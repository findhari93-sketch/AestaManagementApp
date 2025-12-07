"use client";

import React, { useState, useEffect } from "react";
import {
  Drawer,
  Box,
  Typography,
  TextField,
  Button,
  IconButton,
  Alert,
  CircularProgress,
  FormControlLabel,
  Switch,
} from "@mui/material";
import { Close as CloseIcon } from "@mui/icons-material";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { TeaShopAccount } from "@/types/database.types";

interface TeaShopDrawerProps {
  open: boolean;
  onClose: () => void;
  shop: TeaShopAccount | null;
  siteId: string;
  onSuccess?: () => void;
}

export default function TeaShopDrawer({
  open,
  onClose,
  shop,
  siteId,
  onSuccess,
}: TeaShopDrawerProps) {
  const { userProfile } = useAuth();
  const supabase = createClient();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [shopName, setShopName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    if (open) {
      if (shop) {
        setShopName(shop.shop_name);
        setOwnerName(shop.owner_name || "");
        setContactPhone(shop.contact_phone || "");
        setAddress(shop.address || "");
        setNotes(shop.notes || "");
        setIsActive(shop.is_active);
      } else {
        // Reset for new shop
        setShopName("");
        setOwnerName("");
        setContactPhone("");
        setAddress("");
        setNotes("");
        setIsActive(true);
      }
      setError(null);
    }
  }, [open, shop]);

  const handleSave = async () => {
    if (!shopName.trim()) {
      setError("Shop name is required");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const shopData = {
        site_id: siteId,
        shop_name: shopName.trim(),
        owner_name: ownerName.trim() || null,
        contact_phone: contactPhone.trim() || null,
        address: address.trim() || null,
        notes: notes.trim() || null,
        is_active: isActive,
      };

      if (shop) {
        // Update existing shop
        const { error: updateError } = await (supabase
          .from("tea_shop_accounts") as any)
          .update(shopData)
          .eq("id", shop.id);

        if (updateError) throw updateError;
      } else {
        // Create new shop
        const { error: insertError } = await (supabase
          .from("tea_shop_accounts") as any)
          .insert(shopData);

        if (insertError) throw insertError;
      }

      onSuccess?.();
    } catch (err: any) {
      console.error("Error saving shop:", err);
      setError(err.message || "Failed to save shop");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: { width: { xs: "100%", sm: 400 } },
      }}
    >
      <Box sx={{ p: 3 }}>
        {/* Header */}
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3 }}>
          <Typography variant="h6" fontWeight={700}>
            {shop ? "Edit Tea Shop" : "Add Tea Shop"}
          </Typography>
          <IconButton onClick={onClose}>
            <CloseIcon />
          </IconButton>
        </Box>

        {/* Error Alert */}
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {/* Form */}
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <TextField
            label="Shop Name"
            value={shopName}
            onChange={(e) => setShopName(e.target.value)}
            fullWidth
            required
            placeholder="e.g., Raju Tea Stall"
          />

          <TextField
            label="Owner Name"
            value={ownerName}
            onChange={(e) => setOwnerName(e.target.value)}
            fullWidth
            placeholder="e.g., Raju"
          />

          <TextField
            label="Contact Phone"
            value={contactPhone}
            onChange={(e) => setContactPhone(e.target.value)}
            fullWidth
            placeholder="e.g., 9876543210"
          />

          <TextField
            label="Address"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            fullWidth
            multiline
            rows={2}
            placeholder="Shop location/address"
          />

          <TextField
            label="Notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            fullWidth
            multiline
            rows={2}
            placeholder="Any special arrangements or notes"
          />

          {shop && (
            <FormControlLabel
              control={
                <Switch
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                />
              }
              label="Active"
            />
          )}
        </Box>

        {/* Actions */}
        <Box sx={{ mt: 4, display: "flex", gap: 2 }}>
          <Button variant="outlined" onClick={onClose} fullWidth disabled={loading}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleSave}
            fullWidth
            disabled={loading || !shopName.trim()}
          >
            {loading ? <CircularProgress size={24} /> : shop ? "Update" : "Add Shop"}
          </Button>
        </Box>
      </Box>
    </Drawer>
  );
}
