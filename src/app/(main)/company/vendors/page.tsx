"use client";

import { useMemo, useState, useCallback, useDeferredValue } from "react";
import { useRouter } from "next/navigation";
import {
  Box,
  Button,
  Chip,
  IconButton,
  Typography,
  TextField,
  InputAdornment,
  Fab,
  Tooltip,
  Rating,
  Link,
  Tabs,
  Tab,
} from "@mui/material";
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Search as SearchIcon,
  Phone as PhoneIcon,
  WhatsApp as WhatsAppIcon,
  Inventory as InventoryIcon,
} from "@mui/icons-material";
import DataTable, { type MRT_ColumnDef, type PaginationState } from "@/components/common/DataTable";
import PageHeader from "@/components/layout/PageHeader";
import { useAuth } from "@/contexts/AuthContext";
import { useIsMobile } from "@/hooks/useIsMobile";
import { hasEditPermission } from "@/lib/permissions";
import {
  usePaginatedVendors,
  useDeleteVendor,
} from "@/hooks/queries/useVendors";
import { useMaterialCategories } from "@/hooks/queries/useMaterials";
import { useVendorMaterialCounts } from "@/hooks/queries/useVendorInventory";
import VendorDialog from "@/components/materials/VendorDialog";
import type { VendorWithCategories, VendorType } from "@/types/material.types";

// Vendor category tabs based on building material types
type VendorTabId = "all" | "rental" | "civil" | "steel" | "electrical_plumbing" | "hardware" | "finishing";

interface VendorTab {
  id: VendorTabId;
  label: string;
  vendorType?: VendorType;
  categoryNames?: string[];
}

const VENDOR_TABS: VendorTab[] = [
  { id: "all", label: "All Vendors" },
  { id: "rental", label: "Rental", vendorType: "rental_store" },
  { id: "civil", label: "Civil", categoryNames: ["cement", "brick", "block", "sand", "aggregate", "binding"] },
  { id: "steel", label: "Steel & Metals", categoryNames: ["steel", "metal", "iron", "tmt"] },
  { id: "electrical_plumbing", label: "Electrical & Plumbing", categoryNames: ["electrical", "plumbing", "wiring", "pipe"] },
  { id: "hardware", label: "Hardware", categoryNames: ["hardware"] },
  { id: "finishing", label: "Finishing", categoryNames: ["paint", "tile", "sanitary", "flooring", "finishing"] },
];

