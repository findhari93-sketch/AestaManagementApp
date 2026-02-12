"use client";

import { useState, useCallback, useEffect } from "react";
import dayjs from "dayjs";
import { parseIntentSmart } from "@/lib/chat-assistant/intent-parser";
import { executeQuery } from "@/lib/chat-assistant/query-builder";
import {
  formatResponse,
  formatUnknownIntentResponse,
  formatLowConfidenceResponse,
  formatErrorResponse,
  createUserMessage,
  createWelcomeMessage,
} from "@/lib/chat-assistant/response-formatter";
import { CONFIDENCE_THRESHOLDS } from "@/lib/chat-assistant/constants";
import type { ChatMessage, ChatFilters } from "@/lib/chat-assistant/types";
import { useSitesData } from "@/contexts/SiteContext";

interface UseChatAssistantOptions {
  initialSiteId?: string;
}

export function useChatAssistant(options: UseChatAssistantOptions = {}) {
  const { initialSiteId } = options;
  const { sites } = useSitesData();

  // Chat messages state
  const [messages, setMessages] = useState<ChatMessage[]>([createWelcomeMessage()]);

  // Chat filters state - Default to "All Time" (no date filters)
  const [filters, setFilters] = useState<ChatFilters>({
    siteId: initialSiteId || "all",
    dateFrom: null,
    dateTo: null,
  });

  // Loading state
  const [isLoading, setIsLoading] = useState(false);

  // Update site filter when initialSiteId changes
  useEffect(() => {
    if (initialSiteId) {
      setFilters((prev) => ({ ...prev, siteId: initialSiteId }));
    }
  }, [initialSiteId]);

  // Get site name for context
  const getSiteName = useCallback(
    (siteId: string | "all"): string | undefined => {
      if (siteId === "all") return undefined;
      return sites.find((s) => s.id === siteId)?.name;
    },
    [sites]
  );

  // Send a message and get a response
  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isLoading) return;

      // Add user message
      const userMessage = createUserMessage(trimmed);
      setMessages((prev) => [...prev, userMessage]);
      setIsLoading(true);

      try {
        // Parse intent from input (uses Gemini API if available, falls back to keywords)
        const parsedIntent = await parseIntentSmart(trimmed, filters);

        // Handle unknown intent (very low confidence)
        if (parsedIntent.confidence < CONFIDENCE_THRESHOLDS.UNKNOWN) {
          setMessages((prev) => [...prev, formatUnknownIntentResponse()]);
          return;
        }

        // Handle low confidence (ask for confirmation)
        if (parsedIntent.confidence < CONFIDENCE_THRESHOLDS.HIGH) {
          // Find similar intents for suggestions
          const suggestions = [parsedIntent.intent];
          setMessages((prev) => [
            ...prev,
            formatLowConfidenceResponse(parsedIntent, suggestions),
          ]);
          return;
        }

        // Execute the query
        const result = await executeQuery(parsedIntent.intent, parsedIntent.filters);

        // Format and add response
        const siteName = getSiteName(filters.siteId);
        const response = formatResponse(result, parsedIntent, siteName);
        setMessages((prev) => [...prev, response]);
      } catch (error) {
        console.error("Chat assistant error:", error);
        setMessages((prev) => [...prev, formatErrorResponse(error as Error)]);
      } finally {
        setIsLoading(false);
      }
    },
    [filters, isLoading, getSiteName]
  );

  // Handle suggestion clicks (from message suggestions or quick actions)
  const handleSuggestionClick = useCallback(
    (suggestion: string) => {
      // Check if it's "No, show suggestions" - show unknown response
      if (suggestion.toLowerCase().includes("show suggestions")) {
        setMessages((prev) => [...prev, formatUnknownIntentResponse()]);
        return;
      }

      // Otherwise, send as a new query
      sendMessage(suggestion);
    },
    [sendMessage]
  );

  // Clear chat history (keep welcome message)
  const clearChat = useCallback(() => {
    setMessages([createWelcomeMessage()]);
  }, []);

  return {
    messages,
    filters,
    setFilters,
    isLoading,
    sendMessage,
    handleSuggestionClick,
    clearChat,
  };
}
