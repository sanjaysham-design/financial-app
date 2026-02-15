export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const feeds = [
    { name: 'TechCrunch', url: 'https://techcrunch.com/feed/' },
    { name: 'The Verge', url: 'https://www.theverge.com/rss/index.xml' },
    { name: 'Wired', url: 'https://www.wired.com/feed/rss' },
    { name: 'Ars Technica', url: 'https://feeds.arstechnica.com/arstechnica/index' },
    { name: 'VentureBeat', url: 'https://venturebeat.com/feed/' },
    { name: 'MIT Tech Review', url: 'https://www.technologyreview.com/feed/' },
    { name: 'AI News', url: 'https://www.artificialintelligence-news.com/feed/' },
    { name: 'IEEE Spectrum', url: 'https://spectrum.ieee.org/feeds/feed.rss' },
    { name: 'The Batch', url: 'https://www.deeplearning.ai/the-batch/feed/' },
    { name: 'Reuters Tech', url: 'https://feeds.reuters.com/reuters/technologyNews' },
    { name: 'Bloomberg Tech', url: 'https://feeds.bloomberg.com/technology/news.rss' },
  ];

  const AI_KEYWORDS = ['ai', 'artificial intelligence', 'machine learning', 'llm', 'gpt', 'nvidia', 'chip', 'semiconductor', 'deep learning', 'neural', 'openai', 'anthropic', 'gemini', 'model', 'inference', 'gpu', 'data center'];

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
        const summary = entry.match(/<summary[^>]*>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/summary>/s)?.[1]?.replace(/<[^>]+>/g, '').trim() || '';
        if (title) items.push({ title, link, published, summary, source: sourceName });
      }
    } else {
      const itemMatches = xml.matchAll(/<item>([\s\S]*?)<\/item>/g);
      for (const match of itemMatches) {
        const item = match[1];
        const title = item.match(/<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/s)?.[1]?.trim() || '';
        const link = item.match(/<link>(.*?)<\/link>/s)?.[1]?.trim() || item.match(/<guid[^>]*>(.*?)<\/guid>/s)?.[1]?.trim() || '';
        const published = item.match(/<pubDate>(.*?)<\/pubDate>/)?.[1] || '';
        const summary = item.match(/<description>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/description>/s)?.[1]?.replace(/<[^>]+>/g, '').trim().slice(0, 300) || '';
        if (title) items.push({ title, link, published, summary, source: sourceName });
      }
    }
    return items;
  }

  function isAIRelated(item) {
    const text = (item.title + ' ' + item.summary).toLowerCase();
    return AI_KEYWORDS.some(kw => text.includes(kw));
  }

  try {
    const results = await Promise.allSettled(
      feeds.map(async (feed) => {
        const response = await fetch(feed.url, {
          headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/rss+xml, application/xml, text/xml' },
          signal: AbortSignal.timeout(5000)
        });
        if (!response.ok) throw new Error(`${feed.name}: ${response.status}`);
        const xml = await response.text();
        return parseRSS(xml, feed.name);
      })
    );

    let allItems = [];
    for (const result of results) {
      if (result.status === 'fulfilled') allItems = allItems.concat(result.value);
    }

    // Filter to AI-related articles
    const aiItems = allItems.filter(isAIRelated);

    // Sort by date, newest first
    aiItems.sort((a, b) => {
      const da = new Date(a.published);
      const db = new Date(b.published);
      return db - da;
    });

    return res.status(200).json({ articles: aiItems.slice(0, 30) });

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}