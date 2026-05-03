import { sql } from '@vercel/postgres';
import { parseRSS } from '../lib/parseRSS.js';

const FEEDS = [
  { name: 'Reuters',     url: 'https://feeds.reuters.com/reuters/businessNews' },
  { name: 'MarketWatch', url: 'https://feeds.marketwatch.com/marketwatch/topstories/' },
  { name: 'CNBC',        url: 'https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=10000664' },
  { name: 'AP Business', url: 'https://feeds.apnews.com/rss/business' },
  { name: 'Yahoo Finance', url: 'https://finance.yahoo.com/news/rssindex' },
  { name: 'Bloomberg',   url: 'https://feeds.bloomberg.com/markets/news.rss' },
  { name: 'WSJ Markets', url: 'https://feeds.a.dj.com/rss/RSSMarketsMain.xml' },
  { name: 'Seeking Alpha', url: 'https://seekingalpha.com/feed.xml' },
  { name: "Barron's",    url: 'https://www.barrons.com/xml/rss/3_7551.xml' },
];

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // Vercel sends this header on cron invocations; require CRON_SECRET otherwise
  const authHeader = req.headers['authorization'];
  const isVercelCron = req.headers['x-vercel-cron'] === '1';
  if (process.env.CRON_SECRET && !isVercelCron && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const results = await Promise.allSettled(
      FEEDS.map(async (feed) => {
        const response = await fetch(feed.url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; FinancialSignalBot/1.0)',
            'Accept': 'application/rss+xml, application/xml, text/xml',
          },
          signal: AbortSignal.timeout(6000),
        });
        if (!response.ok) throw new Error(`${feed.name}: HTTP ${response.status}`);
        const xml = await response.text();
        return parseRSS(xml, feed.name);
      })
    );

    let allItems = [];
    const feedErrors = [];
    for (let i = 0; i < results.length; i++) {
      if (results[i].status === 'fulfilled') {
        allItems = allItems.concat(results[i].value);
      } else {
        feedErrors.push({ feed: FEEDS[i].name, error: results[i].reason?.message });
      }
    }

    // Deduplicate by URL within this batch
    const seen = new Set();
    const unique = allItems.filter(item => {
      if (!item.url || seen.has(item.url)) return false;
      seen.add(item.url);
      return true;
    });

    let inserted = 0;
    for (const item of unique) {
      try {
        const result = await sql`
          INSERT INTO raw_posts (source, external_id, title, content, url, published_at)
          VALUES (
            ${item.source},
            ${item.url},
            ${item.title},
            ${item.summary || null},
            ${item.url},
            ${item.publishedAt ? new Date(item.publishedAt).toISOString() : null}
          )
          ON CONFLICT (external_id) DO NOTHING
        `;
        if (result.rowCount > 0) inserted++;
      } catch (_) {
        // Skip individual insert errors (malformed dates, etc.)
      }
    }

    res.status(200).json({ ok: true, fetched: unique.length, inserted, feedErrors });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
