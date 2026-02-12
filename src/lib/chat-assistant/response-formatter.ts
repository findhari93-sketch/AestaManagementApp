/**
 * Response Formatter
 * Formats query results into chat messages
 */

import { formatCurrencyFull, formatDate } from "@/lib/formatters";
import type { ChatMessage, QueryResult, ParsedIntent } from "./types";
import { formatDateRangeDescription } from "./date-extractor";
import { getQueryForIntent, intentToReadable } from "./intent-parser";
import { QUICK_ACTIONS } from "./constants";

/**
 * Format a query result into a chat message
 */
export function formatResponse(
  result: QueryResult,
  intent: ParsedIntent,
  siteName?: string
): ChatMessage {
  const id = crypto.randomUUID();
  const timestamp = new Date();

  // Build context string (site + date range)
  const contextParts: string[] = [];
  if (siteName) {
    contextParts.push(`at ${siteName}`);
  }
  if (result.dateRange) {
    const { from, to } = result.dateRange;
    contextParts.push(formatDateRangeDescription(from, to));
  }
  const context = contextParts.length > 0 ? ` (${contextParts.join(", ")})` : "";

  switch (result.type) {
    case "value": {
      const isCount =
        result.label?.includes("workers") ||
        result.label?.includes("count") ||
        result.label?.includes("present");

      const valueText = isCount
        ? result.value?.toString() || "0"
        : formatCurrencyFull(result.value || 0);

      return {
        id,
        type: "assistant",
        text: `${result.label || "Result"}${context}:`,
        highlightValue: valueText,
        timestamp,
      };
    }

    case "table": {
      return {
        id,
        type: "assistant",
        text: `Here's the breakdown${context}:`,
        tableData: result.tableData,
        timestamp,
      };
    }

    case "list": {
      const items = result.listItems || [];
      const displayItems = items.slice(0, 10);
      const moreCount = items.length - 10;

      let text = `${result.label}${context}:\n`;
      text += displayItems.map((item) => `• ${item}`).join("\n");

      if (moreCount > 0) {
        text += `\n...and ${moreCount} more`;
      }

      return {
        id,
        type: "assistant",
        text,
        timestamp,
      };
    }

    case "empty": {
      return {
        id,
        type: "assistant",
        text:
          result.label ||
          `No data found${context}. Try adjusting the date range or site filter.`,
        timestamp,
      };
    }

    default: {
      return {
        id,
        type: "assistant",
        text: "Unable to process this query. Please try again.",
        timestamp,
      };
    }
  }
}

/**
 * Format a low confidence response with suggestions
 */
export function formatLowConfidenceResponse(
  intent: ParsedIntent,
  possibleIntents: string[]
): ChatMessage {
  const suggestions = possibleIntents
    .slice(0, 3)
    .map((i) => intentToReadable(i));

  return {
    id: crypto.randomUUID(),
    type: "assistant",
    text: `I'm not sure what you mean by "${intent.originalQuery}". Did you mean one of these?`,
    suggestedActions: suggestions,
    timestamp: new Date(),
  };
}

/**
 * Format an unknown intent response
 */
export function formatUnknownIntentResponse(): ChatMessage {
  return {
    id: crypto.randomUUID(),
    type: "assistant",
    text: "I didn't understand that. Try asking about attendance, salary, expenses, advances, or contracts. You can also use the quick action buttons below.",
    suggestedActions: QUICK_ACTIONS.slice(0, 4).map((a) => a.label),
    timestamp: new Date(),
  };
}

/**
 * Format an error response
 */
export function formatErrorResponse(error?: Error): ChatMessage {
  console.error("Chat assistant error:", error);

  return {
    id: crypto.randomUUID(),
    type: "assistant",
    text: "Something went wrong while processing your request. Please try again.",
    timestamp: new Date(),
  };
}

/**
 * Create a user message
 */
export function createUserMessage(text: string): ChatMessage {
  return {
    id: crypto.randomUUID(),
    type: "user",
    text,
    timestamp: new Date(),
  };
}

/**
 * Create a loading message
 */
export function createLoadingMessage(): ChatMessage {
  return {
    id: "loading",
    type: "assistant",
    text: "",
    isLoading: true,
    timestamp: new Date(),
  };
}

/**
 * Create the welcome message
 */
export function createWelcomeMessage(): ChatMessage {
  return {
    id: "welcome",
    type: "assistant",
    text: "Hi! I'm your AESTA Assistant. Ask me about attendance, salary, expenses, or contracts. Use the quick actions below to get started!",
    timestamp: new Date(),
  };
}

/**
 * Format a confirmation response (for "Did you mean X?" scenarios)
 */
export function formatConfirmationResponse(
  suggestedIntent: string
): ChatMessage {
  const readableIntent = intentToReadable(suggestedIntent);
  const suggestedQuery = getQueryForIntent(suggestedIntent);

  return {
    id: crypto.randomUUID(),
    type: "assistant",
    text: `Did you mean: "${readableIntent}"?`,
    suggestedActions: [suggestedQuery, "No, show suggestions"],
    timestamp: new Date(),
  };
}
