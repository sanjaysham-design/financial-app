import { sql } from '@vercel/postgres';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { ticker, limit = '50', minImportance = '1' } = req.query;
  const parsedLimit = Math.min(100, Math.max(1, parseInt(limit) || 50));
  const parsedMinImportance = Math.min(5, Math.max(1, parseInt(minImportance) || 1));

  try {
    let rows;
    if (ticker) {
      const t = ticker.toUpperCase().trim();
      ({ rows } = await sql`
        SELECT id, tickers, sentiment, importance, summary, source, url, title, published_at, created_at
        FROM signals
        WHERE ${t} = ANY(tickers)
          AND importance >= ${parsedMinImportance}
        ORDER BY created_at DESC
        LIMIT ${parsedLimit}
      `);
    } else {
      ({ rows } = await sql`
        SELECT id, tickers, sentiment, importance, summary, source, url, title, published_at, created_at
        FROM signals
        WHERE importance >= ${parsedMinImportance}
        ORDER BY created_at DESC
        LIMIT ${parsedLimit}
      `);
    }

    res.status(200).json({ signals: rows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
