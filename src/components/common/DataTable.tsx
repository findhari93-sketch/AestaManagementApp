"use client";

import { useMemo } from "react";
import {
  MaterialReactTable,
  type MRT_ColumnDef,
  type MRT_RowData,
  type MRT_TableOptions,
} from "material-react-table";
import { Box, useTheme, useMediaQuery } from "@mui/material";

// Default table configuration - centralized for entire app
export const tableDefaults = {
  // Density settings
  enableDensityToggle: false,
  density: "compact" as const,

  // Column features
  enableColumnActions: true,
  enableColumnFilters: true,
  enableSorting: true,
  enableColumnResizing: true,
  enableColumnOrdering: true, // Allow column rearrangement
  enableColumnPinning: true, // Allow freezing columns

  // Row features
  enableRowSelection: false,
  enableRowNumbers: false,

  // Global filter/search
  enableGlobalFilter: true,
  enableGlobalFilterModes: false,
  globalFilterFn: "contains" as const,
  positionGlobalFilter: "right" as const,

  // Toolbar features
  enableFullScreenToggle: true,
  enableHiding: true,
  enableFilters: true,

  // Pagination
  enablePagination: true,
  paginationDisplayMode: "pages" as const,

  // Layout
  layoutMode: "semantic" as const,
  enableStickyHeader: true,

  // Initial state
  initialState: {
    density: "compact" as const,
    showColumnFilters: false,
    showGlobalFilter: true,
    pagination: {
      pageSize: 20,
      pageIndex: 0,
    },
    columnPinning: {
      right: ["mrt-row-actions"], // Pin actions column to the right by default
    },
  },

  // Pagination options
  muiPaginationProps: {
    rowsPerPageOptions: [10, 20, 50, 100],
    showFirstButton: true,
    showLastButton: true,
  },
};

// Props interface for DataTable component
interface DataTableProps<TData extends MRT_RowData>
  extends Partial<MRT_TableOptions<TData>> {
  columns: MRT_ColumnDef<TData>[];
  data: TData[];
  isLoading?: boolean;
  // Override default pagination
  pageSize?: number;
  // Enable/disable features
  enableActions?: boolean;
  enableSelection?: boolean;
  // Custom styling
  maxHeight?: string | number;
  minHeight?: string | number;
  // Mobile-specific props
  pinnedColumns?: {
    left?: string[];
    right?: string[];
  };
  // Ultra-compact mode for mobile
  compactMode?: boolean;
  // Columns to hide on mobile (by accessorKey)
  mobileHiddenColumns?: string[];
}

