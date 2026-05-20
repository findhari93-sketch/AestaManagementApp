"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

export interface LifecyclePhoto {
  url: string;
  /** Bucket the photo came from in the workflow, used to label the thumbnail */
  source: "delivery" | "verification" | "invoice" | "challan" | "vendor_bill" | "request";
  /** Stage label shown in the lightbox caption (e.g. "Delivery · GRN-123") */
  caption: string;
  /** When the artefact was recorded — used to sort the gallery by lifecycle order */
  recordedAt: string | null;
}

/**
 * Collects every photo attached along a PO's lifecycle:
 * vendor bill on the PO itself, plus delivery_photos / verification_photos /
 * invoice_url / challan_url from each delivery against that PO. The drawer
 * needs this to let an engineer eyeball every artefact in one place before
 * settling.
 */
export function usePoLifecyclePhotos(poId: string | null | undefined) {
  const supabase = createClient();

  return useQuery({
    queryKey: poId ? ["po-lifecycle-photos", poId] : ["po-lifecycle-photos", "none"],
    enabled: !!poId,
    staleTime: 60_000,
    queryFn: async (): Promise<LifecyclePhoto[]> => {
      if (!poId) return [];

      const { data: poRow, error: poErr } = await supabase
        .from("purchase_orders")
        .select("id, po_number, vendor_bill_url, order_date")
        .eq("id", poId)
        .single();

      if (poErr) throw poErr;

      const { data: deliveries, error: delErr } = await (supabase as any)
        .from("deliveries")
        .select(
          "id, grn_number, delivery_date, delivery_photos, verification_photos, invoice_url, challan_url"
        )
        .eq("po_id", poId)
        .order("delivery_date", { ascending: true });

      if (delErr) throw delErr;

      const photos: LifecyclePhoto[] = [];

      if (poRow?.vendor_bill_url) {
        photos.push({
          url: poRow.vendor_bill_url,
          source: "vendor_bill",
          caption: `Vendor bill · ${poRow.po_number}`,
          recordedAt: poRow.order_date ?? null,
        });
      }

      for (const d of deliveries ?? []) {
        const stage = d.grn_number ? `GRN ${d.grn_number}` : "Delivery";
        const recordedAt: string | null = d.delivery_date ?? null;

        parsePhotoArray(d.delivery_photos).forEach((url) =>
          photos.push({ url, source: "delivery", caption: `Delivery · ${stage}`, recordedAt })
        );
        parsePhotoArray(d.verification_photos).forEach((url) =>
          photos.push({ url, source: "verification", caption: `Verification · ${stage}`, recordedAt })
        );
        if (d.invoice_url) {
          photos.push({ url: d.invoice_url, source: "invoice", caption: `Invoice · ${stage}`, recordedAt });
        }
        if (d.challan_url) {
          photos.push({ url: d.challan_url, source: "challan", caption: `Challan · ${stage}`, recordedAt });
        }
      }

      return photos;
    },
  });
}

function parsePhotoArray(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === "string");
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
    } catch {
      return [];
    }
  }
  return [];
}
