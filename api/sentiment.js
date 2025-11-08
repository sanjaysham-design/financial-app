export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { ticker, apikey, type } = req.query;
  
  if (!ticker || !apikey || !type) {
    return res.status(400).json({ error: 'Missing parameters' });
  }
  
  try {
    let url;
    if (type === 'recommendation') {
      url = `https://finnhub.io/api/v1/stock/recommendation?symbol=${ticker}&token=${apikey}`;
    } else {
      url = `https://finnhub.io/api/v1/news-sentiment?symbol=${ticker}&token=${apikey}`;
    }
    
    const response = await fetch(url);
    const data = await response.json();
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch sentiment data' });
  }
}
```