export default function VendorsPage() {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingVendor, setEditingVendor] = useState<VendorWithCategories | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 50 });
  const [selectedTab, setSelectedTab] = useState<VendorTabId>("all");

  const { userProfile } = useAuth();
  const isMobile = useIsMobile();
  const canEdit = hasEditPermission(userProfile?.role);

  // Debounce search input
  const deferredSearch = useDeferredValue(searchInput);

  // Get current tab configuration
  const currentTab = VENDOR_TABS.find((t) => t.id === selectedTab) || VENDOR_TABS[0];

  // Server-side paginated vendors with search and tab filtering
  const { data: paginatedData, isLoading } = usePaginatedVendors(
    pagination,
    undefined, // categoryId
    deferredSearch.length >= 2 ? deferredSearch : undefined,
    currentTab.vendorType, // vendorType filter for rental tab
    currentTab.categoryNames // categoryNames filter for category tabs
  );

  const vendors = paginatedData?.data || [];
  const totalCount = paginatedData?.totalCount || 0;

  // Handle tab change - reset pagination
  const handleTabChange = useCallback((_event: React.SyntheticEvent, newValue: VendorTabId) => {
    setSelectedTab(newValue);
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
  }, []);

  const { data: categories = [] } = useMaterialCategories();
  const { data: materialCounts = {} } = useVendorMaterialCounts();
  const deleteVendor = useDeleteVendor();

  // Handle pagination change
  const handlePaginationChange = useCallback((newPagination: PaginationState) => {
    setPagination(newPagination);
  }, []);

  const handleOpenDialog = useCallback((vendor?: VendorWithCategories) => {
    if (vendor) {
      setEditingVendor(vendor);
    } else {
      setEditingVendor(null);
    }
    setDialogOpen(true);
  }, []);

  const handleCloseDialog = useCallback(() => {
    setDialogOpen(false);
    setEditingVendor(null);
  }, []);

  const handleDelete = useCallback(
    async (id: string) => {
      if (!confirm("Are you sure you want to delete this vendor?")) return;
      try {
        await deleteVendor.mutateAsync(id);
      } catch (error) {
        console.error("Failed to delete vendor:", error);
      }
    },
    [deleteVendor]
  );

  // Table columns
  const columns = useMemo<MRT_ColumnDef<VendorWithCategories>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Vendor Name",
        size: 200,
        Cell: ({ row }) => (
          <Box>
            <Link
              component="button"
              variant="body2"
              fontWeight={500}
              onClick={() => router.push(`/company/vendors/${row.original.id}`)}
              sx={{ textAlign: "left", cursor: "pointer" }}
            >
              {row.original.name}
            </Link>
            {row.original.code && (
              <Typography variant="caption" color="text.secondary" display="block">
                {row.original.code}
              </Typography>
            )}
          </Box>
        ),
      },
      {
        accessorKey: "contact_person",
        header: "Contact",
        size: 150,
        Cell: ({ row }) => (
          <Box>
            <Typography variant="body2">
              {row.original.contact_person || "-"}
            </Typography>
            {row.original.phone && (
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mt: 0.5 }}>
                <PhoneIcon fontSize="small" sx={{ fontSize: 14 }} color="action" />
                <Typography variant="caption" color="text.secondary">
                  {row.original.phone}
                </Typography>
                {row.original.whatsapp_number && (
                  <Tooltip title="WhatsApp">
                    <WhatsAppIcon
                      fontSize="small"
                      sx={{ fontSize: 14, color: "success.main", ml: 0.5 }}
                    />
                  </Tooltip>
                )}
              </Box>
            )}
          </Box>
        ),
      },
      {
        accessorKey: "city",
        header: "Location",
        size: 120,
        Cell: ({ row }) => row.original.city || "-",
      },
      {
        id: "materials",
        header: "Materials",
        size: 100,
        enableSorting: false,
        Cell: ({ row }) => {
          const count = materialCounts[row.original.id] || 0;
          return count > 0 ? (
            <Chip
              icon={<InventoryIcon />}
              label={count}
              size="small"
              color="primary"
              variant="outlined"
              onClick={() => router.push(`/company/vendors/${row.original.id}?tab=materials`)}
              clickable
            />
          ) : (
            <Typography variant="caption" color="text.secondary">
              None
            </Typography>
          );
        },
      },
      {
        accessorKey: "categories",
        header: "Categories",
        size: 200,
        enableSorting: false,
        Cell: ({ row }) => {
          const cats = row.original.categories || [];
          if (cats.length === 0) return "-";
          return (
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
              {cats.slice(0, 2).map((cat) => (
                <Chip
                  key={cat?.id}
                  label={cat?.name}
                  size="small"
                  variant="outlined"
                />
              ))}
              {cats.length > 2 && (
                <Chip label={`+${cats.length - 2}`} size="small" />
              )}
            </Box>
          );
        },
      },
      {
        accessorKey: "rating",
        header: "Rating",
        size: 100,
        Cell: ({ row }) =>
          row.original.rating ? (
            <Rating
              value={row.original.rating}
              precision={0.5}
              size="small"
              readOnly
            />
          ) : (
            "-"
          ),
      },
      {
        accessorKey: "gst_number",
        header: "GST",
        size: 150,
        Cell: ({ row }) => row.original.gst_number || "-",
      },
    ],
    [materialCounts, router]
  );

  // Row actions
  const renderRowActions = useCallback(
    ({ row }: { row: { original: VendorWithCategories } }) => (
      <Box sx={{ display: "flex", gap: 0.5 }}>
        <Tooltip title="Edit">
          <IconButton
            size="small"
            onClick={() => handleOpenDialog(row.original)}
            disabled={!canEdit}
          >
            <EditIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Delete">
          <IconButton
            size="small"
            onClick={() => handleDelete(row.original.id)}
            disabled={!canEdit}
            color="error"
          >
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>
    ),
    [handleOpenDialog, handleDelete, canEdit]
  );

  return (
    <Box>
      <PageHeader
        title="Vendors & Suppliers"
        actions={
          !isMobile && canEdit ? (
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => handleOpenDialog()}
            >
              Add Vendor
            </Button>
          ) : null
        }
      />

      {/* Category Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: "divider", mb: 2 }}>
        <Tabs
          value={selectedTab}
          onChange={handleTabChange}
          variant={isMobile ? "scrollable" : "standard"}
          scrollButtons={isMobile ? "auto" : false}
          allowScrollButtonsMobile
        >
          {VENDOR_TABS.map((tab) => (
            <Tab key={tab.id} value={tab.id} label={tab.label} />
          ))}
        </Tabs>
      </Box>

      {/* Search */}
      <Box sx={{ mb: 2, display: "flex", alignItems: "center", gap: 2 }}>
        <TextField
          size="small"
          placeholder="Search vendors (min 2 chars)..."
          value={searchInput}
          onChange={(e) => {
            setSearchInput(e.target.value);
            setPagination(prev => ({ ...prev, pageIndex: 0 }));
          }}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
            },
          }}
          sx={{ minWidth: 300 }}
        />
        <Typography variant="caption" color="text.secondary">
          {totalCount} vendor{totalCount !== 1 ? "s" : ""}
        </Typography>
      </Box>

      {/* Data Table with Server-Side Pagination */}
      <DataTable
        columns={columns}
        data={vendors}
        isLoading={isLoading}
        enableRowActions={canEdit}
        renderRowActions={renderRowActions}
        mobileHiddenColumns={["gst_number", "rating", "categories"]}
        initialState={{
          sorting: [{ id: "name", desc: false }],
        }}
        // Server-side pagination
        manualPagination={true}
        rowCount={totalCount}
        pagination={pagination}
        onPaginationChange={handlePaginationChange}
      />

      {/* Mobile FAB */}
      {isMobile && canEdit && (
        <Fab
          color="primary"
          sx={{ position: "fixed", bottom: 16, right: 16 }}
          onClick={() => handleOpenDialog()}
        >
          <AddIcon />
        </Fab>
      )}

      {/* Vendor Dialog */}
      <VendorDialog
        open={dialogOpen}
        onClose={handleCloseDialog}
        vendor={editingVendor}
        categories={categories}
      />
    </Box>
  );
}
