import React, { useState, useEffect, useCallback } from 'react';
import { TrendingUp, DollarSign, Newspaper, BarChart3, Target, Search, Loader } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Area, AreaChart } from 'recharts';

function FinancialApp() {
  const [activeTab, setActiveTab] = useState('news');
  const [stockTicker, setStockTicker] = useState('');
  const [sentimentTicker, setSentimentTicker] = useState('');
  const [apiKeys, setApiKeys] = useState({
    alphaVantage: '',
    finnhub: '',
    newsApi: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [screenedStocks, setScreenedStocks] = useState([]);
  const [sectorsData] = useState([
    {
      name: 'Technology',
      performance: '+2.3%',
      outlook: 'Bullish',
      momentum: 'Strong',
      trend: 'up',
      analysis: 'AI adoption and cloud computing driving sustained growth. Major players showing strong earnings beats. NASDAQ tech index outperforming broader market.'
    },
    {
      name: 'Healthcare',
      performance: '+1.1%',
      outlook: 'Positive',
      momentum: 'Moderate',
      trend: 'up',
      analysis: 'Aging demographics and biotech innovation supporting long-term growth. Drug approval pipeline robust with several blockbuster candidates.'
    },
    {
      name: 'Energy',
      performance: '-0.5%',
      outlook: 'Mixed',
      momentum: 'Weak',
      trend: 'neutral',
      analysis: 'Oil price volatility creating uncertainty. Renewable energy transition ongoing but traditional energy still profitable in near-term.'
    },
    {
      name: 'Finance',
      performance: '+1.8%',
      outlook: 'Positive',
      momentum: 'Strong',
      trend: 'up',
      analysis: 'Higher interest rates benefiting banks. Strong loan demand and improving credit quality. Regional banks recovering from 2023 concerns.'
    },
    {
      name: 'Consumer Discretionary',
      performance: '+0.7%',
      outlook: 'Neutral',
      momentum: 'Moderate',
      trend: 'neutral',
      analysis: 'Mixed signals as consumer spending shows resilience but inflation concerns persist. E-commerce growth continues steady.'
    },
    {
      name: 'Industrials',
      performance: '+1.4%',
      outlook: 'Positive',
      momentum: 'Strong',
      trend: 'up',
      analysis: 'Infrastructure spending and manufacturing reshoring driving demand. Supply chain normalization improving margins.'
    },
    {
      name: 'Real Estate',
      performance: '-0.3%',
      outlook: 'Cautious',
      momentum: 'Weak',
      trend: 'neutral',
      analysis: 'High interest rates pressuring valuations. Commercial real estate facing headwinds from remote work, but residential showing stabilization.'
    },
    {
      name: 'Utilities',
      performance: '+0.4%',
      outlook: 'Stable',
      momentum: 'Moderate',
      trend: 'neutral',
      analysis: 'Defensive sector showing stability. Clean energy transition creating investment opportunities. Dividend yields attractive.'
    }
  ]);
  const [newsStories, setNewsStories] = useState([]);
  const [chartAnalysis, setChartAnalysis] = useState(null);
  const [sentimentAnalysis, setSentimentAnalysis] = useState(null);
  // selectedArticle removed: articles will open directly in a new window

  const tabs = [
    { id: 'news', name: 'Market News', icon: Newspaper },
    { id: 'screener', name: 'Stock Screener', icon: TrendingUp },
    { id: 'sectors', name: 'Sector Trends', icon: BarChart3 },
    { id: 'charts', name: 'Chart Patterns', icon: Target },
    { id: 'sentiment', name: 'Buy/Sell Sentiment', icon: DollarSign }
  ];

  

  function calculateScore(data) {
    let score = 5;
    if (parseFloat(data.PERatio) < 20) score += 1;
    if (parseFloat(data.DebtToEquityRatio) < 1) score += 2;
    if (parseFloat(data.QuarterlyEarningsGrowthYOY) > 0.1) score += 2;
    return Math.min(score, 10);
  }

  function generateReason(data) {
    const reasons = [];
    if (parseFloat(data.PERatio) < 20) reasons.push('attractive valuation');
    if (parseFloat(data.DebtToEquityRatio) < 1) reasons.push('low debt levels');
    if (parseFloat(data.QuarterlyEarningsGrowthYOY) > 0.1) reasons.push('strong earnings growth');
    return 'Shows ' + reasons.join(', ');
  }

  async function fetchScreenerData() {
    if (!apiKeys.alphaVantage) {
      setError('Please configure Alpha Vantage API key');
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      const tickers = ['AAPL', 'MSFT', 'JNJ'];
      const stockData = [];
      
      for (let i = 0; i < tickers.length; i++) {
        const ticker = tickers[i];
        const response = await fetch('/api/stock-overview?ticker=' + ticker + '&apikey=' + apiKeys.alphaVantage);
        const data = await response.json();
        
        if (data.Symbol) {
          stockData.push({
            ticker: data.Symbol,
            company: data.Name,
            price: parseFloat(data['50DayMovingAverage']) || 0,
            pe: parseFloat(data.PERatio) || 0,
            debtToEquity: parseFloat(data.DebtToEquityRatio) || 0,
            epsGrowth: parseFloat(data.QuarterlyEarningsGrowthYOY) * 100 || 0,
            cashFlow: parseFloat(data.OperatingCashflowTTM) > 0 ? 'Positive' : 'Negative',
            score: calculateScore(data),
            reason: generateReason(data)
          });
        }
        
        await new Promise(resolve => setTimeout(resolve, 12000));
      }
      
      setScreenedStocks(stockData);
    } catch (err) {
      setError('Error fetching screener data: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  const analyzeSentiment = useCallback(function (text) {
    const positive = ['gains', 'surge', 'profit', 'growth', 'strong', 'positive'];
    const negative = ['loss', 'decline', 'fall', 'weak', 'concern', 'risk'];

    const lowerText = (text || '').toLowerCase();
    const posCount = positive.filter(word => lowerText.includes(word)).length;
    const negCount = negative.filter(word => lowerText.includes(word)).length;

    if (posCount > negCount) return 'positive';
    if (negCount > posCount) return 'negative';
    return 'neutral';
  }, []);

  const fetchNewsWithKey = useCallback(async function (newsApiKey) {
    setLoading(true);
    setError('');
    
    try {
      const response = await fetch('/api/news?apikey=' + newsApiKey);
      const data = await response.json();
      
      if (data.articles) {
        const formattedNews = [];
        for (let i = 0; i < data.articles.length; i++) {
          const article = data.articles[i];
          formattedNews.push({
            headline: article.title,
            impact: 'Market Moving',
            summary: article.description || '',
            url: article.url || '',
            implications: 'Analyze based on content and market context',
            sentiment: analyzeSentiment(article.title + ' ' + article.description)
          });
        }
        setNewsStories(formattedNews);
      }
    } catch (err) {
      setError('Error fetching news: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [analyzeSentiment]);

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

  function findSupportLevels(prices) {
    // Look at last 50 days for support levels
    const recentPrices = prices.slice(0, 50);
    const sorted = recentPrices.slice().sort(function(a, b) { return a - b; });
    // Get levels at 20th and 40th percentile
    const idx1 = Math.floor(sorted.length * 0.2);
    const idx2 = Math.floor(sorted.length * 0.4);
    return [sorted[idx1].toFixed(2), sorted[idx2].toFixed(2)];
  }

  function findResistanceLevels(prices) {
    // Look at last 50 days for resistance levels
    const recentPrices = prices.slice(0, 50);
    const sorted = recentPrices.slice().sort(function(a, b) { return b - a; });
    // Get levels at 20th and 40th percentile
    const idx1 = Math.floor(sorted.length * 0.2);
    const idx2 = Math.floor(sorted.length * 0.4);
    return [sorted[idx1].toFixed(2), sorted[idx2].toFixed(2)];
  }

  function identifyPattern(prices) {
    const trend = prices[0] > prices[prices.length - 1] ? 'Ascending' : 'Descending';
    return trend + ' Channel';
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
    if (!stockTicker || !apiKeys.alphaVantage) {
      setError('Please enter a ticker and configure Alpha Vantage API key');
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      const response = await fetch('/api/chart-data?ticker=' + stockTicker + '&apikey=' + apiKeys.alphaVantage + '&outputsize=full');
      const data = await response.json();
      
      if (data['Time Series (Daily)']) {
        const timeSeries = data['Time Series (Daily)'];
        const allDates = Object.keys(timeSeries);
        const sliceCount = Math.min(allDates.length, 500); // cap to 500 for performance
        const datesDesc = allDates.slice(0, sliceCount); // most recent first
        const closesDesc = datesDesc.map(function(d) { return parseFloat(timeSeries[d]['4. close']); });
        // Add debug log
        console.debug('Got', allDates.length, 'days of history');

        // Prepare chronological arrays (oldest -> newest) for moving average calculations and charting
        const datesChron = datesDesc.slice().reverse();
        const closesChron = closesDesc.slice().reverse();

        function computeMA(arr, period) {
          const result = [];
          for (let i = 0; i < arr.length; i++) {
            if (i < period - 1) {
              result.push(null);
              continue;
            }
            
            let sum = 0;
            for (let j = 0; j < period; j++) {
              sum += arr[i - j];
            }
            result.push(sum / period);
          }
          return result;
        }

        const ma50 = computeMA(closesChron, 50);
        const ma200 = computeMA(closesChron, 200);

        // Debug: Print first few valid MA values
        console.debug('First MA50 values:', ma50.slice(49, 54));
        console.debug('First MA200 values:', ma200.slice(199, 204));

        const timeSeriesData = closesChron.map(function(close, i) {
          return {
            date: datesChron[i],
            close: Number(close.toFixed(2)),
            ma50: ma50[i] !== null ? Number(ma50[i].toFixed(2)) : null,
            ma200: ma200[i] !== null ? Number(ma200[i].toFixed(2)) : null
          };
        });
        // debug: log last few points so it's easy to inspect in browser console
        try {
          // eslint-disable-next-line no-console
          console.debug('timeSeriesData sample (last 5):', timeSeriesData.slice(-5));
          // eslint-disable-next-line no-console
          console.debug('ma50 last values:', ma50.slice(-5));
          // eslint-disable-next-line no-console
          console.debug('ma200 last values:', ma200.slice(-5));
        } catch (e) {}

        const currentPrice = closesDesc[0];
        const support = findSupportLevels(closesDesc);
        const resistance = findResistanceLevels(closesDesc);

        const displayCount = Math.min(250, timeSeriesData.length);
        const displaySeries = timeSeriesData.slice(-displayCount);

        setChartAnalysis({
          ticker: stockTicker.toUpperCase(),
          currentPrice: currentPrice.toFixed(2),
          support: support,
          resistance: resistance,
          pattern: identifyPattern(closesDesc),
          trend: closesDesc[0] > (closesDesc[20] || closesDesc[0]) ? 'Bullish' : 'Bearish',
          signals: generateSignals(closesDesc, support, resistance),
          recommendation: generateRecommendation(currentPrice, support, resistance),
          timeSeriesData: timeSeriesData,
          displaySeries: displaySeries
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

  async function analyzeSentimentData() {
    if (!sentimentTicker || !apiKeys.finnhub) {
      setError('Please enter a ticker and configure Finnhub API key');
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      const recResponse = await fetch('/api/sentiment?ticker=' + sentimentTicker + '&apikey=' + apiKeys.finnhub + '&type=recommendation');
      const recData = await recResponse.json();
      
      const newsResponse = await fetch('/api/sentiment?ticker=' + sentimentTicker + '&apikey=' + apiKeys.finnhub + '&type=news');
      const newsData = await newsResponse.json();
      
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
          ticker: sentimentTicker.toUpperCase(),
          overall: overall,
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
      } else {
        setError('Could not fetch sentiment data. Check ticker symbol.');
      }
    } catch (err) {
      setError('Error analyzing sentiment: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  const stockCards = screenedStocks.map(function(stock) {
    return (
      <div key={stock.ticker} className="bg-slate-700 rounded-lg p-4 hover:bg-slate-600 transition-colors">
        <div className="flex justify-between items-start mb-3">
          <div>
            <h3 className="text-xl font-bold text-blue-400">{stock.ticker}</h3>
            <p className="text-slate-300">{stock.company}</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold">${stock.price.toFixed(2)}</p>
            <p className="text-emerald-400 text-sm font-semibold">Score: {stock.score}/10</p>
          </div>
        </div>
        
                  {/* This chart display was moved to the Charts tab */}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
          <div className="bg-slate-800 rounded p-2">
            <p className="text-xs text-slate-400">P/E Ratio</p>
            <p className="font-semibold">{stock.pe.toFixed(2)}</p>
          </div>
          <div className="bg-slate-800 rounded p-2">
            <p className="text-xs text-slate-400">Debt/Equity</p>
            <p className="font-semibold">{stock.debtToEquity.toFixed(2)}</p>
          </div>
          <div className="bg-slate-800 rounded p-2">
            <p className="text-xs text-slate-400">EPS Growth</p>
            <p className="font-semibold text-emerald-400">{stock.epsGrowth > 0 ? '+' : ''}{stock.epsGrowth.toFixed(1)}%</p>
          </div>
          <div className="bg-slate-800 rounded p-2">
            <p className="text-xs text-slate-400">Cash Flow</p>
            <p className={'font-semibold ' + (stock.cashFlow === 'Positive' ? 'text-emerald-400' : 'text-red-400')}>{stock.cashFlow}</p>
          </div>
        </div>
        
        <p className="text-sm text-slate-300 italic">{stock.reason}</p>
      </div>
    );
  });

  const newsCards = newsStories.map(function(story, idx) {
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
            href={story.url || '#'}
            target="_blank"
            rel="noopener noreferrer"
            className="text-lg font-bold flex-1 text-blue-400 hover:text-blue-300 cursor-pointer transition-colors"
          >
            {story.headline}
          </a>
          <span className={'px-3 py-1 rounded-full text-xs font-semibold ml-4 ' + sentimentClass}>
            {story.impact}
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

        {/* Articles open in a new tab directly; modal/overlay removed */}

        <header className="mb-8">
          <div>
            <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">
              Financial Analysis Hub
            </h1>
            <p className="text-slate-400">Comprehensive market insights and stock analysis tools</p>
          </div>
        </header>

        {error && (
          <div className="bg-red-900/30 border border-red-500/50 rounded-lg p-4 mb-6">
            <p className="text-red-300 text-sm">{error}</p>
          </div>
        )}

        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {tabs.map(function(tab) {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={function() { setActiveTab(tab.id); }}
                className={'flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all whitespace-nowrap ' + (isActive ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/50' : 'bg-slate-800 text-slate-300 hover:bg-slate-700')}
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

          {activeTab === 'screener' && (
            <div>
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h2 className="text-2xl font-bold flex items-center gap-2">
                    <TrendingUp className="text-blue-400" />
                    Stock Screener
                  </h2>
                  <p className="text-slate-400 text-sm">Undervalued stocks with strong fundamentals</p>
                </div>
                <button
                  onClick={fetchScreenerData}
                  disabled={loading}
                  className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 disabled:cursor-not-allowed px-4 py-2 rounded-lg font-semibold flex items-center gap-2 transition-colors"
                >
                  {loading ? <Loader className="animate-spin" size={18} /> : <Search size={18} />}
                  Fetch Data
                </button>
              </div>

              {screenedStocks.length > 0 && (
                <div className="space-y-4">{stockCards}</div>
              )}

              {screenedStocks.length === 0 && !loading && (
                <div className="bg-slate-700 rounded-lg p-8 text-center">
                  <TrendingUp className="mx-auto mb-3 text-slate-400" size={48} />
                  <p className="text-slate-300">Click "Fetch Data" to analyze stocks</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'sectors' && (
            <div>
              <div className="mb-4">
                <h2 className="text-2xl font-bold flex items-center gap-2">
                  <BarChart3 className="text-blue-400" />
                  Sector Trend Analyzer
                </h2>
                <p className="text-slate-400 text-sm">Current performance and outlook across major market sectors</p>
              </div>
              
              <div className="space-y-4">
                {sectorsData.map(function(sector) {
                  let outlookClass = 'bg-yellow-500/20 text-yellow-400';
                  if (sector.outlook === 'Bullish' || sector.outlook === 'Positive') {
                    outlookClass = 'bg-emerald-500/20 text-emerald-400';
                  } else if (sector.outlook === 'Cautious') {
                    outlookClass = 'bg-red-500/20 text-red-400';
                  }
                  
                  let perfClass = 'text-slate-400';
                  if (sector.performance.startsWith('+')) {
                    perfClass = 'text-emerald-400';
                  } else if (sector.performance.startsWith('-')) {
                    perfClass = 'text-red-400';
                  }
                  
                  return (
                    <div key={sector.name} className="bg-slate-700 rounded-lg p-4">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h3 className="text-xl font-bold">{sector.name}</h3>
                          <div className="flex gap-4 mt-1">
                            <span className={'text-sm font-semibold ' + perfClass}>
                              {sector.performance}
                            </span>
                            <span className="text-sm text-slate-400">
                              Momentum: <span className="text-white font-semibold">{sector.momentum}</span>
                            </span>
                          </div>
                        </div>
                        <span className={'px-3 py-1 rounded-full text-sm font-semibold ' + outlookClass}>
                          {sector.outlook}
                        </span>
                      </div>
                      <p className="text-slate-300 text-sm">{sector.analysis}</p>
                    </div>
                  );
                })}
              </div>
              
              <div className="mt-6 p-4 bg-blue-900/20 border border-blue-500/30 rounded-lg">
                <p className="text-xs text-blue-300">
                  <strong>Note:</strong> This shows representative sector trends based on market analysis. For real-time sector data, consider premium APIs like Polygon.io or Financial Modeling Prep.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'charts' && (
            <div>
              <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                <Target className="text-blue-400" />
                Chart Pattern Decoder
              </h2>
              <p className="text-slate-400 mb-6">Technical analysis with support, resistance, and pattern recognition</p>
              
              <div className="mb-6">
                <label className="block text-sm font-medium mb-2">Enter Stock Ticker</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={stockTicker}
                    onChange={function(e) { setStockTicker(e.target.value.toUpperCase()); }}
                    className="bg-slate-700 text-white px-4 py-2 rounded-lg flex-1"
                    placeholder="e.g. AAPL"
                  />
                  <button
                    onClick={analyzeChartData}
                    disabled={loading}
                    className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 px-6 py-2 rounded-lg font-semibold flex items-center gap-2 transition-colors"
                  >
                    {loading ? <Loader className="animate-spin" size={18} /> : <Search size={18} />}
                    Analyze
                  </button>
                </div>
              </div>

              {chartAnalysis && (
                <div>
                  {/* Price series with moving averages */}
                  <div className="bg-slate-800 rounded p-4 mb-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-sm font-semibold text-blue-400">Price & Moving Averages (50 / 200)</h4>
                      <div className="text-sm text-slate-300">
                        {chartAnalysis.displaySeries && chartAnalysis.displaySeries.length > 0 ? (
                          <div className="flex gap-4">
                            <div>MA(50): <span className="font-semibold text-emerald-400">${chartAnalysis.displaySeries[chartAnalysis.displaySeries.length - 1].ma50?.toFixed(2) || 'n/a'}</span></div>
                            <div>MA(200): <span className="font-semibold text-orange-400">${chartAnalysis.displaySeries[chartAnalysis.displaySeries.length - 1].ma200?.toFixed(2) || 'n/a'}</span></div>
                            <div>Close: <span className="font-semibold text-blue-400">${chartAnalysis.displaySeries[chartAnalysis.displaySeries.length - 1].close}</span></div>
                          </div>
                        ) : (
                          <span>MA values not available</span>
                        )}
                      </div>
                    </div>

                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={chartAnalysis.displaySeries || chartAnalysis.timeSeriesData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                        <XAxis dataKey="date" stroke="#94a3b8" tick={{ fontSize: 11 }} tickFormatter={function(d) { try { return new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }); } catch (e) { return d; } }} />
                        <YAxis stroke="#94a3b8" domain={["dataMin", "dataMax"]} />
                        <Tooltip
                          contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '8px' }}
                          formatter={function(value) { return ['$' + value, '']; }}
                        />
                        <Legend />
                        <Line type="monotone" dataKey="close" stroke="#3b82f6" dot={false} name="Close" strokeWidth={2} />
                        <Line type="monotone" dataKey="ma50" stroke="#10b981" dot={false} name="MA (50)" strokeWidth={2} connectNulls={true} />
                        <Line type="monotone" dataKey="ma200" stroke="#f97316" dot={false} name="MA (200)" strokeWidth={2} connectNulls={true} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
              
              <div className="mb-6">
                <label className="block text-sm font-medium mb-2">Enter Stock Ticker</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={stockTicker}
                    onChange={function(e) { setStockTicker(e.target.value.toUpperCase()); }}
                    placeholder="e.g., AAPL"
                    className="flex-1 bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
                  />
                  <button
                    onClick={analyzeChartData}
                    disabled={!stockTicker || loading}
                    className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 disabled:cursor-not-allowed px-6 py-2 rounded-lg font-semibold flex items-center gap-2 transition-colors"
                  >
                    {loading ? <Loader className="animate-spin" size={18} /> : <Search size={18} />}
                    Analyze
                  </button>
                </div>
              </div>

              {chartAnalysis && (
                <div className="bg-slate-700 rounded-lg p-4">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-2xl font-bold text-blue-400">{chartAnalysis.ticker}</h3>
                      <p className="text-slate-300">Current Price: ${chartAnalysis.currentPrice}</p>
                    </div>
                    <span className={'px-3 py-1 rounded-full text-sm font-semibold ' + (chartAnalysis.trend === 'Bullish' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400')}>
                      {chartAnalysis.trend}
                    </span>
                  </div>

                  <div className="bg-slate-800 rounded p-4 mb-4">
                    <h4 className="text-sm font-semibold text-blue-400 mb-3">Price Levels Visualization</h4>
                    <ResponsiveContainer width="100%" height={250}>
                      <AreaChart
                        data={[
                          { level: 'Support 2', value: parseFloat(chartAnalysis.support[1]) },
                          { level: 'Support 1', value: parseFloat(chartAnalysis.support[0]) },
                          { level: 'Current', value: parseFloat(chartAnalysis.currentPrice) },
                          { level: 'Resistance 1', value: parseFloat(chartAnalysis.resistance[0]) },
                          { level: 'Resistance 2', value: parseFloat(chartAnalysis.resistance[1]) }
                        ]}
                        margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                        <XAxis dataKey="level" stroke="#94a3b8" />
                        <YAxis stroke="#94a3b8" domain={['dataMin - 5', 'dataMax + 5']} />
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '8px' }}
                          labelStyle={{ color: '#e2e8f0' }}
                          itemStyle={{ color: '#60a5fa' }}
                          formatter={function(value) { return '$' + value; }}
                        />
                        <Area type="monotone" dataKey="value" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.3} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4 mb-4">
                    <div className="bg-slate-800 rounded p-3">
                      <p className="text-sm font-semibold text-blue-400 mb-2">Support Levels</p>
                      <p className="text-slate-300">${chartAnalysis.support.join(', $')}</p>
                    </div>
                    <div className="bg-slate-800 rounded p-3">
                      <p className="text-sm font-semibold text-blue-400 mb-2">Resistance Levels</p>
                      <p className="text-slate-300">${chartAnalysis.resistance.join(', $')}</p>
                    </div>
                  </div>

                  <div className="bg-slate-800 rounded p-3 mb-4">
                    <p className="text-sm font-semibold text-blue-400 mb-2">Pattern: {chartAnalysis.pattern}</p>
                    <ul className="space-y-2">
                      {chartAnalysis.signals.map(function(signal, idx) {
                        return (
                          <li key={idx} className="text-sm text-slate-300 flex items-start gap-2">
                            <span className="text-emerald-400 mt-1">•</span>
                            <span>{signal}</span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>

                  <div className="bg-blue-900/30 border border-blue-500/30 rounded p-3">
                    <p className="text-sm font-semibold text-blue-400 mb-1">Trading Strategy:</p>
                    <p className="text-sm text-slate-300">{chartAnalysis.recommendation}</p>
                  </div>
                </div>
              )}

              {!chartAnalysis && !loading && (
                <div className="bg-slate-700 rounded-lg p-8 text-center">
                  <Target className="mx-auto mb-3 text-slate-400" size={48} />
                  <p className="text-slate-300">Enter a ticker and click Analyze to see technical analysis</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'sentiment' && (
            <div>
              <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                <DollarSign className="text-blue-400" />
                Buy/Sell Sentiment Analysis
              </h2>
              <p className="text-slate-400 mb-6">Market sentiment combining analyst ratings and news sentiment</p>
              
              <div className="mb-6">
                <label className="block text-sm font-medium mb-2">Enter Stock Ticker</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={sentimentTicker}
                    onChange={function(e) { setSentimentTicker(e.target.value.toUpperCase()); }}
                    placeholder="e.g., MSFT"
                    className="flex-1 bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
                  />
                  <button
                    onClick={analyzeSentimentData}
                    disabled={!sentimentTicker || loading}
                    className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 disabled:cursor-not-allowed px-6 py-2 rounded-lg font-semibold flex items-center gap-2 transition-colors"
                  >
                    {loading ? <Loader className="animate-spin" size={18} /> : <Search size={18} />}
                    Analyze
                  </button>
                </div>
              </div>

              {sentimentAnalysis && (
                <div className="bg-slate-700 rounded-lg p-4">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-2xl font-bold text-blue-400">{sentimentAnalysis.ticker}</h3>
                      <p className="text-slate-300">Overall Sentiment Analysis</p>
                    </div>
                    <div className="text-right">
                      <span className={'text-3xl font-bold ' + (sentimentAnalysis.overall === 'BUY' ? 'text-emerald-400' : sentimentAnalysis.overall === 'HOLD' ? 'text-yellow-400' : 'text-red-400')}>
                        {sentimentAnalysis.overall}
                      </span>
                      <p className="text-sm text-slate-400">Confidence: {sentimentAnalysis.confidence}%</p>
                    </div>
                  </div>

                  <div className="bg-slate-800 rounded p-4 mb-4">
                    <h4 className="text-sm font-semibold text-blue-400 mb-3">Sentiment Breakdown</h4>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart
                        data={sentimentAnalysis.breakdown}
                        margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                        <XAxis dataKey="source" stroke="#94a3b8" angle={-15} textAnchor="end" height={80} />
                        <YAxis stroke="#94a3b8" domain={[0, 100]} />
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '8px' }}
                          labelStyle={{ color: '#e2e8f0' }}
                          itemStyle={{ color: '#10b981' }}
                        />
                        <Legend />
                        <Bar dataKey="score" fill="#10b981" name="Sentiment Score" radius={[8, 8, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="bg-slate-800 rounded p-4 mb-4">
                    <h4 className="text-sm font-semibold text-blue-400 mb-3">Overall Confidence Level</h4>
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart
                        layout="vertical"
                        data={[{ name: 'Confidence', value: sentimentAnalysis.confidence }]}
                        margin={{ top: 20, right: 30, left: 100, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                        <XAxis type="number" domain={[0, 100]} stroke="#94a3b8" />
                        <YAxis type="category" dataKey="name" stroke="#94a3b8" />
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '8px' }}
                          formatter={function(value) { return value + '%'; }}
                        />
                        <Bar 
                          dataKey="value" 
                          radius={[0, 8, 8, 0]} 
                          fill={sentimentAnalysis.confidence > 70 ? '#10b981' : sentimentAnalysis.confidence > 40 ? '#f59e0b' : '#ef4444'}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4 mb-4">
                    {sentimentAnalysis.breakdown.map(function(item, idx) {
                      return (
                        <div key={idx} className="bg-slate-800 rounded p-3">
                          <div className="flex justify-between items-center mb-2">
                            <p className="text-sm font-semibold text-blue-400">{item.source}</p>
                            <span className="text-sm font-bold text-emerald-400">{item.score}</span>
                          </div>
                          <p className="text-xs text-slate-300">{item.trend}</p>
                        </div>
                      );
                    })}
                  </div>

                  <div className="bg-emerald-900/30 border border-emerald-500/30 rounded p-3 mb-3">
                    <p className="text-sm font-semibold text-emerald-400 mb-1">Rationale:</p>
                    <p className="text-sm text-slate-300">{sentimentAnalysis.rationale}</p>
                  </div>

                  <div className="bg-yellow-900/30 border border-yellow-500/30 rounded p-3">
                    <p className="text-sm font-semibold text-yellow-400 mb-1">Risk Factors:</p>
                    <p className="text-sm text-slate-300">{sentimentAnalysis.risks}</p>
                  </div>
                </div>
              )}

              {!sentimentAnalysis && !loading && (
                <div className="bg-slate-700 rounded-lg p-8 text-center">
                  <DollarSign className="mx-auto mb-3 text-slate-400" size={48} />
                  <p className="text-slate-300">Enter a ticker and click Analyze to see sentiment analysis</p>
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