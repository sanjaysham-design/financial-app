import React, { useState, useEffect, useCallback } from 'react';
import { TrendingUp, Newspaper, BarChart3, Target, Search, Loader } from 'lucide-react';

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

function FinancialApp() {
  // State declarations
  const [activeTab, setActiveTab] = useState('news');
  const [stockTicker, setStockTicker] = useState('');
  const [apiKeys, setApiKeys] = useState({
    alphaVantage: '',
    finnhub: '',
    newsApi: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [newsStories, setNewsStories] = useState([]);
  // Removed unused chartAnalysis and sentimentAnalysis state

    // Technical chart state
    const [technicalData, setTechnicalData] = useState(null);
    const [chartWindow, setChartWindow] = useState(() => {
      const saved = localStorage.getItem('chartWindow');
      return saved ? Number(saved) : 200;
    });
    const [showSROverlay, setShowSROverlay] = useState(true);
    const [showSRShade, setShowSRShade] = useState(true);

    // Persist chartWindow to localStorage
    useEffect(() => {
      localStorage.setItem('chartWindow', chartWindow);
    }, [chartWindow]);

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
        const response = await fetch(`/api/chart-data?ticker=${stockTicker}&apikey=${apiKeys.alphaVantage}&outputsize=full`);
        const data = await response.json();
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
          setTechnicalData({ chartData, analysis: pivots, srBand });
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

  const tabs = [
    { id: 'news', name: 'Market News', icon: Newspaper },
    { id: 'screener', name: 'Stock Screener', icon: TrendingUp },
    { id: 'sectors', name: 'Sector Trends', icon: BarChart3 },
    { id: 'charts', name: 'Technical Analysis', icon: Target }
  ];

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

  // Helper function to fetch news
  const fetchNewsWithKey = useCallback(async function(newsApiKey) {
    setLoading(true);
    setError('');
    
    try {
      const response = await fetch('/api/news?apikey=' + newsApiKey);
      const data = await response.json();
      
      if (data.articles) {
        const formattedNews = data.articles.map(article => ({
          headline: article.title,
          impact: 'Market Moving',
          summary: article.description || '',
          url: article.url || '',
          implications: 'Analyze based on content and market context',
          sentiment: analyzeSentiment(article.title + ' ' + article.description)
        }));
        setNewsStories(formattedNews);
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
    return (
      <div key={idx} className="bg-slate-700 rounded-lg p-4 hover:bg-slate-600 transition-colors">
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
        <p className="text-slate-300 mb-3">{story.summary}</p>
        <div className="bg-slate-800 rounded p-3">
          <p className="text-sm font-semibold text-blue-400 mb-1">Investment Implications:</p>
          <p className="text-sm text-slate-300">{story.implications}</p>
        </div>
      </div>
    );
  });

  // ...existing code...

  // Technical chart rendering (restored)
  // Example: Place this inside your render function where you want the chart to appear
  // You will need to wire up technicalData, chartWindow, showSROverlay, showSRShade, etc. in later steps
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
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      <div className="max-w-7xl mx-auto p-6">
        <header className="mb-8">
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">
            Financial Analysis Hub
          </h1>
          <p className="text-slate-400">Comprehensive market insights and stock analysis tools</p>
        </header>

        {error && (
          <div className="bg-red-900/30 border border-red-500/50 rounded-lg p-4 mb-6">
            <p className="text-red-300 text-sm">{error}</p>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {tabs.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={'flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all whitespace-nowrap ' + 
                  (isActive ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/50' : 'bg-slate-800 text-slate-300 hover:bg-slate-700')}
              >
                <Icon size={18} />
                {tab.name}
              </button>
            );
          })}
        </div>

        {/* Content Area */}
        <div className="bg-slate-800 rounded-xl shadow-2xl p-6">
          {/* News Tab */}
          {activeTab === 'news' && (
            <div>
              <div className="mb-4">
                <h2 className="text-2xl font-bold flex items-center gap-2">
                  <Newspaper className="text-blue-400" />
                  Market News
                </h2>
                <p className="text-slate-400 text-sm">Top market-moving stories - automatically updated</p>
              </div>

              {loading && (
                <div className="flex items-center justify-center py-12">
                  <Loader className="animate-spin text-blue-400" size={48} />
                </div>
              )}

              {newsStories.length > 0 && (
                <div className="space-y-4">{newsCards}</div>
              )}

              {newsStories.length === 0 && !loading && (
                <div className="bg-slate-700 rounded-lg p-8 text-center">
                  <Newspaper className="mx-auto mb-3 text-slate-400" size={48} />
                  <p className="text-slate-300">Loading news articles...</p>
                </div>
              )}
            </div>
          )}

          {/* Charts Tab */}
          {activeTab === 'charts' && (
              <div>
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <h2 className="text-2xl font-bold flex items-center gap-2">
                      <Target className="text-blue-400" />
                      Technical Analysis
                    </h2>
                    <p className="text-slate-400">Price, moving averages, support/resistance, and overlays</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={stockTicker}
                      onChange={e => setStockTicker(e.target.value.toUpperCase())}
                      placeholder="e.g. AAPL"
                      className="bg-slate-700 text-white px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      onClick={analyzeChartData}
                      disabled={loading}
                      className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 disabled:cursor-not-allowed px-6 py-2 rounded-lg font-semibold flex items-center gap-2 transition-colors"
                    >
                      {loading ? <Loader className="animate-spin" size={18} /> : <Search size={18} />}
                      Analyze
                    </button>
                    <div className="ml-3">
                      <label className="text-xs text-slate-400 mr-2">View:</label>
                      <select value={chartWindow} onChange={e => setChartWindow(Number(e.target.value))} className="bg-slate-700 text-sm text-white px-2 py-1 rounded">
                        <option value={200}>200 days</option>
                        <option value={30}>30 days</option>
                        <option value={10}>10 days</option>
                        <option value={1}>1 day</option>
                      </select>
                    </div>
                    <div className="flex items-center gap-3 ml-4">
                      <label className="flex items-center gap-2 text-sm text-slate-300">
                        <input type="checkbox" checked={showSROverlay} onChange={e => setShowSROverlay(e.target.checked)} className="w-4 h-4" />
                        Show S/R
                      </label>
                      <label className="flex items-center gap-2 text-sm text-slate-300">
                        <input type="checkbox" checked={showSRShade} onChange={e => setShowSRShade(e.target.checked)} className="w-4 h-4" />
                        Shade S/R band
                      </label>
                    </div>
                  </div>
                </div>
                {/* Chart rendering */}
                {technicalData && (
                  <div className="bg-slate-700 rounded-lg p-4">
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
                          {showSROverlay && technicalData.analysis.supports.map((level, idx) => (
                            <ReferenceLine key={`sup-${idx}`} y={Number(level)} stroke="#10B981" strokeDasharray="4 4" label={{ value: `S ${level}`, position: 'right', fill: '#10B981' }} />
                          ))}
                          {showSROverlay && technicalData.analysis.resistances.map((level, idx) => (
                            <ReferenceLine key={`res-${idx}`} y={Number(level)} stroke="#EF4444" strokeDasharray="4 4" label={{ value: `R ${level}`, position: 'right', fill: '#EF4444' }} />
                          ))}
                          {/* Shade between nearest support and resistance */}
                          {showSRShade && technicalData.srBand && (
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
                      shows area between nearest support and resistance. Use toggles to show/hide overlays and shading.
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
