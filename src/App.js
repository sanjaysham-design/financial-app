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

const MAX_STOCKS = 12;

const SECTOR_ETF_MAP = {
  'Technology': 'XLK',
  'Energy': 'XLE',
  'Healthcare': 'XLV',
  'Health Care': 'XLV',
  'Financials': 'XLF',
  'Consumer Discretionary': 'XLY',
  'Industrials': 'XLI',
  'Utilities': 'XLU',
  'Materials': 'XLB',
  'Real Estate': 'XLRE',
  'Communication Services': 'XLC'
};

const AI_STOCKS = {
  'Chips & Semiconductors': [
    { symbol: 'NVDA', name: 'NVIDIA' },
    { symbol: 'AMD', name: 'AMD' },
    { symbol: 'INTC', name: 'Intel' },
    { symbol: 'AVGO', name: 'Broadcom' },
    { symbol: 'TSM', name: 'TSMC' },
    { symbol: 'QCOM', name: 'Qualcomm' },
  ],
  'Infrastructure & Hardware': [
    { symbol: 'DELL', name: 'Dell Technologies' },
    { symbol: 'SMCI', name: 'Super Micro Computer' },
    { symbol: 'HPE', name: 'HP Enterprise' },
    { symbol: 'WDC', name: 'Western Digital' },
    { symbol: 'ANET', name: 'Arista Networks' },
  ],
  'Cloud & Hyperscalers': [
    { symbol: 'MSFT', name: 'Microsoft' },
    { symbol: 'AMZN', name: 'Amazon' },
    { symbol: 'GOOGL', name: 'Alphabet' },
    { symbol: 'META', name: 'Meta' },
    { symbol: 'ORCL', name: 'Oracle' },
  ],
  'AI Software & Models': [
    { symbol: 'PLTR', name: 'Palantir' },
    { symbol: 'SNOW', name: 'Snowflake' },
    { symbol: 'AI', name: 'C3.ai' },
    { symbol: 'SOUN', name: 'SoundHound' },
    { symbol: 'BBAI', name: 'BigBear.ai' },
  ],
};

