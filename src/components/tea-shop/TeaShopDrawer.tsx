"use client";

import React, { useState, useEffect, useRef } from "react";
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
  Paper,
  Divider,
} from "@mui/material";
import {
  Close as CloseIcon,
  QrCode2 as QrCodeIcon,
  CloudUpload as CloudUploadIcon,
  Delete as DeleteIcon,
} from "@mui/icons-material";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { TeaShopAccount } from "@/types/database.types";

interface TeaShopDrawerProps {
  open: boolean;
  onClose: () => void;
  shop: TeaShopAccount | null;
  siteId: string;
  siteGroupId?: string;
  isGroupMode?: boolean;
  onSuccess?: () => void;
}

export default function TeaShopDrawer({
  open,
  onClose,
  shop,
  siteId,
  siteGroupId,
  isGroupMode = false,
  onSuccess,
}: TeaShopDrawerProps) {
  const { userProfile } = useAuth();
  const supabase = createClient();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadingQr, setUploadingQr] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form state
  const [shopName, setShopName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [isActive, setIsActive] = useState(true);

  // Payment info state
  const [upiId, setUpiId] = useState("");
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);

  // Group shop state
  const [isGroupShop, setIsGroupShop] = useState(false);

  useEffect(() => {
    if (open) {
      if (shop) {
        setShopName(shop.shop_name);
        setOwnerName(shop.owner_name || "");
        setContactPhone(shop.contact_phone || "");
        setAddress(shop.address || "");
        setNotes(shop.notes || "");
        setIsActive(shop.is_active);
        // Load payment info
        setUpiId((shop as any).upi_id || "");
        setQrCodeUrl((shop as any).qr_code_url || null);
        // Load group shop info
        setIsGroupShop((shop as any).is_group_shop || false);
      } else {
        // Reset for new shop
        setShopName("");
        setOwnerName("");
        setContactPhone("");
        setAddress("");
        setNotes("");
        setIsActive(true);
        setUpiId("");
        setQrCodeUrl(null);
        // Default to group shop if in group mode
        setIsGroupShop(isGroupMode && !!siteGroupId);
      }
      setError(null);
    }
  }, [open, shop, isGroupMode, siteGroupId]);

  // Handle QR code image upload
  const handleQrCodeUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      setError("Please upload an image file");
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      setError("Image size should be less than 2MB");
      return;
    }

    setUploadingQr(true);
    setError(null);

    try {
      // Generate unique file name
      const fileExt = file.name.split(".").pop();
      const fileName = `${siteId}/${Date.now()}.${fileExt}`;

      // Upload to Supabase Storage
      const { data, error: uploadError } = await supabase.storage
        .from("tea-shop-qr")
        .upload(fileName, file, {
          cacheControl: "3600",
          upsert: true,
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage.from("tea-shop-qr").getPublicUrl(fileName);
      setQrCodeUrl(urlData.publicUrl);
    } catch (err: any) {
      console.error("Error uploading QR code:", err);
      setError("Failed to upload QR code image");
    } finally {
      setUploadingQr(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  // Remove QR code
  const handleRemoveQrCode = () => {
    setQrCodeUrl(null);
  };

  const handleSave = async () => {
    if (!shopName.trim()) {
      setError("Shop name is required");
      return;
    }

    // Validate group shop requires a group
    if (isGroupShop && !siteGroupId) {
      setError("Cannot create group shop: site is not in a group");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const shopData: Record<string, any> = {
        shop_name: shopName.trim(),
        owner_name: ownerName.trim() || null,
        contact_phone: contactPhone.trim() || null,
        address: address.trim() || null,
        notes: notes.trim() || null,
        is_active: isActive,
        upi_id: upiId.trim() || null,
        qr_code_url: qrCodeUrl || null,
        is_group_shop: isGroupShop,
      };

      // Set site_id or site_group_id based on group shop setting
      if (isGroupShop && siteGroupId) {
        shopData.site_group_id = siteGroupId;
        shopData.site_id = null;
      } else {
        shopData.site_id = siteId;
        shopData.site_group_id = null;
      }

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

          <Divider sx={{ my: 1 }} />

          {/* Payment Information Section */}
          <Typography variant="subtitle2" color="text.secondary" sx={{ mt: 1 }}>
            Payment Information
          </Typography>

          <TextField
            label="UPI ID"
            value={upiId}
            onChange={(e) => setUpiId(e.target.value)}
            fullWidth
            placeholder="e.g., shopname@upi or 9876543210@paytm"
            helperText="Enter the shop's UPI ID for quick payments"
          />

          {/* QR Code Upload */}
          <Paper
            variant="outlined"
            sx={{
              p: 2,
              textAlign: "center",
              bgcolor: "grey.50",
              borderStyle: "dashed",
            }}
          >
            <input
              type="file"
              accept="image/*"
              ref={fileInputRef}
              onChange={handleQrCodeUpload}
              style={{ display: "none" }}
              id="qr-code-upload"
            />

            {qrCodeUrl ? (
              <Box>
                <Box
                  component="img"
                  src={qrCodeUrl}
                  alt="Payment QR Code"
                  sx={{
                    maxWidth: 150,
                    maxHeight: 150,
                    objectFit: "contain",
                    mb: 1,
                    borderRadius: 1,
                  }}
                />
                <Box sx={{ display: "flex", gap: 1, justifyContent: "center" }}>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingQr}
                  >
                    Change
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    color="error"
                    startIcon={<DeleteIcon />}
                    onClick={handleRemoveQrCode}
                  >
                    Remove
                  </Button>
                </Box>
              </Box>
            ) : (
              <Box>
                <QrCodeIcon sx={{ fontSize: 48, color: "text.disabled", mb: 1 }} />
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Upload Payment QR Code
                </Typography>
                <Button
                  variant="outlined"
                  startIcon={uploadingQr ? <CircularProgress size={16} /> : <CloudUploadIcon />}
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingQr}
                  size="small"
                >
                  {uploadingQr ? "Uploading..." : "Choose Image"}
                </Button>
                <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
                  Max 2MB, JPG/PNG
                </Typography>
              </Box>
            )}
          </Paper>

          {/* Group Shop Toggle - only show if site is in a group */}
          {siteGroupId && (
            <Paper
              variant="outlined"
              sx={{
                p: 2,
                bgcolor: isGroupShop ? "secondary.50" : "grey.50",
                borderColor: isGroupShop ? "secondary.main" : "divider",
              }}
            >
              <FormControlLabel
                control={
                  <Switch
                    checked={isGroupShop}
                    onChange={(e) => setIsGroupShop(e.target.checked)}
                    color="secondary"
                  />
                }
                label={
                  <Box>
                    <Typography variant="body2" fontWeight={600}>
                      Group Tea Shop
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      This shop serves all sites in the group
                    </Typography>
                  </Box>
                }
              />
              {/* Show warning when converting existing site shop to group shop */}
              {shop && !((shop as any).is_group_shop) && isGroupShop && (
                <Alert severity="info" sx={{ mt: 1 }}>
                  <Typography variant="caption">
                    Converting to group shop: This shop will serve all sites in the group.
                    Existing site-specific entries will remain unchanged.
                  </Typography>
                </Alert>
              )}
            </Paper>
          )}

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
