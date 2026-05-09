/**
 * Fuzzy match wrapper for AI ingest preview.
 *
 * Server-first via two Postgres trigram RPCs (`match_material_by_name`,
 * `match_vendor_by_name`) added in migration 20260509100100. Client-side
 * Levenshtein fallback handles the dev-server case where the migration
 * hasn't been applied yet — best-effort only.
 *
 * Score buckets (consumed by the preview table):
 *   matched   — top hit's score >= 0.7 → auto-pick
 *   ambiguous — top hit between 0.5 and 0.7 → user picks from a dropdown
 *   new       — no candidates >= 0.5 → pre-fill a create-form draft
 */

import { createClient } from "@/lib/supabase/client";
import { withTimeout } from "@/lib/utils/timeout";

/**
 * Per-call timeout for the trigram match RPCs. The Cloudflare Worker proxy
 * occasionally stalls on REST calls (see memory: production_nav_hang_fix_2026_05_05);
 * without a timeout the parse step's Promise.all hangs forever and the
 * "Parsing…" button stays disabled until the user closes the dialog.
 *
 * 15s is generous enough to absorb a slow proxy + a 5-row trigram search,
 * but tight enough that a true hang surfaces as a user-actionable error
 * within the same step rather than an indefinite spinner.
 */
const MATCH_TIMEOUT_MS = 15_000;

export const MATCH_THRESHOLD_AUTO = 0.7;
export const MATCH_THRESHOLD_AMBIGUOUS = 0.5;

export type MaterialMatchCandidate = {
  id: string;
  name: string;
  local_name: string | null;
  category_id: string | null;
  unit: string;
  score: number;
};

export type VendorMatchCandidate = {
  id: string;
  name: string;
  city: string | null;
  phone: string | null;
  gst_number: string | null;
  score: number;
};

export type MatchResult<T> =
  | { status: "matched"; entity: T; score: number; candidates: T[] }
  | { status: "ambiguous"; candidates: T[] }
  | { status: "new" };

function bucketCandidates<T extends { score: number }>(candidates: T[]): MatchResult<T> {
  if (candidates.length === 0) return { status: "new" };
  const top = candidates[0];
  if (top.score >= MATCH_THRESHOLD_AUTO) {
    return { status: "matched", entity: top, score: top.score, candidates };
  }
  if (top.score >= MATCH_THRESHOLD_AMBIGUOUS) {
    return { status: "ambiguous", candidates };
  }
  return { status: "new" };
}

/**
 * Match a material name against the catalog. Optionally constrain to a category.
 */
export async function matchMaterial(
  query: string,
  options: { categoryId?: string | null; limit?: number } = {},
): Promise<MatchResult<MaterialMatchCandidate>> {
  const trimmed = query.trim();
  if (!trimmed) return { status: "new" };

  const supabase = createClient();
  const { data, error } = await withTimeout(
    Promise.resolve(
      (supabase as any).rpc("match_material_by_name", {
        p_query: trimmed,
        p_category_id: options.categoryId ?? null,
        p_threshold: 0.3,
        p_limit: options.limit ?? 5,
      }),
    ),
    MATCH_TIMEOUT_MS,
    `match_material_by_name timed out after ${MATCH_TIMEOUT_MS / 1000}s`,
  );

  if (error) {
    // RPC missing (e.g. migration not yet applied locally) → caller falls back.
    throw new FuzzyMatchRpcError(error.message ?? "match_material_by_name failed");
  }

  const candidates = (data ?? []) as MaterialMatchCandidate[];
  return bucketCandidates(candidates);
}

/**
 * Match a vendor name against the catalog.
 */
export async function matchVendor(
  query: string,
  options: { limit?: number } = {},
): Promise<MatchResult<VendorMatchCandidate>> {
  const trimmed = query.trim();
  if (!trimmed) return { status: "new" };

  const supabase = createClient();
  const { data, error } = await withTimeout(
    Promise.resolve(
      (supabase as any).rpc("match_vendor_by_name", {
        p_query: trimmed,
        p_threshold: 0.3,
        p_limit: options.limit ?? 5,
      }),
    ),
    MATCH_TIMEOUT_MS,
    `match_vendor_by_name timed out after ${MATCH_TIMEOUT_MS / 1000}s`,
  );

  if (error) {
    throw new FuzzyMatchRpcError(error.message ?? "match_vendor_by_name failed");
  }

  const candidates = (data ?? []) as VendorMatchCandidate[];
  return bucketCandidates(candidates);
}

