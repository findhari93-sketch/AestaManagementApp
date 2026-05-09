/**
 * Purchase mode — extracts a bill into a `material_purchase_expenses` row +
 * line items + price history + vendor_inventory upsert via the
 * `ingest_purchase_atomic` RPC.
 */

import type { QueryClient } from "@tanstack/react-query";

import {
  aiPurchaseOutputSchema,
  splitCategoryHint,
  type AiPurchaseOutput,
} from "@/lib/ai-ingestion/schemas";
import {
  matchMaterialClientSide,
  matchVendorClientSide,
} from "@/lib/ai-ingestion/fuzzyMatch";
import {
  commitPurchase,
  type PurchaseCommitResult,
} from "@/lib/services/aiIngestionService";
import { createClient } from "@/lib/supabase/client";
import { withTimeout } from "@/lib/utils/timeout";
import type {
  ModeConfig,
  ResolvedPreview,
  ResolvedPreviewRow,
} from "@/lib/ai-ingestion/types";

/**
 * Catalog fetch timeout. Each list is a single GET to a `CACHEABLE_TABLES`
 * row in the Cloudflare Worker (60s edge cache), so this is generous.
 * If the catalog fetch itself stalls, the user sees a clear error rather
 * than a stuck spinner.
 */
const CATALOG_FETCH_TIMEOUT_MS = 15_000;

import { buildPurchasePrompt } from "./purchase.prompt";

export function createPurchaseMode(
  queryClient: QueryClient,
): ModeConfig<AiPurchaseOutput, PurchaseCommitResult> {
  return {
    mode: "purchase",
    label: "Purchase Bill",
    description:
      "An actual buy from a vendor. Records the expense, line items, price history, and refreshes vendor pricing.",
    buildPrompt: buildPurchasePrompt,
    schema: aiPurchaseOutputSchema,

    async resolvePreview(parsed): Promise<ResolvedPreview> {
      // Pre-fetch the full catalog once instead of issuing N+1 trigram RPCs.
      // The Worker edge-caches `materials` and `vendors` GETs for 60s
      // (CACHEABLE_TABLES in cloudflare-proxy/src/index.ts), so this is two
      // fast trips at most. Avoids browser concurrent-connection queueing
      // and auth-refresh contention that stalled the parse step in earlier
      // attempts (see e5eb5df).
      const supabase = createClient();
      const [vendorsRes, materialsRes] = await Promise.all([
        withTimeout(
          Promise.resolve(
            (supabase as any)
              .from("vendors")
              .select("id, name, city, phone, gst_number")
              .eq("is_active", true),
          ),
          CATALOG_FETCH_TIMEOUT_MS,
          `Vendor catalog fetch timed out after ${CATALOG_FETCH_TIMEOUT_MS / 1000}s`,
        ),
        withTimeout(
          Promise.resolve(
            (supabase as any)
              .from("materials")
              .select("id, name, local_name, category_id, unit")
              .eq("is_active", true),
          ),
          CATALOG_FETCH_TIMEOUT_MS,
          `Material catalog fetch timed out after ${CATALOG_FETCH_TIMEOUT_MS / 1000}s`,
        ),
      ]);

      if (vendorsRes.error) {
        throw new Error(`Failed to load vendor catalog: ${vendorsRes.error.message}`);
      }
      if (materialsRes.error) {
        throw new Error(`Failed to load material catalog: ${materialsRes.error.message}`);
      }
      const allVendors = vendorsRes.data ?? [];
      const allMaterials = materialsRes.data ?? [];

      const vendorMatch = matchVendorClientSide(parsed.vendor.name, allVendors);

      const rows: ResolvedPreviewRow[] = parsed.items.map((item, index) => {
        const match = matchMaterialClientSide(item.name, allMaterials);
        const warnings: string[] = [];

        // Sanity warning: catalog unit vs bill unit mismatch
        if (match.status === "matched" && match.entity.unit && match.entity.unit !== item.unit) {
          warnings.push(`catalog says ${match.entity.unit}, bill says ${item.unit}`);
        }

        const total =
          typeof item.unit_price === "number" && typeof item.quantity === "number"
            ? item.quantity * item.unit_price
            : null;

        return {
          index,
          rawName: item.name,
          rawLocalName: item.local_name ?? null,
          rawCategoryHint: item.category_hint ?? null,
          rawBrand: item.brand ?? null,
          quantity: item.quantity,
          unit: item.unit,
          unitPrice: item.unit_price,
          totalPrice: total,
          hsnCode: item.hsn_code ?? null,
          gstRate: item.gst_rate ?? null,
          notes: null,
          materialMatch:
            match.status === "matched"
              ? { kind: "matched", entity: match.entity, score: match.score, candidates: match.candidates }
              : match.status === "ambiguous"
                ? { kind: "ambiguous", candidates: match.candidates, chosenId: null }
                : { kind: "new", suggestedName: item.name },
          overrideMaterialId: null,
          overrideMaterialName: null,
          warnings,
        };
      });

      return {
        vendorRawName: parsed.vendor.name,
        vendorMatch:
          vendorMatch.status === "matched"
            ? {
                kind: "matched",
                entity: vendorMatch.entity,
                score: vendorMatch.score,
                candidates: vendorMatch.candidates,
              }
            : vendorMatch.status === "ambiguous"
              ? { kind: "ambiguous", candidates: vendorMatch.candidates, chosenId: null }
              : { kind: "new", suggestedName: parsed.vendor.name },
        overrideVendorId: null,
        rows,
      };
    },

    async commit({ parsed, preview, ctx, onPhaseChange }) {
      // Defensive: surface the date used so the user sees what was sent
      const _ = splitCategoryHint; // keep import alive (used by service)
      void _;
      return commitPurchase({
        parsed,
        preview,
        ctx,
        queryClient,
        onPhaseChange,
      });
    },

    summary(parsed) {
      const items = parsed.items.length;
      return `${parsed.vendor.name} · ${items} item${items === 1 ? "" : "s"} · ₹${formatNumber(
        parsed.total_amount,
      )}`;
    },
  };
}

function formatNumber(n: number): string {
  return n.toLocaleString("en-IN", { maximumFractionDigits: 2 });
}
