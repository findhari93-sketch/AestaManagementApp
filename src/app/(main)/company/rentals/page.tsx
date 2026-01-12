"use client";

import { useState, useMemo, useCallback, useDeferredValue } from "react";
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
  Tabs,
  Tab,
  FormControl,
  Select,
  MenuItem,
  InputLabel,
  Snackbar,
  Alert,
} from "@mui/material";
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Search as SearchIcon,
} from "@mui/icons-material";
import DataTable, { type MRT_ColumnDef, type PaginationState } from "@/components/common/DataTable";
import PageHeader from "@/components/layout/PageHeader";
import { useAuth } from "@/contexts/AuthContext";
import { useIsMobile } from "@/hooks/useIsMobile";
import { hasEditPermission } from "@/lib/permissions";
import { formatCurrency, formatDate } from "@/lib/formatters";
import {
  usePaginatedRentalItems,
  useRentalCategories,
  useDeleteRentalItem,
} from "@/hooks/queries/useRentals";
import { RentalItemDialog } from "@/components/rentals";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import type { RentalItemWithDetails, RentalType } from "@/types/rental.types";
import {
  RENTAL_TYPE_LABELS,
  RENTAL_SOURCE_TYPE_LABELS,
  RENTAL_RATE_TYPE_LABELS,
} from "@/types/rental.types";

const RENTAL_TYPE_TABS: { id: RentalType | "all"; label: string }[] = [
  { id: "all", label: "All Items" },
  { id: "scaffolding", label: "Scaffolding" },
  { id: "shuttering", label: "Shuttering" },
  { id: "equipment", label: "Equipment" },
  { id: "other", label: "Other" },
];

type SortOption = "alphabetical" | "recently_added" | "by_rate";

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "alphabetical", label: "Alphabetical" },
  { value: "recently_added", label: "Recently Added" },
  { value: "by_rate", label: "By Daily Rate" },
];