export class FuzzyMatchRpcError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FuzzyMatchRpcError";
  }
}

// ============================================================================
// Client-side fallback (Levenshtein-based) — used only when the RPC is missing.
// ============================================================================

/**
 * Normalised similarity = 1 - levenshtein(a, b) / max(len(a), len(b)).
 * Case-insensitive. Returns 0 for empty inputs.
 */
export function clientSimilarity(a: string, b: string): number {
  const A = a.trim().toLowerCase();
  const B = b.trim().toLowerCase();
  if (!A || !B) return 0;
  if (A === B) return 1;
  const distance = levenshtein(A, B);
  const longest = Math.max(A.length, B.length);
  return 1 - distance / longest;
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  const prev = new Array<number>(n + 1);
  const curr = new Array<number>(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;

  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
      curr[j] = Math.min(
        curr[j - 1] + 1, // insertion
        prev[j] + 1, // deletion
        prev[j - 1] + cost, // substitution
      );
    }
    for (let j = 0; j <= n; j++) prev[j] = curr[j];
  }
  return prev[n];
}

/**
 * Client-side ranking against a pre-fetched list. Use as fallback when the
 * RPC is unavailable. Returns top-N candidates above the auto threshold.
 */
export function rankClientSide<T extends { id: string; name: string }>(
  query: string,
  rows: readonly T[],
  options: { limit?: number; minScore?: number } = {},
): Array<T & { score: number }> {
  const limit = options.limit ?? 5;
  const minScore = options.minScore ?? 0.3;
  const ranked = rows
    .map((row) => ({ ...row, score: clientSimilarity(query, row.name) }))
    .filter((r) => r.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
  return ranked;
}

// ============================================================================
// Client-side matchers that take a pre-fetched catalog and return MatchResult
// in the same shape as the trigram RPCs. Used by resolvePreview to avoid the
// N+1 RPC fan-out (which queues behind browser concurrent-connection limits
// and can stall on auth-token-refresh contention).
// ============================================================================

interface MaterialCatalogRow {
  id: string;
  name: string;
  local_name: string | null;
  category_id: string | null;
  unit: string;
}

interface VendorCatalogRow {
  id: string;
  name: string;
  city: string | null;
  phone: string | null;
  gst_number: string | null;
}

export function matchMaterialClientSide(
  query: string,
  catalog: readonly MaterialCatalogRow[],
  options: { categoryId?: string | null; limit?: number } = {},
): MatchResult<MaterialMatchCandidate> {
  const trimmed = query.trim();
  if (!trimmed) return { status: "new" };
  const limit = options.limit ?? 5;
  const filtered = options.categoryId
    ? catalog.filter((m) => m.category_id === options.categoryId)
    : catalog;

  // Match against name OR local_name, take the better score.
  const scored = filtered
    .map<MaterialMatchCandidate>((m) => {
      const nameScore = clientSimilarity(trimmed, m.name);
      const localScore = m.local_name ? clientSimilarity(trimmed, m.local_name) : 0;
      return {
        id: m.id,
        name: m.name,
        local_name: m.local_name,
        category_id: m.category_id,
        unit: m.unit,
        score: Math.max(nameScore, localScore),
      };
    })
    .filter((c) => c.score >= 0.3)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return bucketCandidates(scored);
}

export function matchVendorClientSide(
  query: string,
  catalog: readonly VendorCatalogRow[],
  options: { limit?: number } = {},
): MatchResult<VendorMatchCandidate> {
  const trimmed = query.trim();
  if (!trimmed) return { status: "new" };
  const limit = options.limit ?? 5;

  const scored = catalog
    .map<VendorMatchCandidate>((v) => ({
      id: v.id,
      name: v.name,
      city: v.city,
      phone: v.phone,
      gst_number: v.gst_number,
      score: clientSimilarity(trimmed, v.name),
    }))
    .filter((c) => c.score >= 0.3)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return bucketCandidates(scored);
}
