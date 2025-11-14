export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { apikey } = req.query;
  
  if (!apikey) {
    return res.status(400).json({ error: 'Missing apikey' });
  }
  
  try {
    const response = await fetch(
      `https://newsapi.org/v2/everything?q=stock OR market OR finance OR economy OR trading OR wall street&sources=cnbc,bloomberg,the-wall-street-journal&language=en&sortBy=publishedAt&pageSize=20&apiKey=${apikey}`
    );
    
    const data = await response.json();
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch news' });
  }
}