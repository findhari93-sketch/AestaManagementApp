/**
 * Entity Extractor
 * Extracts entities like laborer names, categories, and limits from user input
 */

import type { ExtractedEntities } from "./types";
import { LABOR_CATEGORIES } from "./constants";

/**
 * Extract entities from user input text
 */
export function extractEntities(input: string): ExtractedEntities {
  const normalized = input.toLowerCase().trim();
  const entities: ExtractedEntities = {};

  // Extract "top N" pattern
  const topMatch = normalized.match(/\btop\s+(\d+)/i);
  if (topMatch) {
    entities.limit = parseInt(topMatch[1], 10);
  }

  // Extract specific number for lists (e.g., "5 workers", "10 laborers")
  if (!entities.limit) {
    const numMatch = normalized.match(/\b(\d+)\s+(?:workers?|laborers?|people)\b/i);
    if (numMatch) {
      entities.limit = parseInt(numMatch[1], 10);
    }
  }

  // Extract category mentions
  for (const category of LABOR_CATEGORIES) {
    if (normalized.includes(category)) {
      entities.category = category;
      break;
    }
  }

  // Extract plural category forms
  if (!entities.category) {
    const categoryWithS = LABOR_CATEGORIES.find((cat) =>
      normalized.includes(`${cat}s`)
    );
    if (categoryWithS) {
      entities.category = categoryWithS;
    }
  }

  // Extract "worker X" or "laborer X" pattern for specific worker queries
  const workerMatch = normalized.match(
    /(?:worker|laborer|person)\s+(?:named?\s+)?([a-z]+(?:\s+[a-z]+)?)/i
  );
  if (workerMatch && !isStopWord(workerMatch[1])) {
    entities.laborer_name = workerMatch[1].trim();
  }

  // Extract "X's salary/earnings" pattern
  const possessiveMatch = normalized.match(
    /([a-z]+(?:\s+[a-z]+)?)'s?\s+(?:salary|earning|attendance)/i
  );
  if (possessiveMatch && !isStopWord(possessiveMatch[1])) {
    entities.laborer_name = possessiveMatch[1].trim();
  }

  // Extract team name patterns
  const teamMatch = normalized.match(
    /(?:team|mesthri)\s+(?:named?\s+)?([a-z]+(?:\s+[a-z]+)?)/i
  );
  if (teamMatch && !isStopWord(teamMatch[1])) {
    entities.team_name = teamMatch[1].trim();
  }

  return entities;
}

/**
 * Check if a word is a stop word (common words that shouldn't be treated as names)
 */
function isStopWord(word: string): boolean {
  const stopWords = [
    "the",
    "a",
    "an",
    "is",
    "are",
    "was",
    "were",
    "this",
    "that",
    "these",
    "those",
    "who",
    "what",
    "where",
    "when",
    "how",
    "many",
    "much",
    "total",
    "count",
    "all",
    "today",
    "yesterday",
    "week",
    "month",
    "year",
    "site",
    "pending",
    "paid",
    "active",
    "earning",
    "earnings",
    "summary",
    "breakdown",
    "list",
  ];

  return stopWords.includes(word.toLowerCase());
}

/**
 * Extract status filter from input
 */
export function extractStatus(input: string): string | undefined {
  const normalized = input.toLowerCase();

  if (normalized.includes("pending") || normalized.includes("unpaid")) {
    return "pending";
  }

  if (normalized.includes("paid") || normalized.includes("completed")) {
    return "paid";
  }

  if (normalized.includes("active")) {
    return "active";
  }

  if (normalized.includes("inactive") || normalized.includes("inactive")) {
    return "inactive";
  }

  return undefined;
}
