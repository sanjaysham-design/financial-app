export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  res.status(200).json({
    alphaVantage: process.env.DEFAULT_ALPHA_VANTAGE_KEY || '',
    finnhub: process.env.DEFAULT_FINNHUB_KEY || '',
    newsApi: process.env.DEFAULT_NEWS_API_KEY || ''
  });
}