-- Add transport_inbound and transport_outbound to rental_settlement_party_type enum.
-- The original single "transport" value is kept for backwards compat with existing rows.

ALTER TYPE rental_settlement_party_type ADD VALUE IF NOT EXISTS 'transport_inbound';
ALTER TYPE rental_settlement_party_type ADD VALUE IF NOT EXISTS 'transport_outbound';
