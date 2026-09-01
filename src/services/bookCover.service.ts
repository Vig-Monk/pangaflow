// =============================================================================
// soko-api/src/services/bookCover.service.ts
// Robust Book Cover Discovery with High-Resolution CDN Formatting.
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
    .replace(/\s*[\(\[\{][^\)\]\}]*[\)\]\}]/g, ' ') // Strip [Paperback], (1st Edition), etc.
    .replace(/:\s*.*$/, '')                          // Strip subtitles
    .replace(/[^\w\s-]/g, ' ')                       // Strip punctuation
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Formats Google Books URLs to guaranteed high-res HTTPS CDN links
 */
function normalizeGoogleBooksUrl(url: string, volumeId?: string): string {
  if (volumeId) {
    // Direct Google CDN endpoint (bypasses gbs_api restrictions and gives crisp 400x600 covers)
    return `https://books.google.com/books/publisher/content/images/frontcover/${volumeId}?fife=w400-h600`;
  }
  let upgraded = url.replace(/^http:\/\//i, 'https://');
  upgraded = upgraded.replace(/&edge=curl/g, '');
  return upgraded;
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

  // ---------------------------------------------------------------------------
  // Tier 1: Google Books API
  // ---------------------------------------------------------------------------
  try {
    const query = hasValidIsbn
      ? `isbn:${cleanIsbn}`
      : author
        ? `${title} ${author}`
        : title;

    const gbooksUrl = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=3&printType=books`;
    const res = await axios.get(gbooksUrl, { timeout: 4500 });
    const items = res.data?.items || [];

    for (const item of items) {
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
            coverUrl: normalizeGoogleBooksUrl(rawCover, volumeId),
            title: volumeInfo.title || rawTitle,
            author: volumeInfo.authors?.[0] || rawAuthor,
            source: 'googlebooks',
          };
        }
      }
    }
  } catch (err) {
    // Fallback to Open Library
  }

  // ---------------------------------------------------------------------------
  // Tier 2: Open Library API Fallback
  // ---------------------------------------------------------------------------
  try {
    if (hasValidIsbn) {
      return {
        coverUrl: `https://covers.openlibrary.org/b/isbn/${cleanIsbn}-L.jpg`,
        title: rawTitle,
        author: rawAuthor,
        source: 'openlibrary',
      };
    }

    const olQueryUrl = `https://openlibrary.org/search.json?q=${encodeURIComponent(title)}&limit=3`;
    const olRes = await axios.get(olQueryUrl, {
      timeout: 4500,
      headers: { 'User-Agent': 'FlemelaBookstoreApp/1.0 (support@flemela.co.ke)' },
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
      if (doc.isbn && Array.isArray(doc.isbn) && doc.isbn.length > 0) {
        return {
          coverUrl: `https://covers.openlibrary.org/b/isbn/${doc.isbn[0]}-L.jpg`,
          title: doc.title || rawTitle,
          author: doc.author_name?.[0] || rawAuthor,
          source: 'openlibrary',
        };
      }
    }
  } catch (err) {
    // Fallback to null
  }

  return { coverUrl: null, title: rawTitle, source: null };
}