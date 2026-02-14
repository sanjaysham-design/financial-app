export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { ticker } = req.query;
  if (!ticker) return res.status(400).json({ error: 'Ticker is required' });

  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=6mo`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Accept': 'application/json',
      }
    });

    if (!response.ok) throw new Error(`Yahoo Finance error: ${response.status}`);

    const data = await response.json();
    const result = data.chart.result[0];
    const timestamps = result.timestamp;
    const closes = result.indicators.quote[0].close;
    const meta = result.meta;

    const chartData = timestamps.map((ts, i) => ({
      date: new Date(ts * 1000).toISOString().split('T')[0],
      price: closes[i] ? parseFloat(closes[i].toFixed(2)) : null,
    })).filter(d => d.price !== null);

    const prices = chartData.map(d => d.price);
    const currentPrice = meta.regularMarketPrice || prices[prices.length - 1];
    const companyName = meta.longName || meta.shortName || ticker;

    // Support & Resistance
    const sorted = [...prices].sort((a, b) => a - b);
    const len = sorted.length;
    const supportLevels = [
      parseFloat(sorted[Math.floor(len * 0.1)].toFixed(2)),
      parseFloat(sorted[Math.floor(len * 0.2)].toFixed(2)),
    ];
    const resistanceLevels = [
      parseFloat(sorted[Math.floor(len * 0.8)].toFixed(2)),
      parseFloat(sorted[Math.floor(len * 0.9)].toFixed(2)),
    ];

    const recentPrices = prices.slice(-20);
    const recentAvg = recentPrices.reduce((a, b) => a + b, 0) / recentPrices.length;
    const trend = currentPrice > recentAvg ? 'Bullish' : 'Bearish';

    const srBand = {
      support: parseFloat(Math.min(...prices.slice(-30)).toFixed(2)),
      resistance: parseFloat(Math.max(...prices.slice(-30)).toFixed(2)),
    };

    function identifyPattern(prices) {
      const last = prices.slice(-10);
      const first5Avg = last.slice(0, 5).reduce((a, b) => a + b, 0) / 5;
      const last5Avg = last.slice(5).reduce((a, b) => a + b, 0) / 5;
      if (last5Avg > first5Avg * 1.02) return 'Ascending Channel';
      if (last5Avg < first5Avg * 0.98) return 'Descending Channel';
      return 'Consolidation / Range-Bound';
    }

    return res.status(200).json({
      ticker: ticker.toUpperCase(),
      companyName,
      chartData,
      currentPrice: parseFloat(currentPrice.toFixed(2)),
      trend,
      analysis: {
        supports: supportLevels,
        resistances: resistanceLevels,
        pattern: identifyPattern(prices),
      },
      srBand,
    });

  } catch (error) {
    console.error('Chart data error:', error);
    return res.status(500).json({ error: error.message });
  }
}