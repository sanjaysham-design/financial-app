export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const feeds = [
    { name: 'Reuters', url: 'https://feeds.reuters.com/reuters/businessNews' },
    { name: 'MarketWatch', url: 'https://feeds.marketwatch.com/marketwatch/topstories/' },
    { name: 'CNBC', url: 'https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=10000664' },
    { name: 'Seeking Alpha', url: 'https://seekingalpha.com/feed.xml' },
    { name: 'AP Business', url: 'https://feeds.apnews.com/rss/business' },
    { name: 'Motley Fool', url: 'https://www.fool.com/feeds/index.aspx' },
    { name: "Barron's", url: 'https://www.barrons.com/xml/rss/3_7551.xml' },
    { name: 'Financial Times', url: 'https://www.ft.com/rss/home' },
  ];

  function parseRSS(xml, sourceName) {
    const items = [];
    const isAtom = xml.includes('<feed');

    if (isAtom) {
      const entryMatches = xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g);
      for (const match of entryMatches) {
        const entry = match[1];
        const title = entry.match(/<title[^>]*>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/s)?.[1]?.trim() || '';
        const link = entry.match(/<link[^>]*href="([^"]+)"/)?.[1] || entry.match(/<link[^>]*>(.*?)<\/link>/s)?.[1]?.trim() || '';
        const published = entry.match(/<published>(.*?)<\/published>/)?.[1] || entry.match(/<updated>(.*?)<\/updated>/)?.[1] || '';
        const summary = entry.match(/<summary[^>]*>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/summary>/s)?.[1]?.replace(/<[^>]+>/g, '').trim().slice(0, 300) || '';
        if (title) items.push({ title, url: link, publishedAt: published, summary, source: sourceName });
      }
    } else {
      const itemMatches = xml.matchAll(/<item>([\s\S]*?)<\/item>/g);
      for (const match of itemMatches) {
        const item = match[1];
        const title = item.match(/<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/s)?.[1]?.trim() || '';
        const link = item.match(/<link>(.*?)<\/link>/s)?.[1]?.trim() ||
                     item.match(/<guid[^>]*isPermaLink="true"[^>]*>(.*?)<\/guid>/s)?.[1]?.trim() || '';
        const published = item.match(/<pubDate>(.*?)<\/pubDate>/)?.[1] || '';
        const summary = item.match(/<description>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/description>/s)?.[1]?.replace(/<[^>]+>/g, '').trim().slice(0, 300) || '';
        if (title) items.push({ title, url: link, publishedAt: published, summary, source: sourceName });
      }
    }
    return items;
  }

  function analyzeSentiment(text) {
    const positive = ['gains', 'surge', 'profit', 'growth', 'strong', 'positive', 'rise', 'rally', 'up', 'beat'];
    const negative = ['loss', 'decline', 'fall', 'weak', 'concern', 'risk', 'down', 'drop', 'miss', 'cut'];
    const lower = (text || '').toLowerCase();
    const pos = positive.filter(w => lower.includes(w)).length;
    const neg = negative.filter(w => lower.includes(w)).length;
    if (pos > neg) return 'positive';
    if (neg > pos) return 'negative';
    return 'neutral';
  }

  try {
    const results = await Promise.allSettled(
      feeds.map(async (feed) => {
        const response = await fetch(feed.url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'application/rss+xml, application/xml, text/xml, */*',
          },
          signal: AbortSignal.timeout(6000)
        });
        if (!response.ok) throw new Error(`${feed.name}: ${response.status}`);
        const xml = await response.text();
        return parseRSS(xml, feed.name);
      })
    );

    let allArticles = [];
    let successCount = 0;
    for (const result of results) {
      if (result.status === 'fulfilled' && result.value.length > 0) {
        allArticles = allArticles.concat(result.value);
        successCount++;
      }
    }

    // If all RSS feeds failed, fall back to News API
    if (successCount === 0) {
      const { apikey } = req.query;
      if (apikey) {
        const fallback = await fetch(`https://newsapi.org/v2/top-headlines?category=business&language=en&pageSize=30&apiKey=${apikey}`);
        const data = await fallback.json();
        if (data.articles) {
          const formatted = data.articles.map(a => ({
            title: a.title,
            url: a.url,
            publishedAt: a.publishedAt,
            summary: a.description || '',
            source: a.source?.name || 'News API',
            sentiment: analyzeSentiment(a.title + ' ' + a.description),
          }));
          return res.status(200).json({ articles: formatted, source: 'fallback' });
        }
      }
      return res.status(200).json({ articles: [], error: 'All RSS feeds failed and no API key provided' });
    }

    // Sort by date, newest first
    allArticles.sort((a, b) => {
      const da = new Date(a.publishedAt || 0);
      const db = new Date(b.publishedAt || 0);
      return db - da;
    });

    // Add sentiment to each article
    const withSentiment = allArticles.slice(0, 50).map(a => ({
      ...a,
      sentiment: analyzeSentiment(a.title + ' ' + a.summary),
    }));

    return res.status(200).json({ articles: withSentiment, source: 'rss', feedsLoaded: successCount });

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}