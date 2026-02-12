-- ================================================
-- Migration: Request to Purchase Order Linking
-- Description: Links Material Requests to Purchase Orders with item-level tracking
--              and automatic fulfillment synchronization
-- ================================================

-- ================================================
-- 1. Junction Table: Links PO Items to Request Items
-- ================================================

CREATE TABLE IF NOT EXISTS public.purchase_order_request_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    po_item_id UUID NOT NULL REFERENCES public.purchase_order_items(id) ON DELETE CASCADE,
    request_item_id UUID NOT NULL REFERENCES public.material_request_items(id) ON DELETE CASCADE,
    quantity_allocated NUMERIC(12,3) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),

    -- Prevent duplicate links between same PO item and request item
    CONSTRAINT unique_po_request_item UNIQUE (po_item_id, request_item_id)
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_po_request_items_po_item ON public.purchase_order_request_items(po_item_id);
CREATE INDEX IF NOT EXISTS idx_po_request_items_request_item ON public.purchase_order_request_items(request_item_id);

COMMENT ON TABLE public.purchase_order_request_items IS 'Junction table linking purchase order items to material request items for tracking fulfillment';
COMMENT ON COLUMN public.purchase_order_request_items.quantity_allocated IS 'Quantity from this request item allocated to this PO item';

-- ================================================
-- 2. Add Reverse Link on Purchase Orders
-- ================================================

-- Add source request reference on PO (for primary request that spawned this PO)
ALTER TABLE public.purchase_orders
ADD COLUMN IF NOT EXISTS source_request_id UUID REFERENCES public.material_requests(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_purchase_orders_source_request ON public.purchase_orders(source_request_id);

COMMENT ON COLUMN public.purchase_orders.source_request_id IS 'Primary material request that this PO was created from';

-- ================================================
-- 3. RLS Policies for Junction Table
-- ================================================

ALTER TABLE public.purchase_order_request_items ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to view all links
CREATE POLICY "allow_select_po_request_items"
ON public.purchase_order_request_items FOR SELECT
TO authenticated
USING (true);

-- Allow authenticated users to insert links
CREATE POLICY "allow_insert_po_request_items"
ON public.purchase_order_request_items FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

-- Allow authenticated users to delete links
CREATE POLICY "allow_delete_po_request_items"
ON public.purchase_order_request_items FOR DELETE
TO authenticated
USING (auth.uid() IS NOT NULL);

-- ================================================
-- 4. Fulfillment Sync Function
-- ================================================

CREATE OR REPLACE FUNCTION public.sync_request_fulfillment_from_po()
RETURNS TRIGGER AS $$
DECLARE
    v_link RECORD;
    v_request_item_id UUID;
    v_total_fulfilled NUMERIC;
    v_request_id UUID;
    v_all_fulfilled BOOLEAN;
    v_some_fulfilled BOOLEAN;
    v_request_status TEXT;
BEGIN
    -- Find all linked request items for this PO item
    FOR v_link IN
        SELECT pori.request_item_id, pori.quantity_allocated
        FROM public.purchase_order_request_items pori
        WHERE pori.po_item_id = NEW.id
    LOOP
        v_request_item_id := v_link.request_item_id;

        -- Calculate total fulfilled from all linked PO items
        -- Uses the received_qty from purchase_order_items
        SELECT COALESCE(SUM(
            LEAST(poi.received_qty, pori.quantity_allocated)
        ), 0) INTO v_total_fulfilled
        FROM public.purchase_order_request_items pori
        JOIN public.purchase_order_items poi ON poi.id = pori.po_item_id
        WHERE pori.request_item_id = v_request_item_id;

        -- Update the request item's fulfilled_qty
        UPDATE public.material_request_items
        SET fulfilled_qty = v_total_fulfilled
        WHERE id = v_request_item_id
        RETURNING request_id INTO v_request_id;

        -- Check fulfillment status of all items in the request
        SELECT
            BOOL_AND(COALESCE(fulfilled_qty, 0) >= COALESCE(approved_qty, requested_qty)),
            BOOL_OR(COALESCE(fulfilled_qty, 0) > 0)
        INTO v_all_fulfilled, v_some_fulfilled
        FROM public.material_request_items
        WHERE request_id = v_request_id;

        -- Get current request status
        SELECT status INTO v_request_status
        FROM public.material_requests
        WHERE id = v_request_id;

        -- Only update status if request is in ordered/partial_fulfilled state
        IF v_request_status IN ('ordered', 'partial_fulfilled') THEN
            UPDATE public.material_requests
            SET
                status = CASE
                    WHEN v_all_fulfilled THEN 'fulfilled'::material_request_status
                    WHEN v_some_fulfilled THEN 'partial_fulfilled'::material_request_status
                    ELSE status
                END,
                updated_at = now()
            WHERE id = v_request_id;
        END IF;
    END LOOP;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.sync_request_fulfillment_from_po() IS 'Syncs material request fulfillment when PO item received_qty changes';

-- ================================================
-- 5. Trigger: Sync fulfillment when PO item received_qty changes
-- ================================================

DROP TRIGGER IF EXISTS trg_sync_request_fulfillment ON public.purchase_order_items;

CREATE TRIGGER trg_sync_request_fulfillment
AFTER UPDATE OF received_qty ON public.purchase_order_items
FOR EACH ROW
WHEN (OLD.received_qty IS DISTINCT FROM NEW.received_qty)
EXECUTE FUNCTION public.sync_request_fulfillment_from_po();

-- ================================================
-- 6. Function to calculate remaining quantity for request item
-- ================================================

CREATE OR REPLACE FUNCTION public.get_request_item_remaining_qty(p_request_item_id UUID)
RETURNS NUMERIC AS $$
DECLARE
    v_approved_qty NUMERIC;
    v_already_allocated NUMERIC;
BEGIN
    -- Get approved quantity (or requested if not approved)
    SELECT COALESCE(approved_qty, requested_qty) INTO v_approved_qty
    FROM public.material_request_items
    WHERE id = p_request_item_id;

    -- Get total already allocated to POs
    SELECT COALESCE(SUM(quantity_allocated), 0) INTO v_already_allocated
    FROM public.purchase_order_request_items
    WHERE request_item_id = p_request_item_id;

    RETURN GREATEST(0, COALESCE(v_approved_qty, 0) - v_already_allocated);
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION public.get_request_item_remaining_qty(UUID) IS 'Returns remaining quantity not yet allocated to any PO';

-- ================================================
-- 7. Grants
-- ================================================

GRANT ALL ON TABLE public.purchase_order_request_items TO anon;
GRANT ALL ON TABLE public.purchase_order_request_items TO authenticated;
GRANT ALL ON TABLE public.purchase_order_request_items TO service_role;

GRANT EXECUTE ON FUNCTION public.sync_request_fulfillment_from_po() TO anon;
GRANT EXECUTE ON FUNCTION public.sync_request_fulfillment_from_po() TO authenticated;
GRANT EXECUTE ON FUNCTION public.sync_request_fulfillment_from_po() TO service_role;

GRANT EXECUTE ON FUNCTION public.get_request_item_remaining_qty(UUID) TO anon;
GRANT EXECUTE ON FUNCTION public.get_request_item_remaining_qty(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_request_item_remaining_qty(UUID) TO service_role;
