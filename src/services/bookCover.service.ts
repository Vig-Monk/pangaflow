// =============================================================================
// soko-api/src/services/bookCover.service.ts
// Multi-Source High-Resolution Book Cover Discovery Engine
// =============================================================================

import axios from 'axios';

export interface CoverSearchResult {
  coverUrl: string | null;
  title: string;
  author?: string;
  source: 'googlebooks' | 'openlibrary' | null;
}

function cleanQueryString(input: string): string {
  return (input || '')
    .replace(/\s*[\(\[\{][^\)\]\}]*[\)\]\}]/g, ' ')
    .replace(/:\s*.*$/, '')
    .replace(/[^\w\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export async function findBestBookCover(
  rawTitle: string,
  rawAuthor?: string,
  rawIsbn?: string
): Promise<CoverSearchResult> {
  const title = cleanQueryString(rawTitle);
  const author = rawAuthor ? cleanQueryString(rawAuthor) : '';
  const cleanIsbn = (rawIsbn || '').replace(/[^0-9X]/gi, '');
  const hasValidIsbn = cleanIsbn.length === 10 || cleanIsbn.length === 13;

  if (!title && !hasValidIsbn) {
    return { coverUrl: null, title: rawTitle, source: null };
  }

  // 1. Direct Open Library Work Search (Zero Rate Limits, Returns Stable Cover ID)
  try {
    const olUrl = `https://openlibrary.org/search.json?title=${encodeURIComponent(title)}${
      author ? `&author=${encodeURIComponent(author)}` : ''
    }&limit=3`;
    const olRes = await axios.get(olUrl, {
      timeout: 4000,
      headers: { 'User-Agent': 'FlemelaBookstore/2.0 (contact@flemela.co.ke)' },
    });

    const docs = olRes.data?.docs || [];
    for (const doc of docs) {
      if (doc.cover_i) {
        return {
          coverUrl: `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg`,
          title: doc.title || rawTitle,
          author: doc.author_name?.[0] || rawAuthor,
          source: 'openlibrary',
        };
      }
    }
  } catch {
    // Non-blocking cascade to Tier 2
  }

  // 2. Google Books Public Content Stream
  try {
    const query = hasValidIsbn ? `isbn:${cleanIsbn}` : `${title} ${author}`.trim();
    const gbooksUrl = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(
      query
    )}&maxResults=3&printType=books`;
    const res = await axios.get(gbooksUrl, { timeout: 4500 });

    for (const item of res.data?.items || []) {
      const links = item.volumeInfo?.imageLinks;
      if (links) {
        const cover =
          links.extraLarge || links.large || links.medium || links.thumbnail || links.smallThumbnail;
        if (cover) {
          return {
            coverUrl: `https://books.google.com/books/content?id=${item.id}&printsec=frontcover&img=1&zoom=1`,
            title: item.volumeInfo.title || rawTitle,
            author: item.volumeInfo.authors?.[0] || rawAuthor,
            source: 'googlebooks',
          };
        }
      }
    }
  } catch {
    // Non-blocking cascade
  }

  return { coverUrl: null, title: rawTitle, source: null };
}