function FinancialApp() {
  function getTrend(chartData) {
    if (!chartData || chartData.length < 21) return 'Neutral';
    const latest = chartData[chartData.length - 1].price;
    const prev = chartData[chartData.length - 21].price;
    return latest > prev ? 'Bullish' : 'Bearish';
  }

  const [activeTab, setActiveTab] = useState('news');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [stockTicker, setStockTicker] = useState('');
  const [apiKeys, setApiKeys] = useState({ alphaVantage: '', finnhub: '', newsApi: '' });
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('theme');
    if (saved === 'default') return 'classic';
    return saved || 'liquid-glass';
  });
  const [loading, setLoading] = useState(false);
  const [, setError] = useState('');
  const [newsStories, setNewsStories] = useState([]);
  const [newsLastUpdated, setNewsLastUpdated] = useState(null);
  const [technicalData, setTechnicalData] = useState(null);
  const [chartWindow, setChartWindow] = useState(() => {
    const saved = localStorage.getItem('chartWindow');
    return saved ? Number(saved) : 200;
  });
  const [showSR, setShowSR] = useState(() => {
    const saved = localStorage.getItem('showSR');
    return saved !== null ? saved === 'true' : true;
  });
  const trend = technicalData ? getTrend(technicalData.chartData) : 'Neutral';

  useEffect(() => { localStorage.setItem('chartWindow', chartWindow); }, [chartWindow]);
  useEffect(() => { localStorage.setItem('showSR', showSR ? 'true' : 'false'); }, [showSR]);
  useEffect(() => { localStorage.setItem('theme', theme); }, [theme]);

  const analyzeChartData = useCallback(async () => {
    if (!stockTicker) return;
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`/api/chart-data?ticker=${stockTicker}`);
      const data = await response.json();
      if (data.error) { setError('Could not fetch data: ' + data.error); return; }
      setTechnicalData({
        chartData: data.chartData,
        currentPrice: data.currentPrice,
        companyName: data.companyName,
        analysis: data.analysis,
        srBand: data.srBand,
        trend: data.trend,
      });
    } catch (err) {
      setError('Error analyzing chart: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [stockTicker]);

  useEffect(() => {
    if (stockTicker) analyzeChartData();
  }, [chartWindow, analyzeChartData, stockTicker]);

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

  function determineSectorOutlook(perf) {
    const r1w = perf['1w'] ?? 0;
    const r1m = perf['1m'] ?? 0;
    const r3m = perf['3m'] ?? 0;
    if (r1m >= 5 || r3m >= 10) return 'Strong';
    if (r1w > 0 && (r1m < 3 || r3m < 5)) return 'Early Recovery';
    if (r1m <= -2 && r3m <= -2) return 'Weak';
    return 'Neutral';
  }

  useEffect(() => {
    if (activeTab === 'sectors') {
      // eslint-disable-next-line no-console
      console.log('Sector Trends opened, sectorsList length =', sectorsList && sectorsList.length);
    }
  }, [activeTab]);

  const [sectorsLive, setSectorsLive] = useState([]);
  const [sectorsLoading, setSectorsLoading] = useState(false);
  const [sectorsError, setSectorsError] = useState('');
  const [sectorsLastUpdated, setSectorsLastUpdated] = useState(null);
  const [screenerLoading, setScreenerLoading] = useState(false);
  const [screenerError, setScreenerError] = useState('');
  const [screenerLastUpdated, setScreenerLastUpdated] = useState(null);
  const [screenerResults, setScreenerResults] = useState([]);
  const [stockInput, setStockInput] = useState('');
  const [selectedStocks, setSelectedStocks] = useState([]);
  const [marketIndices, setMarketIndices] = useState([]);
  const [indicesLoading, setIndicesLoading] = useState(false);
  const [etfQuotes, setEtfQuotes] = useState({});
  const [, setEtfQuotesLoading] = useState(false);
  const [aiStocks, setAiStocks] = useState({});
  const [aiStocksLoading, setAiStocksLoading] = useState(false);
  const [aiNews, setAiNews] = useState([]);
  const [aiNewsLoading, setAiNewsLoading] = useState(false);
  const [aiLastUpdated, setAiLastUpdated] = useState(null);

  function MobileNavEscapeHandler({ onClose }) {
    useEffect(() => {
      function onKey(e) { if (e.key === 'Escape') onClose(); }
      window.addEventListener('keydown', onKey);
      return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);
    return null;
  }

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
        if (focusable.length === 0) { e.preventDefault(); return; }
        if (e.shiftKey) {
          if (document.activeElement === first) { e.preventDefault(); last.focus(); }
        } else {
          if (document.activeElement === last) { e.preventDefault(); first.focus(); }
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

  const parseNum = useCallback((v) => {
    if (v == null || v === '') return null;
    const n = Number(String(v).replace(/,|\$/g, ''));
    return Number.isFinite(n) ? n : null;
  }, []);

  function formatCurrencyAbbrev(v) {
    const n = parseNum(v);
    if (n == null) return 'N/A';
    const abs = Math.abs(n);
    let value, suffix;
    if (abs >= 1e12) { value = n / 1e12; suffix = 'T'; }
    else if (abs >= 1e9) { value = n / 1e9; suffix = 'Bn'; }
    else if (abs >= 1e6) { value = n / 1e6; suffix = 'M'; }
    else { return '$' + n.toLocaleString('en-US'); }
    const formatted = Math.abs(value) >= 100 ? Math.round(value).toString() : value.toFixed(2);
    return (n < 0 ? '-$' : '$') + formatted + suffix;
  }

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
    const earningsGood = (qEarningsGrowth != null && qEarningsGrowth > 0) || (eps != null && eps > 0);
    const lowDebt = debtToEquity == null ? false : debtToEquity < 1.0;
    const positiveCashProxy = (ebitda != null && ebitda > 0) || (profitMargin != null && profitMargin > 0);
    const undervalued = (pe != null && pe > 0 && pe < 20) || (peg != null && peg > 0 && peg < 1.5) || (pb != null && pb > 0 && pb < 3);
    let score = 0;
    if (pe != null && pe > 0) score += Math.max(0, 20 - pe);
    if (peg != null && peg > 0) score += Math.max(0, 5 - peg * 2);
    if (pb != null && pb > 0) score += Math.max(0, 3 - pb) * 2;
    if (qEarningsGrowth != null) score += Math.min(10, qEarningsGrowth);
    if (debtToEquity != null) score += Math.max(0, 5 - debtToEquity * 2);
    if (positiveCashProxy) score += 5;
    const marketCap = ov.MarketCapitalization ? Number(ov.MarketCapitalization) : null;
    const revenueTTM = ov.RevenueTTM ? Number(ov.RevenueTTM) : null;
    const priceToSales = parseNum(ov.PriceToSalesRatioTTM) ?? null;
    return {
      symbol: ov.Symbol, name: ov.Name || ov['CompanyName'] || '',
      pe, peg, pb, debtToEquity, eps, qEarningsGrowth, ebitda, profitMargin,
      undervalued: !!undervalued, earningsGood, lowDebt, positiveCashProxy, score,
      marketCap, revenueTTM, priceToSales
    };
  }, [parseNum]);

  const fetchAndEvaluateList = useCallback(async (tickers) => {
    const results = [];
    for (const t of tickers) {
      try {
        const overviewResp = await fetch(`/api/stock-overview?ticker=${t}`);
        const ov = await overviewResp.json();
        const evald = evaluateOverview(ov);
        if (evald) {
          evald.currentPrice = null;
          evald.priceChange = null;
          evald.priceChangePercent = null;
          results.push(evald);
        }
      } catch (err) {
        console.warn('Failed overview for', t, err);
      }
      await new Promise(resolve => setTimeout(resolve, 1200));
    }
    return results;
  }, [evaluateOverview]);

  const addStock = useCallback(() => {
    const stock = stockInput.trim().toUpperCase();
    if (stock && !selectedStocks.includes(stock) && selectedStocks.length < MAX_STOCKS) {
      setSelectedStocks(prev => [...prev, stock]);
      setStockInput('');
    }
  }, [stockInput, selectedStocks]);

  const removeStock = useCallback((stock) => {
    setSelectedStocks(prev => prev.filter(s => s !== stock));
  }, []);

  const fetchScreener = useCallback(async () => {
    if (selectedStocks.length === 0) { setScreenerError('Please add at least one stock to analyze'); return; }
    setScreenerLoading(true);
    setScreenerError('');
    try {
      const results = await fetchAndEvaluateList(selectedStocks);
      results.sort((a, b) => b.score - a.score);
      setScreenerResults(results);
      setScreenerLastUpdated(new Date().toISOString());
    } catch (err) {
      setScreenerError('Screener failed: ' + err.message);
    } finally {
      setScreenerLoading(false);
    }
  }, [fetchAndEvaluateList, selectedStocks]);

  function parseAlphaVantageSector(raw) {
    if (!raw || typeof raw !== 'object') return {};
    const keyMap = { '1w': null, '1m': null, '3m': null };
    Object.keys(raw).forEach(k => {
      const lower = k.toLowerCase();
      if (lower.includes('1 week') || lower.includes('week')) keyMap['1w'] = k;
      if (lower.includes('1 month') || lower.includes('month')) { if (!keyMap['1m']) keyMap['1m'] = k; }
      if (lower.includes('3 month')) keyMap['3m'] = k;
    });
    if (!keyMap['1w']) keyMap['1w'] = Object.keys(raw).find(k => k.toLowerCase().includes('5 day')) || null;
    if (!keyMap['1m']) keyMap['1m'] = Object.keys(raw).find(k => k.toLowerCase().includes('1 month')) || null;
    const parsed = {};
    Object.keys(raw).forEach(k => {
      const val = raw[k];
      if (typeof val === 'object') {
        Object.keys(val).forEach(sectorName => {
          if (!parsed[sectorName]) parsed[sectorName] = {};
          if (k === keyMap['1w']) parsed[sectorName]['1w'] = parseFloat(String(val[sectorName]).replace('%', '')) || 0;
          if (k === keyMap['1m']) parsed[sectorName]['1m'] = parseFloat(String(val[sectorName]).replace('%', '')) || 0;
          if (k === keyMap['3m']) parsed[sectorName]['3m'] = parseFloat(String(val[sectorName]).replace('%', '')) || 0;
        });
      }
    });
    return parsed;
  }

  const fetchSectors = useCallback(async () => {
    if (!apiKeys.alphaVantage) { setSectorsError('Missing AlphaVantage API key'); return; }
    setSectorsLoading(true);
    setSectorsError('');
    try {
      const resp = await fetch(`/api/sectors?apikey=${apiKeys.alphaVantage}`);
      const data = await resp.json();
      const parsed = parseAlphaVantageSector(data);
      const merged = sectorsList.map(s => {
        const nameMap = {
          Technology: 'Information Technology', 'Real Estate': 'Real Estate',
          Healthcare: 'Health Care', 'Communication Services': 'Communication Services',
          'Consumer Discretionary': 'Consumer Discretionary', Financials: 'Financials',
          Energy: 'Energy', Industrials: 'Industrials', Materials: 'Materials', Utilities: 'Utilities'
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
      setSectorsLive([]);
    } finally {
      setSectorsLoading(false);
    }
  }, [apiKeys.alphaVantage]);

  useEffect(() => {
    let id;
    if (activeTab === 'sectors') {
      fetchSectors();
      id = setInterval(fetchSectors, 5 * 60 * 1000);
    }
    return () => { if (id) clearInterval(id); };
  }, [activeTab, fetchSectors]);

  const fetchMarketIndices = useCallback(async () => {
    setIndicesLoading(true);
    try {
      const symbols = [
        { symbol: 'DIA', name: 'Dow Jones' },
        { symbol: 'SPY', name: 'S&P 500' },
        { symbol: 'QQQ', name: 'Nasdaq' }
      ];
      const results = [];
      for (const idx of symbols) {
        try {
          await new Promise(resolve => setTimeout(resolve, 400));
          const response = await fetch(`/api/quote?ticker=${idx.symbol}`);
          const data = await response.json();
          const quote = data['Global Quote'];
          if (quote) {
            results.push({
              name: idx.name, symbol: idx.symbol,
              price: parseFloat(quote['05. price']),
              change: parseFloat(quote['09. change']),
              changePercent: parseFloat(quote['10. change percent'].replace('%', '')),
            });
          }
        } catch (err) {
          console.warn(`Failed to fetch ${idx.name}:`, err);
        }
      }
      setMarketIndices(results);
    } catch (err) {
      console.error('Failed to fetch market indices:', err);
    } finally {
      setIndicesLoading(false);
    }
  }, []);

  useEffect(() => {
    let id;
    if (activeTab === 'news') {
      fetchMarketIndices();
      id = setInterval(fetchMarketIndices, 2 * 60 * 1000);
    }
    return () => { if (id) clearInterval(id); };
  }, [activeTab, fetchMarketIndices]);

  const fetchSectorEtfQuotes = useCallback(async () => {
    if (!apiKeys.alphaVantage) return;
    try {
      setEtfQuotesLoading(true);
      const tickers = Array.from(new Set(Object.values(SECTOR_ETF_MAP)));
      const results = await Promise.all(
        tickers.map(async (symbol) => {
          try {
            const response = await fetch(`/api/quote?ticker=${symbol}`);
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
      for (const [sym, val] of results) { if (val) obj[sym] = val; }
      setEtfQuotes(obj);
    } catch (err) {
      console.error('Failed to fetch sector ETF quotes:', err);
    } finally {
      setEtfQuotesLoading(false);
    }
  }, [apiKeys.alphaVantage]);

  useEffect(() => {
    let id;
    if (activeTab === 'sectors') {
      fetchSectorEtfQuotes();
      id = setInterval(fetchSectorEtfQuotes, 2 * 60 * 1000);
    }
    return () => { if (id) clearInterval(id); };
  }, [activeTab, fetchSectorEtfQuotes]);

  const fetchAiStocks = useCallback(async () => {
    setAiStocksLoading(true);
    try {
      const allStocks = Object.values(AI_STOCKS).flat();
      const stockData = {};
      for (const stock of allStocks) {
        try {
          await new Promise(resolve => setTimeout(resolve, 400));
          const [quoteResp, histResp] = await Promise.all([
            fetch(`/api/quote?ticker=${stock.symbol}`),
            fetch(`/api/stock-history?ticker=${stock.symbol}`),
          ]);
          const quoteData = await quoteResp.json();
          const histData = await histResp.json();
          const quote = quoteData['Global Quote'];
          if (quote) {
            // Compute 5-day trend: count up vs down days over last 5 closes
            let trend = null;
            if (histData.closes && histData.closes.length >= 2) {
              const closes = histData.closes.map(d => d.close);
              let upDays = 0, downDays = 0;
              for (let i = 1; i < closes.length; i++) {
                if (closes[i] > closes[i - 1]) upDays++;
                else if (closes[i] < closes[i - 1]) downDays++;
              }
              trend = upDays > downDays ? 'up' : downDays > upDays ? 'down' : 'flat';
            }
            stockData[stock.symbol] = {
              price: parseFloat(quote['05. price']),
              change: parseFloat(quote['09. change']),
              changePercent: parseFloat(quote['10. change percent'].replace('%', '')),
              trend,
            };
          }
        } catch (e) {
          console.warn('Failed to fetch AI stock', stock.symbol, e);
        }
      }
      setAiStocks(stockData);
    } catch (err) {
      console.error('Failed to fetch AI stocks:', err);
    } finally {
      setAiStocksLoading(false);
    }
  }, []);

  const fetchAiNews = useCallback(async () => {
    setAiNewsLoading(true);
    try {
      const resp = await fetch('/api/ai-news');
      const data = await resp.json();
      if (data.articles) setAiNews(data.articles);
      setAiLastUpdated(new Date().toISOString());
    } catch (err) {
      console.error('Failed to fetch AI news:', err);
    } finally {
      setAiNewsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'ai') {
      fetchAiNews();
      fetchAiStocks();
    }
  }, [activeTab, fetchAiNews, fetchAiStocks]);

  const fetchNewsWithKey = useCallback(async function(newsApiKey, q) {
    setLoading(true);
    setError('');
    try {
      // Try RSS feeds first
      const url = q
        ? `/api/news?apikey=${newsApiKey}&q=${encodeURIComponent(q)}`
        : `/api/financial-news?apikey=${newsApiKey}`;
      const response = await fetch(url);
      const data = await response.json();
      if (data.articles && data.articles.length > 0) {
        const formattedNews = data.articles.map(article => ({
          headline: article.title,
          summary: article.summary || article.description || '',
          url: article.url || '',
          sentiment: article.sentiment || analyzeSentiment(article.title + ' ' + (article.summary || '')),
          publishedAt: article.publishedAt || null,
          source: article.source || null,
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

  useEffect(function() {
    async function loadDefaultKeysAndNews() {
      try {
        const response = await fetch('/api/default-keys');
        const data = await response.json();
        if (data && !data.error) {
          setApiKeys(data);
          if (data.newsApi) fetchNewsWithKey(data.newsApi);
        }
      } catch (err) {
        console.error('Failed to load default keys:', err);
      }
    }
    loadDefaultKeysAndNews();
  }, [fetchNewsWithKey]);

  const newsCards = newsStories.map((story, idx) => {
    let sentimentClass = 'bg-yellow-500/20 text-yellow-400';
    if (story.sentiment === 'positive') sentimentClass = 'bg-emerald-500/20 text-emerald-400';
    else if (story.sentiment === 'negative') sentimentClass = 'bg-red-500/20 text-red-400';
    let timeAgo = '';
    if (story.publishedAt) {
      const publishedDate = new Date(story.publishedAt);
      const now = new Date();
      const diffMs = now - publishedDate;
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);
      if (diffMins < 60) timeAgo = `${diffMins}m ago`;
      else if (diffHours < 24) timeAgo = `${diffHours}h ago`;
      else if (diffDays < 7) timeAgo = `${diffDays}d ago`;
      else timeAgo = publishedDate.toLocaleDateString();
    }
    return (
      <div key={idx} className="relative glass-sheen overflow-hidden lg-panel rounded-lg p-4 hover:opacity-95 transition-colors">
        <div className="flex justify-between items-start mb-2">
          <a href={story.url} target="_blank" rel="noopener noreferrer"
            className="text-lg font-bold flex-1 text-blue-400 hover:text-blue-300 cursor-pointer transition-colors">
            {story.headline}
          </a>
          <div className="flex flex-col items-end gap-1 ml-4 shrink-0">
          <span className={'px-3 py-1 rounded-full text-xs font-semibold ' + sentimentClass}>{story.sentiment}</span>
          {story.source && <span className="text-xs text-slate-500">{story.source}</span>}
          </div>
        </div>
        {timeAgo && <div className="text-xs text-slate-400 mb-2">{timeAgo}</div>}
        <p className="text-slate-300 mb-3">{story.summary}</p>
      </div>
    );
  });

  return (
    <div className={`min-h-screen ${theme === 'liquid-glass' ? 'theme-liquid-glass' : 'bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900'} text-white`} data-theme={theme}>
      <div
        className={`fixed inset-0 ${theme === 'liquid-glass' ? 'bg-black/30 backdrop-blur-sm' : 'bg-black/50'} z-40 transition-opacity duration-200 ${mobileNavOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        onClick={() => setMobileNavOpen(false)}
        aria-hidden={!mobileNavOpen}
      />
      <aside role="dialog" aria-modal="true"
        className="fixed top-0 right-0 h-full w-64 max-w-xs lg-panel z-50 md:hidden"
        style={{ transform: mobileNavOpen ? 'translateX(0)' : 'translateX(100%)', transition: 'transform 300ms ease-out' }}>
        <div className="p-4 border-b border-slate-700 flex items-center justify-between">
          <div className="text-lg font-bold">Menu</div>
          <button onClick={() => setMobileNavOpen(false)} aria-label="Close menu"
            className={`p-2 rounded ${theme === 'liquid-glass' ? 'bg-white/5 hover:bg-white/10' : 'bg-slate-700 hover:bg-slate-600'}`}>
            <X size={18} />
          </button>
        </div>
        <div className="p-4 space-y-2">
          {['news','sectors','charts','screener','ai','settings'].map(tab => (
            <button key={tab} onClick={() => { setActiveTab(tab); setMobileNavOpen(false); }}
              className={`w-full text-left px-4 py-2 rounded text-sm font-semibold ${activeTab === tab ? (theme === 'liquid-glass' ? 'bg-white/6 text-slate-100' : 'bg-slate-700 text-white') : 'text-slate-200'}`}>
              {tab === 'news' ? 'News' : tab === 'sectors' ? 'Sector Trends' : tab === 'charts' ? 'Technical Analysis' : tab === 'screener' ? 'Stock Valuations' : tab === 'ai' ? 'AI Tracker' : 'Settings'}
            </button>
          ))}
        </div>
      </aside>

      <div className="max-w-7xl mx-auto p-6">
        <header className="mb-8 flex items-center justify-between relative glass-sheen overflow-hidden">
          <div>
            <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">Financial Hub</h1>
            <p className="text-slate-400 hidden md:block">Comprehensive market insights and stock analysis tools</p>
          </div>
          <div className="md:hidden fixed top-4 right-6 z-60">
            <button onClick={() => setMobileNavOpen(prev => !prev)} aria-expanded={mobileNavOpen} aria-label="Toggle navigation"
              className={`p-2 rounded ${theme === 'liquid-glass' ? 'bg-white/5 hover:bg-white/10' : 'bg-slate-700 hover:bg-slate-600'}`}>
              <span className="relative inline-block w-5 h-5">
                <Menu size={20} className={`absolute inset-0 transition-all duration-200 transform ${mobileNavOpen ? 'opacity-0 scale-90' : 'opacity-100 scale-100'}`} />
                <X size={20} className={`absolute inset-0 transition-all duration-200 transform ${mobileNavOpen ? 'opacity-100 scale-105' : 'opacity-0 scale-90'}`} />
              </span>
            </button>
          </div>
        </header>

        <div className={`${theme === 'liquid-glass' ? 'lg-panel' : 'bg-slate-800'} rounded-xl shadow-2xl p-6`}>
          <div className="mb-6">
            <div className="flex items-center justify-between">
              <div className="hidden md:flex items-center gap-3">
                {[
                  { id: 'news', label: 'News' },
                  { id: 'sectors', label: 'Sector Trends' },
                  { id: 'charts', label: 'Technical Analysis' },
                  { id: 'screener', label: 'Stock Valuations' },
                  { id: 'ai', label: 'AI Tracker' },
                ].map(t => (
                  <button key={t.id} onClick={() => setActiveTab(t.id)}
                    className={"px-4 py-2 rounded-md text-sm font-semibold " + (activeTab === t.id ? 'bg-slate-700 text-white' : 'bg-transparent text-slate-400 hover:bg-slate-700')}>
                    {t.label}
                  </button>
                ))}
                <button onClick={() => setActiveTab('settings')}
                  className={"px-3 py-2 rounded-md text-sm font-semibold flex items-center gap-2 " + (activeTab === 'settings' ? 'bg-slate-700 text-white' : 'bg-transparent text-slate-400 hover:bg-slate-700')}>
                  <Settings size={16} /> Settings
                </button>
              </div>
            </div>
            {mobileNavOpen && (
              <>
                <MobileNavEscapeHandler onClose={() => setMobileNavOpen(false)} />
                <MobileNavFocusTrap />
              </>
            )}
          </div>

          {/* NEWS TAB */}
          {activeTab === 'news' && (
            <div>
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold flex items-center gap-2 text-slate-100"><Newspaper className="text-blue-400" />Market News</h2>
                  <p className="text-slate-400 text-sm hidden md:block">Curated market-moving headlines and quick sentiment.</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-xs text-slate-400">{newsLastUpdated ? `Last: ${new Date(newsLastUpdated).toLocaleString()}` : ''}</div>
                  <button onClick={() => fetchNewsWithKey(apiKeys.newsApi)}
                    className="bg-blue-600 hover:bg-blue-700 px-3 py-1 rounded text-sm font-medium flex items-center gap-2" disabled={loading}>
                    {loading ? <Loader className="animate-spin" size={14} /> : 'Refresh'}
                  </button>
                </div>
              </div>
              {!indicesLoading && marketIndices.length > 0 && (
                <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                  {marketIndices.map((index) => (
                    <div key={index.symbol} className="lg-panel rounded-lg p-4 border border-slate-600 hover:shadow-lg transition-shadow cursor-pointer"
                      onClick={() => { setStockTicker(index.symbol); setActiveTab('charts'); }}>
                      <div className="text-sm text-slate-400 mb-1 flex items-center justify-between">
                        <div>{index.symbol} ({index.name})</div>
                        <button onClick={(e) => { e.stopPropagation(); fetchNewsWithKey(apiKeys.newsApi, index.symbol); }}
                          className="text-xs lg-subpanel px-2 py-1 rounded hover:opacity-95 text-slate-200">News</button>
                      </div>
                      <div className="flex items-baseline justify-between">
                        <div className="text-2xl font-bold text-white">{index.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                        <div className={'text-sm font-semibold ' + (index.change >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                          {index.change >= 0 ? '+' : ''}{index.change.toFixed(2)} ({index.changePercent >= 0 ? '+' : ''}{index.changePercent.toFixed(2)}%)
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {!newsStories || newsStories.length === 0
                ? <div className="lg-panel rounded-lg p-8 text-center text-slate-300">No news available. Try refreshing or check API keys.</div>
                : <div className="space-y-4">{newsCards}</div>
              }
            </div>
          )}

          {/* SETTINGS TAB */}
          {activeTab === 'settings' && (
            <div>
              <div className="mb-4">
                <h2 className="text-2xl font-bold flex items-center gap-2 text-slate-100"><Settings className="text-blue-400" />Settings</h2>
                <p className="text-slate-400 text-sm hidden md:block">Customize application behavior and appearance</p>
              </div>
              <div className="lg-panel rounded-lg p-4">
                <h3 className="text-lg font-semibold mb-3 text-slate-100">Theme</h3>
                <div className="flex flex-col sm:flex-row gap-3">
                  {['classic', 'liquid-glass'].map(t => (
                    <label key={t} className={`p-3 rounded-md cursor-pointer flex-1 border ${theme === t ? 'border-blue-500 bg-slate-600' : 'border-transparent lg-panel'}`}>
                      <input type="radio" name="theme" value={t} checked={theme === t} onChange={() => setTheme(t)} className="mr-3" />
                      <div>
                        <div className="font-semibold">{t === 'classic' ? 'Classic' : 'Liquid Glass'}</div>
                        <div className="text-xs text-slate-400">{t === 'classic' ? 'Current application look' : 'A glassy, translucent aesthetic'}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* SECTORS TAB */}
          {activeTab === 'sectors' && (
            <div>
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold flex items-center gap-2 text-slate-100"><BarChart3 className="text-blue-400" />Sector Trends</h2>
                  <p className="text-slate-400 text-sm hidden md:block">Current performance and near-term outlook for major sectors.</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-xs text-slate-400">{sectorsLastUpdated ? `Last: ${new Date(sectorsLastUpdated).toLocaleString()}` : ''}</div>
                  <button onClick={fetchSectors} className="bg-blue-600 hover:bg-blue-700 px-3 py-1 rounded text-sm font-medium flex items-center gap-2" disabled={sectorsLoading}>
                    {sectorsLoading ? <Loader className="animate-spin" size={14} /> : 'Refresh'}
                  </button>
                </div>
              </div>
              {sectorsError && <div className="bg-red-900/30 border border-red-500/50 rounded-lg p-3 mb-4"><p className="text-red-300 text-sm">{sectorsError}</p></div>}
              {sectorsLoading
                ? <div className="flex items-center justify-center py-8"><Loader className="animate-spin text-blue-400" size={36} /></div>
                : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {(sectorsLive && sectorsLive.length > 0 ? sectorsLive : sectorsList).map(sec => {
                      const outlook = determineSectorOutlook(sec.perf);
                      const isStrong = outlook === 'Strong';
                      const isRecovery = outlook === 'Early Recovery';
                      const isWeak = outlook === 'Weak';
                      const etfTicker = SECTOR_ETF_MAP[sec.name] || null;
                      const badgeClass = isStrong ? 'bg-emerald-500 text-emerald-900' : isRecovery ? 'bg-amber-300 text-amber-900' : isWeak ? 'bg-red-300 text-red-900' : 'bg-slate-700 text-slate-200';
                      return (
                        <div key={sec.id} className={'p-4 rounded-lg relative overflow-hidden glass-sheen ' + (isStrong ? 'border-2 border-emerald-600' : 'lg-panel')}>
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <h3 className="text-lg font-semibold text-slate-100">{sec.name}</h3>
                              <div className="text-xs text-slate-400">{sec.drivers}</div>
                            </div>
                            <div className="text-right"><div className={"inline-block px-2 py-1 rounded text-xs font-semibold " + badgeClass}>{outlook}</div></div>
                          </div>
                          {etfTicker && (
                            <div className="mt-2 flex items-center justify-between">
                              <button type="button" onClick={() => { setStockTicker(etfTicker); setActiveTab('charts'); }}
                                className="inline-flex items-center gap-2 text-[11px] uppercase tracking-wide px-2 py-1 rounded lg-subpanel text-slate-200 border border-slate-600 hover:opacity-95 transition-colors">
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
                            {['1w','1m','3m'].map(p => (
                              <div key={p}>
                                <div className="text-xs text-slate-400">{p.toUpperCase()}</div>
                                <div className={sec.perf[p] >= 0 ? 'text-emerald-300' : 'text-red-300'}>{sec.perf[p]}%</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )
              }
            </div>
          )}

          {/* SCREENER TAB */}
          {activeTab === 'screener' && (
            <div>
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold flex items-center gap-2 text-slate-100"><Search className="text-blue-400" />Stock Valuations</h2>
                  <p className="text-slate-400 text-sm hidden md:block">Comprehensive valuation analysis based on key fundamentals</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-xs text-slate-400">{screenerLastUpdated ? `Last: ${new Date(screenerLastUpdated).toLocaleString()}` : ''}</div>
                </div>
              </div>
              {screenerError && <div className="bg-red-900/30 border border-red-500/50 rounded-lg p-3 mb-4"><p className="text-red-300 text-sm">{screenerError}</p></div>}
              {screenerLoading
                ? <div className="flex items-center justify-center py-8"><Loader className="animate-spin text-blue-400" size={36} /></div>
                : (
                  <div>
                    <div className="mb-6 lg-panel rounded-lg p-4">
                      <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3 mb-4">
                        <input type="text" value={stockInput} onChange={(e) => setStockInput(e.target.value.toUpperCase())}
                          onKeyPress={(e) => e.key === 'Enter' && addStock()} placeholder="Enter stock symbol (e.g., AAPL)"
                          className="lg-subpanel text-white px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 flex-1 min-w-0 w-full md:w-auto"
                          disabled={selectedStocks.length >= MAX_STOCKS} />
                        <button onClick={addStock} disabled={!stockInput || selectedStocks.length >= MAX_STOCKS}
                          className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 px-4 py-2 rounded-lg font-medium w-full md:w-auto">Add Stock</button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {selectedStocks.map((stock) => (
                          <div key={stock} className="lg-subpanel px-3 py-1 rounded-full flex items-center gap-2">
                            <span className="text-sm">{stock}</span>
                            <button onClick={() => removeStock(stock)} className="text-slate-400 hover:text-red-400">×</button>
                          </div>
                        ))}
                      </div>
                      <div className="mt-2 text-xs text-slate-400">{selectedStocks.length}/{MAX_STOCKS} stocks selected</div>
                      <div className="mt-4">
                        <button onClick={fetchScreener} className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg font-medium w-full md:w-auto"
                          disabled={screenerLoading || selectedStocks.length === 0}>
                          {screenerLoading ? <Loader className="animate-spin" size={14} /> : 'Submit'}
                        </button>
                      </div>
                    </div>
                    <div className="space-y-4">
                      {screenerResults.length === 0
                        ? <div className="text-slate-400 text-sm text-center py-8">Add stocks and click Submit to analyze fundamentals.</div>
                        : screenerResults.map(s => {
                          let valuation = 'Fairly Valued';
                          let valuationColor = 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
                          let score = 0; let factors = 0;
                          if (s.peg != null) { if (s.peg < 1) score += 2; else if (s.peg < 2) score += 1; factors += 2; }
                          if (s.pe != null) { if (s.pe < 15) score += 1; else if (s.pe > 25) score -= 1; factors += 1; }
                          if (s.pb != null) { if (s.pb < 1) score += 1; else if (s.pb < 3) score += 0.5; factors += 1; }
                          if (s.profitMargin != null && s.profitMargin > 0) { if (s.profitMargin > 20) score += 1; else if (s.profitMargin > 15) score += 0.5; factors += 1; }
                          const avgScore = factors > 0 ? score / factors : 0.5;
                          if (avgScore > 0.6) { valuation = 'Undervalued'; valuationColor = 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'; }
                          else if (avgScore < 0.3) { valuation = 'Overvalued'; valuationColor = 'bg-red-500/20 text-red-400 border-red-500/30'; }
                          return (
                            <div key={s.symbol} className="lg-panel rounded-lg p-5">
                              <div className="flex justify-between items-start mb-4">
                                <div className="flex-1">
                                  <div className="flex items-baseline gap-4">
                                    <div className="text-2xl font-bold text-blue-400">{s.symbol}</div>
                                  </div>
                                  <div className="text-slate-300 text-sm mt-1">{s.name}</div>
                                </div>
                                <div className={'px-4 py-2 rounded border font-bold ' + valuationColor + ' hidden md:block'}>{valuation}</div>
                              </div>
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                {[
                                  { label: 'Market Cap', value: s.marketCap ? formatCurrencyAbbrev(s.marketCap) : 'N/A', sub: 'Total market value' },
                                  { label: 'Revenue (TTM)', value: s.revenueTTM ? formatCurrencyAbbrev(s.revenueTTM) : 'N/A', sub: 'Trailing twelve months' },
                                  { label: 'Price-to-Sales', value: s.priceToSales ?? 'N/A', sub: s.priceToSales != null ? (s.priceToSales < 2 ? '✓ Low' : s.priceToSales < 5 ? 'Fair' : '⚠ High') : '' },
                                  { label: 'P/E Ratio', value: s.pe ?? 'N/A', sub: s.pe != null ? (s.pe < 15 ? '✓ Low' : s.pe < 25 ? 'Fair' : '⚠ High') : '' },
                                  { label: 'PEG Ratio ⭐', value: s.peg ?? 'N/A', sub: s.peg != null ? (s.peg < 1 ? '✓ Great' : s.peg < 2 ? 'Fair' : '⚠ High') : '' },
                                  { label: 'Price-to-Book', value: s.pb ?? 'N/A', sub: s.pb != null ? (s.pb < 1 ? '✓ Low' : s.pb < 3 ? 'Fair' : '⚠ High') : '' },
                                  { label: 'Profit Margin %', value: s.profitMargin != null ? (s.profitMargin * 100).toFixed(2) + '%' : 'N/A', sub: s.profitMargin != null ? (s.profitMargin * 100 > 20 ? '✓ Excellent' : s.profitMargin * 100 > 10 ? 'Good' : s.profitMargin * 100 > 0 ? 'Fair' : '⚠ Low') : '' },
                                  { label: 'EPS Growth', value: s.qEarningsGrowth != null ? (s.qEarningsGrowth > 0 ? '+' : '') + (s.qEarningsGrowth * 100).toFixed(2) + '%' : 'N/A', sub: s.qEarningsGrowth != null ? (s.qEarningsGrowth * 100 > 15 ? '✓ Strong' : s.qEarningsGrowth * 100 > 5 ? 'Good' : s.qEarningsGrowth * 100 > 0 ? 'Fair' : '⚠ Negative') : '' },
                                ].map(m => (
                                  <div key={m.label} className="lg-subpanel rounded-lg p-3">
                                    <div className="text-xs text-slate-400 mb-1">{m.label}</div>
                                    <div className="text-lg font-bold">{m.value}</div>
                                    <div className="text-xs text-slate-500 mt-1">{m.sub}</div>
                                  </div>
                                ))}
                              </div>
                              <div className={'mt-4 px-4 py-2 rounded border font-bold ' + valuationColor + ' md:hidden text-center'}>{valuation}</div>
                            </div>
                          );
                        })
                      }
                    </div>
                  </div>
                )
              }
            </div>
          )}

          {/* AI TRACKER TAB */}
          {activeTab === 'ai' && (
            <div>
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold flex items-center gap-2 text-slate-100">🤖 AI Tracker</h2>
                  <p className="text-slate-400 text-sm hidden md:block">Live AI stock prices and latest AI news from across the web</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-xs text-slate-400">{aiLastUpdated ? `Last: ${new Date(aiLastUpdated).toLocaleString()}` : ''}</div>
                  <button onClick={() => { fetchAiNews(); fetchAiStocks(); }}
                    className="bg-blue-600 hover:bg-blue-700 px-3 py-1 rounded text-sm font-medium flex items-center gap-2"
                    disabled={aiNewsLoading || aiStocksLoading}>
                    {aiNewsLoading || aiStocksLoading ? <Loader className="animate-spin" size={14} /> : 'Refresh'}
                  </button>
                </div>
              </div>

              <div className="mb-8">
                <h3 className="text-lg font-semibold text-slate-200 mb-4">AI Stocks</h3>
                {aiStocksLoading && Object.keys(aiStocks).length === 0 ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader className="animate-spin text-blue-400 mr-3" size={24} />
                    <span className="text-slate-400">Loading stock prices...</span>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {Object.entries(AI_STOCKS).map(([category, stocks]) => (
                      <div key={category}>
                        <h4 className="text-sm font-semibold text-blue-400 uppercase tracking-wide mb-3">{category}</h4>
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                          {stocks.map(stock => {
                            const data = aiStocks[stock.symbol];
                            const isUp = data && data.change >= 0;
                            const cardStyle = data
                              ? isUp
                                ? { background: 'rgba(6, 78, 59, 0.55)', borderColor: 'rgba(6, 78, 59, 0.6)' }
                                : { background: 'rgba(127, 29, 29, 0.55)', borderColor: 'rgba(127, 29, 29, 0.6)' }
                              : {};
                            return (
                              <div key={stock.symbol}
                                className="lg-panel rounded-lg p-3 cursor-pointer hover:opacity-90 transition-opacity"
                                style={cardStyle}
                                onClick={() => { setStockTicker(stock.symbol); setActiveTab('charts'); }}>
                                <div className="flex items-center justify-between mb-1">
                                  <div className="text-xs text-slate-400">{stock.name}</div>
                                  {data && data.trend && (
                                    <span className={`text-sm font-bold leading-none ${data.trend === 'up' ? 'text-emerald-400' : data.trend === 'down' ? 'text-red-400' : 'text-slate-400'}`}
                                      title={`5-day trend: ${data.trend}`}>
                                      {data.trend === 'up' ? '↑' : data.trend === 'down' ? '↓' : '→'}
                                    </span>
                                  )}
                                </div>
                                <div className="text-lg font-bold text-blue-400">{stock.symbol}</div>
                                {data ? (
                                  <>
                                    <div className="text-sm font-semibold text-white mt-1">${data.price.toFixed(2)}</div>
                                    <div className={'text-xs font-medium mt-1 ' + (isUp ? 'text-emerald-400' : 'text-red-400')}>
                                      {data.change >= 0 ? '+' : ''}{data.change.toFixed(2)} ({data.changePercent >= 0 ? '+' : ''}{data.changePercent.toFixed(2)}%)
                                    </div>
                                  </>
                                ) : (
                                  <div className="text-xs text-slate-500 mt-1">Loading...</div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <h3 className="text-lg font-semibold text-slate-200 mb-4">Latest AI News</h3>
                {aiNewsLoading && aiNews.length === 0 ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader className="animate-spin text-blue-400 mr-3" size={24} />
                    <span className="text-slate-400">Fetching AI news from across the web...</span>
                  </div>
                ) : aiNews.length === 0 ? (
                  <div className="lg-panel rounded-lg p-8 text-center text-slate-300">No AI news found. Try refreshing.</div>
                ) : (
                  <div className="space-y-3">
                    {aiNews.map((article, idx) => {
                      let timeAgo = '';
                      if (article.published) {
                        const publishedDate = new Date(article.published);
                        const diffMs = new Date() - publishedDate;
                        const diffMins = Math.floor(diffMs / 60000);
                        const diffHours = Math.floor(diffMs / 3600000);
                        const diffDays = Math.floor(diffMs / 86400000);
                        if (diffMins < 60) timeAgo = `${diffMins}m ago`;
                        else if (diffHours < 24) timeAgo = `${diffHours}h ago`;
                        else if (diffDays < 7) timeAgo = `${diffDays}d ago`;
                        else timeAgo = publishedDate.toLocaleDateString();
                      }
                      return (
                        <div key={idx} className="lg-panel rounded-lg p-4 hover:opacity-95 transition-colors">
                          <div className="flex justify-between items-start mb-1">
                            <a href={article.link} target="_blank" rel="noopener noreferrer"
                              className="text-base font-semibold text-blue-400 hover:text-blue-300 flex-1 transition-colors">
                              {article.title}
                            </a>
                            <span className="text-xs text-slate-500 ml-4 whitespace-nowrap">{article.source}</span>
                          </div>
                          {timeAgo && <div className="text-xs text-slate-500 mb-1">{timeAgo}</div>}
                          {article.summary && <p className="text-sm text-slate-400">{article.summary.slice(0, 200)}{article.summary.length > 200 ? '...' : ''}</p>}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* CHARTS TAB */}
          {activeTab === 'charts' && (
            <div>
              <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-4 gap-3">
                <div>
                  <h2 className="text-2xl font-bold flex items-center gap-2"><Target className="text-blue-400" />Technical Analysis</h2>
                  <p className="text-slate-400 hidden md:block">Price, support/resistance, and pattern overlays</p>
                </div>
                <div className="flex flex-col md:flex-row md:items-center items-stretch gap-3 w-full md:w-auto">
                  <input type="text" value={stockTicker} onChange={e => setStockTicker(e.target.value.toUpperCase())}
                    placeholder="e.g. AAPL"
                    className="bg-slate-700 text-white px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 flex-1 min-w-0 w-full md:w-auto" />
                  <button onClick={analyzeChartData} disabled={loading}
                    className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 disabled:cursor-not-allowed px-6 py-2 rounded-lg font-semibold flex items-center gap-2 transition-colors w-full md:w-auto justify-center">
                    {loading ? <Loader className="animate-spin" size={18} /> : <Search size={18} />}
                    <span className="ml-1">Analyze</span>
                  </button>
                </div>
              </div>

              {technicalData && (
                <div className="bg-slate-700 rounded-lg p-4 relative glass-sheen overflow-hidden">
                  <div className="mb-6 pb-4 border-b border-slate-600">
                    <div className="flex justify-between items-center">
                      <div>
                        <h3 className="text-3xl font-bold text-blue-400">
                          {stockTicker}
                          {technicalData.companyName && <span className="text-xl font-normal text-slate-400 ml-3">{technicalData.companyName}</span>}
                        </h3>
                        <p className="text-xl text-slate-300 mt-2">Current Price: <span className="font-bold">${technicalData.currentPrice}</span></p>
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
                        <span className={'px-4 py-2 rounded-full font-semibold text-lg ' + (trend === 'Bullish' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400')}>
                          {trend} Trend
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="h-96">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={technicalData.chartData.slice(-chartWindow)}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                        <XAxis dataKey="date" stroke="#9CA3AF" tick={{ fill: '#9CA3AF' }} tickLine={{ stroke: '#4B5563' }} />
                        <YAxis stroke="#9CA3AF" tick={{ fill: '#9CA3AF' }} tickLine={{ stroke: '#4B5563' }} domain={['auto', 'auto']} />
                        <Tooltip contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: '0.375rem' }} labelStyle={{ color: '#9CA3AF' }} />
                        <Legend />
                        <Line type="monotone" dataKey="price" stroke="#60A5FA" dot={false} name="Price" />
                        {showSR && technicalData.analysis.supports.map((level, idx) => (
                          <ReferenceLine key={`sup-${idx}`} y={Number(level)} stroke="#10B981" strokeDasharray="4 4" label={{ value: `S ${level}`, position: 'right', fill: '#10B981' }} />
                        ))}
                        {showSR && technicalData.analysis.resistances.map((level, idx) => (
                          <ReferenceLine key={`res-${idx}`} y={Number(level)} stroke="#EF4444" strokeDasharray="4 4" label={{ value: `R ${level}`, position: 'right', fill: '#EF4444' }} />
                        ))}
                        {showSR && technicalData.srBand && (
                          <ReferenceArea y1={technicalData.srBand.support} y2={technicalData.srBand.resistance}
                            stroke="rgba(99,102,241,0.22)" strokeOpacity={0.35} fill="rgba(99,102,241,0.16)" />
                        )}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="mt-4 text-xs text-slate-400">
                    <span className="inline-block bg-blue-500/20 text-blue-400 px-2 py-1 rounded mr-2">Shaded band</span>
                    shows area between nearest support and resistance.
                  </div>
                  <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="lg-subpanel rounded-lg p-4">
                      <h4 className="text-lg font-semibold text-blue-400 mb-2">Key Levels</h4>
                      <div className="space-y-2">
                        <p className="text-slate-300">Support Levels: <span className="font-bold text-emerald-400">{technicalData.analysis.supports.join(', ')}</span></p>
                        <p className="text-slate-300">Resistance Levels: <span className="font-bold text-red-400">{technicalData.analysis.resistances.join(', ')}</span></p>
                        <p className="text-slate-300">Breakout Zone: <span className="font-bold text-blue-400">{technicalData.srBand ? `${technicalData.srBand.support} - ${technicalData.srBand.resistance}` : 'N/A'}</span></p>
                        <p className="text-slate-300">Pattern: <span className="font-bold text-yellow-400">{technicalData.analysis.pattern}</span></p>
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
                          return (
                            <>
                              <p className="text-slate-300"><strong>Short-term:</strong> Watch for price action near support ({supText}) and resistance ({resText}). Potential entry near support, exit near resistance. Breakouts above {highestRes ? `$${highestRes.toFixed(2)}` : 'resistance'} may signal momentum trades.</p>
                              <p className="text-slate-300"><strong>Long-term:</strong> Position entries near support zones ({supText}), with targets at resistance ({resText}). Consider stop-loss below {lowestSup ? `$${lowestSup.toFixed(2)}` : 'support'}.</p>
                              <p className="text-slate-400 text-xs">These signals are based on recent pivots. Always confirm with broader market context and risk management.</p>
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