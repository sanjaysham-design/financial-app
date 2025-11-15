export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { apikey, q } = req.query;
  
  if (!apikey) {
    return res.status(400).json({ error: 'Missing apikey' });
  }
  
  try {
    const base = `https://newsapi.org/v2/top-headlines?category=business&country=us&pageSize=10&apiKey=${apikey}`;
    const url = q ? `${base}&q=${encodeURIComponent(q)}` : base;
    const response = await fetch(url);
    
    const data = await response.json();
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch news' });
  }
}