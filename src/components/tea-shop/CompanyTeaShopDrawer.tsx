"use client";

import { useState, useEffect, useRef } from "react";
import {
  Drawer,
  Box,
  Typography,
  TextField,
  Button,
  IconButton,
  Alert,
  CircularProgress,
  Paper,
  Divider,
} from "@mui/material";
import {
  Close as CloseIcon,
  LocalCafe as TeaIcon,
  QrCode2 as QrCodeIcon,
  CloudUpload as CloudUploadIcon,
  Delete as DeleteIcon,
} from "@mui/icons-material";
import { createClient } from "@/lib/supabase/client";
import {
  useCreateCompanyTeaShop,
  useUpdateCompanyTeaShop,
  type CompanyTeaShopWithAssignments,
  type CompanyTeaShopFormData,
} from "@/hooks/queries/useCompanyTeaShops";

interface CompanyTeaShopDrawerProps {
  open: boolean;
  onClose: () => void;
  teaShop: CompanyTeaShopWithAssignments | null;
}

export default function CompanyTeaShopDrawer({
  open,
  onClose,
  teaShop,
}: CompanyTeaShopDrawerProps) {
  const isEdit = !!teaShop;
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const createTeaShop = useCreateCompanyTeaShop();
  const updateTeaShop = useUpdateCompanyTeaShop();

  const [error, setError] = useState("");
  const [uploadingQr, setUploadingQr] = useState(false);
  const [formData, setFormData] = useState<CompanyTeaShopFormData>({
    name: "",
    owner_name: "",
    contact_phone: "",
    address: "",
    upi_id: "",
    qr_code_url: "",
    notes: "",
    is_active: true,
  });

  // Reset form when teaShop changes
  useEffect(() => {
    if (teaShop) {
      setFormData({
        name: teaShop.name,
        owner_name: teaShop.owner_name || "",
        contact_phone: teaShop.contact_phone || "",
        address: teaShop.address || "",
        upi_id: teaShop.upi_id || "",
        qr_code_url: teaShop.qr_code_url || "",
        notes: teaShop.notes || "",
        is_active: teaShop.is_active,
      });
    } else {
      setFormData({
        name: "",
        owner_name: "",
        contact_phone: "",
        address: "",
        upi_id: "",
        qr_code_url: "",
        notes: "",
        is_active: true,
      });
    }
    setError("");
  }, [teaShop, open]);

  const handleChange = (field: keyof CompanyTeaShopFormData) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setFormData((prev) => ({ ...prev, [field]: e.target.value }));
    setError("");
  };

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
    setError("");

    try {
      // Generate unique file name
      const fileExt = file.name.split(".").pop();
      const fileName = `company/${teaShop?.id || "new"}/${Date.now()}.${fileExt}`;

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from("tea-shop-qr")
        .upload(fileName, file, {
          cacheControl: "3600",
          upsert: true,
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage.from("tea-shop-qr").getPublicUrl(fileName);
      setFormData((prev) => ({ ...prev, qr_code_url: urlData.publicUrl }));
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
    setFormData((prev) => ({ ...prev, qr_code_url: "" }));
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      setError("Tea shop name is required");
      return;
    }

    try {
      if (isEdit && teaShop) {
        await updateTeaShop.mutateAsync({
          id: teaShop.id,
          data: formData,
        });
      } else {
        await createTeaShop.mutateAsync(formData);
      }
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to save tea shop");
    }
  };

  const isLoading = createTeaShop.isPending || updateTeaShop.isPending;

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
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <TeaIcon color="primary" />
            <Typography variant="h6" fontWeight={700}>
              {isEdit ? "Edit Tea Shop" : "Add Tea Shop"}
            </Typography>
          </Box>
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
          {/* Shop Name */}
          <TextField
            label="Shop Name"
            value={formData.name}
            onChange={handleChange("name")}
            required
            fullWidth
            placeholder="e.g., Elango Tea Shop"
          />

          {/* Owner Name */}
          <TextField
            label="Owner Name"
            value={formData.owner_name}
            onChange={handleChange("owner_name")}
            fullWidth
            placeholder="e.g., Elango"
          />

          {/* Contact Phone */}
          <TextField
            label="Contact Phone"
            value={formData.contact_phone}
            onChange={handleChange("contact_phone")}
            fullWidth
            placeholder="e.g., 9876543210"
          />

          {/* Address */}
          <TextField
            label="Address"
            value={formData.address}
            onChange={handleChange("address")}
            fullWidth
            multiline
            rows={2}
            placeholder="Shop location address"
          />

          {/* Notes */}
          <TextField
            label="Notes"
            value={formData.notes}
            onChange={handleChange("notes")}
            fullWidth
            multiline
            rows={2}
            placeholder="Any additional notes about this tea shop"
          />

          <Divider sx={{ my: 1 }} />

          {/* Payment Information Section */}
          <Typography variant="subtitle2" color="text.secondary">
            Payment Information
          </Typography>

          {/* UPI ID */}
          <TextField
            label="UPI ID"
            value={formData.upi_id}
            onChange={handleChange("upi_id")}
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
              id="company-qr-code-upload"
            />

            {formData.qr_code_url ? (
              <Box>
                <Box
                  component="img"
                  src={formData.qr_code_url}
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
        </Box>

        {/* Actions */}
        <Box sx={{ mt: 4, display: "flex", gap: 2 }}>
          <Button variant="outlined" onClick={onClose} fullWidth disabled={isLoading}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleSubmit}
            fullWidth
            disabled={isLoading || !formData.name.trim()}
          >
            {isLoading ? <CircularProgress size={24} /> : isEdit ? "Update" : "Create"}
          </Button>
        </Box>
      </Box>
    </Drawer>
  );
}
