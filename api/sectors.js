export default async function handler(req, res) {

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const apikey = process.env.DEFAULT_ALPHA_VANTAGE_KEY;
  if (!apikey) {
    return res.status(500).json({ error: 'Alpha Vantage API key not configured' });
  }

  try {
    const response = await fetch(`https://www.alphavantage.co/query?function=SECTOR&apikey=${apikey}`);
    const data = await response.json();
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch sector data' });
  }
}
