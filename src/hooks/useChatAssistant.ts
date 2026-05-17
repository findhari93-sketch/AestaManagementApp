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
import type { ChatMessage, ChatFilters, ConversationHistoryItem } from "@/lib/chat-assistant/types";
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

  // Conversation history for multi-turn Groq context
  const [conversationHistory, setConversationHistory] = useState<ConversationHistoryItem[]>([]);

  // Update site filter when initialSiteId changes
  useEffect(() => {
    if (initialSiteId) {
      setFilters((prev) => ({ ...prev, siteId: initialSiteId }));
    }
  }, [initialSiteId]);

  // Get site name for context
  const getSiteName = useCallback(
    (siteId: string | "all"): string => {
      if (siteId === "all") return "All Sites";
      return sites.find((s) => s.id === siteId)?.name ?? "Unknown Site";
    },
    [sites]
  );

  const getCompanyId = useCallback((): string => {
    return sites[0]?.company_id ?? "";
  }, [sites]);

  // Send a message and get a response
  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isLoading) return;

      const userMessage = createUserMessage(trimmed);
      setMessages((prev) => [...prev, userMessage]);
      setIsLoading(true);

      try {
        // --- Primary path: Groq API route ---
        const dateFrom = filters.dateFrom
          ? dayjs(filters.dateFrom).format("YYYY-MM-DD")
          : dayjs().subtract(30, "day").format("YYYY-MM-DD");
        const dateTo = filters.dateTo
          ? dayjs(filters.dateTo).format("YYYY-MM-DD")
          : dayjs().format("YYYY-MM-DD");

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30_000);
        let response: Response;
        try {
          response = await fetch("/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              question: trimmed,
              siteId: filters.siteId === "all" ? null : filters.siteId,
              companyId: getCompanyId(),
              siteName: getSiteName(filters.siteId),
              dateFrom,
              dateTo,
              history: conversationHistory,
            }),
            signal: controller.signal,
          });
        } finally {
          clearTimeout(timeoutId);
        }

        if (!response.ok) {
          throw new Error(`API error: ${response.status}`);
        }

        const { answer, error: apiError } = await response.json();

        if (apiError) {
          throw new Error(apiError);
        }

        const assistantMessage: ChatMessage = {
          id: crypto.randomUUID(),
          type: "assistant",
          text: answer,
          timestamp: new Date(),
        };

        setMessages((prev) => [...prev, assistantMessage]);

        setConversationHistory((prev) => [
          ...prev.slice(-18),
          { role: "user", content: trimmed },
          { role: "assistant", content: answer },
        ]);
      } catch (apiErr) {
        // --- Fallback path: keyword-based intent parser (when API is unavailable) ---
        console.warn("Groq API unavailable, falling back to keyword parser:", apiErr);
        try {
          const parsedIntent = await parseIntentSmart(trimmed, filters);

          if (parsedIntent.confidence < CONFIDENCE_THRESHOLDS.UNKNOWN) {
            setMessages((prev) => [...prev, formatUnknownIntentResponse()]);
            return;
          }

          if (parsedIntent.confidence < CONFIDENCE_THRESHOLDS.HIGH) {
            setMessages((prev) => [
              ...prev,
              formatLowConfidenceResponse(parsedIntent, [parsedIntent.intent]),
            ]);
            return;
          }

          const result = await executeQuery(parsedIntent.intent, parsedIntent.filters);
          const siteName = getSiteName(filters.siteId);
          const responseMsg = formatResponse(result, parsedIntent, siteName);
          setMessages((prev) => [...prev, responseMsg]);
        } catch (fallbackErr) {
          console.error("Chat assistant fallback error:", fallbackErr);
          setMessages((prev) => [...prev, formatErrorResponse(fallbackErr as Error)]);
        }
      } finally {
        setIsLoading(false);
      }
    },
    [filters, isLoading, getSiteName, getCompanyId, conversationHistory]
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
    setConversationHistory([]);
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
