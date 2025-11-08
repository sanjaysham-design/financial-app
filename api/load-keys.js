import { Redis } from '@upstash/redis';

const redis = Redis.fromEnv();

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { userId } = req.query;
  
  if (!userId) {
    return res.status(400).json({ error: 'User ID required' });
  }

try {
  const keys = await redis.get(`user:${userId}:keys`);

  if (!keys) {
    return res.status(200).json({ 
      alphaVantage: '', 
      finnhub: '', 
      newsApi: '' 
    });
  }

  res.status(200).json(keys);

  } catch (error) {
    console.error('Load keys error:', error);
    res.status(500).json({ error: 'Failed to load keys', details: error.message });
  }
}