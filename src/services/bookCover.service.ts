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

/**
 * Sanitizes Google Books public image URL (uses unrestricted public content stream)
 */
function cleanGoogleBooksUrl(rawUrl: string, volumeId?: string): string {
  if (volumeId) {
    return `https://books.google.com/books/content?id=${volumeId}&printsec=frontcover&img=1&zoom=1`;
  }
  return rawUrl.replace(/^http:\/\//i, 'https://').replace(/&edge=curl/g, '');
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

  // 1. Strict Google Books query: matches exact title and author metadata
  try {
    const query = hasValidIsbn
      ? `isbn:${cleanIsbn}`
      : author
        ? `intitle:"${title}"+inauthor:"${author}"`
        : `intitle:"${title}"`;

    const gbooksUrl = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(
      query
    )}&maxResults=1&printType=books`;
    const res = await axios.get(gbooksUrl, { timeout: 4500 });

    const items = res.data?.items || [];
    if (items.length > 0) {
      const item = items[0];
      const volumeId = item.id;
      const volumeInfo = item.volumeInfo || {};
      const imageLinks = volumeInfo.imageLinks;

      if (imageLinks) {
        const rawCover =
          imageLinks.extraLarge ||
          imageLinks.large ||
          imageLinks.medium ||
          imageLinks.thumbnail ||
          imageLinks.smallThumbnail;

        if (rawCover && typeof rawCover === 'string' && rawCover.length > 10) {
          return {
            coverUrl: cleanGoogleBooksUrl(rawCover, volumeId),
            title: volumeInfo.title || rawTitle,
            author: volumeInfo.authors?.[0] || rawAuthor,
            source: 'googlebooks',
          };
        }
      }
    }
  } catch {
    // Non-blocking fallback to Open Library
  }

  // 2. Direct Open Library Work Search (Zero Rate Limits, Returns Stable Cover ID)
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
    // Non-blocking fallback
  }

  return { coverUrl: null, title: rawTitle, source: null };
}