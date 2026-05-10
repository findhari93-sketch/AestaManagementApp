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
  RowPriceContext,
  VendorSummary,
} from "@/lib/ai-ingestion/types";

const CATALOG_FETCH_TIMEOUT_MS = 30_000;

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
      // Use React Query cache (already warm from the materials page) to avoid
      // redundant network round-trips. Fall back to a direct Supabase fetch
      // only when the cache is empty (e.g. dialog opened on a cold page).
      const cachedVendors = queryClient.getQueryData<unknown[]>(["vendors", "list"]);
      const cachedMaterials = queryClient.getQueryData<unknown[]>(["materials", "list"]);

      let allVendors: unknown[];
      let allMaterials: unknown[];

      const supabase = createClient();

      if (cachedVendors && cachedMaterials) {
        allVendors = cachedVendors;
        allMaterials = cachedMaterials;
      } else {
        const [vendorsRes, materialsRes] = await Promise.all([
          cachedVendors
            ? Promise.resolve({ data: cachedVendors, error: null })
            : withTimeout(
                Promise.resolve(
                  (supabase as any)
                    .from("vendors")
                    .select("id, name, city, phone, gst_number")
                    .eq("is_active", true),
                ),
                CATALOG_FETCH_TIMEOUT_MS,
                `Vendor catalog fetch timed out after ${CATALOG_FETCH_TIMEOUT_MS / 1000}s`,
              ),
          cachedMaterials
            ? Promise.resolve({ data: cachedMaterials, error: null })
            : withTimeout(
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
        allVendors = vendorsRes.data ?? [];
        allMaterials = materialsRes.data ?? [];
      }

      const vendorMatch = matchVendorClientSide(
        parsed.vendor.name,
        allVendors as Parameters<typeof matchVendorClientSide>[1],
      );
      const matchedVendorId =
        vendorMatch.status === "matched" ? vendorMatch.entity.id : null;

      // First pass: build rows + collect matched material ids (for price-context lookup)
      const matchedMaterialIds: string[] = [];
      const baseRows = parsed.items.map((item, index) => {
        const match = matchMaterialClientSide(
          item.name,
          allMaterials as Parameters<typeof matchMaterialClientSide>[1],
        );
        if (match.status === "matched") matchedMaterialIds.push(match.entity.id);
        return { item, index, match };
      });

      // Price intelligence (best-effort — failures degrade to null priceContext rather than blocking the preview)
      const [priceCtxRes, vendorSummaryRes] = await Promise.all([
        matchedMaterialIds.length > 0
          ? (supabase as any).rpc("get_purchase_price_context", {
              p_material_ids: matchedMaterialIds,
              p_vendor_id: matchedVendorId,
            })
          : Promise.resolve({ data: [], error: null }),
        matchedVendorId
          ? (supabase as any).rpc("get_vendor_recent_summary", {
              p_vendor_id: matchedVendorId,
              p_days: 30,
            })
          : Promise.resolve({ data: null, error: null }),
      ]);

      const priceCtxByMaterialId = new Map<string, RowPriceContext>();
      if (!priceCtxRes.error && Array.isArray(priceCtxRes.data)) {
        const today = new Date();
        for (const row of priceCtxRes.data as Array<{
          material_id: string;
          last_same_vendor_price: number | null;
          last_same_vendor_date: string | null;
          last_any_vendor_price: number | null;
          last_any_vendor_id: string | null;
          last_any_vendor_name: string | null;
          last_any_vendor_date: string | null;
        }>) {
          const lastSame =
            row.last_same_vendor_price != null && row.last_same_vendor_date
              ? {
                  price: Number(row.last_same_vendor_price),
                  date: row.last_same_vendor_date,
                  daysAgo: daysBetween(row.last_same_vendor_date, today),
                }
              : null;
          const lastAny =
            row.last_any_vendor_price != null && row.last_any_vendor_date
              ? {
                  price: Number(row.last_any_vendor_price),
                  vendorId: row.last_any_vendor_id ?? "",
                  vendorName: row.last_any_vendor_name ?? "Unknown vendor",
                  date: row.last_any_vendor_date,
                }
              : null;
          priceCtxByMaterialId.set(row.material_id, {
            lastFromSameVendor: lastSame,
            lastFromAnyVendor: lastAny,
            deltaPctVsSameVendor: null, // filled per-row using current bill price
          });
        }
      } else if (priceCtxRes.error) {
        console.warn("[ai-ingest] price context lookup failed:", priceCtxRes.error);
      }

      const rows: ResolvedPreviewRow[] = baseRows.map(({ item, index, match }) => {
        const warnings: string[] = [];

        // Sanity warning: catalog unit vs bill unit mismatch
        if (match.status === "matched" && match.entity.unit && match.entity.unit !== item.unit) {
          warnings.push(`catalog says ${match.entity.unit}, bill says ${item.unit}`);
        }

        const total =
          typeof item.unit_price === "number" && typeof item.quantity === "number"
            ? item.quantity * item.unit_price
            : null;

        // Compute per-row price context with delta vs same vendor
        let priceContext: RowPriceContext | null = null;
        if (match.status === "matched") {
          const ctx = priceCtxByMaterialId.get(match.entity.id);
          if (ctx) {
            const deltaPct =
              ctx.lastFromSameVendor && typeof item.unit_price === "number"
                ? ((item.unit_price - ctx.lastFromSameVendor.price) /
                    ctx.lastFromSameVendor.price) *
                  100
                : null;
            priceContext = { ...ctx, deltaPctVsSameVendor: deltaPct };
          }
        }

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
          priceContext,
        };
      });

      // Build vendor summary (best-effort)
      let vendorSummary: VendorSummary | null = null;
      if (
        vendorMatch.status === "matched" &&
        !vendorSummaryRes.error &&
        Array.isArray(vendorSummaryRes.data) &&
        vendorSummaryRes.data.length > 0
      ) {
        const s = vendorSummaryRes.data[0] as {
          bill_count: number;
          total_amount: number;
          avg_amount: number;
        };
        if (Number(s.bill_count) > 0) {
          vendorSummary = {
            vendorId: vendorMatch.entity.id,
            vendorName: vendorMatch.entity.name,
            last30Days: {
              billCount: Number(s.bill_count),
              totalAmount: Number(s.total_amount),
              avgAmount: Number(s.avg_amount),
            },
            thisBill: { totalAmount: Number(parsed.total_amount) },
          };
        }
      } else if (vendorSummaryRes.error) {
        console.warn("[ai-ingest] vendor summary lookup failed:", vendorSummaryRes.error);
      }

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
        vendorSummary,
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

function daysBetween(isoDate: string, today: Date): number {
  const past = new Date(isoDate);
  const ms = today.getTime() - past.getTime();
  return Math.max(0, Math.round(ms / (1000 * 60 * 60 * 24)));
}
