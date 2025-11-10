const sectors = [
  {
    id: 'technology',
    name: 'Technology',
    perf: { '1w': 2.8, '1m': 7.4, '3m': 15.2 },
    drivers: 'Strong earnings from megacap software and AI-related demand, secular cloud migration, and continued capex in AI infrastructure.'
  },
  {
    id: 'energy',
    name: 'Energy',
    perf: { '1w': -1.2, '1m': 3.5, '3m': 6.1 },
    drivers: 'Oil price volatility, improving demand in some regions, but supply concerns and renewable transition create mixed longer-term outlook.'
  },
  {
    id: 'healthcare',
    name: 'Healthcare',
    perf: { '1w': 0.6, '1m': 1.8, '3m': 4.0 },
    drivers: 'Defensive sector with steady M&A activity, drug approvals and aging demographics supporting long-term demand.'
  },
  {
    id: 'financials',
    name: 'Financials',
    perf: { '1w': 1.1, '1m': 4.9, '3m': 9.0 },
    drivers: 'Higher rates have helped net interest margins; economic growth and loan demand will determine next leg of performance.'
  },
  {
    id: 'consumer',
    name: 'Consumer Discretionary',
    perf: { '1w': 3.2, '1m': 5.9, '3m': 8.6 },
    drivers: 'Strong consumer spending on services and resilient retail sales, but sensitive to rates and income trends.'
  },
  {
    id: 'industrials',
    name: 'Industrials',
    perf: { '1w': 0.3, '1m': 2.0, '3m': 5.5 },
    drivers: 'Gradual recovery in manufacturing and global trade headwinds; infrastructure spending is a tailwind.'
  },
  {
    id: 'utilities',
    name: 'Utilities',
    perf: { '1w': -0.5, '1m': -0.8, '3m': -1.5 },
    drivers: 'Defensive yield plays that lag in risk-on environments; interest rate moves remain a key risk.'
  },
  {
    id: 'materials',
    name: 'Materials',
    perf: { '1w': 1.4, '1m': 3.1, '3m': 6.3 },
    drivers: 'Cyclical exposure to commodity cycles and industrial activity; tied to China demand and supply constraints.'
  },
  {
    id: 'realestate',
    name: 'Real Estate',
    perf: { '1w': 0.9, '1m': 2.2, '3m': 3.8 },
    drivers: 'Rising yields pressure some REIT valuations, but selective demand for logistics and data center assets persists.'
  },
  {
    id: 'communication',
    name: 'Communication Services',
    perf: { '1w': 1.8, '1m': 4.0, '3m': 7.2 },
    drivers: 'Ad recovery and streaming monetization improving, with platform ad growth and engagement as drivers.'
  }
];

export default sectors;
