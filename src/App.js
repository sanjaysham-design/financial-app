import React, { useState, useEffect, useCallback } from 'react';
import { Newspaper, Target, Search, Loader, Info } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine, ReferenceArea } from 'recharts';

function FinancialApp() {
  const [activeTab, setActiveTab] = useState('news');
  const [stockTicker, setStockTicker] = useState('');
  const [technicalData, setTechnicalData] = useState(null);
  const [showSROverlay, setShowSROverlay] = useState(true);
  const [showSRShade, setShowSRShade] = useState(true);
  const [apiKeys, setApiKeys] = useState({
    alphaVantage: '',
    finnhub: '',
    newsApi: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [newsStories, setNewsStories] = useState([]);
  const [chartAnalysis, setChartAnalysis] = useState(null);

  const tabs = [
    { id: 'news', name: 'Market News', icon: Newspaper },
    { id: 'charts', name: 'Technical Analysis', icon: Target }
  ];

  const calculateMA = (data, period) => {
    return data.map((_, index) => {
      if (index < period - 1) return null;
      const sum = data.slice(index - period + 1, index + 1).reduce((a, b) => a + b, 0);
      return sum / period;
    });
  };

  const findSupportResistance = (prices) => {
    const pivots = [];
    const window = 10; // Look at 10 days before and after for pivots
    
    for (let i = window; i < prices.length - window; i++) {
      const currentPrice = prices[i];
      const leftPrices = prices.slice(i - window, i);
      const rightPrices = prices.slice(i + 1, i + window + 1);
      
      // Check for support (local minimum)
      if (currentPrice <= Math.min(...leftPrices) && currentPrice <= Math.min(...rightPrices)) {
        pivots.push({ type: 'support', price: currentPrice, index: i });
      }
      // Check for resistance (local maximum)
      if (currentPrice >= Math.max(...leftPrices) && currentPrice >= Math.max(...rightPrices)) {
        pivots.push({ type: 'resistance', price: currentPrice, index: i });
      }
    }
    return pivots;
  };

  const analyzeSentiment = useCallback((text) => {
    const positive = ['gains', 'surge', 'profit', 'growth', 'strong', 'positive'];
    const negative = ['loss', 'decline', 'fall', 'weak', 'concern', 'risk'];

    const lowerText = (text || '').toLowerCase();
    const posCount = positive.filter(word => lowerText.includes(word)).length;
    const negCount = negative.filter(word => lowerText.includes(word)).length;

    if (posCount > negCount) return 'positive';
    if (negCount > posCount) return 'negative';
    return 'neutral';
  }, []);

  const fetchNewsWithKey = useCallback(async (newsApiKey) => {
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
  }, [analyzeSentiment]);

  useEffect(() => {
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
        // grab more history so MA200 can be plotted across the chart
        const dates = Object.keys(timeSeries).slice(0, 400).reverse();
        const prices = dates.map(date => ({
          date,
          price: parseFloat(timeSeries[date]['4. close']),
          volume: parseFloat(timeSeries[date]['5. volume'])
        }));

        const closePrices = prices.map(p => p.price);
        const ma50 = calculateMA(closePrices, 50);
        const ma200 = calculateMA(closePrices, 200);
        const pivots = findSupportResistance(closePrices);

        const chartData = prices.map((point, idx) => ({
          date: new Date(point.date).toLocaleDateString(),
          price: point.price,
          ma50: ma50[idx],
          ma200: ma200[idx],
          volume: point.volume
        }));

        const currentPrice = closePrices[closePrices.length - 1];
        const lastMA50 = ma50[ma50.length - 1];
        const lastMA200 = ma200[ma200.length - 1];

        const shortTermTrend = currentPrice > lastMA50 ? 'bullish' : 'bearish';
        const longTermTrend = currentPrice > lastMA200 ? 'bullish' : 'bearish';
        const goldCross = ma50[ma50.length - 1] > ma200[ma200.length - 1] && 
                       ma50[ma50.length - 2] <= ma200[ma200.length - 2];
        const deathCross = ma50[ma50.length - 1] < ma200[ma200.length - 1] && 
                        ma50[ma50.length - 2] >= ma200[ma200.length - 2];

        // compute nearest support (highest < price) and nearest resistance (lowest > price)
        const numericSupports = pivots.filter(p => p.type === 'support').map(p => p.price).sort((a,b) => a - b);
        const numericResistances = pivots.filter(p => p.type === 'resistance').map(p => p.price).sort((a,b) => a - b);
        const nearestSupport = numericSupports.filter(s => s < currentPrice).pop() || null;
        const nearestResistance = numericResistances.find(r => r > currentPrice) || null;

        setTechnicalData({
          chartData,
          pivots,
          currentPrice: currentPrice.toFixed(2),
          srBand: (nearestSupport !== null && nearestResistance !== null) ? { low: nearestSupport, high: nearestResistance } : null,
          analysis: {
            shortTerm: {
              trend: shortTermTrend,
              signal: currentPrice > lastMA50 ? 'Above 50 MA - momentum is positive' : 'Below 50 MA - momentum is weakening',
              strategy: shortTermTrend === 'bullish' 
                ? 'Look for pullbacks to 50 MA for potential entries' 
                : 'Consider reduced position sizes and tighter stops'
            },
            longTerm: {
              trend: longTermTrend,
              signal: currentPrice > lastMA200 ? 'Above 200 MA - long term uptrend' : 'Below 200 MA - long term downtrend',
              strategy: longTermTrend === 'bullish'
                ? 'Maintain long positions with stops below 200 MA'
                : 'Focus on shorter timeframes or consider inverse positions'
            },
            signals: {
              goldCross,
              deathCross,
              supports: pivots.filter(p => p.type === 'support').slice(-3).map(p => p.price.toFixed(2)),
              resistances: pivots.filter(p => p.type === 'resistance').slice(-3).map(p => p.price.toFixed(2))
            }
          }
        });

        setChartAnalysis({
          ticker: stockTicker.toUpperCase(),
          currentPrice: currentPrice.toFixed(2),
          trend: shortTermTrend,
          support: pivots.filter(p => p.type === 'support').slice(-3).map(p => p.price.toFixed(2)),
          resistance: pivots.filter(p => p.type === 'resistance').slice(-3).map(p => p.price.toFixed(2))
        });
      } else {
        setError('Could not fetch data. Check ticker symbol or API limit.');
      }
    } catch (err) {
      setError('Error analyzing chart: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

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

        <div className="bg-slate-800 rounded-xl shadow-2xl p-6">
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

          {activeTab === 'charts' && (
            <div>
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h2 className="text-2xl font-bold flex items-center gap-2">
                    <Target className="text-blue-400" />
                    Technical Analysis & Sentiment
                  </h2>
                  <p className="text-slate-400">Comprehensive market analysis with sentiment data</p>
                </div>
                
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={stockTicker}
                    onChange={(e) => setStockTicker(e.target.value.toUpperCase())}
                    className="bg-slate-700 text-white px-4 py-2 rounded-lg"
                    placeholder="e.g. AAPL"
                  />
                  <button
                    onClick={analyzeChartData}
                    disabled={loading}
                    className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 disabled:cursor-not-allowed px-6 py-2 rounded-lg font-semibold flex items-center gap-2 transition-colors"
                  >
                    {loading ? <Loader className="animate-spin" size={18} /> : <Search size={18} />}
                    Analyze
                  </button>
                  <div className="flex items-center gap-3 ml-4">
                    <label className="flex items-center gap-2 text-sm text-slate-300">
                      <input type="checkbox" checked={showSROverlay} onChange={(e) => setShowSROverlay(e.target.checked)} className="w-4 h-4" />
                      Show S/R
                    </label>
                    <label className="flex items-center gap-2 text-sm text-slate-300">
                      <input type="checkbox" checked={showSRShade} onChange={(e) => setShowSRShade(e.target.checked)} className="w-4 h-4" />
                      Shade S/R band
                    </label>
                  </div>
                </div>
              </div>

              {technicalData && (
                <div className="space-y-4">
                  <div className="bg-slate-700 rounded-lg p-4">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="text-xl font-bold text-blue-400">{chartAnalysis.ticker}</h3>
                        <p className="text-slate-300">Current Price: ${chartAnalysis.currentPrice}</p>
                      </div>
                      <span className={'px-3 py-1 rounded-full text-sm font-semibold ' + 
                        (chartAnalysis.trend === 'bullish' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400')}>
                        {chartAnalysis.trend.toUpperCase()}
                      </span>
                    </div>

                    {/* Small legend explaining shaded S/R band */}
                    <div className="flex items-center gap-3 mt-2 text-sm text-slate-300">
                      <div className="flex items-center gap-2">
                        <span style={{ width: 14, height: 12, display: 'inline-block', background: 'rgba(99,102,241,0.16)', border: '1px solid rgba(99,102,241,0.22)', borderRadius: 2 }} />
                        <div>
                          <div className="font-medium text-slate-200">S/R Band</div>
                          <div className="text-xs text-slate-400">Shaded area shows nearest support and resistance — range where price may bounce or breakout</div>
                        </div>
                      </div>
                      <div className="flex items-center ml-4 text-slate-400">
                        <Info size={14} className="mr-1" />
                        <span className="text-xs">Toggle visibility with the checkboxes</span>
                      </div>
                    </div>

                    <div className="h-96 mt-4">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={technicalData.chartData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={true} horizontal={true} />
                          <XAxis 
                            dataKey="date" 
                            stroke="#9CA3AF"
                            tick={{ fill: '#9CA3AF' }}
                            tickLine={{ stroke: '#4B5563' }}
                          />
                          <YAxis 
                            stroke="#9CA3AF"
                            tick={{ fill: '#9CA3AF' }}
                            tickLine={{ stroke: '#4B5563' }}
                            domain={['auto', 'auto']}
                          />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: '#1F2937',
                              border: '1px solid #374151',
                              borderRadius: '0.375rem'
                            }}
                            labelStyle={{ color: '#9CA3AF' }}
                          />
                          <Legend />
                          <Line 
                            type="monotone" 
                            dataKey="price" 
                            stroke="#60A5FA" 
                            dot={false} 
                            name="Price"
                          />
                          <Line 
                            type="monotone" 
                            dataKey="ma50" 
                            stroke="#34D399" 
                            dot={false}
                            name="50 MA"
                          />
                          <Line 
                            type="monotone" 
                            dataKey="ma200" 
                            stroke="#F87171" 
                            dot={false}
                            name="200 MA"
                          />
                            {/* Support/resistance overlays (conditionally rendered) */}
                            {showSROverlay && technicalData.analysis.signals.supports.map((level, idx) => (
                              <ReferenceLine key={`sup-${idx}`} y={Number(level)} stroke="#10B981" strokeDasharray="4 4" label={{ value: `S ${level}`, position: 'right', fill: '#10B981' }} />
                            ))}
                            {showSROverlay && technicalData.analysis.signals.resistances.map((level, idx) => (
                              <ReferenceLine key={`res-${idx}`} y={Number(level)} stroke="#EF4444" strokeDasharray="4 4" label={{ value: `R ${level}`, position: 'right', fill: '#EF4444' }} />
                            ))}

                            {/* Shade between nearest support and resistance (if available) */}
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

                    <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="bg-slate-800 rounded-lg p-4">
                        <h4 className="text-lg font-semibold text-blue-400 mb-2">Short-term Analysis</h4>
                        <div className="space-y-2">
                          <p className="text-slate-300">{technicalData.analysis.shortTerm.signal}</p>
                          <p className="text-slate-400 text-sm">{technicalData.analysis.shortTerm.strategy}</p>
                        </div>
                      </div>

                      <div className="bg-slate-800 rounded-lg p-4">
                        <h4 className="text-lg font-semibold text-blue-400 mb-2">Long-term Analysis</h4>
                        <div className="space-y-2">
                          <p className="text-slate-300">{technicalData.analysis.longTerm.signal}</p>
                          <p className="text-slate-400 text-sm">{technicalData.analysis.longTerm.strategy}</p>
                        </div>
                      </div>

                      <div className="bg-slate-800 rounded-lg p-4">
                        <h4 className="text-lg font-semibold text-blue-400 mb-2">Support Levels</h4>
                        <div className="flex gap-2">
                          {technicalData.analysis.signals.supports.map((level, idx) => (
                            <span key={idx} className="px-3 py-1 bg-emerald-500/20 text-emerald-400 rounded-full text-sm">
                              ${level}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="bg-slate-800 rounded-lg p-4">
                        <h4 className="text-lg font-semibold text-blue-400 mb-2">Resistance Levels</h4>
                        <div className="flex gap-2">
                          {technicalData.analysis.signals.resistances.map((level, idx) => (
                            <span key={idx} className="px-3 py-1 bg-red-500/20 text-red-400 rounded-full text-sm">
                              ${level}
                            </span>
                          ))}
                        </div>
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