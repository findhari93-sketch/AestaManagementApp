"use client";

import { useState, useMemo } from "react";
import {
  Box,
  Grid,
  TextField,
  InputAdornment,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Typography,
  Alert,
  Button,
} from "@mui/material";
import {
  Search as SearchIcon,
  Sort as SortIcon,
  Add as AddIcon,
  Storefront as EmptyStoreIcon,
} from "@mui/icons-material";
import ProductCard, { ProductCardSkeleton } from "./ProductCard";
import CategoryFilterTabs from "./CategoryFilterTabs";
import {
  useStoreCatalog,
  useStoreCategoriesWithCounts,
  filterStoreCatalog,
} from "@/hooks/queries/useStoreCatalog";
import type { StoreCatalogItem, StoreCatalogFilter, MaterialCategory } from "@/types/material.types";

interface CategoryWithCount extends Omit<MaterialCategory, 'display_order'> {
  display_order: number | null;
  productCount: number;
}

interface StoreCatalogGridProps {
  vendorId: string;
  vendorName: string;
  onProductClick?: (product: StoreCatalogItem) => void;
  onAddProduct?: () => void;
}

type SortOption = StoreCatalogFilter["sortBy"];

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "name", label: "Name (A-Z)" },
  { value: "price_asc", label: "Price: Low to High" },
  { value: "price_desc", label: "Price: High to Low" },
  { value: "recent", label: "Recently Updated" },
];

export default function StoreCatalogGrid({
  vendorId,
  vendorName,
  onProductClick,
  onAddProduct,
}: StoreCatalogGridProps) {
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("name");

  const {
    data: products = [],
    isLoading: productsLoading,
    error: productsError,
  } = useStoreCatalog(vendorId);

  const {
    data: rawCategories = [],
    isLoading: categoriesLoading,
  } = useStoreCategoriesWithCounts(vendorId);

  // Cast categories to the expected type
  const categories: CategoryWithCount[] = rawCategories as CategoryWithCount[];

  // Filter and sort products
  const filteredProducts = useMemo(() => {
    return filterStoreCatalog(products, {
      categoryId: selectedCategoryId,
      searchQuery,
      sortBy,
    });
  }, [products, selectedCategoryId, searchQuery, sortBy]);

  const isLoading = productsLoading || categoriesLoading;

  if (productsError) {
    return (
      <Alert severity="error" sx={{ m: 2 }}>
        Failed to load store catalog. Please try again later.
      </Alert>
    );
  }

  return (
    <Box>
      {/* Category Filter Tabs */}
      <CategoryFilterTabs
        categories={categories}
        selectedCategoryId={selectedCategoryId}
        onCategoryChange={setSelectedCategoryId}
        totalCount={products.length}
        isLoading={categoriesLoading}
      />

      {/* Search and Sort Controls */}
      <Box
        display="flex"
        gap={2}
        mb={2}
        flexWrap="wrap"
        alignItems="center"
      >
        <TextField
          size="small"
          placeholder="Search products..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          sx={{ flexGrow: 1, minWidth: 200 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon color="action" />
              </InputAdornment>
            ),
          }}
        />

        <FormControl size="small" sx={{ minWidth: 160 }}>
          <InputLabel>Sort by</InputLabel>
          <Select
            value={sortBy}
            label="Sort by"
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            startAdornment={
              <InputAdornment position="start">
                <SortIcon color="action" fontSize="small" />
              </InputAdornment>
            }
          >
            {SORT_OPTIONS.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {onAddProduct && (
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={onAddProduct}
            sx={{ whiteSpace: "nowrap" }}
          >
            Add Product
          </Button>
        )}
      </Box>

      {/* Results Count */}
      <Typography variant="body2" color="text.secondary" mb={2}>
        {isLoading
          ? "Loading products..."
          : `${filteredProducts.length} product${filteredProducts.length !== 1 ? "s" : ""} found`}
      </Typography>

      {/* Product Grid */}
      {isLoading ? (
        <Grid container spacing={2}>
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <Grid size={{ xs: 6, sm: 4, md: 3, lg: 2 }} key={i}>
              <ProductCardSkeleton />
            </Grid>
          ))}
        </Grid>
      ) : filteredProducts.length === 0 ? (
        <EmptyState
          hasProducts={products.length > 0}
          searchQuery={searchQuery}
          onAddProduct={onAddProduct}
          vendorName={vendorName}
        />
      ) : (
        <Grid container spacing={2}>
          {filteredProducts.map((product) => (
            <Grid size={{ xs: 6, sm: 4, md: 3, lg: 2 }} key={product.id}>
              <ProductCard
                product={product}
                onClick={() => onProductClick?.(product)}
              />
            </Grid>
          ))}
        </Grid>
      )}
    </Box>
  );
}

// Empty state component
function EmptyState({
  hasProducts,
  searchQuery,
  onAddProduct,
  vendorName,
}: {
  hasProducts: boolean;
  searchQuery: string;
  onAddProduct?: () => void;
  vendorName: string;
}) {
  if (hasProducts && searchQuery) {
    // No results for search
    return (
      <Box
        display="flex"
        flexDirection="column"
        alignItems="center"
        justifyContent="center"
        py={8}
        px={2}
      >
        <SearchIcon sx={{ fontSize: 64, color: "grey.400", mb: 2 }} />
        <Typography variant="h6" color="text.secondary" gutterBottom>
          No products found
        </Typography>
        <Typography variant="body2" color="text.secondary" textAlign="center">
          No products match "{searchQuery}". Try a different search term.
        </Typography>
      </Box>
    );
  }

  // No products in store
  return (
    <Box
      display="flex"
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      py={8}
      px={2}
    >
      <EmptyStoreIcon sx={{ fontSize: 80, color: "grey.300", mb: 2 }} />
      <Typography variant="h6" color="text.secondary" gutterBottom>
        No products yet
      </Typography>
      <Typography
        variant="body2"
        color="text.secondary"
        textAlign="center"
        mb={3}
        maxWidth={400}
      >
        {vendorName} doesn't have any products in their catalog yet.
        Add your first product to start building the store inventory.
      </Typography>
      {onAddProduct && (
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={onAddProduct}
        >
          Add First Product
        </Button>
      )}
    </Box>
  );
}
