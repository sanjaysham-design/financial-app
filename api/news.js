export default async function handler(req, res) {
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { q } = req.query;
  const apikey = process.env.DEFAULT_NEWS_API_KEY;

  if (!apikey) {
    return res.status(500).json({ error: 'News API key not configured' });
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