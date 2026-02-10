/**
 * Intent Parser
 * Parses user input to determine intent and extract filters
 * Uses Gemini API when available, falls back to keyword matching
 */

import type { ParsedIntent, ChatFilters, IntentFilters } from "./types";
import { INTENT_KEYWORDS } from "./constants";
import { extractDateRange } from "./date-extractor";
import { extractEntities, extractStatus } from "./entity-extractor";
import { parseWithGemini, isGeminiAvailable } from "./gemini-parser";
import dayjs from "dayjs";

/**
 * Smart parse - tries Gemini first, falls back to keyword matching
 */
export async function parseIntentSmart(
  input: string,
  defaultFilters: ChatFilters
): Promise<ParsedIntent> {
  // Try Gemini API first if available
  if (isGeminiAvailable()) {
    try {
      const geminiResult = await parseWithGemini(input, defaultFilters);
      if (geminiResult && geminiResult.confidence > 0.5) {
        console.log("Using Gemini parser result:", geminiResult);
        return geminiResult;
      }
    } catch (error) {
      console.warn("Gemini parsing failed, using keyword fallback:", error);
    }
  }

  // Fall back to keyword-based parsing
  return parseIntent(input, defaultFilters);
}

/**
 * Parse user input into a structured intent with filters (keyword-based)
 */
export function parseIntent(input: string, defaultFilters: ChatFilters): ParsedIntent {
  // 1. Normalize input: lowercase, trim, remove extra spaces
  const normalized = normalizeInput(input);

  // 2. Calculate scores for each intent
  const intentScores = calculateIntentScores(normalized);

  // 3. Get the top matching intent
  const topIntent = getTopIntent(intentScores);

  // 4. Extract date range from input
  const dateRange = extractDateRange(normalized);

  // 5. Extract entities (laborer name, category, etc.)
  const entities = extractEntities(normalized);

  // 6. Extract status filter
  const status = extractStatus(normalized);

  // 7. Build filters, applying defaults from chat filter bar
  const filters: IntentFilters = {
    site_id: defaultFilters.siteId !== "all" ? defaultFilters.siteId : undefined,
    date_from:
      dateRange.from ||
      (defaultFilters.dateFrom
        ? dayjs(defaultFilters.dateFrom).format("YYYY-MM-DD")
        : undefined),
    date_to:
      dateRange.to ||
      (defaultFilters.dateTo
        ? dayjs(defaultFilters.dateTo).format("YYYY-MM-DD")
        : undefined),
    ...entities,
    status,
  };

  return {
    intent: topIntent.intent,
    confidence: topIntent.score,
    filters,
    originalQuery: input,
  };
}

/**
 * Normalize input text for processing
 */
function normalizeInput(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ") // Collapse multiple spaces
    .replace(/[?!.,]+$/g, ""); // Remove trailing punctuation
}

/**
 * Calculate match scores for each intent
 */
function calculateIntentScores(input: string): Map<string, number> {
  const scores = new Map<string, number>();

  for (const [intentName, keywords] of Object.entries(INTENT_KEYWORDS)) {
    let score = 0;
    let matchedKeywords = 0;

    for (const keyword of keywords) {
      if (input.includes(keyword.toLowerCase())) {
        matchedKeywords++;
        // Longer keywords get higher scores (more specific)
        const keywordWeight = keyword.split(" ").length;
        score += keywordWeight;
      }
    }

    if (matchedKeywords > 0) {
      // Normalize score by number of possible keywords
      // More matched keywords = higher confidence
      const normalizedScore = Math.min(1, score / (keywords.length * 0.5));
      scores.set(intentName, normalizedScore);
    }
  }

  return scores;
}

/**
 * Get the top matching intent from scores
 */
function getTopIntent(scores: Map<string, number>): { intent: string; score: number } {
  let topIntent = "unknown";
  let topScore = 0;

  for (const [intent, score] of scores) {
    if (score > topScore) {
      topScore = score;
      topIntent = intent;
    }
  }

  return { intent: topIntent, score: topScore };
}

/**
 * Get suggested intents for low confidence matches
 */
export function getSuggestedIntents(scores: Map<string, number>): string[] {
  const entries = Array.from(scores.entries());

  // Sort by score descending
  entries.sort((a, b) => b[1] - a[1]);

  // Return top 3 intents
  return entries.slice(0, 3).map(([intent]) => intentToReadable(intent));
}

/**
 * Convert intent ID to readable text
 */
export function intentToReadable(intent: string): string {
  const readableMap: Record<string, string> = {
    total_salary: "Total salary",
    total_salary_paid: "Salary paid",
    salary_pending: "Pending salary",
    attendance_count: "Attendance count",
    attendance_summary: "Attendance summary",
    total_spending: "Total spending",
    expense_total: "Total expenses",
    expense_by_category: "Expense breakdown",
    advance_total: "Total advances",
    advance_pending: "Pending advances",
    contract_summary: "Contract summary",
    contract_payments_total: "Contract payments",
    laborer_count: "Worker count",
    laborer_by_category: "Workers by category",
    laborer_earnings: "Worker earnings",
    tea_shop_balance: "Tea shop balance",
    team_summary: "Team summary",
    daily_cost: "Daily cost",
    holiday_list: "Holiday list",
    work_days_summary: "Overtime workers",
  };

  return readableMap[intent] || intent.replace(/_/g, " ");
}

/**
 * Get a query suggestion for a given intent
 */
export function getQueryForIntent(intent: string): string {
  const queryMap: Record<string, string> = {
    total_salary: "Total salary this month",
    total_salary_paid: "How much salary was paid",
    salary_pending: "Pending salary",
    attendance_count: "How many workers came today?",
    attendance_summary: "Attendance summary this week",
    total_spending: "Total spending this month",
    expense_total: "Total expenses this month",
    expense_by_category: "Expense breakdown by category",
    advance_total: "Total advances given",
    advance_pending: "Pending advances",
    contract_summary: "Active contracts",
    contract_payments_total: "Contract payments this month",
    laborer_count: "How many active workers",
    laborer_by_category: "Workers by category",
    laborer_earnings: "Top earning workers",
    tea_shop_balance: "Tea shop balance",
    team_summary: "Team summary",
    daily_cost: "Today's cost",
    holiday_list: "Site holidays",
    work_days_summary: "Overtime workers",
  };

  return queryMap[intent] || intent.replace(/_/g, " ");
}
