"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Box,
  Button,
  Typography,
  CircularProgress,
  Alert,
  Paper,
  Stack,
  Chip,
} from "@mui/material";
import {
  ArrowBack as ArrowBackIcon,
  Store as StoreIcon,
  Phone as PhoneIcon,
  WhatsApp as WhatsAppIcon,
} from "@mui/icons-material";
import PageHeader from "@/components/layout/PageHeader";
import { StoreCatalogGrid } from "@/components/store-catalog";
import { useVendor } from "@/hooks/queries/useVendors";
import { useMaterialCountForVendor } from "@/hooks/queries/useVendorInventory";
import type { StoreCatalogItem } from "@/types/material.types";
import ProductDetailDrawer from "@/components/store-catalog/ProductDetailDrawer";
import AddProductDialog from "@/components/store-catalog/AddProductDialog";

export default function StoreCatalogPage() {
  const params = useParams();
  const router = useRouter();
  const vendorId = params?.id as string;

  const [selectedProduct, setSelectedProduct] = useState<StoreCatalogItem | null>(null);
  const [addProductOpen, setAddProductOpen] = useState(false);

  const { data: vendor, isLoading: vendorLoading, error: vendorError } = useVendor(vendorId);
  const { data: productCount = 0 } = useMaterialCountForVendor(vendorId);

  if (vendorLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (vendorError || !vendor) {
    return (
      <Box sx={{ p: 2 }}>
        <Alert severity="error">
          {vendorError ? (vendorError as Error).message : "Vendor not found"}
        </Alert>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => router.push("/company/vendors")}
          sx={{ mt: 2 }}
        >
          Back to Vendors
        </Button>
      </Box>
    );
  }

  const vendorName = vendor.shop_name || vendor.name;

  return (
    <Box>
      <PageHeader
        title=""
        actions={
          <Button
            startIcon={<ArrowBackIcon />}
            onClick={() => router.push(`/company/vendors/${vendorId}`)}
            size="small"
          >
            Back to Vendor
          </Button>
        }
      />

      {/* Store Header */}
      <Paper
        variant="outlined"
        sx={{
          p: 2,
          mb: 2,
          background: "linear-gradient(135deg, #f5f7fa 0%, #e4e9f2 100%)",
        }}
      >
        <Box display="flex" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={2}>
          <Box display="flex" alignItems="center" gap={2}>
            <Box
              sx={{
                width: 56,
                height: 56,
                borderRadius: 2,
                bgcolor: "primary.main",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <StoreIcon sx={{ color: "white", fontSize: 32 }} />
            </Box>
            <Box>
              <Typography variant="h5" fontWeight={600}>
                {vendorName}
              </Typography>
              <Stack direction="row" spacing={1} alignItems="center" mt={0.5}>
                <Chip
                  size="small"
                  label={`${productCount} products`}
                  color="primary"
                  variant="outlined"
                />
                {vendor.city && (
                  <Typography variant="body2" color="text.secondary">
                    {vendor.city}
                  </Typography>
                )}
              </Stack>
            </Box>
          </Box>

          {/* Quick Contact */}
          <Stack direction="row" spacing={1}>
            {vendor.phone && (
              <Button
                variant="outlined"
                size="small"
                startIcon={<PhoneIcon />}
                href={`tel:${vendor.phone}`}
              >
                Call
              </Button>
            )}
            {vendor.whatsapp_number && (
              <Button
                variant="outlined"
                size="small"
                color="success"
                startIcon={<WhatsAppIcon />}
                href={`https://wa.me/${vendor.whatsapp_number.replace(/\D/g, "")}`}
                target="_blank"
              >
                WhatsApp
              </Button>
            )}
          </Stack>
        </Box>
      </Paper>

      {/* Store Catalog Grid */}
      <StoreCatalogGrid
        vendorId={vendorId}
        vendorName={vendorName}
        onProductClick={(product) => setSelectedProduct(product)}
        onAddProduct={() => setAddProductOpen(true)}
      />

      {/* Product Detail Drawer */}
      <ProductDetailDrawer
        open={!!selectedProduct}
        onClose={() => setSelectedProduct(null)}
        product={selectedProduct}
        vendorId={vendorId}
        vendorName={vendorName}
      />

      {/* Add Product Dialog */}
      <AddProductDialog
        open={addProductOpen}
        onClose={() => setAddProductOpen(false)}
        vendorId={vendorId}
        vendorName={vendorName}
      />
    </Box>
  );
}
