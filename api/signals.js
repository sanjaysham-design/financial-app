import { Redis } from '@upstash/redis';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (!process.env.UPSTASH_REDIS_REST_URL) return res.status(500).json({ error: 'UPSTASH_REDIS_REST_URL not set' });
  if (!process.env.UPSTASH_REDIS_REST_TOKEN) return res.status(500).json({ error: 'UPSTASH_REDIS_REST_TOKEN not set' });

  const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });

  const { ticker, limit = '50', minImportance = '1' } = req.query;
  const parsedLimit = Math.min(200, Math.max(1, parseInt(limit) || 50));
  const parsedMin = Math.min(5, Math.max(1, parseInt(minImportance) || 1));

  try {
    const raw = await redis.lrange('signals', 0, 499);
    let signals = raw.map(r => typeof r === 'string' ? JSON.parse(r) : r);

    if (ticker) {
      const t = ticker.toUpperCase().trim();
      signals = signals.filter(s => s.tickers?.includes(t));
    }
    if (parsedMin > 1) {
      signals = signals.filter(s => (s.importance || 1) >= parsedMin);
    }

    res.status(200).json({ signals: signals.slice(0, parsedLimit) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
