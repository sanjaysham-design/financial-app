import { Redis } from '@upstash/redis';

const redis = Redis.fromEnv();

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { userId, alphaVantage, finnhub, newsApi } = req.body;
    
    if (!userId) {
      return res.status(400).json({ error: 'User ID required' });
    }

    await redis.set(`user:${userId}:keys`, {
      alphaVantage,
      finnhub,
      newsApi
    });

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Save keys error:', error);
    res.status(500).json({ error: 'Failed to save keys', details: error.message });
  }
}