export default function CompanyRentalsPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<RentalItemWithDetails | null>(null);
  const [selectedTab, setSelectedTab] = useState<RentalType | "all">("all");
  const [searchInput, setSearchInput] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("alphabetical");
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 50 });
  const [deleteConfirm, setDeleteConfirm] = useState<{
    open: boolean;
    item: RentalItemWithDetails | null;
  }>({ open: false, item: null });
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: "success" | "error";
  }>({ open: false, message: "", severity: "success" });

  const { userProfile } = useAuth();
  const isMobile = useIsMobile();
  const canEdit = hasEditPermission(userProfile?.role);

  // Debounce search
  const deferredSearch = useDeferredValue(searchInput);

  // Fetch data with server-side pagination
  const { data: paginatedData, isLoading } = usePaginatedRentalItems(
    pagination,
    selectedTab !== "all" ? selectedTab : undefined,
    deferredSearch.length >= 2 ? deferredSearch : undefined,
    sortBy
  );

  const rentalItems = paginatedData?.data || [];
  const totalCount = paginatedData?.totalCount || 0;

  const { data: categories = [] } = useRentalCategories();
  const deleteItem = useDeleteRentalItem();

  // Handle pagination change
  const handlePaginationChange = useCallback((newPagination: PaginationState) => {
    setPagination(newPagination);
  }, []);

  // Handle tab change - reset pagination
  const handleTabChange = useCallback((_event: React.SyntheticEvent, newValue: RentalType | "all") => {
    setSelectedTab(newValue);
    setPagination(prev => ({ ...prev, pageIndex: 0 }));
  }, []);

  // No need for client-side filtering since server handles it
  const filteredItems = rentalItems;

  const handleOpenDialog = useCallback((item?: RentalItemWithDetails) => {
    setEditingItem(item || null);
    setDialogOpen(true);
  }, []);

  const handleCloseDialog = useCallback(() => {
    setDialogOpen(false);
    setEditingItem(null);
  }, []);

  const handleDeleteClick = useCallback((item: RentalItemWithDetails) => {
    setDeleteConfirm({ open: true, item });
  }, []);

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteConfirm.item) return;
    const itemName = deleteConfirm.item.name;
    try {
      await deleteItem.mutateAsync(deleteConfirm.item.id);
      setDeleteConfirm({ open: false, item: null });
      setSnackbar({
        open: true,
        message: `"${itemName}" deleted successfully`,
        severity: "success",
      });
    } catch (error) {
      console.error("Failed to delete item:", error);
      setSnackbar({
        open: true,
        message: `Failed to delete: ${error instanceof Error ? error.message : "Unknown error"}`,
        severity: "error",
      });
    }
  }, [deleteConfirm.item, deleteItem]);

  const handleDeleteCancel = useCallback(() => {
    setDeleteConfirm({ open: false, item: null });
  }, []);

  // Table columns
  const columns = useMemo<MRT_ColumnDef<RentalItemWithDetails>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Item Name",
        size: 200,
        Cell: ({ row }) => (
          <Box>
            <Typography variant="body2" fontWeight={500}>
              {row.original.name}
            </Typography>
            {row.original.code && (
              <Typography variant="caption" color="text.secondary">
                {row.original.code}
              </Typography>
            )}
          </Box>
        ),
      },
      {
        accessorKey: "local_name",
        header: "Local Name",
        size: 150,
        Cell: ({ row }) =>
          row.original.local_name || (
            <Typography variant="caption" color="text.secondary">
              -
            </Typography>
          ),
      },
      {
        accessorKey: "source_type",
        header: "Source",
        size: 100,
        Cell: ({ row }) => (
          <Chip
            size="small"
            label={RENTAL_SOURCE_TYPE_LABELS[row.original.source_type] || "Store"}
            variant="outlined"
            color={row.original.source_type === "contractor" ? "secondary" : "default"}
          />
        ),
      },
      {
        accessorKey: "rental_type",
        header: "Type",
        size: 120,
        Cell: ({ row }) => (
          <Chip
            size="small"
            label={RENTAL_TYPE_LABELS[row.original.rental_type]}
            variant="outlined"
            color={
              row.original.rental_type === "scaffolding"
                ? "primary"
                : row.original.rental_type === "shuttering"
                  ? "secondary"
                  : row.original.rental_type === "equipment"
                    ? "warning"
                    : "default"
            }
          />
        ),
      },
      {
        accessorKey: "category",
        header: "Category",
        size: 140,
        Cell: ({ row }) =>
          row.original.category?.name || (
            <Typography variant="caption" color="text.secondary">
              -
            </Typography>
          ),
      },
      {
        accessorKey: "unit",
        header: "Unit",
        size: 80,
        Cell: ({ row }) => (
          <Typography variant="body2">{row.original.unit}</Typography>
        ),
      },
      {
        accessorKey: "default_daily_rate",
        header: "Default Rate",
        size: 120,
        Cell: ({ row }) =>
          row.original.default_daily_rate ? (
            <Box>
              <Typography variant="body2" fontWeight={500} color="primary">
                {formatCurrency(row.original.default_daily_rate)}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                /{RENTAL_RATE_TYPE_LABELS[row.original.rate_type] === "Hourly" ? "hr" : "day"}
              </Typography>
            </Box>
          ) : (
            <Typography variant="caption" color="text.secondary">
              -
            </Typography>
          ),
      },
      {
        accessorKey: "created_at",
        header: "Added",
        size: 100,
        Cell: ({ row }) => (
          <Typography variant="caption" color="text.secondary">
            {formatDate(row.original.created_at)}
          </Typography>
        ),
      },
    ],
    []
  );

  // Row actions
  const renderRowActions = useCallback(
    ({ row }: { row: { original: RentalItemWithDetails } }) => (
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
            onClick={() => handleDeleteClick(row.original)}
            disabled={!canEdit}
            color="error"
          >
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>
    ),
    [handleOpenDialog, handleDeleteClick, canEdit]
  );

  return (
    <Box>
      <PageHeader
        title="Rental Items Catalog"
        subtitle="Manage items available for rental (scaffolding, shuttering, equipment)"
        actions={
          !isMobile && canEdit ? (
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => handleOpenDialog()}
            >
              Add Item
            </Button>
          ) : null
        }
      />

      {/* Type Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: "divider", mb: 2 }}>
        <Tabs
          value={selectedTab}
          onChange={handleTabChange}
          variant={isMobile ? "scrollable" : "standard"}
          scrollButtons={isMobile ? "auto" : false}
          allowScrollButtonsMobile
        >
          {RENTAL_TYPE_TABS.map((tab) => (
            <Tab key={tab.id} value={tab.id} label={tab.label} />
          ))}
        </Tabs>
      </Box>

      {/* Search and Sort */}
      <Box
        sx={{
          display: "flex",
          gap: 2,
          mb: 2,
          flexDirection: isMobile ? "column" : "row",
          alignItems: isMobile ? "stretch" : "center",
        }}
      >
        <TextField
          size="small"
          placeholder="Search items (min 2 chars)..."
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
          sx={{ minWidth: 250, flex: 1 }}
        />
        <FormControl size="small" sx={{ minWidth: 180 }}>
          <InputLabel>Sort by</InputLabel>
          <Select
            value={sortBy}
            label="Sort by"
            onChange={(e) => {
              setSortBy(e.target.value as SortOption);
              setPagination(prev => ({ ...prev, pageIndex: 0 }));
            }}
          >
            {SORT_OPTIONS.map((opt) => (
              <MenuItem key={opt.value} value={opt.value}>
                {opt.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      {/* Count */}
      <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: "block" }}>
        {totalCount} item{totalCount !== 1 ? "s" : ""}
      </Typography>

      {/* Data Table with Server-Side Pagination */}
      <DataTable
        columns={columns}
        data={filteredItems}
        isLoading={isLoading}
        enableRowActions={canEdit}
        renderRowActions={renderRowActions}
        mobileHiddenColumns={["local_name", "source_type", "category", "created_at"]}
        enableSorting={false}
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

      {/* Item Dialog */}
      <RentalItemDialog
        open={dialogOpen}
        onClose={handleCloseDialog}
        item={editingItem}
      />

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={deleteConfirm.open}
        title="Delete Rental Item"
        message={`Are you sure you want to delete "${deleteConfirm.item?.name}"? This will hide it from the catalog.`}
        confirmText="Delete"
        confirmColor="error"
        isLoading={deleteItem.isPending}
        onConfirm={handleDeleteConfirm}
        onCancel={handleDeleteCancel}
      />

      {/* Feedback Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
          severity={snackbar.severity}
          variant="filled"
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
