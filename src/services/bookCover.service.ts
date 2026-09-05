// =============================================================================
// soko-api/src/services/bookCover.service.ts
// Multi-Source HD (800px+) Book Cover Engine with Rate-Limit Circuit Breakers
// =============================================================================

import axios from 'axios';
import { env } from '../config/env';

export interface CoverSearchResult {
  coverUrl: string | null;
  title: string;
  author?: string;
  source: 'applebooks' | 'openlibrary' | 'googlebooks' | 'goodreads' | null;
}

// In-memory cache across searches
const searchCache = new Map<string, { result: CoverSearchResult; timestamp: number }>();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 Hours

// Circuit breaker: pauses Google Books on HTTP 429 to avoid spamming a locked IP
let googleBooksBlockedUntil = 0;

// -----------------------------------------------------------------------------
// 1. String Sanitizers & ISBN Validation
// -----------------------------------------------------------------------------

export function cleanTitleString(input: string): { full: string; primary: string; searchTerms: string[] } {
  if (!input) return { full: '', primary: '', searchTerms: [] };

  const sanitized = input
    .replace(/<[^>]*>/g, ' ')
    .replace(/^by\s+/i, '')
    .replace(/^(?:author|title):\s*/i, '')
    // Strip ONLY technical edition/format brackets, keeping creative subtitles
    .replace(/\s*[\(\[][^\)\]]*(?:edition|paperback|hardcover|anniversary|reprint|series|vol\.|volume|copy)[^\)\]]*[\)\]]/gi, ' ')
    .replace(/\.(?:pdf|epub|mobi|azw3?)$/i, '')
    .replace(/[“”"]/g, '')
    .replace(/[\u2018\u2019']/g, "'")
    .replace(/\s+/g, ' ')
    .trim();

  // Primary title (before colon or spaced dash)
  const parts = sanitized.split(/\s*[:–—]\s*|\s+-\s+/);
  const primary = (parts[0] || sanitized).trim();

  // Strip parentheses for providers that struggle with punctuation
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

export function isValidIsbn10(isbn: string): boolean {
  if (!/^[0-9]{9}[0-9X]$/i.test(isbn)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(isbn[i], 10) * (10 - i);
  }
  const checkChar = isbn[9].toUpperCase();
  sum += checkChar === 'X' ? 10 : parseInt(checkChar, 10);
  return sum % 11 === 0;
}

export function isValidIsbn13(isbn: string): boolean {
  if (!/^97[89][0-9]{10}$/.test(isbn)) return false;
  let sum = 0;
  for (let i = 0; i < 13; i++) {
    const digit = parseInt(isbn[i], 10);
    sum += i % 2 === 0 ? digit : digit * 3;
  }
  return sum % 10 === 0;
}

export function extractValidIsbn(raw?: string | null): string | null {
  if (!raw) return null;
  const digits = raw.replace(/[^0-9X]/gi, '').toUpperCase();
  if (digits.length === 10 && isValidIsbn10(digits)) return digits;
  if (digits.length === 13 && isValidIsbn13(digits)) return digits;
  return null;
}

// -----------------------------------------------------------------------------
// 2. Provider 1: Apple Books / iTunes Storefront (No Rate Limits, High Res)
// -----------------------------------------------------------------------------

async function queryAppleBooks(
  searchTerm: string,
  author?: string
): Promise<{ url: string; title: string; author?: string } | null> {
  const query = author ? `${searchTerm} ${author}` : searchTerm;
  const url = `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=ibook&limit=3`;

  try {
    const res = await axios.get<{
      resultCount: number;
      results: Array<{ trackCensoredName: string; artistName: string; artworkUrl100?: string }>;
    }>(url, {
      timeout: 4500,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; FlemelaCoverEngine/2.0)' },
    });

    if (res.data?.resultCount > 0) {
      for (const item of res.data.results) {
        if (item.artworkUrl100) {
          // Uncap Apple's 100x100 thumbnail to full-quality 800x800+ publisher artwork
          const hdUrl = item.artworkUrl100
            .replace('100x100bb', '800x800bb')
            .replace('100x100', '800x800');

          return {
            url: hdUrl,
            title: item.trackCensoredName,
            author: item.artistName,
          };
        }
      }
    }
  } catch {
    // Non-blocking cascade
  }

  return null;
}

// -----------------------------------------------------------------------------
// 3. Provider 2: Open Library (Direct Cover IDs & ISBNs)
// -----------------------------------------------------------------------------

async function queryOpenLibrary(
  searchTerms: string[],
  cleanAuthor?: string,
  validIsbn?: string | null
): Promise<{ url: string; title: string; author?: string } | null> {
  // Direct ISBN cover
  if (validIsbn) {
    return {
      url: `https://covers.openlibrary.org/b/isbn/${validIsbn}-L.jpg`,
      title: searchTerms[0] || 'Book',
      author: cleanAuthor,
    };
  }

  // Open Library Search
  for (const term of searchTerms) {
    try {
      const q = cleanAuthor ? `${term} ${cleanAuthor}` : term;
      const olUrl = `https://openlibrary.org/search.json?q=${encodeURIComponent(q)}&fields=key,title,author_name,cover_i,isbn&limit=5`;

      const res = await axios.get<{
        docs: Array<{ title: string; author_name?: string[]; cover_i?: number; isbn?: string[] }>;
      }>(olUrl, {
        timeout: 6000,
        headers: { 'User-Agent': 'FlemelaBookstore/2.0 (concierge@flemela.co.ke)' },
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
      // Continue to next search term
    }
  }

  return null;
}

// -----------------------------------------------------------------------------
// 4. Provider 3: Google Books (Protected by Circuit Breaker)
// -----------------------------------------------------------------------------

function transformGoogleBooksToHd(volumeId: string, rawUrl?: string): string {
  if (volumeId) {
    return `https://books.google.com/books/publisher/content/images/frontcover/${volumeId}?fife=w800&source=gbs_api`;
  }
  if (rawUrl) {
    return rawUrl
      .replace(/^http:\/\//i, 'https://')
      .replace(/&edge=curl/gi, '')
      .replace(/&zoom=[1-9]/gi, '&zoom=0')
      .concat(rawUrl.includes('fife=') ? '' : '&fife=w800');
  }
  return '';
}

async function queryGoogleBooks(
  queryParam: string,
  apiKey?: string
): Promise<{ url: string; volumeId: string; title: string; author?: string } | null> {
  // If IP is locked in a 429 cooldown, skip Google Books entirely
  if (Date.now() < googleBooksBlockedUntil) {
    return null;
  }

  const url = new URL('https://www.googleapis.com/books/v1/volumes');
  url.searchParams.set('q', queryParam);
  url.searchParams.set('maxResults', '3');
  url.searchParams.set('printType', 'books');
  if (apiKey) url.searchParams.set('key', apiKey);

  try {
    const res = await axios.get(url.toString(), {
      timeout: 5000,
      headers: { 'User-Agent': 'Flemela-GoogleBooks-Resolver/2.0' },
    });

    const items = res.data?.items || [];
    for (const item of items) {
      const volumeId = item.id;
      const volumeInfo = item.volumeInfo || {};
      const imageLinks = volumeInfo.imageLinks;

      if (imageLinks) {
        const candidateUrl =
          imageLinks.extraLarge ||
          imageLinks.large ||
          imageLinks.medium ||
          imageLinks.thumbnail ||
          imageLinks.smallThumbnail;

        if (candidateUrl) {
          const hdUrl = transformGoogleBooksToHd(volumeId, candidateUrl);
          return {
            url: hdUrl,
            volumeId,
            title: volumeInfo.title || '',
            author: volumeInfo.authors?.[0],
          };
        }
      }
    }
  } catch (err: any) {
    if (err.response?.status === 429) {
      googleBooksBlockedUntil = Date.now() + 10 * 60 * 1000; // 10-minute circuit breaker
      console.warn('⚠️ Google Books IP rate-limit active. Pausing Google Books for 10 minutes and shifting to Apple Books & Open Library.');
    }
  }

  return null;
}

// -----------------------------------------------------------------------------
// 5. Provider 4: Goodreads / Public BookCover API
// -----------------------------------------------------------------------------

async function queryGoodreads(
  title: string,
  author?: string,
  isbn?: string | null
): Promise<string | null> {
  try {
    let url = `https://bookcover.longitood.com/bookcover?book_title=${encodeURIComponent(title)}`;
    if (author) url += `&author_name=${encodeURIComponent(author)}`;
    if (isbn) url = `https://bookcover.longitood.com/bookcover?isbn=${isbn}`;

    const res = await axios.get<{ url?: string }>(url, { timeout: 4500 });
    let coverUrl = res.data?.url;

    if (coverUrl && coverUrl.startsWith('http')) {
      coverUrl = coverUrl.replace(/\._S[XY]\d+_\./i, '.');
      return coverUrl;
    }
  } catch {
    // Non-blocking
  }
  return null;
}

// -----------------------------------------------------------------------------
// 6. Master Resolution Engine
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

  // Check cache
  const cacheKey = `${validIsbn || ''}_${titleFull.toLowerCase()}_${author.toLowerCase()}`;
  const cached = searchCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.result;
  }

  // ---------------------------------------------------------------------------
  // STEP 1: Apple Books Storefront (Fast, Studio-Grade HD, No 429 Blocks)
  // ---------------------------------------------------------------------------
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

  // ---------------------------------------------------------------------------
  // STEP 2: Open Library (By ISBN or High-Speed Works Search)
  // ---------------------------------------------------------------------------
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

  // ---------------------------------------------------------------------------
  // STEP 3: Google Books (If not in a 429 lockout window)
  // ---------------------------------------------------------------------------
  const apiKey = (env as any).GOOGLE_BOOKS_API_KEY || process.env.GOOGLE_BOOKS_API_KEY || undefined;
  if (Date.now() >= googleBooksBlockedUntil) {
    const gbooksQuery = validIsbn
      ? `isbn:${validIsbn}`
      : author
      ? `intitle:"${titlePrimary}" inauthor:"${author}"`
      : `intitle:"${titlePrimary}"`;

    const gbooksResult = await queryGoogleBooks(gbooksQuery, apiKey);
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
  }

  // ---------------------------------------------------------------------------
  // STEP 4: Goodreads / Public BookCover Fallback
  // ---------------------------------------------------------------------------
  const goodreadsUrl = await queryGoodreads(titlePrimary, author, validIsbn);
  if (goodreadsUrl) {
    const finalResult: CoverSearchResult = {
      coverUrl: goodreadsUrl,
      title: rawTitle,
      author: rawAuthor,
      source: 'goodreads',
    };
    searchCache.set(cacheKey, { result: finalResult, timestamp: Date.now() });
    return finalResult;
  }

  return { coverUrl: null, title: rawTitle, source: null };
}