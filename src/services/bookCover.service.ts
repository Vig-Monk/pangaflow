// =============================================================================
// soko-api/src/services/bookCover.service.ts
// Ultra-High-Resolution (HD 800px+) Book Cover Discovery Engine.
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
    .replace(/\s*[\(\[\{][^\)\]\}]*[\)\]\}]/g, ' ') // Strip (Paperback), [E-Book], etc.
    .replace(/:\s*.*$/, '')                          // Strip subtitles
    .replace(/[^\w\s-]/g, ' ')                       // Strip punctuation
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Upgrades Google Books thumbnail URLs to 800px+ High-Resolution HD images
 */
function upgradeToHighResGoogleUrl(url: string, volumeId?: string): string {
  // If volumeId is present, use Google's direct 800x1200 HD publisher CDN endpoint
  if (volumeId) {
    return `https://books.google.com/books/publisher/content/images/frontcover/${volumeId}?fife=w800-h1200`;
  }

  let upgraded = url.replace(/^http:\/\//i, 'https://');
  upgraded = upgraded.replace(/&edge=curl/g, '');

  // zoom=0 removes thumbnail downscaling and returns uncompressed scan
  upgraded = upgraded.replace(/zoom=[0-9]/g, 'zoom=0');

  // Append 800px width scaling parameter if not present
  if (!upgraded.includes('fife=')) {
    upgraded += '&fife=w800-h1200';
  }

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
  // Tier 1: Google Books API (High-Resolution Discovery)
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
            coverUrl: upgradeToHighResGoogleUrl(rawCover, volumeId),
            title: volumeInfo.title || rawTitle,
            author: volumeInfo.authors?.[0] || rawAuthor,
            source: 'googlebooks',
          };
        }
      }
    }
  } catch (err) {
    // Non-blocking fallback to Open Library
  }

  // ---------------------------------------------------------------------------
  // Tier 2: Open Library API (Large -L.jpg Format)
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
    // Fallback
  }

  return { coverUrl: null, title: rawTitle, source: null };
}