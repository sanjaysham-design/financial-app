export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { ticker } = req.query;
  if (!ticker) return res.status(400).json({ error: 'Missing ticker' });

  const apikey = process.env.FMP_API_KEY;
  console.log('FMP key present:', !!apikey, 'ticker:', ticker);

  if (!apikey) return res.status(500).json({ error: 'FMP API key not configured' });

  try {
    const [profileRes, ratiosRes, incomeRes] = await Promise.all([
      fetch(`https://financialmodelingprep.com/api/v3/profile/${ticker}?apikey=${apikey}`),
      fetch(`https://financialmodelingprep.com/api/v3/ratios-ttm/${ticker}?apikey=${apikey}`),
      fetch(`https://financialmodelingprep.com/api/v3/income-statement/${ticker}?limit=2&apikey=${apikey}`)
    ]);

    const [profile, ratios, income] = await Promise.all([
      profileRes.json(),
      ratiosRes.json(),
      incomeRes.json()
    ]);

    const p = profile[0] || {};
    const r = ratios[0] || {};
    const i0 = income[0] || {};
    const i1 = income[1] || {};

    const epsGrowth = i0.eps && i1.eps && i1.eps !== 0
      ? (i0.eps - i1.eps) / Math.abs(i1.eps)
      : null;

    return res.status(200).json({
      Symbol: ticker.toUpperCase(),
      Name: p.companyName || ticker,
      MarketCapitalization: p.mktCap || null,
      PERatio: r.peRatioTTM || null,
      PEGRatio: r.pegRatioTTM || null,
      PriceToBookRatio: r.priceToBookRatioTTM || null,
      PriceToSalesRatioTTM: r.priceToSalesRatioTTM || null,
      EPS: p.eps || null,
      QuarterlyEarningsGrowthYOY: epsGrowth,
      ProfitMargin: r.netProfitMarginTTM || null,
      EBITDA: i0.ebitda || null,
      RevenueTTM: i0.revenue || null,
      DebtToEquity: r.debtEquityRatioTTM || null,
    });

  } catch (error) {
    console.error('stock-overview error:', error);
    return res.status(500).json({ error: error.message });
  }
}