"use client";

import { useMemo } from "react";
import {
  MaterialReactTable,
  type MRT_ColumnDef,
  type MRT_RowData,
  type MRT_TableOptions,
} from "material-react-table";
import { useTheme } from "@mui/material/styles";

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
  ...otherProps
}: DataTableProps<TData>) {
  const theme = useTheme();

  // Merge initial state with custom pagination if provided
  const initialState = useMemo(
    () => ({
      ...tableDefaults.initialState,
      ...(pageSize && {
        pagination: {
          pageSize,
          pageIndex: 0,
        },
      }),
      ...(otherProps.initialState || {}),
    }),
    [pageSize, otherProps.initialState]
  );

  // Table container styles
  const muiTableContainerProps = useMemo(
    () => ({
      sx: {
        maxHeight: maxHeight || "calc(100vh - 300px)",
        minHeight: minHeight || 400,
        ...((otherProps.muiTableContainerProps as any)?.sx || {}),
      },
    }),
    [maxHeight, minHeight, otherProps.muiTableContainerProps]
  );

  // Paper styles for the table wrapper
  const muiTablePaperProps = useMemo(
    () => ({
      elevation: 0,
      sx: {
        borderRadius: 2,
        border: `1px solid ${theme.palette.divider}`,
        ...((otherProps.muiTablePaperProps as any)?.sx || {}),
      },
    }),
    [theme.palette.divider, otherProps.muiTablePaperProps]
  );

  // Table head cell styles
  const muiTableHeadCellProps = useMemo(
    () => ({
      sx: {
        fontWeight: 600,
        backgroundColor: theme.palette.background.default,
        ...((otherProps.muiTableHeadCellProps as any)?.sx || {}),
      },
    }),
    [theme.palette.background.default, otherProps.muiTableHeadCellProps]
  );

  // Table body cell styles
  const muiTableBodyCellProps = useMemo(
    () => ({
      sx: {
        fontSize: "0.875rem",
        ...((otherProps.muiTableBodyCellProps as any)?.sx || {}),
      },
    }),
    [otherProps.muiTableBodyCellProps]
  );

  // Top toolbar styles
  const muiTopToolbarProps = useMemo(
    () => ({
      sx: {
        backgroundColor: theme.palette.background.paper,
        ...((otherProps.muiTopToolbarProps as any)?.sx || {}),
      },
    }),
    [theme.palette.background.paper, otherProps.muiTopToolbarProps]
  );

  // Bottom toolbar styles
  const muiBottomToolbarProps = useMemo(
    () => ({
      sx: {
        backgroundColor: theme.palette.background.paper,
        ...((otherProps.muiBottomToolbarProps as any)?.sx || {}),
      },
    }),
    [theme.palette.background.paper, otherProps.muiBottomToolbarProps]
  );

  return (
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
      // Styling props
      muiTableContainerProps={muiTableContainerProps}
      muiTablePaperProps={muiTablePaperProps}
      muiTableHeadCellProps={muiTableHeadCellProps}
      muiTableBodyCellProps={muiTableBodyCellProps}
      muiTopToolbarProps={muiTopToolbarProps}
      muiBottomToolbarProps={muiBottomToolbarProps}
      // Spread any additional props (allows full customization)
      {...otherProps}
    />
  );
}

// Re-export types for convenience
export type { MRT_ColumnDef, MRT_RowData, MRT_TableOptions };
