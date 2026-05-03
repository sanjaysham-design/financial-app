import { sql } from '@vercel/postgres';

// Cached: only charged on first call per 5-min TTL window
const SYSTEM_PROMPT = `You are a financial signal extraction agent. Given news article headlines and summaries, extract trading-relevant signals.

For each article output a JSON object with:
- id: the article's numeric id (as given)
- tickers: array of stock ticker symbols mentioned (uppercase, max 5, e.g. ["AAPL", "MSFT"]). Empty array [] if none clearly mentioned.
- sentiment: "bullish", "bearish", or "neutral" from a short-term trader's perspective
- importance: integer 1-5 (1=noise, 2=minor, 3=notable, 4=significant, 5=market-moving)
- summary: max 100 characters capturing the key trading implication

Return ONLY a valid JSON array. No explanation, no markdown, no code blocks.

Common tickers to recognize: AAPL, MSFT, NVDA, AMZN, GOOGL, GOOG, META, TSLA, BRK.A, BRK.B, UNH, JPM, V, XOM, JNJ, PG, MA, HD, CVX, MRK, ABBV, LLY, BAC, PEP, KO, COST, TMO, AVGO, WMT, DIS, CSCO, MCD, ADBE, CRM, NFLX, AMD, INTC, QCOM, TXN, UNP, RTX, HON, AMGN, LMT, SBUX, SPGI, BLK, GS, MS, WFC, AXP, GE, CAT, DE, BA, F, GM, UBER, PLTR, COIN, SQ, PYPL, SHOP, ZM, SNOW, DDOG, ABNB, RBLX, RIVN, SOFI, AMC, GME, SPY, QQQ, IWM, VIX`;

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
    const { rows: posts } = await sql`
      SELECT id, title, content, source, url, published_at
      FROM raw_posts
      WHERE processed = FALSE
      ORDER BY collected_at ASC
      LIMIT 20
    `;

    if (posts.length === 0) {
      return res.status(200).json({ ok: true, processed: 0 });
    }

    const batchInput = posts.map(p => ({
      id: p.id,
      title: p.title,
      summary: (p.content || '').slice(0, 200),
    }));

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
        system: [
          {
            type: 'text',
            text: SYSTEM_PROMPT,
            cache_control: { type: 'ephemeral' },
          },
        ],
        messages: [
          {
            role: 'user',
            content: `Extract signals from these ${posts.length} articles:\n${JSON.stringify(batchInput)}`,
          },
        ],
      }),
    });

    if (!claudeRes.ok) {
      const errText = await claudeRes.text();
      return res.status(500).json({ error: `Anthropic API error`, details: errText.slice(0, 300) });
    }

    const claudeData = await claudeRes.json();
    const rawText = claudeData.content?.[0]?.text || '[]';

    let signals;
    try {
      signals = JSON.parse(rawText);
    } catch {
      return res.status(500).json({ error: 'Failed to parse Claude response', raw: rawText.slice(0, 300) });
    }

    let inserted = 0;
    for (const signal of signals) {
      const post = posts.find(p => p.id === signal.id);
      if (!post) continue;

      const tickers = Array.isArray(signal.tickers) ? signal.tickers : [];
      const tickersLiteral = `{${tickers.map(t => `"${t.replace(/"/g, '')}"`).join(',')}}`;
      const sentiment = ['bullish', 'bearish', 'neutral'].includes(signal.sentiment) ? signal.sentiment : 'neutral';
      const importance = Math.min(5, Math.max(1, parseInt(signal.importance) || 3));
      const summary = (signal.summary || post.title).slice(0, 200);

      try {
        await sql`
          INSERT INTO signals (raw_post_id, tickers, sentiment, importance, summary, source, url, title, published_at)
          VALUES (
            ${post.id},
            ${tickersLiteral}::text[],
            ${sentiment},
            ${importance},
            ${summary},
            ${post.source},
            ${post.url},
            ${post.title},
            ${post.published_at}
          )
        `;
        inserted++;
      } catch (_) {
        // Skip individual insert errors
      }
    }

    // Mark all fetched posts as processed regardless of insertion outcome
    for (const post of posts) {
      await sql`UPDATE raw_posts SET processed = TRUE WHERE id = ${post.id}`;
    }

    res.status(200).json({
      ok: true,
      processed: posts.length,
      inserted,
      cacheUsage: claudeData.usage,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
