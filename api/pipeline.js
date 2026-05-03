// Single endpoint: creates tables if needed, collects RSS, extracts signals via Claude Haiku.
// Triggered by Vercel Cron (daily) or manually via GET /api/pipeline
import { sql } from '@vercel/postgres';

const FEEDS = [
  { name: 'Reuters',      url: 'https://feeds.reuters.com/reuters/businessNews' },
  { name: 'MarketWatch',  url: 'https://feeds.marketwatch.com/marketwatch/topstories/' },
  { name: 'CNBC',         url: 'https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=10000664' },
  { name: 'AP Business',  url: 'https://feeds.apnews.com/rss/business' },
  { name: 'Yahoo Finance', url: 'https://finance.yahoo.com/news/rssindex' },
  { name: 'Bloomberg',    url: 'https://feeds.bloomberg.com/markets/news.rss' },
  { name: 'WSJ Markets',  url: 'https://feeds.a.dj.com/rss/RSSMarketsMain.xml' },
  { name: 'Seeking Alpha', url: 'https://seekingalpha.com/feed.xml' },
  { name: "Barron's",     url: 'https://www.barrons.com/xml/rss/3_7551.xml' },
];

const SYSTEM_PROMPT = `You are a financial signal extraction agent. Given news article headlines and summaries, extract trading-relevant signals.

For each article output a JSON object with:
- id: the article's numeric id (as given)
- tickers: array of stock ticker symbols mentioned (uppercase, max 5, e.g. ["AAPL", "MSFT"]). Empty array [] if none clearly mentioned.
- sentiment: "bullish", "bearish", or "neutral" from a short-term trader's perspective
- importance: integer 1-5 (1=noise, 2=minor, 3=notable, 4=significant, 5=market-moving)
- summary: max 100 characters capturing the key trading implication

Return ONLY a valid JSON array. No explanation, no markdown, no code blocks.

Common tickers to recognize: AAPL, MSFT, NVDA, AMZN, GOOGL, GOOG, META, TSLA, BRK.A, BRK.B, UNH, JPM, V, XOM, JNJ, PG, MA, HD, CVX, MRK, ABBV, LLY, BAC, PEP, KO, COST, TMO, AVGO, WMT, DIS, CSCO, MCD, ADBE, CRM, NFLX, AMD, INTC, QCOM, TXN, UNP, RTX, HON, AMGN, LMT, SBUX, SPGI, BLK, GS, MS, WFC, AXP, GE, CAT, DE, BA, F, GM, UBER, PLTR, COIN, SQ, PYPL, SHOP, ZM, SNOW, DDOG, ABNB, RBLX, RIVN, SOFI, AMC, GME, SPY, QQQ, IWM, VIX`;

function parseRSS(xml, sourceName) {
  const items = [];
  const isAtom = xml.includes('<feed');
  if (isAtom) {
    const entryMatches = xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g);
    for (const match of entryMatches) {
      const entry = match[1];
      const title = entry.match(/<title[^>]*>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/s)?.[1]?.trim() || '';
      const link = entry.match(/<link[^>]*href="([^"]+)"/)?.[1] || entry.match(/<link[^>]*>(.*?)<\/link>/s)?.[1]?.trim() || '';
      const published = entry.match(/<published>(.*?)<\/published>/)?.[1] || entry.match(/<updated>(.*?)<\/updated>/)?.[1] || '';
      const summary = entry.match(/<summary[^>]*>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/summary>/s)?.[1]?.replace(/<[^>]+>/g, '').trim().slice(0, 400) || '';
      if (title && link) items.push({ title, url: link, publishedAt: published, summary, source: sourceName });
    }
  } else {
    const itemMatches = xml.matchAll(/<item>([\s\S]*?)<\/item>/g);
    for (const match of itemMatches) {
      const item = match[1];
      const title = item.match(/<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/s)?.[1]?.trim() || '';
      const link = item.match(/<link>(.*?)<\/link>/s)?.[1]?.trim() || item.match(/<guid[^>]*isPermaLink="true"[^>]*>(.*?)<\/guid>/s)?.[1]?.trim() || '';
      const published = item.match(/<pubDate>(.*?)<\/pubDate>/)?.[1] || '';
      const summary = item.match(/<description>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/description>/s)?.[1]?.replace(/<[^>]+>/g, '').trim().slice(0, 400) || '';
      if (title && link) items.push({ title, url: link, publishedAt: published, summary, source: sourceName });
    }
  }
  return items;
}

