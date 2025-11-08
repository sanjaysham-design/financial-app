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
    const text = await response.text();
    
    // Check if response is valid JSON
    let data;
    try {
      data = JSON.parse(text);
    } catch (parseError) {
      console.error('Finnhub response:', text);
      return res.status(500).json({ 
        error: 'Invalid response from Finnhub API',
        details: text.substring(0, 100)
      });
    }
    
    // Check for API errors
    if (data.error) {
      return res.status(400).json({ 
        error: 'Finnhub API error',
        details: data.error
      });
    }
    
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to fetch sentiment data',
      details: error.message
    });
  }
}