export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { ticker } = req.query;
  if (!ticker) return res.status(400).json({ error: 'Missing ticker' });

  const apikey = process.env.DEFAULT_FINNHUB_KEY;
  if (!apikey) return res.status(500).json({ error: 'Finnhub API key not configured' });

  try {
    const response = await fetch(
      `https://finnhub.io/api/v1/quote?symbol=${ticker}&token=${apikey}`
    );
    const data = await response.json();

    // Return in a format compatible with existing code
    return res.status(200).json({
      'Global Quote': {
        '05. price': data.c?.toString() || '0',
        '09. change': (data.c - data.pc)?.toFixed(2) || '0',
        '10. change percent': (((data.c - data.pc) / data.pc) * 100)?.toFixed(2) + '%' || '0%',
      }
    });

  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch quote data' });
  }
}