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
  Avatar,
} from "@mui/material";
import {
  Close as CloseIcon,
  QrCode2 as QrCodeIcon,
  CloudUpload as CloudUploadIcon,
  Delete as DeleteIcon,
  LocalCafe as CafeIcon,
} from "@mui/icons-material";
import { createClient } from "@/lib/supabase/client";
import { hardenedUpload } from "@/lib/storage/uploadHelpers";
import { useAuth } from "@/contexts/AuthContext";
import type { Database } from "@/types/database.types";

type TeaShopAccount = Database["public"]["Tables"]["tea_shop_accounts"]["Row"];

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
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

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
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      if (shop) {
        setShopName(shop.shop_name);
        setOwnerName(shop.owner_name || "");
        setContactPhone(shop.contact_phone || "");
        setAddress(shop.address || "");
        setNotes(shop.notes || "");
        setIsActive(shop.is_active);
        setUpiId((shop as any).upi_id || "");
        setQrCodeUrl((shop as any).qr_code_url || null);
        setPhotoUrl((shop as any).photo_url || null);
      } else {
        setShopName("");
        setOwnerName("");
        setContactPhone("");
        setAddress("");
        setNotes("");
        setIsActive(true);
        setUpiId("");
        setQrCodeUrl(null);
        setPhotoUrl(null);
      }
      setError(null);
    }
  }, [open, shop]);

  const handleQrCodeUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Please upload an image file");
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setError("Image size should be less than 2MB");
      return;
    }

    setUploadingQr(true);
    setError(null);

    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${siteId}/${Date.now()}.${fileExt}`;
      const { publicUrl } = await hardenedUpload({
        supabase,
        bucketName: "tea-shop-qr",
        filePath: fileName,
        file,
      });
      setQrCodeUrl(publicUrl);
    } catch (err: any) {
      console.error("Error uploading QR code:", err);
      const message = err?.message || "";
      setError(
        message.includes("timed out") || message.includes("stalled")
          ? "Upload timed out. Please check your connection and try again."
          : "Failed to upload QR code image"
      );
    } finally {
      setUploadingQr(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleRemoveQrCode = () => setQrCodeUrl(null);

  const handlePhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Please upload an image file");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError("Image size should be less than 5MB");
      return;
    }

    setUploadingPhoto(true);
    setError(null);

    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${siteId}/${Date.now()}.${fileExt}`;
      const { publicUrl } = await hardenedUpload({
        supabase,
        bucketName: "tea-shop-photos",
        filePath: fileName,
        file,
      });
      setPhotoUrl(publicUrl);
    } catch (err: any) {
      console.error("Error uploading photo:", err);
      const message = err?.message || "";
      setError(
        message.includes("timed out") || message.includes("stalled")
          ? "Upload timed out. Please check your connection and try again."
          : "Failed to upload shop photo"
      );
    } finally {
      setUploadingPhoto(false);
      if (photoInputRef.current) photoInputRef.current.value = "";
    }
  };

  const handleSave = async () => {
    if (!shopName.trim()) {
      setError("Shop name is required");
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
        photo_url: photoUrl || null,
        is_group_shop: false,
        site_id: siteId,
        site_group_id: null,
      };

      if (shop) {
        const { error: updateError } = await (supabase
          .from("tea_shop_accounts") as any)
          .update(shopData)
          .eq("id", shop.id);
        if (updateError) throw updateError;
      } else {
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

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

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

          {/* Shop Photo Upload */}
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: "block" }}>
              Shop Photo (shown in page header)
            </Typography>
            <input
              type="file"
              accept="image/*"
              ref={photoInputRef}
              onChange={handlePhotoUpload}
              style={{ display: "none" }}
              id="shop-photo-upload"
            />
            <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
              <Avatar
                src={photoUrl || undefined}
                sx={{ width: 64, height: 64, bgcolor: "primary.light", cursor: "pointer" }}
                onClick={() => photoInputRef.current?.click()}
              >
                {!photoUrl && <CafeIcon />}
              </Avatar>
              <Box>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={uploadingPhoto ? <CircularProgress size={14} /> : <CloudUploadIcon />}
                  onClick={() => photoInputRef.current?.click()}
                  disabled={uploadingPhoto}
                >
                  {uploadingPhoto ? "Uploading..." : photoUrl ? "Change" : "Upload Photo"}
                </Button>
                {photoUrl && (
                  <Button
                    size="small"
                    color="error"
                    onClick={() => setPhotoUrl(null)}
                    sx={{ ml: 1 }}
                  >
                    Remove
                  </Button>
                )}
                <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                  Max 5MB, JPG/PNG
                </Typography>
              </Box>
            </Box>
          </Box>

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

          {siteGroupId && (
            <Alert severity="info" sx={{ py: 1 }}>
              <Typography variant="caption">
                This site is in a group. Tea shop data will be automatically combined with other sites in the group.
              </Typography>
            </Alert>
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
