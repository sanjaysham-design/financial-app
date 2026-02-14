export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { ticker } = req.query;
  if (!ticker) return res.status(400).json({ error: 'Missing ticker' });

  try {
    const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${ticker}?modules=summaryDetail,defaultKeyStatistics,financialData,price,incomeStatementHistory`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Accept': 'application/json',
      }
    });

    if (!response.ok) throw new Error(`Yahoo Finance error: ${response.status}`);

    const data = await response.json();
    const result = data.quoteSummary.result[0];

    const price = result.price || {};
    const summary = result.summaryDetail || {};
    const keyStats = result.defaultKeyStatistics || {};
    const financialData = result.financialData || {};

    const raw = (obj, key) => obj?.[key]?.raw ?? null;
    const fmt = (obj, key) => obj?.[key]?.fmt ?? null;

    return res.status(200).json({
      Symbol: ticker.toUpperCase(),
      Name: price.longName || price.shortName || ticker,
      MarketCapitalization: raw(price, 'marketCap'),
      PERatio: raw(summary, 'trailingPE'),
      PEGRatio: raw(keyStats, 'pegRatio'),
      PriceToBookRatio: raw(keyStats, 'priceToBook'),
      PriceToSalesRatioTTM: raw(summary, 'priceToSalesTrailing12Months'),
      EPS: raw(keyStats, 'trailingEps'),
      QuarterlyEarningsGrowthYOY: raw(keyStats, 'earningsQuarterlyGrowth'),
      ProfitMargin: raw(financialData, 'profitMargins'),
      EBITDA: raw(financialData, 'ebitda'),
      RevenueTTM: raw(financialData, 'totalRevenue'),
      DebtToEquity: raw(financialData, 'debtToEquity') != null
        ? raw(financialData, 'debtToEquity') / 100
        : null,
    });

  } catch (error) {
    console.error('stock-overview error:', error);
    return res.status(500).json({ error: error.message });
  }
}