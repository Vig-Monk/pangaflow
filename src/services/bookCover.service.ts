// =============================================================================
// soko-api/src/services/bookCover.service.ts
// Multi-Source HD Cover Engine — APPLE BOOKS PRIORITY #1
// =============================================================================

import axios from 'axios';
import { env } from '../config/env';

export interface CoverSearchResult {
  coverUrl: string | null;
  title: string;
  author?: string;
  source: 'applebooks' | 'openlibrary' | 'googlebooks' | 'goodreads' | null;
}

const searchCache = new Map<string, { result: CoverSearchResult; timestamp: number }>();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 Hours

let googleBooksBlockedUntil = 0;

export function cleanTitleString(input: string): { full: string; primary: string; searchTerms: string[] } {
  if (!input) return { full: '', primary: '', searchTerms: [] };

  const sanitized = input
    .replace(/<[^>]*>/g, ' ')
    .replace(/^by\s+/i, '')
    .replace(/^(?:author|title):\s*/i, '')
    .replace(/\s*[\(\[][^\)\]]*(?:edition|paperback|hardcover|anniversary|reprint|series|vol\.|volume|copy)[^\)\]]*[\)\]]/gi, ' ')
    .replace(/\.(?:pdf|epub|mobi|azw3?)$/i, '')
    .replace(/[“”"]/g, '')
    .replace(/[\u2018\u2019']/g, "'")
    .replace(/\s+/g, ' ')
    .trim();

  const parts = sanitized.split(/\s*[:–—]\s*|\s+-\s+/);
  const primary = (parts[0] || sanitized).trim();
  const noParens = sanitized.replace(/[\(\)\[\]\{\}]/g, ' ').replace(/\s+/g, ' ').trim();

  const searchTerms = Array.from(new Set([sanitized, primary, noParens])).filter((t) => t.length > 0);
  return { full: sanitized, primary, searchTerms };
}

export function cleanAuthorString(input?: string | null): string {
  if (!input) return '';
  return input
    .replace(/<[^>]*>/g, ' ')
    .replace(/^by\s+/i, '')
    .replace(/^(?:author|written by):\s*/i, '')
    .replace(/\s+(?:and|with|&|\+)\s+.*$/i, '')
    .replace(/,\s*.*$/, '')
    .replace(/\b(?:Ph\.?D\.?|M\.?D\.?|Dr\.?|Prof\.?|Esq\.?)\b/gi, '')
    .replace(/[\(\[\{][^\)\]\}]*[\)\]\}]/g, ' ')
    .replace(/[^\w\s'.]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function extractValidIsbn(raw?: string | null): string | null {
  if (!raw) return null;
  const digits = raw.replace(/[^0-9X]/gi, '').toUpperCase();
  if (digits.length === 10 || digits.length === 13) return digits;
  return null;
}

// -----------------------------------------------------------------------------
// Priority 1: Apple Books Storefront (Studio Publisher Artwork, No 429 Blocks)
// -----------------------------------------------------------------------------
async function queryAppleBooks(
  searchTerm: string,
  author?: string
): Promise<{ url: string; title: string; author?: string } | null> {
  // Try with author first; if that returns 0 results, query title alone
  const queries = author
    ? [`${searchTerm} ${author}`, searchTerm]
    : [searchTerm];

  for (const q of queries) {
    const url = `https://itunes.apple.com/search?term=${encodeURIComponent(q)}&entity=ibook&country=us&limit=3`;

    try {
      const res = await axios.get<{
        resultCount: number;
        results: Array<{ trackCensoredName: string; artistName: string; artworkUrl100?: string }>;
      }>(url, {
        timeout: 4000,
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AppleBookCoverEngine/2.0)' },
      });

      if (res.data?.resultCount > 0) {
        for (const item of res.data.results) {
          if (item.artworkUrl100) {
            // Uncap Apple's 100x100 thumbnail to 1000x1000 studio jacket
            const hdUrl = item.artworkUrl100
              .replace('100x100bb', '1000x1000bb')
              .replace('100x100', '1000x1000');

            return {
              url: hdUrl,
              title: item.trackCensoredName,
              author: item.artistName,
            };
          }
        }
      }
    } catch {
      // Continue to next query attempt
    }
  }

  return null;
}

// -----------------------------------------------------------------------------
// Priority 2: Open Library (Direct ISBN Archive)
// -----------------------------------------------------------------------------
async function queryOpenLibrary(
  searchTerms: string[],
  cleanAuthor?: string,
  validIsbn?: string | null
): Promise<{ url: string; title: string; author?: string } | null> {
  if (validIsbn) {
    return {
      url: `https://covers.openlibrary.org/b/isbn/${validIsbn}-L.jpg?default=false`,
      title: searchTerms[0] || 'Book',
      author: cleanAuthor,
    };
  }

  for (const term of searchTerms) {
    try {
      const q = cleanAuthor ? `${term} ${cleanAuthor}` : term;
      const olUrl = `https://openlibrary.org/search.json?q=${encodeURIComponent(q)}&fields=key,title,author_name,cover_i,isbn&limit=3`;

      const res = await axios.get<{
        docs: Array<{ title: string; author_name?: string[]; cover_i?: number; isbn?: string[] }>;
      }>(olUrl, {
        timeout: 4000,
        headers: { 'User-Agent': 'BookCoverEngine/2.0' },
      });

      const docs = res.data?.docs || [];
      for (const doc of docs) {
        if (doc.cover_i && typeof doc.cover_i === 'number' && doc.cover_i > 0) {
          return {
            url: `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg`,
            title: doc.title || term,
            author: doc.author_name?.[0] || cleanAuthor,
          };
        }
        if (doc.isbn && doc.isbn.length > 0) {
          return {
            url: `https://covers.openlibrary.org/b/isbn/${doc.isbn[0]}-L.jpg`,
            title: doc.title || term,
            author: doc.author_name?.[0] || cleanAuthor,
          };
        }
      }
    } catch {
      // Continue
    }
  }

  return null;
}

// -----------------------------------------------------------------------------
// Priority 3: Google Books (Strictly a Fallback if Apple & OpenLibrary have no record)
// -----------------------------------------------------------------------------
function buildVerifiedGoogleBooksUrl(volumeId: string, rawThumbnailUrl?: string): string {
  if (rawThumbnailUrl) {
    let clean = rawThumbnailUrl.replace(/^http:\/\//i, 'https://').replace(/&edge=curl/gi, '');
    if (!clean.includes('&fife=')) {
      clean += '&fife=w800';
    }
    return clean;
  }
  return `https://books.google.com/books/content?id=${volumeId}&printsec=frontcover&img=1&zoom=1&source=gbs_api`;
}

async function queryGoogleBooks(
  title: string,
  author?: string,
  validIsbn?: string | null,
  apiKey?: string
): Promise<{ url: string; volumeId: string; title: string; author?: string } | null> {
  if (Date.now() < googleBooksBlockedUntil) {
    return null;
  }

  const queryTerms = validIsbn
    ? `isbn:${validIsbn}`
    : author
    ? `${title} ${author}`
    : title;

  const url = new URL('https://www.googleapis.com/books/v1/volumes');
  url.searchParams.set('q', queryTerms);
  url.searchParams.set('maxResults', '3');
  url.searchParams.set('printType', 'books');
  if (apiKey) url.searchParams.set('key', apiKey);

  try {
    const res = await axios.get(url.toString(), {
      timeout: 3500,
      headers: { 'User-Agent': 'BookCoverEngine/2.0' },
    });

    const items = res.data?.items || [];
    for (const item of items) {
      const volumeId = item.id;
      const volumeInfo = item.volumeInfo || {};
      const imageLinks = volumeInfo.imageLinks;

      const candidateUrl =
        imageLinks?.extraLarge ||
        imageLinks?.large ||
        imageLinks?.medium ||
        imageLinks?.thumbnail ||
        imageLinks?.smallThumbnail;

      if (candidateUrl || volumeId) {
        return {
          url: buildVerifiedGoogleBooksUrl(volumeId, candidateUrl),
          volumeId,
          title: volumeInfo.title || title,
          author: volumeInfo.authors?.[0] || author,
        };
      }
    }
  } catch (err: any) {
    if (err.response?.status === 429) {
      googleBooksBlockedUntil = Date.now() + 5 * 60 * 1000;
    }
  }

  return null;
}

// -----------------------------------------------------------------------------
// Master Resolution Engine — Enforces Apple Books First
// -----------------------------------------------------------------------------
export async function findBestBookCover(
  rawTitle: string,
  rawAuthor?: string,
  rawIsbnOrSku?: string
): Promise<CoverSearchResult> {
  const { full: titleFull, primary: titlePrimary, searchTerms } = cleanTitleString(rawTitle);
  const author = cleanAuthorString(rawAuthor);
  const validIsbn = extractValidIsbn(rawIsbnOrSku);

  if (!titleFull && !validIsbn) {
    return { coverUrl: null, title: rawTitle, source: null };
  }

  // Check 24-hour cache
  const cacheKey = `${validIsbn || ''}_${titleFull.toLowerCase()}_${author.toLowerCase()}`;
  const cached = searchCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.result;
  }

  // ===========================================================================
  // STEP 1: Apple Books Storefront (PRIORITY #1)
  // ===========================================================================
  for (const term of searchTerms) {
    const appleResult = await queryAppleBooks(term, author);
    if (appleResult?.url) {
      const finalResult: CoverSearchResult = {
        coverUrl: appleResult.url,
        title: appleResult.title || rawTitle,
        author: appleResult.author || rawAuthor,
        source: 'applebooks',
      };
      searchCache.set(cacheKey, { result: finalResult, timestamp: Date.now() });
      return finalResult;
    }
  }

  // ===========================================================================
  // STEP 2: Open Library (PRIORITY #2 — Direct ISBN)
  // ===========================================================================
  const olResult = await queryOpenLibrary(searchTerms, author, validIsbn);
  if (olResult?.url) {
    const finalResult: CoverSearchResult = {
      coverUrl: olResult.url,
      title: olResult.title || rawTitle,
      author: olResult.author || rawAuthor,
      source: 'openlibrary',
    };
    searchCache.set(cacheKey, { result: finalResult, timestamp: Date.now() });
    return finalResult;
  }

  // ===========================================================================
  // STEP 3: Google Books (PRIORITY #3 — Last-Resort Fallback Only)
  // ===========================================================================
  const apiKey = (env as any).GOOGLE_BOOKS_API_KEY || process.env.GOOGLE_BOOKS_API_KEY || undefined;
  const gbooksResult = await queryGoogleBooks(titlePrimary, author, validIsbn, apiKey);
  if (gbooksResult?.url) {
    const finalResult: CoverSearchResult = {
      coverUrl: gbooksResult.url,
      title: gbooksResult.title || rawTitle,
      author: gbooksResult.author || rawAuthor,
      source: 'googlebooks',
    };
    searchCache.set(cacheKey, { result: finalResult, timestamp: Date.now() });
    return finalResult;
  }

  return { coverUrl: null, title: rawTitle, source: null };
}