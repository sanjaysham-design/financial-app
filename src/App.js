import React, { useState, useEffect } from 'react';
import { TrendingUp, DollarSign, Newspaper, BarChart3, Target, Search, AlertCircle, Loader } from 'lucide-react';

function FinancialApp() {

useEffect(function() {
  async function loadDefaultKeys() {
    try {
      const response = await fetch('/api/default-keys');
      const data = await response.json();
      if (data && !data.error) {
        setApiKeys(data);
        // Auto-load news after keys are loaded
        if (data.newsApi) {
          fetchNewsWithKey(data.newsApi);
        }
      }
    } catch (err) {
      console.error('Failed to load default keys:', err);
    }
  }
  loadDefaultKeys();
}, []);


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
  const [newsStories, setNewsStories] = useState([]);
  const [chartAnalysis, setChartAnalysis] = useState(null);
  const [sentimentAnalysis, setSentimentAnalysis] = useState(null);
  const [selectedArticle, setSelectedArticle] = useState(null);

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
      setError('Please enter Alpha Vantage API key');
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      const tickers = ['AAPL', 'MSFT', 'JNJ'];
      const stockData = [];
      
      for (let i = 0; i < tickers.length; i++) {
        const ticker = tickers[i];
        const response = await fetch(`/api/stock-overview?ticker=${ticker}&apikey=${apiKeys.alphaVantage}`);
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

  function analyzeSentiment(text) {
    const positive = ['gains', 'surge', 'profit', 'growth', 'strong', 'positive'];
    const negative = ['loss', 'decline', 'fall', 'weak', 'concern', 'risk'];
    
    const lowerText = text.toLowerCase();
    const posCount = positive.filter(word => lowerText.includes(word)).length;
    const negCount = negative.filter(word => lowerText.includes(word)).length;
    
    if (posCount > negCount) return 'positive';
    if (negCount > posCount) return 'negative';
    return 'neutral';
  }

async function fetchNewsWithKey(newsApiKey) {
  setLoading(true);
  setError('');
  
  try {
    const response = await fetch(`/api/news?apikey=${newsApiKey}`);
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
}

async function fetchNews() {
  if (!apiKeys.newsApi) {
    setError('Please enter News API key');
    return;
  }
  
  fetchNewsWithKey(apiKeys.newsApi);
}
    
    setLoading(true);
    setError('');
    
    try {
      const response = await fetch(`/api/news?apikey=${apiKeys.newsApi}`);
      const data = await response.json();
      
      if (data.articles) {
        const formattedNews = [];
        for (let i = 0; i < data.articles.length; i++) {
          const article = data.articles[i];
          formattedNews.push({
            headline: article.title,
            impact: 'Market Moving',
            summary: article.description || '',
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
  }

  function findSupportLevels(prices) {
    const sorted = prices.slice().sort(function(a, b) { return a - b; });
    return [sorted[5].toFixed(2), sorted[10].toFixed(2)];
  }

  function findResistanceLevels(prices) {
    const sorted = prices.slice().sort(function(a, b) { return b - a; });
    return [sorted[5].toFixed(2), sorted[10].toFixed(2)];
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
      setError('Please enter a ticker and Alpha Vantage API key');
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      const response = await fetch(`/api/chart-data?ticker=${stockTicker}&apikey=${apiKeys.alphaVantage}`);
      const data = await response.json();
      
      if (data['Time Series (Daily)']) {
        const timeSeries = data['Time Series (Daily)'];
        const dates = Object.keys(timeSeries).slice(0, 50);
        const prices = [];
        for (let i = 0; i < dates.length; i++) {
          prices.push(parseFloat(timeSeries[dates[i]]['4. close']));
        }
        
        const currentPrice = prices[0];
        const support = findSupportLevels(prices);
        const resistance = findResistanceLevels(prices);
        
        setChartAnalysis({
          ticker: stockTicker.toUpperCase(),
          currentPrice: currentPrice.toFixed(2),
          support: support,
          resistance: resistance,
          pattern: identifyPattern(prices),
          trend: prices[0] > prices[20] ? 'Bullish' : 'Bearish',
          signals: generateSignals(prices, support, resistance),
          recommendation: generateRecommendation(currentPrice, support, resistance)
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
      setError('Please enter a ticker and Finnhub API key');
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      const recResponse = await fetch(`/api/sentiment?ticker=${sentimentTicker}&apikey=${apiKeys.finnhub}&type=recommendation`);
      const recData = await recResponse.json();
      
      const newsResponse = await fetch(`/api/sentiment?ticker=${sentimentTicker}&apikey=${apiKeys.finnhub}&type=news`);
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
        <h3 
          className="text-lg font-bold flex-1 text-blue-400 hover:text-blue-300 cursor-pointer transition-colors"
          onClick={function() { setSelectedArticle(story); }}
        >
          {story.headline}
        </h3>
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

      <div key={idx} className="bg-slate-700 rounded-lg p-4">
        <div className="flex justify-between items-start mb-2">
          <h3 className="text-lg font-bold flex-1">{story.headline}</h3>
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

  const sentimentBreakdown = sentimentAnalysis ? sentimentAnalysis.breakdown.map(function(item, idx) {
    return (
      <div key={idx} className="bg-slate-800 rounded p-3">
        <div className="flex justify-between items-center mb-2">
          <p className="text-sm font-semibold text-blue-400">{item.source}</p>
          <span className="text-sm font-bold text-emerald-400">{item.score}</span>
        </div>
        <p className="text-xs text-slate-300">{item.trend}</p>
      </div>
    );
  }) : null;

  return (
  <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
    <div className="max-w-7xl mx-auto p-6">

      {selectedArticle && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-slate-800 rounded-xl shadow-2xl max-w-4xl w-full border border-slate-700 my-8">
            <div className="p-6 border-b border-slate-700 flex justify-between items-start">
              <h2 className="text-2xl font-bold text-blue-400 flex-1 pr-4">
                {selectedArticle.headline}
              </h2>
              <button
                onClick={function() { setSelectedArticle(null); }}
                className="text-slate-400 hover:text-white text-2xl font-bold leading-none"
              >
                ×
              </button>
            </div>
            
            <div className="p-6">
              <p className="text-slate-300 mb-4">{selectedArticle.summary}</p>
              
              <div className="bg-slate-700 rounded p-4 mb-4">
                <p className="text-sm font-semibold text-blue-400 mb-2">Investment Implications:</p>
                <p className="text-sm text-slate-300">{selectedArticle.implications}</p>
              </div>

              {selectedArticle.url && (
                <div className="border-t border-slate-700 pt-4">
                  <iframe
                    src={selectedArticle.url}
                    className="w-full h-96 rounded-lg border border-slate-600"
                    title="Article Content"
                    sandbox="allow-same-origin allow-scripts"
                  />
                  
                    href={selectedArticle.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block mt-4 bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded-lg font-semibold transition-colors"
                  >
                    Open in New Tab →
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <header className="mb-8"></header>
        
        <header className="mb-8">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">
                Financial Analysis Hub
              </h1>
              <p className="text-slate-400">Comprehensive market insights and stock analysis tools</p>
            </div>
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
                  disabled={!apiKeys.alphaVantage || loading}
                  className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 disabled:cursor-not-allowed px-4 py-2 rounded-lg font-semibold flex items-center gap-2 transition-colors"
                >
                  {loading ? <Loader className="animate-spin" size={18} /> : <Search size={18} />}
                  Fetch Data
                </button>
              </div>
              
              {!apiKeys.alphaVantage && (
                <div className="bg-slate-700 rounded-lg p-8 text-center">
                  <AlertCircle className="mx-auto mb-3 text-yellow-400" size={48} />
                  <p className="text-slate-300">Configure Alpha Vantage API key above to fetch live stock data</p>
                </div>
              )}

              {screenedStocks.length > 0 && (
                <div className="space-y-4">{stockCards}</div>
              )}
            </div>
          )}

          {activeTab === 'sectors' && (
            <div>
              <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                <BarChart3 className="text-blue-400" />
                Sector Trend Analyzer
              </h2>
              <div className="bg-slate-700 rounded-lg p-8 text-center">
                <AlertCircle className="mx-auto mb-3 text-blue-400" size={48} />
                <p className="text-slate-300 mb-2">Sector analysis requires premium market data APIs</p>
                <p className="text-slate-400 text-sm">Consider using Bloomberg, Refinitiv, or similar enterprise APIs for comprehensive sector data</p>
              </div>
            </div>
          )}

          {activeTab === 'news' && (
            <div>
              <div className="mb-4">
                <h2 className="text-2xl font-bold flex items-center gap-2">
                  <Newspaper className="text-blue-400" />
                  Market News Filter
                </h2>
                <p className="text-slate-400 text-sm">Top market-moving stories - automatically updated</p>
              </div>
          

              {newsStories.length > 0 && (
                <div className="space-y-4">{newsCards}</div>
              )}
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
                    placeholder="e.g., AAPL"
                    className="flex-1 bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
                  />
                  <button
                    onClick={analyzeChartData}
                    disabled={!apiKeys.alphaVantage || !stockTicker || loading}
                    className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 disabled:cursor-not-allowed px-6 py-2 rounded-lg font-semibold flex items-center gap-2 transition-colors"
                  >
                    {loading ? <Loader className="animate-spin" size={18} /> : <Search size={18} />}
                    Analyze
                  </button>
                </div>
              </div>

              {!apiKeys.alphaVantage && (
                <div className="bg-slate-700 rounded-lg p-8 text-center">
                  <AlertCircle className="mx-auto mb-3 text-yellow-400" size={48} />
                  <p className="text-slate-300">Configure Alpha Vantage API key above to analyze charts</p>
                </div>
              )}

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
                    disabled={!apiKeys.finnhub || !sentimentTicker || loading}
                    className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 disabled:cursor-not-allowed px-6 py-2 rounded-lg font-semibold flex items-center gap-2 transition-colors"
                  >
                    {loading ? <Loader className="animate-spin" size={18} /> : <Search size={18} />}
                    Analyze
                  </button>
                </div>
              </div>

              {!apiKeys.finnhub && (
                <div className="bg-slate-700 rounded-lg p-8 text-center">
                  <AlertCircle className="mx-auto mb-3 text-yellow-400" size={48} />
                  <p className="text-slate-300">Configure Finnhub API key above to analyze sentiment</p>
                </div>
              )}

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

                  <div className="grid md:grid-cols-2 gap-4 mb-4">
                    {sentimentBreakdown}
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