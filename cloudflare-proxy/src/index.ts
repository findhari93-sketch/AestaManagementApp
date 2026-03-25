/**
 * Cloudflare Worker - Supabase Reverse Proxy
 *
 * Proxies all requests from this worker's URL to the Supabase project URL.
 * This bypasses ISP-level blocks on *.supabase.co domains in India.
 *
 * Handles: REST API, Auth, Storage (uploads/downloads), Realtime WebSocket
 */

interface Env {
  SUPABASE_URL: string;
}

// All headers that Supabase client sends
const ALLOWED_HEADERS = [
  "Accept",
  "Accept-Encoding",
  "Accept-Language",
  "Authorization",
  "Content-Type",
  "apikey",
  "accept-profile",
  "content-profile",
  "prefer",
  "range",
  "x-client-info",
  "x-supabase-api-version",
  "x-upsert",
  "Upgrade",
  "Connection",
].join(", ");

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const supabaseOrigin = new URL(env.SUPABASE_URL);

    // Handle CORS preflight
    if (request.method === "OPTIONS") {
      return handleCors(request);
    }

    // Build the target URL: replace worker origin with Supabase origin
    const targetUrl = new URL(url.pathname + url.search, env.SUPABASE_URL);

    // For WebSocket upgrade requests (Supabase Realtime),
    // create a new Request pointing to Supabase and let Cloudflare handle the upgrade
    const upgradeHeader = request.headers.get("Upgrade");
    if (upgradeHeader && upgradeHeader.toLowerCase() === "websocket") {
      // Clone headers and set correct Host
      const headers = new Headers(request.headers);
      headers.set("Host", supabaseOrigin.host);

      // Cloudflare handles WebSocket proxying automatically when you fetch
      // with the Upgrade header - just use https:// (not wss://)
      return fetch(targetUrl.toString(), {
        method: request.method,
        headers,
        body: request.body,
      });
    }

    // For regular HTTP requests
    const headers = new Headers(request.headers);
    headers.set("Host", supabaseOrigin.host);

    try {
      const response = await fetch(targetUrl.toString(), {
        method: request.method,
        headers,
        body: request.method !== "GET" && request.method !== "HEAD"
          ? request.body
          : undefined,
        redirect: "follow",
      });

      // Build response with CORS headers
      const responseHeaders = new Headers(response.headers);
      setCorsHeaders(responseHeaders, request);

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
      });
    } catch (error) {
      return new Response(
        JSON.stringify({
          error: "Proxy error",
          message: error instanceof Error ? error.message : "Unknown error",
        }),
        {
          status: 502,
          headers: {
            "Content-Type": "application/json",
            ...getCorsHeadersObj(request),
          },
        }
      );
    }
  },
};

/**
 * Handle CORS preflight request
 */
function handleCors(request: Request): Response {
  return new Response(null, {
    status: 204,
    headers: {
      ...getCorsHeadersObj(request),
      "Access-Control-Max-Age": "86400",
    },
  });
}

function setCorsHeaders(headers: Headers, request: Request): void {
  const origin = request.headers.get("Origin") || "*";
  headers.set("Access-Control-Allow-Origin", origin);
  headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD");
  headers.set("Access-Control-Allow-Headers", ALLOWED_HEADERS);
  headers.set("Access-Control-Expose-Headers", "Content-Range, Range, x-supabase-api-version, content-range");
  headers.set("Access-Control-Allow-Credentials", "true");
}

function getCorsHeadersObj(request: Request): Record<string, string> {
  const origin = request.headers.get("Origin") || "*";
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD",
    "Access-Control-Allow-Headers": ALLOWED_HEADERS,
    "Access-Control-Expose-Headers": "Content-Range, Range, x-supabase-api-version, content-range",
    "Access-Control-Allow-Credentials": "true",
  };
}
