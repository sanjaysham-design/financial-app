export function parseRSS(xml, sourceName) {
  const items = [];
  const isAtom = xml.includes('<feed');

  if (isAtom) {
    const entryMatches = xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g);
    for (const match of entryMatches) {
      const entry = match[1];
      const title = entry.match(/<title[^>]*>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/s)?.[1]?.trim() || '';
      const link = entry.match(/<link[^>]*href="([^"]+)"/)?.[1] || entry.match(/<link[^>]*>(.*?)<\/link>/s)?.[1]?.trim() || '';
      const published = entry.match(/<published>(.*?)<\/published>/)?.[1] || entry.match(/<updated>(.*?)<\/updated>/)?.[1] || '';
      const summary = entry.match(/<summary[^>]*>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/summary>/s)?.[1]?.replace(/<[^>]+>/g, '').trim().slice(0, 400) || '';
      if (title && link) items.push({ title, url: link, publishedAt: published, summary, source: sourceName });
    }
  } else {
    const itemMatches = xml.matchAll(/<item>([\s\S]*?)<\/item>/g);
    for (const match of itemMatches) {
      const item = match[1];
      const title = item.match(/<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/s)?.[1]?.trim() || '';
      const link = item.match(/<link>(.*?)<\/link>/s)?.[1]?.trim() ||
                   item.match(/<guid[^>]*isPermaLink="true"[^>]*>(.*?)<\/guid>/s)?.[1]?.trim() || '';
      const published = item.match(/<pubDate>(.*?)<\/pubDate>/)?.[1] || '';
      const summary = item.match(/<description>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/description>/s)?.[1]?.replace(/<[^>]+>/g, '').trim().slice(0, 400) || '';
      if (title && link) items.push({ title, url: link, publishedAt: published, summary, source: sourceName });
    }
  }
  return items;
}