export default function DataTable<TData extends MRT_RowData>({
  columns,
  data,
  isLoading = false,
  pageSize,
  enableActions = false,
  enableSelection = false,
  maxHeight,
  minHeight,
  pinnedColumns,
  compactMode = true, // Default to compact on mobile
  mobileHiddenColumns = [],
  ...otherProps
}: DataTableProps<TData>) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.down('md'));
  const useCompact = compactMode && isMobile;

  // Build column visibility for mobile
  const mobileColumnVisibility = useMemo(() => {
    if (!isMobile || mobileHiddenColumns.length === 0) return {};
    return Object.fromEntries(
      mobileHiddenColumns.map((col) => [col, false])
    );
  }, [isMobile, mobileHiddenColumns]);

  // Merge initial state with custom pagination, pinned columns, and column visibility
  const initialState = useMemo(
    () => ({
      ...tableDefaults.initialState,
      ...(pageSize && {
        pagination: {
          pageSize: isMobile ? Math.min(pageSize, 15) : pageSize,
          pageIndex: 0,
        },
      }),
      // Apply pinned columns - auto-pin first column on mobile if not specified
      columnPinning: {
        left: pinnedColumns?.left || [],
        right: pinnedColumns?.right || ['mrt-row-actions'],
      },
      // Hide specified columns on mobile
      columnVisibility: {
        ...mobileColumnVisibility,
        ...(otherProps.initialState?.columnVisibility || {}),
      },
      ...(otherProps.initialState || {}),
    }),
    [pageSize, pinnedColumns, mobileColumnVisibility, isMobile, otherProps.initialState]
  );

  // Table container styles with ultra-compact mobile optimization
  const muiTableContainerProps = useMemo(
    () => ({
      sx: {
        maxHeight: maxHeight || (useCompact ? "calc(100vh - 260px)" : isTablet ? "calc(100vh - 300px)" : "calc(100vh - 280px)"),
        minHeight: minHeight || (useCompact ? 250 : 350),
        overflowX: 'auto',
        WebkitOverflowScrolling: 'touch',
        // Visible scrollbar for mobile
        '&::-webkit-scrollbar': {
          height: useCompact ? 6 : 8,
          width: useCompact ? 6 : 8,
        },
        '&::-webkit-scrollbar-track': {
          backgroundColor: theme.palette.action.hover,
          borderRadius: 3,
        },
        '&::-webkit-scrollbar-thumb': {
          backgroundColor: theme.palette.action.disabled,
          borderRadius: 3,
          '&:hover': {
            backgroundColor: theme.palette.action.active,
          },
        },
        ...((otherProps.muiTableContainerProps as any)?.sx || {}),
      },
    }),
    [maxHeight, minHeight, useCompact, isTablet, theme.palette, otherProps.muiTableContainerProps]
  );

  // Paper styles for the table wrapper
  const muiTablePaperProps = useMemo(
    () => ({
      elevation: 0,
      sx: {
        borderRadius: useCompact ? 1 : 2,
        border: `1px solid ${theme.palette.divider}`,
        overflow: 'hidden',
        ...((otherProps.muiTablePaperProps as any)?.sx || {}),
      },
    }),
    [theme.palette.divider, useCompact, otherProps.muiTablePaperProps]
  );

  // Table head cell styles - ultra-compact on mobile
  const muiTableHeadCellProps = useMemo(
    () => ({
      sx: {
        fontWeight: 700,
        backgroundColor: theme.palette.background.default,
        fontSize: useCompact ? "0.65rem" : isTablet ? "0.75rem" : "0.8rem",
        py: useCompact ? 0.5 : isTablet ? 0.75 : 1,
        px: useCompact ? 0.75 : isTablet ? 1 : 1.5,
        whiteSpace: 'nowrap',
        lineHeight: 1.2,
        '& .Mui-TableHeadCell-Content': {
          justifyContent: 'flex-start',
        },
        '& .Mui-TableHeadCell-Content-Labels': {
          gap: 0.25,
        },
        '& .Mui-TableHeadCell-Content-Wrapper': {
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        },
        ...((otherProps.muiTableHeadCellProps as any)?.sx || {}),
      },
    }),
    [theme.palette.background.default, useCompact, isTablet, otherProps.muiTableHeadCellProps]
  );

  // Table body cell styles - ultra-compact on mobile
  const muiTableBodyCellProps = useMemo(
    () => ({
      sx: {
        fontSize: useCompact ? "0.7rem" : isTablet ? "0.75rem" : "0.8rem",
        py: useCompact ? 0.25 : isTablet ? 0.5 : 0.75,
        px: useCompact ? 0.75 : isTablet ? 1 : 1.5,
        lineHeight: 1.3,
        '& .MuiChip-root': {
          height: useCompact ? 18 : 22,
          fontSize: useCompact ? '0.6rem' : '0.7rem',
          '& .MuiChip-label': {
            px: useCompact ? 0.5 : 0.75,
          },
        },
        '& .MuiIconButton-root': {
          padding: useCompact ? 0.25 : 0.5,
          '& .MuiSvgIcon-root': {
            fontSize: useCompact ? '1rem' : '1.15rem',
          },
        },
        ...((otherProps.muiTableBodyCellProps as any)?.sx || {}),
      },
    }),
    [useCompact, isTablet, otherProps.muiTableBodyCellProps]
  );

  // Top toolbar styles - compact on mobile
  const muiTopToolbarProps = useMemo(
    () => ({
      sx: {
        backgroundColor: theme.palette.background.paper,
        minHeight: useCompact ? 40 : 48,
        px: useCompact ? 0.5 : 1,
        py: useCompact ? 0.25 : 0.5,
        '& .MuiBox-root': {
          gap: useCompact ? 0.25 : 0.5,
        },
        '& .MuiIconButton-root': {
          padding: useCompact ? 0.5 : 1,
        },
        '& .MuiInputBase-root': {
          fontSize: useCompact ? '0.75rem' : '0.875rem',
          height: useCompact ? 32 : 40,
        },
        ...((otherProps.muiTopToolbarProps as any)?.sx || {}),
      },
    }),
    [theme.palette.background.paper, useCompact, otherProps.muiTopToolbarProps]
  );

  // Bottom toolbar styles - compact on mobile
  const muiBottomToolbarProps = useMemo(
    () => ({
      sx: {
        backgroundColor: theme.palette.background.paper,
        minHeight: useCompact ? 36 : 48,
        px: useCompact ? 0.5 : 1,
        '& .MuiTablePagination-root': {
          overflow: 'hidden',
        },
        '& .MuiTablePagination-toolbar': {
          minHeight: useCompact ? 36 : 48,
          px: useCompact ? 0 : 1,
        },
        '& .MuiTablePagination-selectLabel': {
          display: useCompact ? 'none' : 'block',
          fontSize: '0.75rem',
        },
        '& .MuiTablePagination-displayedRows': {
          fontSize: useCompact ? '0.65rem' : '0.75rem',
          margin: 0,
        },
        '& .MuiTablePagination-select': {
          fontSize: useCompact ? '0.7rem' : '0.8rem',
        },
        '& .MuiTablePagination-actions': {
          ml: useCompact ? 0 : 1,
          '& .MuiIconButton-root': {
            padding: useCompact ? 0.25 : 0.5,
          },
        },
        ...((otherProps.muiBottomToolbarProps as any)?.sx || {}),
      },
    }),
    [theme.palette.background.paper, useCompact, otherProps.muiBottomToolbarProps]
  );

  // Search box styles - compact
  const muiSearchTextFieldProps = useMemo(
    () => ({
      size: 'small' as const,
      variant: 'outlined' as const,
      sx: {
        '& .MuiInputBase-root': {
          fontSize: useCompact ? '0.75rem' : '0.875rem',
          py: 0,
        },
        '& .MuiInputBase-input': {
          py: useCompact ? 0.5 : 0.75,
          px: useCompact ? 1 : 1.5,
        },
        minWidth: useCompact ? 120 : 180,
        maxWidth: useCompact ? 160 : 250,
      },
    }),
    [useCompact]
  );

  // Table row styles
  const muiTableBodyRowProps = useMemo(
    () => ({
      sx: {
        '&:hover': {
          backgroundColor: theme.palette.action.hover,
        },
      },
    }),
    [theme.palette.action.hover]
  );

  // Pagination props - simplified for mobile
  const muiPaginationProps = useMemo(
    () => ({
      rowsPerPageOptions: useCompact ? [10, 15, 25] : [10, 20, 50, 100],
      showFirstButton: !useCompact,
      showLastButton: !useCompact,
      size: useCompact ? 'small' as const : 'medium' as const,
    }),
    [useCompact]
  );

  const tableContent = (
    <MaterialReactTable
      columns={columns}
      data={data}
      // Spread all defaults
      {...tableDefaults}
      // State
      state={{
        isLoading,
        ...(otherProps.state || {}),
      }}
      // Merged initial state
      initialState={initialState}
      // Row selection if enabled
      enableRowSelection={enableSelection}
      // Disable features on mobile for performance
      enableColumnOrdering={!useCompact}
      enableColumnResizing={!useCompact}
      enableFullScreenToggle={!useCompact}
      // Styling props
      muiTableContainerProps={muiTableContainerProps}
      muiTablePaperProps={muiTablePaperProps}
      muiTableHeadCellProps={muiTableHeadCellProps}
      muiTableBodyCellProps={muiTableBodyCellProps}
      muiTableBodyRowProps={muiTableBodyRowProps}
      muiTopToolbarProps={muiTopToolbarProps}
      muiBottomToolbarProps={muiBottomToolbarProps}
      muiSearchTextFieldProps={muiSearchTextFieldProps}
      muiPaginationProps={muiPaginationProps}
      // Spread any additional props (allows full customization)
      {...otherProps}
    />
  );

  // Wrap in scroll indicator container for mobile
  if (useCompact) {
    return (
      <Box
        sx={{
          position: 'relative',
          '&::after': {
            content: '""',
            position: 'absolute',
            right: 0,
            top: 40, // Below toolbar
            bottom: 36, // Above pagination
            width: 12,
            background: `linear-gradient(to right, transparent, ${theme.palette.action.hover})`,
            pointerEvents: 'none',
            opacity: 0.7,
            borderRadius: '0 4px 4px 0',
          },
        }}
      >
        {tableContent}
      </Box>
    );
  }

  return tableContent;
}

// Re-export types for convenience
export type { MRT_ColumnDef, MRT_RowData, MRT_TableOptions };
