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
  const [chartAnalysis, setChartAnalysis] = useState(null);
  const [sentimentAnalysis, setSentimentAnalysis] = useState(null);

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
    async function analyzeChartData() {
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
    }

    // Auto-refresh chart when chartWindow changes
    useEffect(() => {
      if (stockTicker) analyzeChartData();
    }, [chartWindow]);

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

  function findSupportLevels(prices) {
    const recentPrices = prices.slice(0, 50);
    const sorted = recentPrices.slice().sort((a, b) => a - b);
    const idx1 = Math.floor(sorted.length * 0.2);
    const idx2 = Math.floor(sorted.length * 0.4);
    return [sorted[idx1].toFixed(2), sorted[idx2].toFixed(2)];
  }

  function findResistanceLevels(prices) {
    const recentPrices = prices.slice(0, 50);
    const sorted = recentPrices.slice().sort((a, b) => b - a);
    const idx1 = Math.floor(sorted.length * 0.2);
    const idx2 = Math.floor(sorted.length * 0.4);
    return [sorted[idx1].toFixed(2), sorted[idx2].toFixed(2)];
  }

  function identifyPattern(prices) {
    const direction = prices[0] > prices[prices.length - 1] ? 'Ascending' : 'Descending';
    return `${direction} Channel`;
  }

  function generateSignals(prices, support, resistance) {
    return [
      'Current price relative to 50-day range',
      'Support levels identified at $' + support.join(', $'),
      'Resistance levels at $' + resistance.join(', $'),
      'Momentum indicators suggest ' + (prices[0] > prices[10] ? 'bullish' : 'bearish') + ' bias'
    ];
  }

  function generateRecommendation(current, support, resistance) {
    return 'Consider entry near $' + support[0] + '. Target $' + resistance[0] + ' on breakout. Stop loss below $' + support[1] + '.';
  }

  async function analyzeChartData() {
    if (!stockTicker || !apiKeys.alphaVantage || !apiKeys.finnhub) {
      setError('Please enter a ticker and configure API keys');
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      const response = await fetch('/api/chart-data?ticker=' + stockTicker + '&apikey=' + apiKeys.alphaVantage + '&outputsize=full');
      const data = await response.json();
      
      if (data['Time Series (Daily)']) {
        const timeSeries = data['Time Series (Daily)'];
        const datesDesc = Object.keys(timeSeries).slice(0, 500);
        const closesDesc = datesDesc.map(date => parseFloat(timeSeries[date]['4. close']));
        
        const currentPrice = closesDesc[0];
        const support = findSupportLevels(closesDesc);
        const resistance = findResistanceLevels(closesDesc);

        setChartAnalysis({
          ticker: stockTicker.toUpperCase(),
          currentPrice: currentPrice.toFixed(2),
          support,
          resistance,
          pattern: identifyPattern(closesDesc),
          trend: closesDesc[0] > (closesDesc[20] || closesDesc[0]) ? 'Bullish' : 'Bearish',
          signals: generateSignals(closesDesc, support, resistance),
          recommendation: generateRecommendation(currentPrice, support, resistance)
        });

        // Also fetch sentiment data
        const [recResponse, newsResponse] = await Promise.all([
          fetch('/api/sentiment?ticker=' + stockTicker + '&apikey=' + apiKeys.finnhub + '&type=recommendation'),
          fetch('/api/sentiment?ticker=' + stockTicker + '&apikey=' + apiKeys.finnhub + '&type=news')
        ]);
        
        if (recResponse.ok && newsResponse.ok) {
          const [recData, newsData] = await Promise.all([
            recResponse.json(),
            newsResponse.json()
          ]);
          
          if (recData && recData.length > 0) {
            const latest = recData[0];
            const totalRatings = latest.buy + latest.hold + latest.sell;
            const buyScore = (latest.buy / totalRatings) * 100;
            
            let overall = 'HOLD';
            if (buyScore > 60) overall = 'BUY';
            else if (buyScore < 40) overall = 'SELL';
            
            const bullishPercent = newsData.sentiment ? newsData.sentiment.bullishPercent : 50;
            const sentimentScore = newsData.sentiment ? newsData.sentiment.sentiment : 0;
            
            setSentimentAnalysis({
              ticker: stockTicker.toUpperCase(),
              overall,
              confidence: Math.round(buyScore),
              breakdown: [
                { source: 'Social Media', score: Math.round(bullishPercent), trend: 'Based on news sentiment analysis' },
                { source: 'Analyst Ratings', score: Math.round(buyScore), trend: latest.buy + ' Buy, ' + latest.hold + ' Hold, ' + latest.sell + ' Sell' },
                { source: 'Institutional Activity', score: buyScore > 50 ? 75 : 45, trend: 'Derived from analyst consensus' },
                { source: 'News Sentiment', score: Math.round(sentimentScore * 100), trend: sentimentScore > 0 ? 'Positive coverage' : 'Mixed coverage' }
              ],
              rationale: 'Analyst consensus shows ' + overall + ' rating with ' + latest.buy + ' buy recommendations vs ' + latest.sell + ' sell recommendations.',
              risks: 'Market conditions and company-specific events could impact performance. Always conduct your own research.'
            });
          }
        } else {
          setError('Failed to fetch sentiment data. Please try again.');
        }
      } else {
        setError('Could not fetch data. Check ticker symbol or API limit.');
      }
    } catch (err) {
      setError('Error analyzing chart: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

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
