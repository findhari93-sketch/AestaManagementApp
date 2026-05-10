import type { SupabaseClient } from "@supabase/supabase-js";
import { ensureFreshSession } from "@/lib/auth/sessionManager";

/**
 * Shared upload primitives used by FileUploader, useImageUpload, and the
 * smaller dialog-embedded uploaders (Vendor, TeaShop, etc.).
 *
 * The whole point of this module is the no-progress watchdog: when the browser's
 * per-host connection pool is poisoned by a dead Supabase Realtime WebSocket
 * (see SessionManager.healConnectionPool), an XHR upload to that host will sit
 * waiting for an available socket and never fire onloadstart/onprogress. A
 * blunt 30-second per-attempt timeout is too coarse to catch this — by then
 * the user has already given up. The watchdog aborts after 5s of silence so
 * the retry loop can re-issue on a fresh socket (the abort closes the dead
 * socket and evicts it from the pool).
 */

export const UPLOAD_CONSTANTS = {
  // Dynamic per-attempt timeout: min 30s, +5s per 100KB of file size.
  MIN_ATTEMPT_TIMEOUT: 30000,
  TIMEOUT_PER_100KB: 5000,

  // Watchdog: abort if no progress signal within this window after xhr.send().
  NO_PROGRESS_WATCHDOG: 5000,

  // Retry: 1 initial + MAX_RETRIES retries.
  MAX_RETRIES: 2,
  INITIAL_RETRY_DELAY: 1000,
} as const;

export function getAttemptTimeout(fileSizeBytes: number): number {
  const sizeKB = fileSizeBytes / 1024;
  return Math.max(
    UPLOAD_CONSTANTS.MIN_ATTEMPT_TIMEOUT,
    Math.ceil(sizeKB / 100) * UPLOAD_CONSTANTS.TIMEOUT_PER_100KB
  );
}

export interface XhrUploadOptions {
  bucketName: string;
  filePath: string;
  file: Blob;
  accessToken: string;
  contentType?: string;
  onProgress?: (percent: number) => void;
  signal?: AbortSignal;
  timeoutMs?: number;
  noProgressWatchdogMs?: number;
}

/**
 * Direct XHR upload to Supabase Storage with a no-progress watchdog.
 *
 * Why XHR and not fetch/SDK: we need real progress events (`xhr.upload.onprogress`)
 * AND the ability to detect a stall before any byte has been sent. The fetch API
 * doesn't expose request-side progress, and the Supabase SDK swallows it.
 */
export function uploadFileViaXHR(
  options: XhrUploadOptions
): Promise<{ path: string }> {
  const {
    bucketName,
    filePath,
    file,
    accessToken,
    contentType,
    onProgress,
    signal,
    timeoutMs = getAttemptTimeout(file.size),
    noProgressWatchdogMs = UPLOAD_CONSTANTS.NO_PROGRESS_WATCHDOG,
  } = options;

  return new Promise((resolve, reject) => {
    const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!baseUrl) {
      reject(new Error("NEXT_PUBLIC_SUPABASE_URL not configured"));
      return;
    }
    const uploadUrl = `${baseUrl}/storage/v1/object/${bucketName}/${filePath}`;

    const xhr = new XMLHttpRequest();
    xhr.timeout = timeoutMs;

    let progressed = false;
    let watchdogTriggered = false;
    let watchdogTimer: ReturnType<typeof setTimeout> | null = null;
    const clearWatchdog = () => {
      if (watchdogTimer) {
        clearTimeout(watchdogTimer);
        watchdogTimer = null;
      }
    };

    const onSignalAbort = () => {
      try {
        xhr.abort();
      } catch {
        // ignore — onabort handles rejection
      }
    };
    if (signal) {
      if (signal.aborted) {
        reject(new Error("Upload cancelled"));
        return;
      }
      signal.addEventListener("abort", onSignalAbort, { once: true });
    }
    const detachSignal = () => {
      if (signal) signal.removeEventListener("abort", onSignalAbort);
    };

    // onloadstart fires when the request starts loading. For tiny files this
    // may be the only "we have a connection" signal we see before onload.
    xhr.upload.onloadstart = () => {
      progressed = true;
      clearWatchdog();
    };

    xhr.upload.onprogress = (event) => {
      progressed = true;
      clearWatchdog();
      if (event.lengthComputable && onProgress) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };

    xhr.onload = () => {
      clearWatchdog();
      detachSignal();
      if (xhr.status >= 200 && xhr.status < 300) {
        let responsePath = filePath;
        try {
          const response = JSON.parse(xhr.responseText);
          responsePath = response.Key || filePath;
          const bucketPrefix = `${bucketName}/`;
          if (responsePath.startsWith(bucketPrefix)) {
            responsePath = responsePath.slice(bucketPrefix.length);
          }
        } catch {
          // status was OK, response body wasn't JSON — fall back to filePath
        }
        resolve({ path: responsePath });
      } else {
        let errorMsg = `Upload failed (${xhr.status})`;
        try {
          const errResponse = JSON.parse(xhr.responseText);
          errorMsg = errResponse.message || errResponse.error || errorMsg;
        } catch {
          // ignore parse error
        }
        reject(new Error(errorMsg));
      }
    };

    xhr.onerror = () => {
      clearWatchdog();
      detachSignal();
      reject(new Error("Network error during upload"));
    };

    xhr.ontimeout = () => {
      clearWatchdog();
      detachSignal();
      reject(new Error(`Upload timed out after ${Math.round(timeoutMs / 1000)}s`));
    };

    xhr.onabort = () => {
      clearWatchdog();
      detachSignal();
      // "stalled" is retryable; "cancelled" is terminal — uploadWithRetry
      // breaks its loop on cancelled/aborted but continues on stalled.
      if (watchdogTriggered) {
        reject(
          new Error(
            `Upload stalled — no progress within ${Math.round(noProgressWatchdogMs / 1000)}s`
          )
        );
      } else {
        reject(new Error("Upload cancelled"));
      }
    };

    xhr.open("POST", uploadUrl);
    xhr.setRequestHeader("Authorization", `Bearer ${accessToken}`);
    xhr.setRequestHeader("x-upsert", "true");
    xhr.setRequestHeader("cache-control", "3600");
    xhr.setRequestHeader(
      "Content-Type",
      contentType || file.type || "application/octet-stream"
    );
    xhr.send(file);

    watchdogTimer = setTimeout(() => {
      if (!progressed) {
        console.warn(
          `[uploadFileViaXHR] No progress within ${noProgressWatchdogMs}ms — aborting (likely poisoned connection pool)`
        );
        watchdogTriggered = true;
        try {
          xhr.abort();
        } catch {
          // ignore — onabort handles rejection
        }
      }
    }, noProgressWatchdogMs);
  });
}

