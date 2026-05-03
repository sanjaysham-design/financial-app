import { Redis } from '@upstash/redis';

const FEEDS = [
  { name: 'Reuters',       url: 'https://feeds.reuters.com/reuters/businessNews' },
  { name: 'MarketWatch',   url: 'https://feeds.marketwatch.com/marketwatch/topstories/' },
  { name: 'CNBC',          url: 'https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=10000664' },
  { name: 'AP Business',   url: 'https://feeds.apnews.com/rss/business' },
  { name: 'Yahoo Finance',  url: 'https://finance.yahoo.com/news/rssindex' },
  { name: 'Bloomberg',     url: 'https://feeds.bloomberg.com/markets/news.rss' },
  { name: 'WSJ Markets',   url: 'https://feeds.a.dj.com/rss/RSSMarketsMain.xml' },
  { name: 'Seeking Alpha', url: 'https://seekingalpha.com/feed.xml' },
  { name: "Barron's",      url: 'https://www.barrons.com/xml/rss/3_7551.xml' },
];

const SYSTEM_PROMPT = `You are a financial signal extraction agent. Given news article headlines and summaries, extract trading-relevant signals.

For each article output a JSON object with:
- id: the article's numeric id (as given)
- tickers: array of stock ticker symbols mentioned (uppercase, max 5). Empty array [] if none clearly mentioned.
- sentiment: "bullish", "bearish", or "neutral" from a short-term trader's perspective
- importance: integer 1-5 (1=noise, 2=minor, 3=notable, 4=significant, 5=market-moving)
- summary: max 100 characters capturing the key trading implication

Return ONLY a valid JSON array. No explanation, no markdown, no code blocks.

Common tickers: AAPL, MSFT, NVDA, AMZN, GOOGL, GOOG, META, TSLA, JPM, V, XOM, JNJ, PG, MA, HD, CVX, MRK, ABBV, LLY, BAC, PEP, KO, COST, AVGO, WMT, DIS, CSCO, MCD, ADBE, CRM, NFLX, AMD, INTC, QCOM, TXN, GS, MS, WFC, AXP, GE, CAT, DE, BA, F, GM, UBER, PLTR, COIN, PYPL, SHOP, SNOW, DDOG, ABNB, AMC, GME, SPY, QQQ, IWM`;

function parseRSS(xml, sourceName) {
  const items = [];
  const isAtom = xml.includes('<feed');
  if (isAtom) {
    for (const match of xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)) {
      const e = match[1];
      const title = e.match(/<title[^>]*>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/s)?.[1]?.trim() || '';
      const link = e.match(/<link[^>]*href="([^"]+)"/)?.[1] || e.match(/<link[^>]*>(.*?)<\/link>/s)?.[1]?.trim() || '';
      const published = e.match(/<published>(.*?)<\/published>/)?.[1] || e.match(/<updated>(.*?)<\/updated>/)?.[1] || '';
      const summary = e.match(/<summary[^>]*>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/summary>/s)?.[1]?.replace(/<[^>]+>/g, '').trim().slice(0, 300) || '';
      if (title && link) items.push({ title, url: link, publishedAt: published, summary, source: sourceName });
    }
  } else {
    for (const match of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
      const item = match[1];
      const title = item.match(/<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/s)?.[1]?.trim() || '';
      const link = item.match(/<link>(.*?)<\/link>/s)?.[1]?.trim() || item.match(/<guid[^>]*isPermaLink="true"[^>]*>(.*?)<\/guid>/s)?.[1]?.trim() || '';
      const published = item.match(/<pubDate>(.*?)<\/pubDate>/)?.[1] || '';
      const summary = item.match(/<description>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/description>/s)?.[1]?.replace(/<[^>]+>/g, '').trim().slice(0, 300) || '';
      if (title && link) items.push({ title, url: link, publishedAt: published, summary, source: sourceName });
    }
  }
  return items;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const isVercelCron = req.headers['x-vercel-cron'] === '1';
  const authHeader = req.headers['authorization'];
  if (process.env.CRON_SECRET && !isVercelCron && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!process.env.ANTHROPIC_API_KEY) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not set' });
  if (!process.env.UPSTASH_REDIS_REST_URL) return res.status(500).json({ error: 'UPSTASH_REDIS_REST_URL not set' });
  if (!process.env.UPSTASH_REDIS_REST_TOKEN) return res.status(500).json({ error: 'UPSTASH_REDIS_REST_TOKEN not set' });

  const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });

  try {
    // 1. Collect RSS feeds
    const feedResults = await Promise.allSettled(
      FEEDS.map(async (feed) => {
        const r = await fetch(feed.url, {
          headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/rss+xml, application/xml, text/xml' },
          signal: AbortSignal.timeout(6000),
        });
        if (!r.ok) throw new Error(`${feed.name}: HTTP ${r.status}`);
        return parseRSS(await r.text(), feed.name);
      })
    );

    let allItems = [];
    const feedErrors = [];
    for (let i = 0; i < feedResults.length; i++) {
      if (feedResults[i].status === 'fulfilled') allItems = allItems.concat(feedResults[i].value);
      else feedErrors.push({ feed: FEEDS[i].name, error: feedResults[i].reason?.message });
    }

    // 2. Deduplicate against Redis seen-URLs set
    const seenChecks = await Promise.all(allItems.map(item => redis.sismember('signal_seen_urls', item.url)));
    const newItems = allItems.filter((_, i) => !seenChecks[i]);

    if (newItems.length === 0) {
      return res.status(200).json({ ok: true, fetched: allItems.length, newItems: 0, extracted: 0, feedErrors });
    }

    // 3. Extract signals with Claude Haiku
    const batchInput = newItems.slice(0, 25).map((p, i) => ({ id: i, title: p.title, summary: p.summary.slice(0, 200) }));

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
        messages: [{ role: 'user', content: `Extract signals from these ${batchInput.length} articles:\n${JSON.stringify(batchInput)}` }],
      }),
    });

    if (!claudeRes.ok) {
      const err = await claudeRes.text();
      return res.status(500).json({ error: `Anthropic API error: ${err.slice(0, 200)}` });
    }

    const claudeData = await claudeRes.json();
    let signals;
    try {
      signals = JSON.parse(claudeData.content?.[0]?.text || '[]');
    } catch {
      return res.status(500).json({ error: 'Failed to parse Claude response' });
    }

    // 4. Store signals in Redis and mark URLs as seen
    const now = new Date().toISOString();
    let stored = 0;
    for (const signal of signals) {
      const item = newItems[signal.id];
      if (!item) continue;
      const record = {
        tickers: Array.isArray(signal.tickers) ? signal.tickers : [],
        sentiment: ['bullish', 'bearish', 'neutral'].includes(signal.sentiment) ? signal.sentiment : 'neutral',
        importance: Math.min(5, Math.max(1, parseInt(signal.importance) || 3)),
        summary: (signal.summary || item.title).slice(0, 200),
        title: item.title,
        url: item.url,
        source: item.source,
        publishedAt: item.publishedAt,
        collectedAt: now,
      };
      await redis.lpush('signals', JSON.stringify(record));
      await redis.sadd('signal_seen_urls', item.url);
      stored++;
    }

    // Keep only the latest 500 signals
    await redis.ltrim('signals', 0, 499);

    res.status(200).json({ ok: true, fetched: allItems.length, newItems: newItems.length, extracted: stored, feedErrors });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
