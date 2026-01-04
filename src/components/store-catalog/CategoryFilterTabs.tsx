"use client";

import { Box, Tabs, Tab, Chip, Skeleton } from "@mui/material";
import {
  Category as CategoryIcon,
  ElectricalServices as ElectricalIcon,
  Plumbing as PlumbingIcon,
  Construction as CivilIcon,
  FormatPaint as PaintIcon,
  Hardware as HardwareIcon,
  DoorFront as DoorIcon,
  ViewModule as TilesIcon,
  AllInclusive as AllIcon,
} from "@mui/icons-material";
interface CategoryWithCount {
  id: string;
  name: string;
  code: string | null;
  productCount: number;
}

interface CategoryFilterTabsProps {
  categories: CategoryWithCount[];
  selectedCategoryId: string | null;
  onCategoryChange: (categoryId: string | null) => void;
  totalCount: number;
  isLoading?: boolean;
}

// Map category codes to icons
const getCategoryIcon = (code: string | null): React.ReactElement => {
  if (!code) return <CategoryIcon fontSize="small" />;

  const iconMap: Record<string, React.ReactElement> = {
    ELC: <ElectricalIcon fontSize="small" />,
    PLB: <PlumbingIcon fontSize="small" />,
    CEM: <CivilIcon fontSize="small" />,
    STL: <CivilIcon fontSize="small" />,
    AGG: <CivilIcon fontSize="small" />,
    BRK: <CivilIcon fontSize="small" />,
    PNT: <PaintIcon fontSize="small" />,
    HRD: <HardwareIcon fontSize="small" />,
    DW: <DoorIcon fontSize="small" />,
    TIL: <TilesIcon fontSize="small" />,
  };

  return iconMap[code] || <CategoryIcon fontSize="small" />;
};

export default function CategoryFilterTabs({
  categories,
  selectedCategoryId,
  onCategoryChange,
  totalCount,
  isLoading = false,
}: CategoryFilterTabsProps) {
  if (isLoading) {
    return <CategoryFilterTabsSkeleton />;
  }

  const handleChange = (_: React.SyntheticEvent, value: string | null) => {
    onCategoryChange(value === "all" ? null : value);
  };

  return (
    <Box
      sx={{
        borderBottom: 1,
        borderColor: "divider",
        mb: 2,
        bgcolor: "background.paper",
        position: "sticky",
        top: 0,
        zIndex: 1,
      }}
    >
      <Tabs
        value={selectedCategoryId || "all"}
        onChange={handleChange}
        variant="scrollable"
        scrollButtons="auto"
        allowScrollButtonsMobile
        sx={{
          minHeight: 48,
          "& .MuiTab-root": {
            minHeight: 48,
            textTransform: "none",
            fontWeight: 500,
          },
        }}
      >
        {/* All Categories Tab */}
        <Tab
          value="all"
          icon={<AllIcon fontSize="small" />}
          iconPosition="start"
          label={
            <Box display="flex" alignItems="center" gap={0.5}>
              All
              <Chip
                size="small"
                label={totalCount}
                sx={{
                  height: 20,
                  fontSize: "0.7rem",
                  fontWeight: 600,
                  bgcolor: selectedCategoryId === null ? "primary.main" : "grey.200",
                  color: selectedCategoryId === null ? "white" : "text.primary",
                }}
              />
            </Box>
          }
        />

        {/* Category Tabs */}
        {categories.map((category) => (
          <Tab
            key={category.id}
            value={category.id}
            icon={getCategoryIcon(category.code)}
            iconPosition="start"
            label={
              <Box display="flex" alignItems="center" gap={0.5}>
                {category.name}
                <Chip
                  size="small"
                  label={category.productCount}
                  sx={{
                    height: 20,
                    fontSize: "0.7rem",
                    fontWeight: 600,
                    bgcolor:
                      selectedCategoryId === category.id
                        ? "primary.main"
                        : "grey.200",
                    color:
                      selectedCategoryId === category.id
                        ? "white"
                        : "text.primary",
                  }}
                />
              </Box>
            }
          />
        ))}
      </Tabs>
    </Box>
  );
}

function CategoryFilterTabsSkeleton() {
  return (
    <Box
      sx={{
        borderBottom: 1,
        borderColor: "divider",
        mb: 2,
        p: 1,
        display: "flex",
        gap: 2,
        overflowX: "auto",
      }}
    >
      {[1, 2, 3, 4, 5].map((i) => (
        <Skeleton
          key={i}
          variant="rectangular"
          width={100}
          height={36}
          sx={{ borderRadius: 1 }}
        />
      ))}
    </Box>
  );
}
