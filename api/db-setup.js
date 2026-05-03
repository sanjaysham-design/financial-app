// Run once via: POST /api/db-setup?secret=YOUR_SETUP_SECRET
// Requires POSTGRES_URL env var (set automatically by Vercel Postgres integration)
import { sql } from '@vercel/postgres';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { secret } = req.query;
  if (!process.env.SETUP_SECRET || secret !== process.env.SETUP_SECRET) {
    return res.status(401).json({ error: 'Invalid secret' });
  }

  try {
    await sql`
      CREATE TABLE IF NOT EXISTS raw_posts (
        id          SERIAL PRIMARY KEY,
        source      VARCHAR(100) NOT NULL,
        external_id VARCHAR(1000) UNIQUE NOT NULL,
        title       TEXT NOT NULL,
        content     TEXT,
        url         TEXT,
        published_at TIMESTAMPTZ,
        collected_at TIMESTAMPTZ DEFAULT NOW(),
        processed   BOOLEAN DEFAULT FALSE
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
    await sql`CREATE INDEX IF NOT EXISTS raw_posts_processed_idx ON raw_posts(processed) WHERE processed = FALSE`;

    res.status(200).json({ ok: true, message: 'Tables created successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