export interface HardenedUploadOptions {
  supabase: SupabaseClient;
  bucketName: string;
  filePath: string;
  file: Blob;
  contentType?: string;
  onProgress?: (percent: number) => void;
  signal?: AbortSignal;
  maxRetries?: number;
  /** Skip the ensureFreshSession() call before upload (caller has already done it). */
  skipSessionCheck?: boolean;
}

export interface HardenedUploadResult {
  path: string;
  publicUrl: string;
}

/**
 * Full upload pipeline: fresh session → XHR with watchdog → retry on transient
 * failures → return path + public URL. This is the function the small
 * dialog-embedded uploaders should use instead of `supabase.storage.from(...).upload(...)`.
 */
export async function hardenedUpload(
  options: HardenedUploadOptions
): Promise<HardenedUploadResult> {
  const {
    supabase,
    bucketName,
    filePath,
    file,
    contentType,
    onProgress,
    signal,
    maxRetries = UPLOAD_CONSTANTS.MAX_RETRIES,
    skipSessionCheck = false,
  } = options;

  if (!skipSessionCheck) {
    try {
      await ensureFreshSession();
    } catch (err) {
      console.warn(
        "[hardenedUpload] ensureFreshSession failed, proceeding with cached session:",
        err
      );
    }
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error("Session expired. Please log in again.");
  }
  let currentToken = session.access_token;

  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (signal?.aborted) {
      throw new Error("Upload cancelled");
    }

    if (attempt > 0) {
      const delay =
        UPLOAD_CONSTANTS.INITIAL_RETRY_DELAY * Math.pow(2, attempt - 1);
      console.log(`[hardenedUpload] Retry ${attempt} after ${delay}ms`);
      await new Promise((r) => setTimeout(r, delay));
      // On retry, refresh the token — a stalled first attempt may have
      // happened because the token was about to expire.
      try {
        const {
          data: { session: freshSession },
        } = await supabase.auth.refreshSession();
        if (freshSession?.access_token) {
          currentToken = freshSession.access_token;
        }
      } catch {
        // ignore — keep using current token
      }
    }

    try {
      const result = await uploadFileViaXHR({
        bucketName,
        filePath,
        file,
        accessToken: currentToken,
        contentType,
        onProgress,
        signal,
      });
      const {
        data: { publicUrl },
      } = supabase.storage.from(bucketName).getPublicUrl(result.path);
      return { path: result.path, publicUrl };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.warn(
        `[hardenedUpload] Attempt ${attempt + 1}/${maxRetries + 1} failed:`,
        lastError.message
      );
      // Terminal: user/global cancel. Stalled is retryable so it stays in the loop.
      if (
        lastError.message.includes("cancelled") ||
        lastError.message.includes("aborted")
      ) {
        break;
      }
    }
  }

  throw lastError ?? new Error("Upload failed");
}
