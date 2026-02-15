export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { ticker } = req.query;
  if (!ticker) return res.status(400).json({ error: 'Missing ticker' });

  const apikey = process.env.DEFAULT_FINNHUB_KEY;
  if (!apikey) return res.status(500).json({ error: 'Finnhub API key not configured' });

  const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

  try {
    const profileRes = await fetch(`https://finnhub.io/api/v1/stock/profile2?symbol=${ticker}&token=${apikey}`);
    const profile = await profileRes.json();
    await delay(300);

    const metricRes = await fetch(`https://finnhub.io/api/v1/stock/metric?symbol=${ticker}&metric=all&token=${apikey}`);
    const metricData = await metricRes.json();

    const m = metricData.metric || {};

    // Calculate RevenueTTM and EBITDA from enterprise value ratios
    const enterpriseValue = m['enterpriseValue'] ? m['enterpriseValue'] * 1e6 : null;
    const revenueTTM = enterpriseValue && m['evRevenueTTM'] ? enterpriseValue / m['evRevenueTTM'] : null;
    const ebitda = enterpriseValue && m['evEbitdaTTM'] ? enterpriseValue / m['evEbitdaTTM'] : null;

    return res.status(200).json({
      Symbol: ticker.toUpperCase(),
      Name: profile.name || ticker,
      MarketCapitalization: m['marketCapitalization'] ? m['marketCapitalization'] * 1e6 : null,
      PERatio: m['peBasicExclExtraTTM'] || m['peTTM'] || null,
      PEGRatio: m['pegTTM'] || null,
      PriceToBookRatio: m['pbQuarterly'] || m['pbAnnual'] || null,
      PriceToSalesRatioTTM: m['psTTM'] || null,
      EPS: m['epsBasicExclExtraItemsTTM'] || m['epsTTM'] || null,
      QuarterlyEarningsGrowthYOY: m['epsGrowthQuarterlyYoy'] != null ? m['epsGrowthQuarterlyYoy'] / 100 : null,
      ProfitMargin: m['netProfitMarginTTM'] != null ? m['netProfitMarginTTM'] / 100 : null,
      EBITDA: ebitda,
      RevenueTTM: revenueTTM,
      DebtToEquity: m['totalDebt/totalEquityAnnual'] != null ? m['totalDebt/totalEquityAnnual'] / 100 : null,
    });

  } catch (error) {
    console.error('stock-overview error:', error);
    return res.status(500).json({ error: error.message });
  }
}