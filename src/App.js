import React, { useState, useEffect, useCallback } from 'react';
import { TrendingUp, Newspaper, BarChart3, Target, Search, Loader } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

function FinancialApp() {
  // State declarations
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

  // Your other functions here...

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
                    Technical Analysis & Sentiment
                  </h2>
                  <p className="text-slate-400">Comprehensive market analysis with price patterns, indicators, and sentiment data</p>
                </div>
                
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={stockTicker}
                    onChange={(e) => setStockTicker(e.target.value.toUpperCase())}
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
                </div>
              </div>

              {chartAnalysis && (
                <div className="space-y-4">
                  {/* Price Chart */}
                  <div className="bg-slate-700 rounded-lg p-4">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="text-xl font-bold text-blue-400">{chartAnalysis.ticker}</h3>
                        <p className="text-slate-300">Current Price: ${chartAnalysis.currentPrice}</p>
                      </div>
                      <span className={'px-3 py-1 rounded-full text-sm font-semibold ' + 
                        (chartAnalysis.trend === 'Bullish' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400')}>
                        {chartAnalysis.trend}
                      </span>
                    </div>
                  </div>

                  {/* Support & Resistance */}
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="bg-slate-700 rounded-lg p-4">
                      <h4 className="text-sm font-semibold text-blue-400 mb-3">Support & Resistance</h4>
                      <div className="space-y-2">
                        <div className="bg-slate-800 rounded p-3">
                          <p className="text-sm text-slate-400">Support Levels</p>
                          <p className="text-slate-300">${chartAnalysis.support.join(', $')}</p>
                        </div>
                        <div className="bg-slate-800 rounded p-3">
                          <p className="text-sm text-slate-400">Resistance Levels</p>
                          <p className="text-slate-300">${chartAnalysis.resistance.join(', $')}</p>
                        </div>
                      </div>
                    </div>

                    {/* Signals */}
                    <div className="bg-slate-700 rounded-lg p-4">
                      <h4 className="text-sm font-semibold text-blue-400 mb-3">Signals</h4>
                      <ul className="space-y-2">
                        {chartAnalysis.signals.map((signal, idx) => (
                          <li key={idx} className="text-sm text-slate-300 flex items-start gap-2">
                            <span className="text-emerald-400 mt-1">•</span>
                            <span>{signal}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* Sentiment Analysis */}
                  {sentimentAnalysis && (
                    <div className="bg-slate-700 rounded-lg p-4">
                      <h4 className="text-sm font-semibold text-blue-400 mb-3">Market Sentiment</h4>
                      <div className="grid md:grid-cols-2 gap-4">
                        {sentimentAnalysis.breakdown.map((item, idx) => (
                          <div key={idx} className="bg-slate-800 p-3 rounded">
                            <div className="flex justify-between items-center mb-2">
                              <p className="text-sm font-semibold text-slate-300">{item.source}</p>
                              <span className="text-sm font-bold text-emerald-400">{item.score}%</span>
                            </div>
                            <div className="w-full bg-slate-700 rounded-full h-2">
                              <div
                                className="bg-emerald-400 h-2 rounded-full"
                                style={{ width: `${item.score}%` }}
                              ></div>
                            </div>
                            <p className="text-xs text-slate-400 mt-1">{item.trend}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
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
        </div>

        <footer className="mt-8 text-center text-slate-500 text-sm">
          <p>Get your free API keys and start analyzing! This app connects to real market data.</p>
        </footer>
      </div>
    </div>
  );
}

export default FinancialApp;