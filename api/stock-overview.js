export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { ticker } = req.query;
  if (!ticker) return res.status(400).json({ error: 'Missing ticker' });

  const apikey = process.env.DEFAULT_FINNHUB_KEY;

  try {
    const metricRes = await fetch(
      `https://finnhub.io/api/v1/stock/metric?symbol=${ticker}&metric=all&token=${apikey}`
    );
    const text = await metricRes.text();
    return res.status(200).json({ raw: text.slice(0, 2000) });

  } catch (error) {
    return res.status(200).json({ error: error.message });
  }
}