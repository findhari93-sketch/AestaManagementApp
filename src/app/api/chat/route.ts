import { NextRequest, NextResponse } from "next/server";
import Groq from "groq-sdk";
import { createClient } from "@/lib/supabase/server";
import { TOOL_DEFINITIONS, executeTool } from "@/lib/chat-assistant/chat-tools";
import type { ChatApiRequest, ChatApiResponse } from "@/lib/chat-assistant/types";
import dayjs from "dayjs";

const SYSTEM_PROMPT = (ctx: {
  siteName: string;
  siteId: string | null;
  companyId: string;
  dateFrom: string;
  dateTo: string;
  today: string;
}) => `You are AESTA Assistant, an AI helper for Aesta Construction Manager.
You help site engineers and construction managers get quick insights from their site data.

Current context:
- Site: ${ctx.siteName}${ctx.siteId ? ` (ID: ${ctx.siteId})` : " (all sites)"}
- Company ID: ${ctx.companyId}
- Date range selected: ${ctx.dateFrom} to ${ctx.dateTo}
- Today: ${ctx.today}

Instructions:
1. Always use tools to fetch data before answering quantitative questions about numbers, people, or costs.
2. Format all monetary amounts with ₹ symbol in Indian number format (e.g., ₹1,25,000).
3. Lead with the key number or fact, then add details if relevant.
4. You may call multiple tools if the question spans multiple domains.
5. If the user asks about a date not in the selected range, derive the correct date range from their question and use it as tool arguments.
6. Respond in Tamil if the user writes in Tamil; otherwise respond in English.
7. If no relevant data is found after calling tools, say so clearly — do not guess or fabricate numbers.
8. Keep answers concise — construction managers are busy.
9. When the user asks a cross-site question and no site is selected, use company_id: ${ctx.companyId} in the cross-site tools.`;

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // 1. Parse and validate request
    const body: ChatApiRequest = await request.json();
    const { question, siteId, companyId, siteName, dateFrom, dateTo, history } = body;

    if (!question?.trim()) {
      return NextResponse.json<ChatApiResponse>({ answer: "", error: "No question provided" }, { status: 400 });
    }

    // 2. Verify authentication
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json<ChatApiResponse>({ answer: "", error: "Not authenticated" }, { status: 401 });
    }

    // 2a. Look up the user's company_id from the database (server-verified, not client-supplied)
    // users.auth_id -> users.id -> company_members.user_id -> company_members.company_id
    const { data: userRow } = await supabase
      .from("users")
      .select("id")
      .eq("auth_id", user.id)
      .single();

    if (!userRow?.id) {
      return NextResponse.json<ChatApiResponse>({ answer: "", error: "User profile not found" }, { status: 403 });
    }

    // Get the user's primary company (or first membership if no primary)
    const { data: membership } = await supabase
      .from("company_members")
      .select("company_id")
      .eq("user_id", userRow.id)
      .order("is_primary", { ascending: false })
      .limit(1)
      .single();

    if (!membership?.company_id) {
      return NextResponse.json<ChatApiResponse>({ answer: "", error: "User has no company membership" }, { status: 403 });
    }

    const verifiedCompanyId: string = membership.company_id;

    // 3. Verify GROQ_API_KEY is configured
    if (!process.env.GROQ_API_KEY) {
      return NextResponse.json<ChatApiResponse>(
        { answer: "", error: "GROQ_API_KEY is not configured. Add it to .env.local." },
        { status: 500 }
      );
    }

    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    const today = dayjs().format("YYYY-MM-DD");

    // 4. Build initial messages
    const systemMessage = {
      role: "system" as const,
      content: SYSTEM_PROMPT({ siteName, siteId, companyId: verifiedCompanyId, dateFrom, dateTo, today }),
    };

    const MAX_HISTORY = 20;
    const historyMessages = (history ?? []).slice(-MAX_HISTORY).map((h) => ({
      role: h.role as "user" | "assistant",
      content: h.content,
    }));

    let messages: Groq.Chat.ChatCompletionMessageParam[] = [
      systemMessage,
      ...historyMessages,
      { role: "user", content: question },
    ];

    // 5. Groq tool-calling loop (max 5 iterations to prevent infinite loops)
    for (let iteration = 0; iteration < 5; iteration++) {
      const response = await groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        messages,
        tools: TOOL_DEFINITIONS,
        tool_choice: "auto",
        temperature: 0.2,
        max_tokens: 1024,
      });

      const choice = response.choices[0];

      if (!choice) {
        return NextResponse.json<ChatApiResponse>({ answer: "No response from AI. Please try again." });
      }

      // Handle truncated response (context/token limit reached)
      if (choice.finish_reason === "length") {
        const partial = choice.message.content ?? "";
        return NextResponse.json<ChatApiResponse>({
          answer: partial + (partial ? "\n\n_(Response was cut off — try a more specific question.)_" : "I couldn't generate an answer. Please try a more specific question."),
        });
      }

      // If Groq finished (no more tool calls), return the answer
      if (choice.finish_reason === "stop" || !choice.message.tool_calls?.length) {
        return NextResponse.json<ChatApiResponse>({
          answer: choice.message.content ?? "No answer generated.",
        });
      }

      // Execute all tool calls in parallel
      const toolCallResults = await Promise.all(
        choice.message.tool_calls.map(async (tc) => {
          let args: Record<string, unknown> = {};
          try {
            args = JSON.parse(tc.function.arguments ?? "{}");
          } catch {
            return {
              role: "tool" as const,
              tool_call_id: tc.id,
              content: JSON.stringify({ error: "Invalid tool arguments" }),
            };
          }
          const result = await executeTool(tc.function.name, args, supabase);
          return {
            role: "tool" as const,
            tool_call_id: tc.id,
            content: result,
          };
        })
      );

      // Append assistant message (with tool calls) + tool results to conversation
      messages = [...messages, choice.message, ...toolCallResults];
    }

    // Fallback if loop exhausted
    return NextResponse.json<ChatApiResponse>({
      answer: "I ran too many queries trying to answer that. Please try a more specific question.",
    });
  } catch (err) {
    console.error("[/api/chat] error:", err);
    const message = err instanceof Error ? err.message : "An unexpected error occurred";
    return NextResponse.json<ChatApiResponse>({ answer: "", error: message }, { status: 500 });
  }
}
