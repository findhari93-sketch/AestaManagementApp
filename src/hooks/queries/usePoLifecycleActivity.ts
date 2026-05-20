"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

export interface LifecycleEvent {
  /** ISO timestamp when the action happened — null if the system never stamped it (rare) */
  at: string | null;
  /** Display name of the user who did the action, or "—" when not tracked */
  by: string;
  /** Short label of what happened ("PO created", "Bill verified", etc.) */
  action: string;
  /** Optional context line shown under the action (e.g. GRN number) */
  detail?: string;
  /** Phase chip colour */
  phase: "request" | "po" | "delivery" | "bill" | "settlement";
}

interface Args {
  poId: string | null | undefined;
  expenseId: string | null | undefined;
}

/**
 * Returns a chronologically-sorted list of lifecycle events for a PO. Pulls
 * from the *_by / *_at columns on material_requests, purchase_orders,
 * deliveries, and material_purchase_expenses — the schema's audit_log table
 * exists but is currently empty (no triggers populate it), so edit history
 * isn't available. We surface creation, approval, delivery, verification,
 * and settlement actors only.
 */
export function usePoLifecycleActivity({ poId, expenseId }: Args) {
  const supabase = createClient();

  return useQuery({
    queryKey: ["po-lifecycle-activity", poId ?? "none", expenseId ?? "none"],
    enabled: !!poId,
    staleTime: 60_000,
    queryFn: async (): Promise<LifecycleEvent[]> => {
      if (!poId) return [];

      // ── PO + linked request ──────────────────────────────────────────────
      const { data: po, error: poErr } = await (supabase as any)
        .from("purchase_orders")
        .select(
          "id, po_number, source_request_id, created_by, created_at, approved_by, approved_at, cancelled_by, cancelled_at, cancellation_reason, bill_verified, bill_verified_by, bill_verified_at, vendor_bill_url"
        )
        .eq("id", poId)
        .single();
      if (poErr) throw poErr;

      let request: any = null;
      if (po?.source_request_id) {
        const { data: req } = await (supabase as any)
          .from("material_requests")
          .select("id, ref_code, created_by, created_at, approved_by, approved_at")
          .eq("id", po.source_request_id)
          .maybeSingle();
        request = req ?? null;
      }

      // ── Deliveries for this PO ───────────────────────────────────────────
      const { data: deliveries } = await (supabase as any)
        .from("deliveries")
        .select(
          "id, grn_number, delivery_date, recorded_by, recorded_at, received_by, verified_by, verified_at, engineer_verified_by, engineer_verified_at, verification_status"
        )
        .eq("po_id", poId)
        .order("delivery_date", { ascending: true });

      // ── Settlement expense ───────────────────────────────────────────────
      let expense: any = null;
      if (expenseId) {
        const { data: e } = await (supabase as any)
          .from("material_purchase_expenses")
          .select("id, ref_code, is_paid, created_by, created_at, updated_at")
          .eq("id", expenseId)
          .maybeSingle();
        expense = e ?? null;
      }

      // ── Resolve user names in a single round-trip ───────────────────────
      const userIds = new Set<string>();
      const collect = (id: unknown) => {
        if (typeof id === "string" && id) userIds.add(id);
      };
      collect(request?.created_by);
      collect(request?.approved_by);
      collect(po.created_by);
      collect(po.approved_by);
      collect(po.cancelled_by);
      collect(po.bill_verified_by);
      for (const d of deliveries ?? []) {
        collect(d.recorded_by);
        collect(d.received_by);
        collect(d.verified_by);
        collect(d.engineer_verified_by);
      }
      collect(expense?.created_by);

      const nameById = new Map<string, string>();
      if (userIds.size > 0) {
        const { data: users } = await (supabase as any)
          .from("users")
          .select("id, name, email")
          .in("id", Array.from(userIds));
        for (const u of users ?? []) {
          nameById.set(u.id, u.name || u.email || "Unknown");
        }
      }
      const nameOf = (id: unknown): string =>
        typeof id === "string" && id ? nameById.get(id) ?? "Unknown user" : "—";

      // ── Build event list ─────────────────────────────────────────────────
      const events: LifecycleEvent[] = [];

      if (request) {
        events.push({
          at: request.created_at,
          by: nameOf(request.created_by),
          action: "Material request created",
          detail: request.ref_code ?? undefined,
          phase: "request",
        });
        if (request.approved_at) {
          events.push({
            at: request.approved_at,
            by: nameOf(request.approved_by),
            action: "Request approved",
            phase: "request",
          });
        }
      }

      events.push({
        at: po.created_at,
        by: nameOf(po.created_by),
        action: "Purchase order created",
        detail: po.po_number,
        phase: "po",
      });
      if (po.approved_at) {
        events.push({
          at: po.approved_at,
          by: nameOf(po.approved_by),
          action: "PO approved",
          phase: "po",
        });
      }
      if (po.cancelled_at) {
        events.push({
          at: po.cancelled_at,
          by: nameOf(po.cancelled_by),
          action: "PO cancelled",
          detail: po.cancellation_reason ?? undefined,
          phase: "po",
        });
      }

      for (const d of deliveries ?? []) {
        const grnLabel = d.grn_number ? `GRN ${d.grn_number}` : "Delivery";
        if (d.recorded_at || d.delivery_date) {
          events.push({
            at: d.recorded_at || d.delivery_date,
            by: nameOf(d.recorded_by ?? d.received_by),
            action: "Delivery recorded",
            detail: grnLabel,
            phase: "delivery",
          });
        }
        if (d.engineer_verified_at) {
          events.push({
            at: d.engineer_verified_at,
            by: nameOf(d.engineer_verified_by),
            action: "Engineer verified delivery",
            detail: grnLabel,
            phase: "delivery",
          });
        }
        if (d.verified_at) {
          events.push({
            at: d.verified_at,
            by: nameOf(d.verified_by),
            action: "Delivery verified",
            detail: grnLabel,
            phase: "delivery",
          });
        }
      }

      if (po.vendor_bill_url && po.bill_verified_at) {
        events.push({
          at: po.bill_verified_at,
          by: nameOf(po.bill_verified_by),
          action: "Vendor bill verified",
          phase: "bill",
        });
      }

      if (expense) {
        events.push({
          at: expense.created_at,
          by: nameOf(expense.created_by),
          action: "Settlement expense created",
          detail: expense.ref_code ?? undefined,
          phase: "settlement",
        });
        if (expense.is_paid) {
          events.push({
            at: expense.updated_at,
            // The settlement RPC stamps updated_at when the payment is logged
            // but doesn't capture a separate settled_by, so we don't know
            // exactly who clicked Confirm. Show "—" rather than guess.
            by: "—",
            action: "Vendor paid",
            phase: "settlement",
          });
        }
      }

      events.sort((a, b) => {
        const aT = a.at ? Date.parse(a.at) : 0;
        const bT = b.at ? Date.parse(b.at) : 0;
        return aT - bT;
      });

      return events;
    },
  });
}