async function ensureTables() {
  await sql`
    CREATE TABLE IF NOT EXISTS raw_posts (
      id           SERIAL PRIMARY KEY,
      source       VARCHAR(100) NOT NULL,
      external_id  VARCHAR(1000) UNIQUE NOT NULL,
      title        TEXT NOT NULL,
      content      TEXT,
      url          TEXT,
      published_at TIMESTAMPTZ,
      collected_at TIMESTAMPTZ DEFAULT NOW(),
      processed    BOOLEAN DEFAULT FALSE
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS signals (
      id           SERIAL PRIMARY KEY,
      raw_post_id  INTEGER REFERENCES raw_posts(id),
      tickers      TEXT[],
      sentiment    VARCHAR(10) CHECK (sentiment IN ('bullish', 'bearish', 'neutral')),
      importance   SMALLINT CHECK (importance BETWEEN 1 AND 5),
      summary      TEXT,
      source       VARCHAR(100),
      url          TEXT,
      title        TEXT,
      published_at TIMESTAMPTZ,
      created_at   TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS signals_tickers_idx ON signals USING GIN(tickers)`;
  await sql`CREATE INDEX IF NOT EXISTS signals_created_idx ON signals(created_at DESC)`;
}

async function collectRSS() {
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
    if (results[i].status === 'fulfilled') allItems = allItems.concat(results[i].value);
    else feedErrors.push({ feed: FEEDS[i].name, error: results[i].reason?.message });
  }

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
          ${item.source}, ${item.url}, ${item.title}, ${item.summary || null}, ${item.url},
          ${item.publishedAt ? new Date(item.publishedAt).toISOString() : null}
        )
        ON CONFLICT (external_id) DO NOTHING
      `;
      if (result.rowCount > 0) inserted++;
    } catch (_) {}
  }

  return { fetched: unique.length, inserted, feedErrors };
}

async function extractSignals() {
  const { rows: posts } = await sql`
    SELECT id, title, content, source, url, published_at
    FROM raw_posts WHERE processed = FALSE
    ORDER BY collected_at ASC LIMIT 20
  `;
  if (posts.length === 0) return { processed: 0, inserted: 0 };

  const batchInput = posts.map(p => ({ id: p.id, title: p.title, summary: (p.content || '').slice(0, 200) }));

  const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'anthropic-beta': 'prompt-caching-2024-07-31',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4096,
      system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: `Extract signals from these ${posts.length} articles:\n${JSON.stringify(batchInput)}` }],
    }),
  });

  if (!claudeRes.ok) {
    const err = await claudeRes.text();
    throw new Error(`Anthropic API error: ${err.slice(0, 200)}`);
  }

  const claudeData = await claudeRes.json();
  let signals;
  try {
    signals = JSON.parse(claudeData.content?.[0]?.text || '[]');
  } catch {
    throw new Error('Failed to parse Claude response');
  }

  let inserted = 0;
  for (const signal of signals) {
    const post = posts.find(p => p.id === signal.id);
    if (!post) continue;
    const tickers = Array.isArray(signal.tickers) ? signal.tickers : [];
    const tickersLiteral = `{${tickers.map(t => `"${t.replace(/"/g, '')}"`).join(',')}}`;
    const sentiment = ['bullish', 'bearish', 'neutral'].includes(signal.sentiment) ? signal.sentiment : 'neutral';
    const importance = Math.min(5, Math.max(1, parseInt(signal.importance) || 3));
    try {
      await sql`
        INSERT INTO signals (raw_post_id, tickers, sentiment, importance, summary, source, url, title, published_at)
        VALUES (
          ${post.id}, ${tickersLiteral}::text[], ${sentiment}, ${importance},
          ${(signal.summary || post.title).slice(0, 200)},
          ${post.source}, ${post.url}, ${post.title}, ${post.published_at}
        )
      `;
      inserted++;
    } catch (_) {}
  }

  for (const post of posts) {
    await sql`UPDATE raw_posts SET processed = TRUE WHERE id = ${post.id}`;
  }

  return { processed: posts.length, inserted, cacheUsage: claudeData.usage };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const authHeader = req.headers['authorization'];
  const isVercelCron = req.headers['x-vercel-cron'] === '1';
  if (process.env.CRON_SECRET && !isVercelCron && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY env var not set' });
  }

  try {
    await ensureTables();
    const collectStats = await collectRSS();
    const extractStats = await extractSignals();
    res.status(200).json({ ok: true, collect: collectStats, extract: extractStats });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
