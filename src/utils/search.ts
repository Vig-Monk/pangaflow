// =============================================================================
// soko-api/src/utils/search.ts
// Reusable, Multi-Project PostgreSQL Trigram Fuzzy Search Query Builder
// =============================================================================

export interface FuzzyFieldConfig {
  column: string;      // e.g. 'p.name', 'c.phone', 'p.sku'
  weight?: number;     // Ranking multiplier (e.g. title: 1.5, desc: 0.6)
  exactOnly?: boolean; // If true, only ILIKE is used (good for short codes/SKUs)
}

export interface BuildFuzzySearchParams {
  searchTerm: string;
  startParamIndex: number;
  fields: FuzzyFieldConfig[];
  similarityThreshold?: number; // Default 0.28 for sensible book title typo hits
}

export interface FuzzySearchResult {
  conditionSql: string;
  relevanceSql: string;
  params: unknown[];
  nextParamIndex: number;
}

/**
 * Builds a parameterized SQL WHERE clause and ORDER BY relevance score using
 * PostgreSQL's native `pg_trgm` extension with GIN index acceleration.
 *
 * Can be reused for any entity (Products, Customers, Expenses, Orders, etc.)
 */
export function buildFuzzySearchQuery(
  options: BuildFuzzySearchParams
): FuzzySearchResult | null {
  const cleanTerm = (options.searchTerm || '').trim().toLowerCase();
  if (!cleanTerm) return null;

  const threshold = options.similarityThreshold ?? 0.28;
  const params: unknown[] = [];
  let paramIdx = options.startParamIndex;

  const exactParamIdx = paramIdx++;
  const likeParamIdx = paramIdx++;

  params.push(cleanTerm);
  params.push(`%${cleanTerm}%`);

  const conditionClauses: string[] = [];
  const scoreClauses: string[] = [];

  const isShortQuery = cleanTerm.length < 3;

  for (const field of options.fields) {
    const col = field.column;
    const weight = field.weight ?? 1.0;

    if (isShortQuery || field.exactOnly) {
      // Short terms (< 3 chars): ILIKE substring matching
      conditionClauses.push(`${col} ILIKE $${likeParamIdx}`);
      scoreClauses.push(`
        (CASE 
          WHEN LOWER(${col}) = $${exactParamIdx} THEN 2.0
          WHEN ${col} ILIKE $${likeParamIdx} THEN 1.0
          ELSE 0.0
        END) * ${weight}
      `);
    } else {
      // 3+ character terms: Trigram word_similarity + similarity + ILIKE
      conditionClauses.push(`(
        ${col} ILIKE $${likeParamIdx} OR
        similarity(LOWER(${col}), $${exactParamIdx}) >= ${threshold} OR
        word_similarity($${exactParamIdx}, LOWER(${col})) >= ${threshold}
      )`);

      scoreClauses.push(`
        (CASE 
          WHEN LOWER(${col}) = $${exactParamIdx} THEN 3.0
          WHEN ${col} ILIKE $${likeParamIdx} THEN 2.0
          ELSE GREATEST(
            similarity(LOWER(${col}), $${exactParamIdx}),
            word_similarity($${exactParamIdx}, LOWER(${col}))
          )
        END) * ${weight}
      `);
    }
  }

  const conditionSql = `(${conditionClauses.join(' OR ')})`;
  const relevanceSql = `GREATEST(${scoreClauses.join(', ')})`;

  return {
    conditionSql,
    relevanceSql,
    params,
    nextParamIndex: paramIdx,
  };
}