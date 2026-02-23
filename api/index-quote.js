export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { ticker } = req.query;
  if (!ticker) return res.status(400).json({ error: 'Missing ticker' });

  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=5d`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Accept': 'application/json',
      }
    });

    if (!response.ok) throw new Error(`Yahoo Finance error: ${response.status}`);

    const data = await response.json();
    const meta = data.chart.result[0].meta;

    const price = meta.regularMarketPrice;
    const change = meta.regularMarketChange;
    const changePercent = meta.regularMarketChangePercent;

    return res.status(200).json({ price, change, changePercent });
  } catch (error) {
    console.error('Index quote error:', error);
    return res.status(500).json({ error: error.message });
  }
}
