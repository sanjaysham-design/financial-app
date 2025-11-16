import React, { useState, useEffect, useCallback } from 'react';
import './App.css';
import { Newspaper, BarChart3, Target, Search, Loader, Menu, X, Settings } from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  ReferenceArea
} from 'recharts';
import sectorsList from './data/sectors';

// State for manual stock entry
const MAX_STOCKS = 12;

// ETF mapping for each sector (SPDR sector ETFs)
const SECTOR_ETF_MAP = {
  'Technology': 'XLK',
  'Energy': 'XLE',
  'Healthcare': 'XLV', // static dataset name
  'Health Care': 'XLV', // AV naming
  'Financials': 'XLF',
  'Consumer Discretionary': 'XLY',
  'Industrials': 'XLI',
  'Utilities': 'XLU',
  'Materials': 'XLB',
  'Real Estate': 'XLRE',
  'Communication Services': 'XLC'
};

function FinancialApp() {
  // Helper to determine trend
  function getTrend(chartData) {
    if (!chartData || chartData.length < 21) return 'Neutral';
    const latest = chartData[chartData.length - 1].price;
    const prev = chartData[chartData.length - 21].price;
    return latest > prev ? 'Bullish' : 'Bearish';
  }
  // State declarations
  const [activeTab, setActiveTab] = useState('news');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [stockTicker, setStockTicker] = useState('');
  const [apiKeys, setApiKeys] = useState({
    alphaVantage: '',
    finnhub: '',
    newsApi: ''
  });
  // Theme state: 'classic' or 'liquid-glass'  (we rename 'default' -> 'classic')
  // New installs will default to the liquid-glass theme; persisted users keep their saved choice.
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('theme');
    // migrate older stored value 'default' -> 'classic'
    if (saved === 'default') return 'classic';
    return saved || 'liquid-glass';
  });
  const [loading, setLoading] = useState(false);
  const [, setError] = useState('');
  const [newsStories, setNewsStories] = useState([]);
  const [newsLastUpdated, setNewsLastUpdated] = useState(null);
  // Removed unused chartAnalysis and sentimentAnalysis state

    // Technical chart state
    const [technicalData, setTechnicalData] = useState(null);
    const [chartWindow, setChartWindow] = useState(() => {
      const saved = localStorage.getItem('chartWindow');
      return saved ? Number(saved) : 200;
    });
    const [showSR, setShowSR] = useState(() => {
      const saved = localStorage.getItem('showSR');
      return saved !== null ? saved === 'true' : true;
    });

    // Compute trend for chart
    const trend = technicalData ? getTrend(technicalData.chartData) : 'Neutral';

    // Persist chartWindow to localStorage
    useEffect(() => {
      localStorage.setItem('chartWindow', chartWindow);
    }, [chartWindow]);

    // Persist S/R toggle to localStorage
    useEffect(() => {
      localStorage.setItem('showSR', showSR ? 'true' : 'false');
    }, [showSR]);

    // Persist theme selection
    useEffect(() => {
      localStorage.setItem('theme', theme);
    }, [theme]);

    // Helper: calculate moving average
    function calculateMA(data, period) {
      return data.map((_, idx, arr) => {
        if (idx + period > arr.length) return null;
        const slice = arr.slice(idx, idx + period);
        return slice.reduce((sum, v) => sum + v, 0) / period;
      });
    }

    // Helper: find support/resistance pivots
    function findSupportResistance(prices) {
      const pivots = { supports: [], resistances: [] };
      for (let i = 10; i < prices.length - 10; i++) {
        const low = Math.min(...prices.slice(i - 10, i + 10));
        const high = Math.max(...prices.slice(i - 10, i + 10));
        if (prices[i] === low) pivots.supports.push(prices[i].toFixed(2));
        if (prices[i] === high) pivots.resistances.push(prices[i].toFixed(2));
      }
      // Only keep unique and nearest levels
      return {
        supports: Array.from(new Set(pivots.supports)).slice(0, 2),
        resistances: Array.from(new Set(pivots.resistances)).slice(0, 2)
      };
    }

    // Analyze chart data and set technicalData
    const analyzeChartData = useCallback(async () => {
      if (!stockTicker || !apiKeys.alphaVantage) return;
      setLoading(true);
      setError('');
      try {
        // Fetch company name
        const overviewResp = await fetch('/api/stock-overview?ticker=' + stockTicker + '&apikey=' + apiKeys.alphaVantage);
        const overviewData = await overviewResp.json();
        const companyName = overviewData.Name || '';

        let data;
        // Always fetch daily series (we avoid intraday calls to respect rate limits)

        // Default: fetch daily series
        const response = await fetch(`/api/chart-data?ticker=${stockTicker}&apikey=${apiKeys.alphaVantage}&outputsize=full`);
        data = await response.json();
        if (data['Time Series (Daily)']) {
          const timeSeries = data['Time Series (Daily)'];
          const datesDesc = Object.keys(timeSeries);
          const closesDesc = datesDesc.map(date => parseFloat(timeSeries[date]['4. close']));
          // Compute MAs
          const ma50 = calculateMA(closesDesc, 50);
          const ma200 = calculateMA(closesDesc, 200);
          // Find S/R
          const pivots = findSupportResistance(closesDesc);
          // Chart data slice
          const chartData = datesDesc.slice(0, chartWindow).map((date, idx) => ({
            date,
            price: closesDesc[idx],
            ma50: ma50[idx] || null,
            ma200: ma200[idx] || null
          })).reverse();
          // S/R band
          let srBand = null;
          if (pivots.supports.length && pivots.resistances.length) {
            srBand = {
              low: Math.min(...pivots.supports.map(Number)),
              high: Math.max(...pivots.resistances.map(Number))
            };
          }
          setTechnicalData({ 
            chartData, 
            currentPrice: chartData.length > 0 ? chartData[chartData.length - 1].price.toFixed(2) : '0.00',
            companyName: companyName, 
            analysis: pivots, 
            srBand });
        } else {
          setError('Could not fetch data. Check ticker or API limit.');
        }
      } catch (err) {
        setError('Error analyzing chart: ' + err.message);
      } finally {
        setLoading(false);
      }
    }, [stockTicker, apiKeys.alphaVantage, chartWindow]);

    // Auto-refresh chart when chartWindow changes
    useEffect(() => {
      if (stockTicker) analyzeChartData();
    }, [chartWindow, analyzeChartData, stockTicker]);

  // Tabs configuration (UI currently renders specific sections directly)
  // kept for future navigation wiring

  // Helper function to analyze sentiment
  function analyzeSentiment(text) {
    const positive = ['gains', 'surge', 'profit', 'growth', 'strong', 'positive'];
    const negative = ['loss', 'decline', 'fall', 'weak', 'concern', 'risk'];

    const lowerText = (text || '').toLowerCase();
    const posCount = positive.filter(word => lowerText.includes(word)).length;
    const negCount = negative.filter(word => lowerText.includes(word)).length;

    if (posCount > negCount) return 'positive';
    if (negCount > posCount) return 'negative';
    return 'neutral';
  }

  // Helper to determine sector outlook from simple performance signals
  function determineSectorOutlook(perf) {
    // perf expected: { '1w': number, '1m': number, '3m': number }
    const r1w = perf['1w'] ?? 0;
    const r1m = perf['1m'] ?? 0;
    const r3m = perf['3m'] ?? 0;

    // Strong momentum: clear positive 1m and 3m
    if (r1m >= 5 || r3m >= 10) return 'Strong';
    // Early recovery: recent 1w positive after weaker 1m/3m
    if (r1w > 0 && (r1m < 3 || r3m < 5)) return 'Early Recovery';
    // Weak: sustained negative in 1m and 3m
    if (r1m <= -2 && r3m <= -2) return 'Weak';
    return 'Neutral';
  }

  // Diagnostic: log sector list when user opens sectors tab
  useEffect(() => {
    if (activeTab === 'sectors') {
      // eslint-disable-next-line no-console
  console.log('Sector Trends opened, sectorsList length =', sectorsList && sectorsList.length);
    }
  }, [activeTab]);

  // Live sectors state
  const [sectorsLive, setSectorsLive] = useState([]);
  const [sectorsLoading, setSectorsLoading] = useState(false);
  const [sectorsError, setSectorsError] = useState('');
  const [sectorsLastUpdated, setSectorsLastUpdated] = useState(null);

  // Stock screener state
  const [screenerLoading, setScreenerLoading] = useState(false);
  const [screenerError, setScreenerError] = useState('');
  const [screenerLastUpdated, setScreenerLastUpdated] = useState(null);
  const [screenerResults, setScreenerResults] = useState([]);
  const [stockInput, setStockInput] = useState('');
  const [selectedStocks, setSelectedStocks] = useState([]);

  // Market indices state
  const [marketIndices, setMarketIndices] = useState([]);
  const [indicesLoading, setIndicesLoading] = useState(false);

  // Sector ETF quotes state
  const [etfQuotes, setEtfQuotes] = useState({}); // { XLK: { price, change, changePercent } }
  const [etfQuotesLoading, setEtfQuotesLoading] = useState(false);

  // Local: simple component to handle Escape key for mobile nav
  function MobileNavEscapeHandler({ onClose }) {
    useEffect(() => {
      function onKey(e) {
        if (e.key === 'Escape') onClose();
      }
      window.addEventListener('keydown', onKey);
      return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);
    return null;
  }

  // Local: focus trap for the mobile nav panel (basic Tab wrap)
  function MobileNavFocusTrap() {
    useEffect(() => {
      const panel = document.querySelector("aside[role='dialog']");
      if (!panel) return;
      const focusableSelector = "a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])";
      const focusable = Array.from(panel.querySelectorAll(focusableSelector)).filter(el => el.offsetParent !== null);
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const prevActive = document.activeElement;

      if (first && typeof first.focus === 'function') first.focus();

      function onKey(e) {
        if (e.key !== 'Tab') return;
        if (focusable.length === 0) {
          e.preventDefault();
          return;
        }
        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }

      window.addEventListener('keydown', onKey);
      return () => {
        window.removeEventListener('keydown', onKey);
        if (prevActive && typeof prevActive.focus === 'function') prevActive.focus();
      };
    }, []);

    return null;
  }

  // Helper: parse number safely
  const parseNum = useCallback((v) => {
    if (v == null || v === '' ) return null;
    const n = Number(String(v).replace(/,|\$/g, ''));
    return Number.isFinite(n) ? n : null;
  }, []);

  // Helper: format large currency values into abbreviated strings
  // Examples: 4320000000000 -> $4.32T, 4320000000 -> $4.32Bn, 4320000 -> $4.32M
  function formatCurrencyAbbrev(v) {
    const n = parseNum(v);
    if (n == null) return 'N/A';
    const abs = Math.abs(n);
    let value, suffix;
    if (abs >= 1e12) {
      value = n / 1e12;
      suffix = 'T';
    } else if (abs >= 1e9) {
      value = n / 1e9;
      suffix = 'Bn';
    } else if (abs >= 1e6) {
      value = n / 1e6;
      suffix = 'M';
    } else {
      // For smaller numbers show full with commas
      return '$' + n.toLocaleString('en-US');
    }
    // show one or two decimal places depending on size
    const formatted = Math.abs(value) >= 100 ? Math.round(value).toString() : value.toFixed(2);
    return (n < 0 ? '-$' : '$') + formatted + suffix;
  }

  // Score and filter an overview object. Returns null if it fails basic checks.
  const evaluateOverview = useCallback((ov) => {
    if (!ov || !ov.Symbol) return null;
    const pe = parseNum(ov.PERatio) ?? parseNum(ov.TrailingPE) ?? null;
    const peg = parseNum(ov.PEGRatio) ?? null;
    const pb = parseNum(ov.PriceToBookRatio) ?? parseNum(ov.PriceToBookRatioTTM) ?? null;
    const debtToEquity = parseNum(ov.DebtToEquity) ?? parseNum(ov['Debt/Eq']) ?? null;
    const eps = parseNum(ov.EPS) ?? null;
    const qEarningsGrowth = parseNum(ov.QuarterlyEarningsGrowthYOY) ?? null;
    const ebitda = parseNum(ov.EBITDA) ?? null;
    const profitMargin = parseNum(ov.ProfitMargin) ?? null;

    // basic fundamental checks
    const earningsGood = (qEarningsGrowth != null && qEarningsGrowth > 0) || (eps != null && eps > 0);
    const lowDebt = debtToEquity == null ? false : debtToEquity < 1.0;
    const positiveCashProxy = (ebitda != null && ebitda > 0) || (profitMargin != null && profitMargin > 0);

    // undervalued signal
    const undervalued = (pe != null && pe > 0 && pe < 20) || (peg != null && peg > 0 && peg < 1.5) || (pb != null && pb > 0 && pb < 3);

    // score: prefer lower PE/PEG/PB, stronger earnings growth, lower debt
    let score = 0;
    if (pe != null && pe > 0) score += Math.max(0, 20 - pe);
    if (peg != null && peg > 0) score += Math.max(0, 5 - peg * 2);
    if (pb != null && pb > 0) score += Math.max(0, 3 - pb) * 2;
    if (qEarningsGrowth != null) score += Math.min(10, qEarningsGrowth);
    if (debtToEquity != null) score += Math.max(0, 5 - debtToEquity * 2);
    if (positiveCashProxy) score += 5;

    // Add extraction for new metrics
    const marketCap = ov.MarketCapitalization ? Number(ov.MarketCapitalization) : null;
    const revenueTTM = ov.RevenueTTM ? Number(ov.RevenueTTM) : null;
    const priceToSales = parseNum(ov.PriceToSalesRatioTTM) ?? null;

    return {
      symbol: ov.Symbol,
      name: ov.Name || ov['CompanyName'] || '',
      pe, peg, pb, debtToEquity, eps, qEarningsGrowth, ebitda, profitMargin,
      undervalued: !!undervalued,
      earningsGood,
      lowDebt,
      positiveCashProxy,
      score,
      marketCap,
      revenueTTM,
      priceToSales
    };
  }, [parseNum]);

  // Fetch overview for a list of tickers and return evaluated results
  const fetchAndEvaluateList = useCallback(async (tickers) => {
    const key = apiKeys.alphaVantage;
    if (!key) throw new Error('Missing AlphaVantage API key');
    const results = [];
    // fetch in series to be conservative with rate limits
    for (const t of tickers) {
      try {
        // Fetch both overview and quote data
        const [overviewResp, quoteResp] = await Promise.all([
          fetch(`/api/stock-overview?ticker=${t}&apikey=${key}`),
          fetch(`/api/quote?ticker=${t}&apikey=${key}`)
        ]);
        const ov = await overviewResp.json();
        const quoteData = await quoteResp.json();
        
        const evald = evaluateOverview(ov);
        if (evald) {
          // Add quote data to the result
          const quote = quoteData['Global Quote'];
          if (quote) {
            evald.currentPrice = parseFloat(quote['05. price']) || null;
            evald.priceChange = parseFloat(quote['09. change']) || null;
            evald.priceChangePercent = quote['10. change percent'] ? parseFloat(quote['10. change percent'].replace('%', '')) : null;
          }
          results.push(evald);
        }
      } catch (err) {
        // continue on errors
        console.warn('Failed overview for', t, err);
      }
    }
    return results;
  }, [apiKeys.alphaVantage, evaluateOverview]);

  // Add stock to selected list
  const addStock = useCallback(() => {
    const stock = stockInput.trim().toUpperCase();
    if (stock && !selectedStocks.includes(stock) && selectedStocks.length < MAX_STOCKS) {
      setSelectedStocks(prev => [...prev, stock]);
      setStockInput('');
    }
  }, [stockInput, selectedStocks]);

  // Remove stock from selected list
  const removeStock = useCallback((stock) => {
    setSelectedStocks(prev => prev.filter(s => s !== stock));
  }, []);

  // Main screener fetch
  const fetchScreener = useCallback(async () => {
    if (selectedStocks.length === 0) {
      setScreenerError('Please add at least one stock to analyze');
      return;
    }

    setScreenerLoading(true);
    setScreenerError('');
    try {
      const results = await fetchAndEvaluateList(selectedStocks);

      // Sort by score
      results.sort((a, b) => b.score - a.score);
      
      setScreenerResults(results);
      setScreenerLastUpdated(new Date().toISOString());
    } catch (err) {
      setScreenerError('Screener failed: ' + err.message);
    } finally {
      setScreenerLoading(false);
    }
  }, [fetchAndEvaluateList, selectedStocks]);

  // Parse AlphaVantage SECTOR response into our perf shape
  function parseAlphaVantageSector(raw) {
    if (!raw || typeof raw !== 'object') return {};

    // Find keys that correspond to 1 Week / 1 Month / 3 Month
    const keyMap = { '1w': null, '1m': null, '3m': null };
    Object.keys(raw).forEach(k => {
      const lower = k.toLowerCase();
      if (lower.includes('1 week') || lower.includes('1 week performance') || lower.includes('week')) {
        keyMap['1w'] = k;
      }
      if (lower.includes('1 month') || lower.includes('1 month performance') || lower.includes('month')) {
        // prefer 1 month
        if (!keyMap['1m']) keyMap['1m'] = k;
      }
      if (lower.includes('3 month') || lower.includes('3 month performance') || lower.includes('3 month')) {
        keyMap['3m'] = k;
      }
    });

    // If specific keys aren't found, try some common alternatives
    if (!keyMap['1w']) {
      keyMap['1w'] = Object.keys(raw).find(k => k.toLowerCase().includes('5 day') || k.toLowerCase().includes('5 day performance')) || null;
    }
    if (!keyMap['1m']) {
      keyMap['1m'] = Object.keys(raw).find(k => k.toLowerCase().includes('1 month')) || null;
    }

    const parsed = {};
    // Build mapping of sector -> perf values
    Object.keys(raw).forEach(k => {
      // only consider keys that are the performance maps (they map sector name to string percent)
      const val = raw[k];
      if (typeof val === 'object') {
        Object.keys(val).forEach(sectorName => {
          if (!parsed[sectorName]) parsed[sectorName] = {};
          // extract values for keys we care about
          if (k === keyMap['1w']) parsed[sectorName]['1w'] = parseFloat(String(val[sectorName]).replace('%', '')) || 0;
          if (k === keyMap['1m']) parsed[sectorName]['1m'] = parseFloat(String(val[sectorName]).replace('%', '')) || 0;
          if (k === keyMap['3m']) parsed[sectorName]['3m'] = parseFloat(String(val[sectorName]).replace('%', '')) || 0;
        });
      }
    });

    return parsed; // { 'Information Technology': { '1w': x, '1m': y, '3m': z }, ... }
  }

  // Fetch live sector data from our API proxy
  const fetchSectors = useCallback(async () => {
    if (!apiKeys.alphaVantage) {
      setSectorsError('Missing AlphaVantage API key (set defaults or provide key)');
      return;
    }
    setSectorsLoading(true);
    setSectorsError('');
    try {
      const resp = await fetch(`/api/sectors?apikey=${apiKeys.alphaVantage}`);
      const data = await resp.json();
      // parse response
      const parsed = parseAlphaVantageSector(data);

    // merge with static drivers list (canonical fallback from src/data/sectors.js)
  const merged = sectorsList.map(s => {
        // AlphaVantage uses slightly different sector names for some sectors
        const nameMap = {
          Technology: 'Information Technology',
          'Real Estate': 'Real Estate',
          Healthcare: 'Health Care',
          'Communication Services': 'Communication Services',
          'Consumer Discretionary': 'Consumer Discretionary',
          Financials: 'Financials',
          Energy: 'Energy',
          Industrials: 'Industrials',
          Materials: 'Materials',
          Utilities: 'Utilities'
        };
        const rawName = nameMap[s.name] || s.name;
        const perfObj = parsed[rawName] || {};
        return {
          ...s,
          perf: {
            '1w': perfObj['1w'] != null ? perfObj['1w'] : (s.perf && s.perf['1w']) || 0,
            '1m': perfObj['1m'] != null ? perfObj['1m'] : (s.perf && s.perf['1m']) || 0,
            '3m': perfObj['3m'] != null ? perfObj['3m'] : (s.perf && s.perf['3m']) || 0
          }
        };
      });

      setSectorsLive(merged);
      setSectorsLastUpdated(new Date().toISOString());
    } catch (err) {
      setSectorsError('Failed to load sector data: ' + err.message);
      // fallback to static list
      setSectorsLive([]);
    } finally {
      setSectorsLoading(false);
    }
  }, [apiKeys.alphaVantage]);

  // Auto-refresh when sectors tab active
  useEffect(() => {
    let id;
    if (activeTab === 'sectors') {
      fetchSectors();
      // refresh every 5 minutes
      id = setInterval(fetchSectors, 5 * 60 * 1000);
    }
    return () => {
      if (id) clearInterval(id);
    };
  }, [activeTab, fetchSectors]);

  // Fetch market indices
  const fetchMarketIndices = useCallback(async () => {
    if (!apiKeys.alphaVantage) return;
    
    setIndicesLoading(true);
    try {
      // Using ETFs as proxies: DIA (Dow), SPY (S&P 500), QQQ (Nasdaq)
      const symbols = [
        { symbol: 'DIA', name: 'Dow Jones' },
        { symbol: 'SPY', name: 'S&P 500' },
        { symbol: 'QQQ', name: 'Nasdaq' }
      ];
      
      const promises = symbols.map(async (idx) => {
        try {
          const response = await fetch(`/api/quote?ticker=${idx.symbol}&apikey=${apiKeys.alphaVantage}`);
          const data = await response.json();
          const quote = data['Global Quote'];
          
          if (quote) {
            // also fetch compact chart data for sparkline
            let spark = null;
            try {
              const ch = await fetch(`/api/chart-data?ticker=${idx.symbol}&apikey=${apiKeys.alphaVantage}&outputsize=compact`);
              const chd = await ch.json();
              if (chd['Time Series (Daily)']) {
                const ts = chd['Time Series (Daily)'];
                const dates = Object.keys(ts).sort();
                const slice = dates.slice(-20);
                spark = slice.map(d => ({ date: d, price: parseFloat(ts[d]['4. close']) }));
              }
            } catch (e) {
              console.warn('Failed to fetch chart data for sparkline', idx.symbol, e);
            }

            return {
              name: idx.name,
              symbol: idx.symbol,
              price: parseFloat(quote['05. price']),
              change: parseFloat(quote['09. change']),
              changePercent: parseFloat(quote['10. change percent'].replace('%', '')),
              spark
            };
          }
          return null;
        } catch (err) {
          console.warn(`Failed to fetch ${idx.name}:`, err);
          return null;
        }
      });
      
      const results = await Promise.all(promises);
      setMarketIndices(results.filter(r => r !== null));
    } catch (err) {
      console.error('Failed to fetch market indices:', err);
    } finally {
      setIndicesLoading(false);
    }
  }, [apiKeys.alphaVantage]);

  // Auto-refresh indices when news tab is active
  useEffect(() => {
    let id;
    if (activeTab === 'news') {
      fetchMarketIndices();
      // refresh every 2 minutes
      id = setInterval(fetchMarketIndices, 2 * 60 * 1000);
    }
    return () => {
      if (id) clearInterval(id);
    };
  }, [activeTab, fetchMarketIndices]);

  // Fetch sector ETF quotes
  const fetchSectorEtfQuotes = useCallback(async () => {
    if (!apiKeys.alphaVantage) return;
    try {
      setEtfQuotesLoading(true);
      const tickers = Array.from(new Set(Object.values(SECTOR_ETF_MAP)));
      const results = await Promise.all(
        tickers.map(async (symbol) => {
          try {
            const response = await fetch(`/api/quote?ticker=${symbol}&apikey=${apiKeys.alphaVantage}`);
            const data = await response.json();
            const quote = data['Global Quote'];
            if (quote) {
              return [symbol, {
                price: parseFloat(quote['05. price']),
                change: parseFloat(quote['09. change']),
                changePercent: quote['10. change percent'] ? parseFloat(quote['10. change percent'].replace('%', '')) : null
              }];
            }
          } catch (e) {
            console.error('ETF quote fetch failed for', symbol, e);
          }
          return [symbol, null];
        })
      );
      const obj = {};
      for (const [sym, val] of results) {
        if (val) obj[sym] = val;
      }
      setEtfQuotes(obj);
    } catch (err) {
      console.error('Failed to fetch sector ETF quotes:', err);
    } finally {
      setEtfQuotesLoading(false);
    }
  }, [apiKeys.alphaVantage]);

  // Auto-refresh ETF quotes when sectors tab is active
  useEffect(() => {
    let id;
    if (activeTab === 'sectors') {
      fetchSectorEtfQuotes();
      id = setInterval(fetchSectorEtfQuotes, 2 * 60 * 1000);
    }
    return () => {
      if (id) clearInterval(id);
    };
  }, [activeTab, fetchSectorEtfQuotes]);

  // Helper function to fetch news
  const fetchNewsWithKey = useCallback(async function(newsApiKey, q) {
    setLoading(true);
    setError('');
    
    try {
      const url = '/api/news?apikey=' + newsApiKey + (q ? ('&q=' + encodeURIComponent(q)) : '');
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.articles) {
        const formattedNews = data.articles.map(article => ({
          headline: article.title,
          impact: 'Market Moving',
          summary: article.description || '',
          url: article.url || '',
          implications: 'Analyze based on content and market context',
          sentiment: analyzeSentiment(article.title + ' ' + article.description),
          publishedAt: article.publishedAt || null
        }));
        setNewsStories(formattedNews);
        setNewsLastUpdated(new Date().toISOString());
      }
    } catch (err) {
      setError('Error fetching news: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load default API keys and news on mount
  useEffect(function() {
    async function loadDefaultKeysAndNews() {
      try {
        const response = await fetch('/api/default-keys');
        const data = await response.json();
        if (data && !data.error) {
          setApiKeys(data);
          if (data.newsApi) {
            fetchNewsWithKey(data.newsApi);
          }
        }
      } catch (err) {
        console.error('Failed to load default keys:', err);
      }
    }
    loadDefaultKeysAndNews();
  }, [fetchNewsWithKey]);

  // Prepare news cards component
  const newsCards = newsStories.map((story, idx) => {
    let sentimentClass = 'bg-yellow-500/20 text-yellow-400';
    if (story.sentiment === 'positive') {
      sentimentClass = 'bg-emerald-500/20 text-emerald-400';
    } else if (story.sentiment === 'negative') {
      sentimentClass = 'bg-red-500/20 text-red-400';
    }
    
    // Format timestamp
    let timeAgo = '';
    if (story.publishedAt) {
      const publishedDate = new Date(story.publishedAt);
      const now = new Date();
      const diffMs = now - publishedDate;
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);
      
      if (diffMins < 60) {
        timeAgo = `${diffMins}m ago`;
      } else if (diffHours < 24) {
        timeAgo = `${diffHours}h ago`;
      } else if (diffDays < 7) {
        timeAgo = `${diffDays}d ago`;
      } else {
        timeAgo = publishedDate.toLocaleDateString();
      }
    }
    
    return (
      <div key={idx} className="relative glass-sheen overflow-hidden lg-panel rounded-lg p-4 hover:opacity-95 transition-colors">
        <div className="flex justify-between items-start mb-2">
          <a
            href={story.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-lg font-bold flex-1 text-blue-400 hover:text-blue-300 cursor-pointer transition-colors"
          >
            {story.headline}
          </a>
          <span className={'px-3 py-1 rounded-full text-xs font-semibold ml-4 ' + sentimentClass}>
            {story.sentiment}
          </span>
        </div>
        {timeAgo && (
          <div className="text-xs text-slate-400 mb-2">{timeAgo}</div>
        )}
        <p className="text-slate-300 mb-3">{story.summary}</p>
      </div>
    );
  });

  // Technical chart rendering (restored)
  // Example: Place this inside your render function where you want the chart to appear
  // You will need to wire up technicalData, chartWindow, showSR, etc. in later steps
  // <ResponsiveContainer width="100%" height={400}>
  //   <LineChart data={technicalData.chartData}>
  //     <CartesianGrid strokeDasharray="3 3" />
  //     <XAxis dataKey="date" />
  //     <YAxis />
  //     <Tooltip />
  //     <Legend />
  //     <Line type="monotone" dataKey="price" stroke="#60A5FA" dot={false} name="Price" />
  //     <Line type="monotone" dataKey="ma50" stroke="#34D399" dot={false} name="50 MA" />
  //     <Line type="monotone" dataKey="ma200" stroke="#F87171" dot={false} name="200 MA" />
  //     {/* S/R overlays and shading will be added in next step */}
  //   </LineChart>
  // </ResponsiveContainer>



  // Render function
  return (
    <div className={`min-h-screen ${theme === 'liquid-glass' ? 'theme-liquid-glass' : 'bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900'} text-white`} data-theme={theme}>
      <div className="max-w-7xl mx-auto p-6">
  <header className="mb-8 flex items-center justify-between relative glass-sheen overflow-hidden">
          <div>
            <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">
                Financial Hub
              </h1>
            <p className="text-slate-400 hidden md:block">Comprehensive market insights and stock analysis tools</p>
          </div>
          <div className="md:hidden fixed top-4 right-6 z-50">
            <button
              onClick={() => setMobileNavOpen(prev => !prev)}
              aria-expanded={mobileNavOpen}
              aria-label="Toggle navigation"
              className={`p-2 rounded ${theme === 'liquid-glass' ? 'bg-white/5 hover:bg-white/10' : 'bg-slate-700 hover:bg-slate-600'}`}
            >
              <span className="relative inline-block w-5 h-5">
                <Menu size={20} className={`absolute inset-0 transition-all duration-200 transform ${mobileNavOpen ? 'opacity-0 scale-90' : 'opacity-100 scale-100'}`} />
                <X size={20} className={`absolute inset-0 transition-all duration-200 transform ${mobileNavOpen ? 'opacity-100 scale-105' : 'opacity-0 scale-90'}`} />
              </span>
            </button>
          </div>
        </header>
  {/* Content Area */}
  <div className={`${theme === 'liquid-glass' ? 'bg-white/5 backdrop-blur-sm border border-white/5' : 'bg-slate-800'} rounded-xl shadow-2xl p-6`}>
          {/* Tabs */}
          <div className="mb-6">
            <div className="flex items-center justify-between">
              <div className="hidden md:flex items-center gap-3">
                <button
                  onClick={() => setActiveTab('news')}
                  className={"px-4 py-2 rounded-md text-sm font-semibold " + (activeTab === 'news' ? 'bg-slate-700 text-white' : 'bg-transparent text-slate-400 hover:bg-slate-700')}
                >
                  News
                </button>
                <button
                  onClick={() => setActiveTab('sectors')}
                  className={"px-4 py-2 rounded-md text-sm font-semibold " + (activeTab === 'sectors' ? 'bg-slate-700 text-white' : 'bg-transparent text-slate-400 hover:bg-slate-700')}
                >
                  Sector Trends
                </button>
                <button
                  onClick={() => setActiveTab('charts')}
                  className={"px-4 py-2 rounded-md text-sm font-semibold " + (activeTab === 'charts' ? 'bg-slate-700 text-white' : 'bg-transparent text-slate-400 hover:bg-slate-700')}
                >
                  Technical Analysis
                </button>
                <button
                  onClick={() => setActiveTab('screener')}
                  className={"px-4 py-2 rounded-md text-sm font-semibold " + (activeTab === 'screener' ? 'bg-slate-700 text-white' : 'bg-transparent text-slate-400 hover:bg-slate-700')}
                >
                  Stock Valuations
                </button>
                <button
                  onClick={() => setActiveTab('settings')}
                  className={"px-3 py-2 rounded-md text-sm font-semibold flex items-center gap-2 " + (activeTab === 'settings' ? 'bg-slate-700 text-white' : 'bg-transparent text-slate-400 hover:bg-slate-700')}
                >
                  <Settings size={16} />
                  Settings
                </button>
              </div>
            </div>

            {/* Mobile nav slide-over/backdrop */}
            {/* Backdrop (fades) and slide-over panel (translates) to animate open/close */}
            <div
              className={`fixed inset-0 ${theme === 'liquid-glass' ? 'bg-black/30 backdrop-blur-sm' : 'bg-black/50'} z-40 transition-opacity duration-200 ${mobileNavOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
              onClick={() => setMobileNavOpen(false)}
              aria-hidden={!mobileNavOpen}
            />

            <aside
              role="dialog"
              aria-modal="true"
              className={`fixed top-0 right-0 h-full w-64 max-w-xs ${theme === 'liquid-glass' ? 'bg-white/4 backdrop-blur-sm border border-white/5' : 'bg-slate-800'} z-50 transform transition-transform duration-300 ease-out md:hidden ${mobileNavOpen ? 'translate-x-0' : 'translate-x-full'}`}
            >
              <div className="p-4 border-b border-slate-700 flex items-center justify-between">
                <div className="text-lg font-bold">Menu</div>
                <button
                  onClick={() => setMobileNavOpen(false)}
                  aria-label="Close menu"
                  className={`p-2 rounded ${theme === 'liquid-glass' ? 'bg-white/5 hover:bg-white/10' : 'bg-slate-700 hover:bg-slate-600'}`}
                >
                  <X size={18} />
                </button>
              </div>
              <div className="p-4 space-y-2">
                <button onClick={() => { setActiveTab('news'); setMobileNavOpen(false); }} className={`w-full text-left px-4 py-2 rounded text-sm font-semibold ${activeTab === 'news' ? (theme === 'liquid-glass' ? 'bg-white/6 text-slate-100' : 'bg-slate-700 text-white') : 'text-slate-200'}`}>News</button>
                <button onClick={() => { setActiveTab('sectors'); setMobileNavOpen(false); }} className={`w-full text-left px-4 py-2 rounded text-sm font-semibold ${activeTab === 'sectors' ? (theme === 'liquid-glass' ? 'bg-white/6 text-slate-100' : 'bg-slate-700 text-white') : 'text-slate-200'}`}>Sector Trends</button>
                <button onClick={() => { setActiveTab('charts'); setMobileNavOpen(false); }} className={`w-full text-left px-4 py-2 rounded text-sm font-semibold ${activeTab === 'charts' ? (theme === 'liquid-glass' ? 'bg-white/6 text-slate-100' : 'bg-slate-700 text-white') : 'text-slate-200'}`}>Technical Analysis</button>
                <button onClick={() => { setActiveTab('screener'); setMobileNavOpen(false); }} className={`w-full text-left px-4 py-2 rounded text-sm font-semibold ${activeTab === 'screener' ? (theme === 'liquid-glass' ? 'bg-white/6 text-slate-100' : 'bg-slate-700 text-white') : 'text-slate-200'}`}>Stock Valuations</button>
                <button onClick={() => { setActiveTab('settings'); setMobileNavOpen(false); }} className={`w-full text-left px-4 py-2 rounded text-sm font-semibold ${activeTab === 'settings' ? (theme === 'liquid-glass' ? 'bg-white/6 text-slate-100' : 'bg-slate-700 text-white') : 'text-slate-200'}`}>
                  <div className="flex items-center gap-2">
                    <Settings size={16} />
                    Settings
                  </div>
                </button>
              </div>
            </aside>

            {/* Accessibility helpers when mobile nav is open */}
            {mobileNavOpen && (
              <>
                <MobileNavEscapeHandler onClose={() => setMobileNavOpen(false)} />
                <MobileNavFocusTrap />
              </>
            )}
          </div>
          {activeTab === 'news' && (
            <div>
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold flex items-center gap-2 text-slate-100">
                    <Newspaper className="text-blue-400" />
                    Market News
                  </h2>
                  <p className="text-slate-400 text-sm hidden md:block">Curated market-moving headlines and quick sentiment.</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-xs text-slate-400">
                    {newsLastUpdated ? `Last: ${new Date(newsLastUpdated).toLocaleString()}` : ''}
                  </div>
                  <button
                    onClick={() => fetchNewsWithKey(apiKeys.newsApi)}
                    className="bg-blue-600 hover:bg-blue-700 px-3 py-1 rounded text-sm font-medium flex items-center gap-2"
                    disabled={loading}
                  >
                    {loading ? <Loader className="animate-spin" size={14} /> : 'Refresh'}
                  </button>
                </div>
              
              </div>
              {/* Market Indices */}
              {!indicesLoading && marketIndices.length > 0 && (
                <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                  {marketIndices.map((index) => (
                    <div
                      key={index.symbol}
                      className="lg-panel rounded-lg p-4 border border-slate-600 hover:shadow-lg transition-shadow cursor-pointer"
                      onClick={() => { setStockTicker(index.symbol); setActiveTab('charts'); }}
                      title={`Open ${index.symbol} in Technical Analysis`}
                    >
                      <div className="text-sm text-slate-400 mb-1 flex items-center justify-between">
                        <div>{index.symbol} ({index.name})</div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={(e) => { e.stopPropagation(); setActiveTab('news'); fetchNewsWithKey(apiKeys.newsApi, index.symbol); }}
                            className="text-xs lg-subpanel px-2 py-1 rounded hover:opacity-95 text-slate-200"
                          >
                            News
                          </button>
                        </div>
                      </div>
                      <div className="flex items-baseline justify-between">
                        <div className="text-2xl font-bold text-white">
                          {index.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                        <div className={'text-sm font-semibold ' + (index.change >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                          {index.change >= 0 ? '+' : ''}{index.change.toFixed(2)} ({index.changePercent >= 0 ? '+' : ''}{index.changePercent.toFixed(2)}%)
                        </div>
                      </div>
                      {index.spark && index.spark.length > 0 && (
                        <div className="mt-3 h-10">
                          <ResponsiveContainer width="100%" height={40}>
                            <LineChart data={index.spark}>
                              <Line type="monotone" dataKey="price" stroke="#60A5FA" dot={false} strokeWidth={2} />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {!newsStories || newsStories.length === 0 ? (
                <div className="lg-panel rounded-lg p-8 text-center text-slate-300">No news available. Try refreshing or check API keys.</div>
              ) : (
                <div className="space-y-4">{newsCards}</div>
              )}
            </div>
          )}

          {activeTab === 'settings' && (
            <div>
              <div className="mb-4">
                <h2 className="text-2xl font-bold flex items-center gap-2 text-slate-100">
                  <Settings className="text-blue-400" />
                  Settings
                </h2>
                <p className="text-slate-400 text-sm hidden md:block">Customize application behavior and appearance</p>
              </div>

              <div className="lg-panel rounded-lg p-4">
                <h3 className="text-lg font-semibold mb-3 text-slate-100">Theme</h3>
                <div className="flex flex-col sm:flex-row gap-3">
                  <label className={`p-3 rounded-md cursor-pointer flex-1 border ${theme === 'classic' ? 'border-blue-500 bg-slate-600' : 'border-transparent lg-panel'}`}>
                    <input type="radio" name="theme" value="classic" checked={theme === 'classic'} onChange={() => setTheme('classic')} className="mr-3" />
                    <div>
                      <div className="font-semibold">Classic</div>
                      <div className="text-xs text-slate-400">Current application look</div>
                    </div>
                  </label>

                  <label className={`p-3 rounded-md cursor-pointer flex-1 border ${theme === 'liquid-glass' ? 'border-blue-500 bg-slate-600' : 'border-transparent lg-panel'}`}>
                    <input type="radio" name="theme" value="liquid-glass" checked={theme === 'liquid-glass'} onChange={() => setTheme('liquid-glass')} className="mr-3" />
                    <div>
                      <div className="font-semibold">Liquid Glass</div>
                      <div className="text-xs text-slate-400">A glassy, translucent aesthetic (configure below)</div>
                    </div>
                  </label>
                </div>

                <div className="mt-4 text-sm text-slate-400">
                  Theme selection is saved to your browser. I'll implement the Liquid Glass styling next — tell me how you'd like it to look and I'll apply styles globally.
                </div>
              </div>
            </div>
          )}

          {activeTab === 'sectors' && (
            <div>
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold flex items-center gap-2 text-slate-100">
                    <BarChart3 className="text-blue-400" />
                    Sector Trends
                  </h2>
                      <p className="text-slate-400 text-sm hidden md:block">Current performance and near-term outlook for major sectors.</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-xs text-slate-400">{sectorsLastUpdated ? `Last: ${new Date(sectorsLastUpdated).toLocaleString()}` : ''}</div>
                  <button
                    onClick={fetchSectors}
                    className="bg-blue-600 hover:bg-blue-700 px-3 py-1 rounded text-sm font-medium flex items-center gap-2"
                    disabled={sectorsLoading}
                  >
                    {sectorsLoading ? <Loader className="animate-spin" size={14} /> : 'Refresh'}
                  </button>
                  {(!sectorsLive || sectorsLive.length === 0) && (
                    <div className="text-xs text-amber-300 ml-3">Showing fallback data (static)</div>
                  )}
                </div>
              </div>

              {sectorsError && (
                <div className="bg-red-900/30 border border-red-500/50 rounded-lg p-3 mb-4">
                  <p className="text-red-300 text-sm">{sectorsError}</p>
                </div>
              )}

              {sectorsLoading && (
                <div className="flex items-center justify-center py-8">
                  <Loader className="animate-spin text-blue-400" size={36} />
                </div>
              )}

              {!sectorsLoading && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {(sectorsLive && sectorsLive.length > 0 ? sectorsLive : sectorsList).map(sec => {
                    const outlook = determineSectorOutlook(sec.perf);
                    const isStrong = outlook === 'Strong';
                    const isRecovery = outlook === 'Early Recovery';
                    const isWeak = outlook === 'Weak';
                    const etfTicker = SECTOR_ETF_MAP[sec.name] || null;
                    const badgeClass = isStrong
                      ? 'bg-emerald-500 text-emerald-900'
                      : isRecovery
                        ? 'bg-amber-300 text-amber-900'
                        : isWeak
                          ? 'bg-red-300 text-red-900'
                          : 'bg-slate-700 text-slate-200';

                      return (
                      <div key={sec.id} className={'p-4 rounded-lg relative overflow-hidden glass-sheen ' + (isStrong ? 'border-2 border-emerald-600' : 'lg-panel')}>
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <h3 className="text-lg font-semibold text-slate-100">{sec.name}</h3>
                            <div className="text-xs text-slate-400">{sec.drivers}</div>
                          </div>
                          <div className="text-right">
                            <div className={"inline-block px-2 py-1 rounded text-xs font-semibold " + badgeClass}>{outlook}</div>
                          </div>
                        </div>
                        {etfTicker && (
                          <div className="mt-2 flex items-center justify-between">
                            <button
                              type="button"
                              onClick={() => { setStockTicker(etfTicker); setActiveTab('charts'); }}
                              className="inline-flex items-center gap-2 text-[11px] uppercase tracking-wide px-2 py-1 rounded lg-subpanel text-slate-200 border border-slate-600 hover:opacity-95 transition-colors"
                              title={`Open ${etfTicker} in Technical Analysis`}
                            >
                              ETF: <span className="font-semibold">{etfTicker}</span>
                            </button>
                            {etfQuotes[etfTicker] && (
                              <div className="text-right text-xs">
                                <div className="text-slate-200 font-semibold">${etfQuotes[etfTicker].price?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                                <div className={(etfQuotes[etfTicker].change ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                                  {(etfQuotes[etfTicker].change ?? 0) >= 0 ? '+' : ''}{(etfQuotes[etfTicker].change ?? 0).toFixed(2)} ({(etfQuotes[etfTicker].changePercent ?? 0) >= 0 ? '+' : ''}{(etfQuotes[etfTicker].changePercent ?? 0).toFixed(2)}%)
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                        <div className="mt-3 flex items-center gap-4 text-sm">
                          <div>
                            <div className="text-xs text-slate-400">1W</div>
                            <div className={sec.perf['1w'] >= 0 ? 'text-emerald-300' : 'text-red-300'}>{sec.perf['1w']}%</div>
                          </div>
                          <div>
                            <div className="text-xs text-slate-400">1M</div>
                            <div className={sec.perf['1m'] >= 0 ? 'text-emerald-300' : 'text-red-300'}>{sec.perf['1m']}%</div>
                          </div>
                          <div>
                            <div className="text-xs text-slate-400">3M</div>
                            <div className={sec.perf['3m'] >= 0 ? 'text-emerald-300' : 'text-red-300'}>{sec.perf['3m']}%</div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="mt-6 text-xs text-slate-400">
                <strong>Highlights:</strong> Sectors marked <span className="font-semibold text-emerald-300">Strong</span> show robust momentum (1M/3M), <span className="font-semibold text-amber-300">Early Recovery</span> indicates recent rebound after weakness, and <span className="font-semibold text-red-300">Weak</span> signals sustained underperformance. Explanations summarize primary macro and structural drivers.
              </div>
            </div>
          )}
          
              {activeTab === 'screener' && (
                <div>
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <h2 className="text-2xl font-bold flex items-center gap-2 text-slate-100">
                        <Search className="text-blue-400" />
                          Stock Valuations
                      </h2>
                      <p className="text-slate-400 text-sm hidden md:block">Comprehensive valuation analysis based on key fundamentals</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-xs text-slate-400">{screenerLastUpdated ? `Last: ${new Date(screenerLastUpdated).toLocaleString()}` : ''}</div>
                    </div>
                  </div>

                  {screenerError && (
                    <div className="bg-red-900/30 border border-red-500/50 rounded-lg p-3 mb-4">
                      <p className="text-red-300 text-sm">{screenerError}</p>
                    </div>
                  )}

                  {screenerLoading && (
                    <div className="flex items-center justify-center py-8">
                      <Loader className="animate-spin text-blue-400" size={36} />
                    </div>
                  )}

                  {!screenerLoading && (
                    <div>
                      {/* Stock Input Section */}
                      <div className="mb-6 lg-panel rounded-lg p-4">
                        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3 mb-4">
                          <input
                            type="text"
                            value={stockInput}
                            onChange={(e) => setStockInput(e.target.value.toUpperCase())}
                            onKeyPress={(e) => e.key === 'Enter' && addStock()}
                            placeholder="Enter stock symbol (e.g., AAPL)"
                            className="lg-subpanel text-white px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 flex-1 min-w-0 w-full md:w-auto"
                            disabled={selectedStocks.length >= MAX_STOCKS}
                          />
                          <button
                            onClick={addStock}
                            disabled={!stockInput || selectedStocks.length >= MAX_STOCKS}
                            className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 px-4 py-2 rounded-lg font-medium w-full md:w-auto"
                          >
                            Add Stock
                          </button>
                        </div>
                        
                        {/* Selected Stocks */}
                        <div className="flex flex-wrap gap-2">
                          {selectedStocks.map((stock) => (
                            <div key={stock} className="lg-subpanel px-3 py-1 rounded-full flex items-center gap-2">
                              <span className="text-sm">{stock}</span>
                              <button
                                onClick={() => removeStock(stock)}
                                className="text-slate-400 hover:text-red-400"
                              >
                                ×
                              </button>
                            </div>
                          ))}
                        </div>
                        <div className="mt-2 text-xs text-slate-400">
                          {selectedStocks.length}/{MAX_STOCKS} stocks selected
                        </div>
                        <div className="mt-4">
                          <button
                            onClick={fetchScreener}
                            className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg font-medium w-full md:w-auto"
                            disabled={screenerLoading || selectedStocks.length === 0}
                          >
                            {screenerLoading ? <Loader className="animate-spin" size={14} /> : 'Submit'}
                          </button>
                        </div>
                      </div>

                      {/* Results Section */}
                      <div className="space-y-4">
                        {screenerResults.length === 0 ? (
                          <div className="text-slate-400 text-sm text-center py-8">Add stocks and click Refresh to analyze fundamentals.</div>
                        ) : (
                          screenerResults.map(s => {
                            // Calculate valuation summary
                            let valuation = 'Fairly Valued';
                            let valuationColor = 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
                            
                            let score = 0;
                            let factors = 0;
                            
                            // PEG (most important)
                            if (s.peg != null) {
                              if (s.peg < 1) score += 2;
                              else if (s.peg < 2) score += 1;
                              factors += 2;
                            }
                            
                            // P/E
                            if (s.pe != null) {
                              if (s.pe < 15) score += 1;
                              else if (s.pe > 25) score -= 1;
                              factors += 1;
                            }
                            
                            // P/B
                            if (s.pb != null) {
                              if (s.pb < 1) score += 1;
                              else if (s.pb < 3) score += 0.5;
                              factors += 1;
                            }
                            
                            // ROE (calculate from profit margin as proxy)
                            if (s.profitMargin != null && s.profitMargin > 0) {
                              if (s.profitMargin > 20) score += 1;
                              else if (s.profitMargin > 15) score += 0.5;
                              factors += 1;
                            }
                            
                            const avgScore = factors > 0 ? score / factors : 0.5;
                            
                            if (avgScore > 0.6) {
                              valuation = 'Undervalued';
                              valuationColor = 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
                            } else if (avgScore < 0.3) {
                              valuation = 'Overvalued';
                              valuationColor = 'bg-red-500/20 text-red-400 border-red-500/30';
                            }
                            
                            return (
                              <div key={s.symbol} className="lg-panel rounded-lg p-5">
                                <div className="flex justify-between items-start mb-4">
                                  <div className="flex-1">
                                    <div className="flex items-baseline gap-4">
                                      <div className="text-2xl font-bold text-blue-400">{s.symbol}</div>
                                      {s.currentPrice != null && (
                                        <div className="flex items-baseline gap-3">
                                          <span className="text-xl font-semibold text-slate-200">${s.currentPrice.toFixed(2)}</span>
                                          {s.priceChange != null && s.priceChangePercent != null && (
                                            <span className={
                                              'text-sm font-medium ' + 
                                              (s.priceChange >= 0 ? 'text-emerald-400' : 'text-red-400')
                                            }>
                                              {s.priceChange >= 0 ? '+' : ''}{s.priceChange.toFixed(2)} ({s.priceChangePercent >= 0 ? '+' : ''}{s.priceChangePercent.toFixed(2)}%)
                                            </span>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                    <div className="text-slate-300 text-sm mt-1">{s.name}</div>
                                  </div>
                                  <div className={'px-4 py-2 rounded border font-bold ' + valuationColor + ' hidden md:block'}>
                                    {valuation}
                                  </div>
                                </div>
                                
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                  {/* Market Cap */}
                                  <div className="lg-subpanel rounded-lg p-3">
                                    <div className="text-xs text-slate-400 mb-1">Market Cap</div>
                                      <div className="text-lg font-bold">{s.marketCap ? formatCurrencyAbbrev(s.marketCap) : 'N/A'}</div>
                                    <div className="text-xs text-slate-500 mt-1">Total market value of outstanding shares</div>
                                  </div>
                                  
                                  {/* Revenue TTM */}
                                  <div className="lg-subpanel rounded-lg p-3">
                                    <div className="text-xs text-slate-400 mb-1">Revenue (TTM)</div>
                                    <div className="text-lg font-bold">{s.revenueTTM ? formatCurrencyAbbrev(s.revenueTTM) : 'N/A'}</div>
                                    <div className="text-xs text-slate-500 mt-1">Trailing twelve month revenue</div>
                                  </div>
                                  
                                  {/* Price-to-Sales Ratio */}
                                  <div className="lg-subpanel rounded-lg p-3">
                                    <div className="text-xs text-slate-400 mb-1">Price-to-Sales</div>
                                    <div className="text-lg font-bold">{s.priceToSales ?? 'N/A'}</div>
                                    <div className="text-xs text-slate-500 mt-1">
                                      {s.priceToSales != null && s.priceToSales < 2 ? '✓ Low' : s.priceToSales != null && s.priceToSales < 5 ? 'Fair' : s.priceToSales != null ? '⚠ High' : ''}
                                    </div>
                                  </div>
                                  
                                  {/* P/E Ratio */}
                                  <div className="lg-subpanel rounded-lg p-3">
                                    <div className="text-xs text-slate-400 mb-1">P/E Ratio</div>
                                    <div className="text-lg font-bold">{s.pe ?? 'N/A'}</div>
                                    <div className="text-xs text-slate-500 mt-1">
                                      {s.pe != null && s.pe < 15 ? '✓ Low' : s.pe != null && s.pe < 25 ? 'Fair' : s.pe != null ? '⚠ High' : ''}
                                    </div>
                                  </div>
                                  
                                  {/* PEG Ratio */}
                                  <div className="lg-subpanel rounded-lg p-3">
                                    <div className="text-xs text-slate-400 mb-1">PEG Ratio ⭐</div>
                                    <div className="text-lg font-bold">{s.peg ?? 'N/A'}</div>
                                    <div className="text-xs text-slate-500 mt-1">
                                      {s.peg != null && s.peg < 1 ? '✓ Great' : s.peg != null && s.peg < 2 ? 'Fair' : s.peg != null ? '⚠ High' : ''}
                                    </div>
                                  </div>
                                  
                                  {/* Price-to-Book */}
                                  <div className="lg-subpanel rounded-lg p-3">
                                    <div className="text-xs text-slate-400 mb-1">Price-to-Book</div>
                                    <div className="text-lg font-bold">{s.pb ?? 'N/A'}</div>
                                    <div className="text-xs text-slate-500 mt-1">
                                      {s.pb != null && s.pb < 1 ? '✓ Low' : s.pb != null && s.pb < 3 ? 'Fair' : s.pb != null ? '⚠ High' : ''}
                                    </div>
                                  </div>
                                  
                                  {/* ROE (using profit margin) */}
                                  <div className="lg-subpanel rounded-lg p-3">
                                    <div className="text-xs text-slate-400 mb-1">Profit Margin %</div>
                                      <div className="text-lg font-bold">{s.profitMargin != null ? (s.profitMargin * 100).toFixed(2) + '%' : 'N/A'}</div>
                                      <div className="text-xs text-slate-500 mt-1">
                                        {s.profitMargin != null && s.profitMargin * 100 > 20 ? '✓ Excellent' : s.profitMargin != null && s.profitMargin * 100 > 10 ? 'Good' : s.profitMargin != null && s.profitMargin * 100 > 0 ? 'Fair' : s.profitMargin != null ? '⚠ Low' : ''}
                                    </div>
                                  </div>
                                  
                                  
                                  {/* EPS Growth */}
                                  <div className="lg-subpanel rounded-lg p-3">
                                    <div className="text-xs text-slate-400 mb-1">EPS Growth</div>
                                    <div className="text-lg font-bold">{s.qEarningsGrowth != null ? (s.qEarningsGrowth > 0 ? '+' : '') + (s.qEarningsGrowth * 100).toFixed(2) + '%' : 'N/A'}</div>
                                    <div className="text-xs text-slate-500 mt-1">
                                      {s.qEarningsGrowth != null && s.qEarningsGrowth * 100 > 15 ? '✓ Strong' : s.qEarningsGrowth != null && s.qEarningsGrowth * 100 > 5 ? 'Good' : s.qEarningsGrowth != null && s.qEarningsGrowth * 100 > 0 ? 'Fair' : s.qEarningsGrowth != null ? '⚠ Negative' : ''}
                                    </div>
                                  </div>
                                </div>
                                {/* Mobile: valuation badge moved to bottom of the card to avoid layout breakage */}
                                <div className={'mt-4 px-4 py-2 rounded border font-bold ' + valuationColor + ' md:hidden text-center'}>
                                  {valuation}
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>

                      {/* Metrics Legend */}
                        {screenerResults.length > 0 && (
                        <div className="mt-8 lg-panel rounded-lg p-6">
                          <h3 className="text-xl font-bold text-blue-400 mb-4">📊 Metrics Explained</h3>
                          
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="lg-subpanel rounded-lg p-4">
                                  <h4 className="font-bold text-emerald-400 mb-2">⭐ PEG Ratio (Price/Earnings-to-Growth)</h4>
                                  <p className="text-sm text-slate-300 mb-2"><strong>Formula:</strong> P/E Ratio ÷ EPS Growth Rate</p>
                                  <p className="text-sm text-slate-300 mb-2"><strong>Why it matters:</strong> Balances valuation against growth expectations.</p>
                                  <p className="text-sm text-slate-400"><strong>What's good:</strong> &lt;1 = undervalued relative to growth, 1-2 = fair, &gt;2 = may be expensive</p>
                                </div>
                            
                                <div className="lg-subpanel rounded-lg p-4">
                                  <h4 className="font-bold text-blue-400 mb-2">P/E Ratio (Price-to-Earnings)</h4>
                                  <p className="text-sm text-slate-300 mb-2"><strong>Formula:</strong> Stock Price ÷ Earnings Per Share</p>
                                  <p className="text-sm text-slate-300 mb-2"><strong>Why it matters:</strong> Shows how much investors pay for $1 of earnings.</p>
                                  <p className="text-sm text-slate-400"><strong>What's good:</strong> &lt;15 = cheap, 15-25 = fair, &gt;25 = expensive (industry dependent)</p>
                                </div>
                            
                                <div className="lg-subpanel rounded-lg p-4">
                                  <h4 className="font-bold text-blue-400 mb-2">Price-to-Sales (P/S)</h4>
                                  <p className="text-sm text-slate-300 mb-2"><strong>Formula:</strong> Market Cap ÷ Revenue (TTM)</p>
                                  <p className="text-sm text-slate-300 mb-2"><strong>Why it matters:</strong> Useful for companies with little earnings (early growth) — compares price to revenue base.</p>
                                  <p className="text-sm text-slate-400"><strong>What's good:</strong> Lower P/S indicates cheaper relative to revenue; &lt;2 often considered attractive depending on the sector</p>
                                </div>
                            
                                <div className="lg-subpanel rounded-lg p-4">
                                  <h4 className="font-bold text-blue-400 mb-2">Price-to-Book Ratio (P/B)</h4>
                                  <p className="text-sm text-slate-300 mb-2"><strong>Formula:</strong> Stock Price ÷ Book Value Per Share</p>
                                  <p className="text-sm text-slate-300 mb-2"><strong>Why it matters:</strong> Shows if you're paying more than the company's net assets.</p>
                                  <p className="text-sm text-slate-400"><strong>What's good:</strong> &lt;1 = undervalued, 1-3 = fair, &gt;3 = expensive (industry dependent)</p>
                                </div>
                            
                                <div className="lg-subpanel rounded-lg p-4">
                                  <h4 className="font-bold text-blue-400 mb-2">Market Capitalization</h4>
                                  <p className="text-sm text-slate-300 mb-2"><strong>Definition:</strong> Total market value of outstanding shares (Price × Shares Outstanding)</p>
                                  <p className="text-sm text-slate-300 mb-2"><strong>Why it matters:</strong> Determines company size and what comparables/benchmarks to use.</p>
                                  <p className="text-sm text-slate-400"><strong>What's good:</strong> No universal threshold — use market cap to select peers and adjust valuation expectations</p>
                                </div>
                            
                                <div className="lg-subpanel rounded-lg p-4">
                                  <h4 className="font-bold text-blue-400 mb-2">Revenue (TTM)</h4>
                                  <p className="text-sm text-slate-300 mb-2"><strong>Definition:</strong> Trailing twelve months total revenue</p>
                                  <p className="text-sm text-slate-300 mb-2"><strong>Why it matters:</strong> Baseline for P/S and growth analysis; look for stability or acceleration.</p>
                                  <p className="text-sm text-slate-400"><strong>What's good:</strong> Positive and growing revenue is generally favorable; compare growth rates to peers</p>
                                </div>
                            
                                <div className="lg-subpanel rounded-lg p-4">
                                  <h4 className="font-bold text-blue-400 mb-2">Profit Margin %</h4>
                                  <p className="text-sm text-slate-300 mb-2"><strong>Formula:</strong> Net Income ÷ Revenue × 100</p>
                                  <p className="text-sm text-slate-300 mb-2"><strong>Why it matters:</strong> Shows how efficiently the company converts revenue to profit.</p>
                                  <p className="text-sm text-slate-400"><strong>What's good:</strong> &gt;20% = excellent, 10-20% = good, &lt;10% = needs improvement (sector dependent)</p>
                                </div>
                            
                                <div className="lg-subpanel rounded-lg p-4">
                                  <h4 className="font-bold text-blue-400 mb-2">EPS Growth (Earnings Per Share Growth)</h4>
                                  <p className="text-sm text-slate-300 mb-2"><strong>Formula:</strong> Year-over-year change in quarterly earnings or trailing EPS growth</p>
                                  <p className="text-sm text-slate-300 mb-2"><strong>Why it matters:</strong> Shows if the company is scaling profits per share — critical for growth investors.</p>
                                  <p className="text-sm text-slate-400"><strong>What's good:</strong> Positive = good, &gt;15% = strong growth, negative = concerning</p>
                                </div>
                              </div>
                          
                          <div className="mt-6 p-4 bg-blue-900/20 border border-blue-500/30 rounded-lg">
                            <h4 className="font-bold text-blue-400 mb-2">💡 How to Use These Metrics</h4>
                            <p className="text-sm text-slate-300">
                              No single metric tells the whole story. Look at the <strong className="text-emerald-400">Valuation Summary</strong> for a combined assessment, 
                              but also consider the individual metrics and the company's industry. A tech growth stock will have different ratios 
                              than a mature dividend stock. Always do additional research before investing.
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
              {activeTab === 'charts' && (
              <div>
                <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-4 gap-3">
                  <div>
                    <h2 className="text-2xl font-bold flex items-center gap-2">
                      <Target className="text-blue-400" />
                      Technical Analysis
                    </h2>
                    <p className="text-slate-400 hidden md:block">Price, moving averages, support/resistance, and overlays</p>
                  </div>
                  <div className="flex flex-col md:flex-row md:items-center items-stretch gap-3 w-full md:w-auto">
                    <input
                      type="text"
                      value={stockTicker}
                      onChange={e => setStockTicker(e.target.value.toUpperCase())}
                      placeholder="e.g. AAPL"
                      className="bg-slate-700 text-white px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 flex-1 min-w-0 w-full md:w-auto"
                    />
                    <button
                      onClick={analyzeChartData}
                      disabled={loading}
                      className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 disabled:cursor-not-allowed px-6 py-2 rounded-lg font-semibold flex items-center gap-2 transition-colors w-full md:w-auto justify-center"
                    >
                      {loading ? <Loader className="animate-spin" size={18} /> : <Search size={18} />}
                      <span className="ml-1">Analyze</span>
                    </button>
                  </div>
                </div>
        {/* Chart rendering */}
        {technicalData && (
          <div className="bg-slate-700 rounded-lg p-4 relative glass-sheen overflow-hidden">
                      {/* Stock Name and Price Header */}
                      <div className="mb-6 pb-4 border-b border-slate-600">
                        <div className="flex justify-between items-center">
                          <div>
                            <h3 className="text-3xl font-bold text-blue-400">
                              {stockTicker}
                              {technicalData.companyName && (
                                <span className="text-xl font-normal text-slate-400 ml-3">{technicalData.companyName}</span>
                              )}
                            </h3>
                            <p className="text-xl text-slate-300 mt-2">
                              Current Price: <span className="font-bold">${technicalData.currentPrice}</span>
                            </p>
                          </div>
                          <div className="flex flex-col items-end gap-3">
                            <div className="flex items-center gap-3">
                              <label className="text-xs text-slate-400 mr-2 hidden md:inline">View:</label>
                              <select value={chartWindow} onChange={e => setChartWindow(Number(e.target.value))} className="bg-slate-600 text-sm text-white px-2 py-1 rounded">
                                <option value={200}>200 days</option>
                                <option value={30}>30 days</option>
                                <option value={10}>10 days</option>
                                <option value={3}>3 days</option>
                              </select>
                              <label className="flex items-center gap-2 text-sm text-slate-300 ml-2">
                                <input type="checkbox" checked={showSR} onChange={e => setShowSR(e.target.checked)} className="w-4 h-4" />
                                <span className="hidden sm:inline">Show S/R</span>
                              </label>
                            </div>
                            <span className={
                              'px-4 py-2 rounded-full font-semibold text-lg ' +
                              (trend === 'Bullish'
                                ? 'bg-emerald-500/20 text-emerald-400'
                                : 'bg-red-500/20 text-red-400')
                            }>
                              {trend} Trend
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="h-96">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={technicalData.chartData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={true} horizontal={true} />
                            <XAxis dataKey="date" stroke="#9CA3AF" tick={{ fill: '#9CA3AF' }} tickLine={{ stroke: '#4B5563' }} />
                            <YAxis stroke="#9CA3AF" tick={{ fill: '#9CA3AF' }} tickLine={{ stroke: '#4B5563' }} domain={[ 'auto', 'auto' ]} />
                            <Tooltip contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: '0.375rem' }} labelStyle={{ color: '#9CA3AF' }} />
                            <Legend />
                            <Line type="monotone" dataKey="price" stroke="#60A5FA" dot={false} name="Price" />
                            <Line type="monotone" dataKey="ma50" stroke="#34D399" dot={false} name="50 MA" />
                            <Line type="monotone" dataKey="ma200" stroke="#F87171" dot={false} name="200 MA" />
                            {/* S/R overlays */}
                            {showSR && technicalData.analysis.supports.map((level, idx) => (
                              <ReferenceLine key={`sup-${idx}`} y={Number(level)} stroke="#10B981" strokeDasharray="4 4" label={{ value: `S ${level}`, position: 'right', fill: '#10B981' }} />
                            ))}
                            {showSR && technicalData.analysis.resistances.map((level, idx) => (
                              <ReferenceLine key={`res-${idx}`} y={Number(level)} stroke="#EF4444" strokeDasharray="4 4" label={{ value: `R ${level}`, position: 'right', fill: '#EF4444' }} />
                            ))}
                            {/* Shade between nearest support and resistance */}
                            {showSR && technicalData.srBand && (
                              <ReferenceArea
                                y1={technicalData.srBand.low}
                                y2={technicalData.srBand.high}
                                stroke="rgba(99,102,241,0.22)"
                                strokeOpacity={0.35}
                                fill="rgba(99,102,241,0.16)"
                              />
                            )}
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    {/* Legend for shaded band */}
                        <div className="mt-4 text-xs text-slate-400">
                          <span className="inline-block bg-blue-500/20 text-blue-400 px-2 py-1 rounded mr-2">Shaded band</span>
                          shows area between nearest support and resistance. Use the toggle to show/hide overlays and shading.
                        </div>

                        {/* Key levels and strategy explanation */}
                        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="lg-subpanel rounded-lg p-4">
                            <h4 className="text-lg font-semibold text-blue-400 mb-2">Key Levels & Breakouts</h4>
                            <div className="space-y-2">
                              <p className="text-slate-300">Support Levels: <span className="font-bold text-emerald-400">{technicalData.analysis.supports.join(', ')}</span></p>
                              <p className="text-slate-300">Resistance Levels: <span className="font-bold text-red-400">{technicalData.analysis.resistances.join(', ')}</span></p>
                              <p className="text-slate-300">Breakout Zone: <span className="font-bold text-blue-400">{technicalData.srBand ? `${technicalData.srBand.low} - ${technicalData.srBand.high}` : 'N/A'}</span></p>
                              <p className="text-slate-300">50-day MA: <span className="font-bold text-emerald-300">{
                                (() => {
                                  const last = technicalData.chartData && technicalData.chartData.length > 0 ? technicalData.chartData[technicalData.chartData.length - 1] : null;
                                  const v = last && last.ma50 != null ? last.ma50 : null;
                                  return v != null ? `$${v.toFixed(2)}` : 'N/A';
                                })()
                              }</span></p>
                              <p className="text-slate-300">200-day MA: <span className="font-bold text-red-300">{
                                (() => {
                                  const last = technicalData.chartData && technicalData.chartData.length > 0 ? technicalData.chartData[technicalData.chartData.length - 1] : null;
                                  const v = last && last.ma200 != null ? last.ma200 : null;
                                  return v != null ? `$${v.toFixed(2)}` : 'N/A';
                                })()
                              }</span></p>
                            </div>
                          </div>
                          <div className="lg-subpanel rounded-lg p-4">
                            <h4 className="text-lg font-semibold text-blue-400 mb-2">Trading Strategy Insights</h4>
                            <div className="space-y-2">
                              {(() => {
                                const sup = technicalData.analysis.supports;
                                const res = technicalData.analysis.resistances;
                                const supText = sup.length > 0 ? sup.join(', ') : 'N/A';
                                const resText = res.length > 0 ? res.join(', ') : 'N/A';
                                const lowestSup = sup.length > 0 ? Math.min(...sup.map(Number)) : null;
                                const highestRes = res.length > 0 ? Math.max(...res.map(Number)) : null;
                                
                                // Extract latest MA values
                                const last = technicalData.chartData && technicalData.chartData.length > 0 ? technicalData.chartData[technicalData.chartData.length - 1] : null;
                                const ma50 = last && last.ma50 != null ? last.ma50 : null;
                                const ma200 = last && last.ma200 != null ? last.ma200 : null;
                                
                                // Determine MA cross signal
                                let maCrossSignal = '';
                                if (ma50 != null && ma200 != null) {
                                  if (ma50 > ma200) {
                                    maCrossSignal = <span className="text-emerald-400 font-semibold">Golden Cross (Bullish)</span>;
                                  } else if (ma50 < ma200) {
                                    maCrossSignal = <span className="text-red-400 font-semibold">Death Cross (Bearish)</span>;
                                  } else {
                                    maCrossSignal = <span className="text-slate-400">Neutral</span>;
                                  }
                                }
                                
                                return (
                                  <>
                                    <p className="text-slate-300">
                                      <strong>Short-term:</strong> Watch for price action near support ({supText}) and resistance ({resText}). 
                                      Potential entry near support levels, exit or partial profit near resistance levels. 
                                      Breakouts above {highestRes ? `$${highestRes.toFixed(2)}` : 'resistance'} may signal momentum trades.
                                    </p>
                                    <p className="text-slate-300">
                                      <strong>Long-term:</strong> Position entries near strong support zones ({supText}), with targets at resistance ({resText}). 
                                      Consider stop-loss below {lowestSup ? `$${lowestSup.toFixed(2)}` : 'support'}. 
                                      If price sustains above {highestRes ? `$${highestRes.toFixed(2)}` : 'resistance'}, it may indicate a longer-term uptrend.
                                    </p>
                                    <p className="text-slate-300">
                                      <strong>Moving Average Crossovers:</strong> {maCrossSignal ? maCrossSignal : 'N/A'}
                                      {ma50 != null && ma200 != null && (
                                        <>
                                          {ma50 > ma200 && (
                                            <span> — The 50-day MA (${ma50.toFixed(2)}) is above the 200-day MA (${ma200.toFixed(2)}), signaling bullish momentum. This "Golden Cross" suggests upward price action and is a buy signal for many traders.</span>
                                          )}
                                          {ma50 < ma200 && (
                                            <span> — The 50-day MA (${ma50.toFixed(2)}) is below the 200-day MA (${ma200.toFixed(2)}), signaling bearish momentum. This "Death Cross" suggests downward pressure and is often seen as a sell signal.</span>
                                          )}
                                        </>
                                      )}
                                    </p>
                                    <p className="text-slate-300 text-sm">
                                      <strong>MA Convergence/Divergence:</strong> When both MAs move upward together, it confirms a strong uptrend; if they rise in sync, momentum is building. 
                                      If they diverge (one rising, one falling), it signals weakening trend strength and potential reversal. 
                                      Watch for the 50-day MA crossing the 200-day MA as a key inflection point.
                                    </p>
                                    <p className="text-slate-400 text-xs">These signals are based on recent pivots and moving averages. Always confirm with broader market context and risk management.</p>
                                  </>
                                );
                              })()}
                            </div>
                          </div>
                        </div>
                  </div>
                )}

                    
                {!technicalData && !loading && (
                  <div className="bg-slate-700 rounded-lg p-8 text-center">
                    <Target className="mx-auto mb-3 text-slate-400" size={48} />
                    <p className="text-slate-300">Enter a ticker and click Analyze to see technical analysis</p>
                  </div>
                )}
        </div>
      )}
        </div>

        <footer className="mt-8 text-center text-slate-500 text-sm">
          <p>Get your free API keys and start analyzing! This app connects to real market data.</p>
        </footer>
      </div>
    </div>
  );
}

export default FinancialApp;
