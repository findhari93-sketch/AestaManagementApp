"use client";

import { useMemo, useState } from "react";
import {
  Box,
  Paper,
  Typography,
  IconButton,
  Tooltip,
  TextField,
  Chip,
  Stack,
  Pagination,
  Button,
  Alert,
} from "@mui/material";
import {
  CheckCircle as ValidIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  Delete as DeleteIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
  Info as SampleIcon,
  SkipNext as SkipIcon,
} from "@mui/icons-material";
import {
  ParseResult,
  ParsedRow,
  MassUploadTableName,
  ValidationError,
} from "@/types/mass-upload.types";
import { getTableConfig } from "@/lib/mass-upload/tableConfigs";

interface DataPreviewTableProps {
  parseResult: ParseResult;
  tableName: MassUploadTableName;
  onRowUpdate: (rowNumber: number, field: string, value: string) => void;
  onRowDelete: (rowNumber: number) => void;
  onToggleSkipRow?: (rowNumber: number) => void;
  onSkipAllSampleRows?: () => void;
  pageSize?: number;
}

export function DataPreviewTable({
  parseResult,
  tableName,
  onRowUpdate,
  onRowDelete,
  onToggleSkipRow,
  onSkipAllSampleRows,
  pageSize = 10,
}: DataPreviewTableProps) {
  const config = getTableConfig(tableName);
  const [page, setPage] = useState(1);
  const [editingCell, setEditingCell] = useState<{
    rowNumber: number;
    field: string;
  } | null>(null);
  const [editValue, setEditValue] = useState("");

  const headers = config?.fields.map((f) => f.csvHeader) || [];

  // Count sample rows and skipped rows
  const sampleRowCount = parseResult.rows.filter(r => r.isSampleRow).length;
  const skippedRowCount = parseResult.rows.filter(r => r.isSkipped).length;
  const activeRowCount = parseResult.rows.filter(r => !r.isSkipped).length;

  // Paginate rows
  const totalPages = Math.ceil(parseResult.rows.length / pageSize);
  const paginatedRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return parseResult.rows.slice(start, start + pageSize);
  }, [parseResult.rows, page, pageSize]);

  const handleStartEdit = (rowNumber: number, field: string, value: string) => {
    setEditingCell({ rowNumber, field });
    setEditValue(value || "");
  };

  const handleSaveEdit = () => {
    if (editingCell) {
      onRowUpdate(editingCell.rowNumber, editingCell.field, editValue);
      setEditingCell(null);
      setEditValue("");
    }
  };

  const handleCancelEdit = () => {
    setEditingCell(null);
    setEditValue("");
  };

  const getStatusIcon = (row: ParsedRow) => {
    if (row.isSkipped) {
      return <SkipIcon color="disabled" fontSize="small" />;
    }
    if (row.isSampleRow) {
      return <SampleIcon color="info" fontSize="small" />;
    }
    switch (row.status) {
      case "valid":
        return <ValidIcon color="success" fontSize="small" />;
      case "warning":
        return <WarningIcon color="warning" fontSize="small" />;
      case "error":
        return <ErrorIcon color="error" fontSize="small" />;
    }
  };

  const getStatusTooltip = (row: ParsedRow) => {
    if (row.isSkipped) return "Skipped - will not be imported";
    if (row.isSampleRow) return "Sample row - click skip to exclude from import";
    if (row.errors.length > 0) return row.errors.map((e) => e.message).join("\n");
    return row.status;
  };

  const getRowBackground = (row: ParsedRow) => {
    if (row.isSkipped) return "#f5f5f5";
    if (row.isSampleRow) return "#e3f2fd";
    if (row.status === "error") return "#ffebee";
    if (row.status === "warning") return "#fff8e1";
    return "transparent";
  };

  const getErrorForField = (
    row: ParsedRow,
    csvHeader: string
  ): ValidationError | undefined => {
    return row.errors.find((e) => e.csvHeader === csvHeader);
  };

  if (!config) {
    return <Typography>No configuration found for table: {tableName}</Typography>;
  }

  return (
    <Paper sx={{ overflow: "hidden" }}>
      {/* Header */}
      <Box sx={{ p: 2, borderBottom: 1, borderColor: "divider" }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Box>
            <Typography variant="subtitle1" fontWeight="bold">
              Data Preview ({parseResult.rows.length} rows)
            </Typography>
            <Stack direction="row" spacing={1} mt={0.5}>
              <Chip
                size="small"
                label={`${activeRowCount} to import`}
                color="primary"
                variant="outlined"
              />
              {sampleRowCount > 0 && (
                <Chip
                  size="small"
                  icon={<SampleIcon />}
                  label={`${sampleRowCount} sample`}
                  color="info"
                  variant="outlined"
                />
              )}
              {skippedRowCount > 0 && (
                <Chip
                  size="small"
                  icon={<SkipIcon />}
                  label={`${skippedRowCount} skipped`}
                  color="default"
                  variant="outlined"
                />
              )}
            </Stack>
          </Box>
          {sampleRowCount > 0 && onSkipAllSampleRows && (
            <Button
              size="small"
              variant="outlined"
              startIcon={<SkipIcon />}
              onClick={onSkipAllSampleRows}
            >
              Skip All Sample Rows
            </Button>
          )}
        </Stack>
      </Box>

      {/* Sample Row Alert */}
      {sampleRowCount > 0 && (
        <Alert severity="info" sx={{ mx: 2, mt: 1, mb: 0 }}>
          <Typography variant="body2">
            <strong>{sampleRowCount} sample row(s) detected</strong> - These are example rows
            from the template. You can skip them to exclude from import, or delete them.
          </Typography>
        </Alert>
      )}

      {/* Table */}
      <Box sx={{ overflowX: "auto" }}>
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: "0.875rem",
          }}
        >
          <thead>
            <tr style={{ backgroundColor: "#f5f5f5" }}>
              <th
                style={{
                  padding: "12px 8px",
                  textAlign: "center",
                  borderBottom: "2px solid #ddd",
                  width: 50,
                }}
              >
                #
              </th>
              <th
                style={{
                  padding: "12px 8px",
                  textAlign: "center",
                  borderBottom: "2px solid #ddd",
                  width: 60,
                }}
              >
                Status
              </th>
              {headers.map((header) => (
                <th
                  key={header}
                  style={{
                    padding: "12px 8px",
                    textAlign: "left",
                    borderBottom: "2px solid #ddd",
                    whiteSpace: "nowrap",
                  }}
                >
                  {header}
                </th>
              ))}
              <th
                style={{
                  padding: "12px 8px",
                  textAlign: "center",
                  borderBottom: "2px solid #ddd",
                  width: 100,
                }}
              >
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {paginatedRows.map((row) => (
              <tr
                key={row.rowNumber}
                style={{
                  backgroundColor: getRowBackground(row),
                  opacity: row.isSkipped ? 0.6 : 1,
                  textDecoration: row.isSkipped ? "line-through" : "none",
                }}
              >
                <td
                  style={{
                    padding: "8px",
                    textAlign: "center",
                    borderBottom: "1px solid #eee",
                    color: "#666",
                  }}
                >
                  <Stack direction="row" alignItems="center" justifyContent="center" spacing={0.5}>
                    <span>{row.rowNumber}</span>
                    {row.isSampleRow && (
                      <Chip
                        label="Sample"
                        size="small"
                        color="info"
                        variant="outlined"
                        sx={{ fontSize: "0.65rem", height: 18 }}
                      />
                    )}
                  </Stack>
                </td>
                <td
                  style={{
                    padding: "8px",
                    textAlign: "center",
                    borderBottom: "1px solid #eee",
                  }}
                >
                  <Tooltip title={getStatusTooltip(row)}>
                    <span>{getStatusIcon(row)}</span>
                  </Tooltip>
                </td>
                {headers.map((header) => {
                  const value = row.originalData[header] || "";
                  const error = getErrorForField(row, header);
                  const isEditing =
                    editingCell?.rowNumber === row.rowNumber &&
                    editingCell?.field === header;

                  return (
                    <td
                      key={header}
                      style={{
                        padding: "4px 8px",
                        borderBottom: "1px solid #eee",
                        backgroundColor: error && !row.isSkipped ? "#ffcdd2" : "transparent",
                        maxWidth: 200,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {isEditing ? (
                        <Stack direction="row" spacing={0.5} alignItems="center">
                          <TextField
                            size="small"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            autoFocus
                            sx={{ minWidth: 100 }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleSaveEdit();
                              if (e.key === "Escape") handleCancelEdit();
                            }}
                          />
                          <IconButton size="small" onClick={handleSaveEdit}>
                            <SaveIcon fontSize="small" color="primary" />
                          </IconButton>
                          <IconButton size="small" onClick={handleCancelEdit}>
                            <CancelIcon fontSize="small" />
                          </IconButton>
                        </Stack>
                      ) : (
                        <Stack
                          direction="row"
                          spacing={0.5}
                          alignItems="center"
                          sx={{ cursor: row.isSkipped ? "default" : "pointer" }}
                          onClick={() => {
                            if (!row.isSkipped) {
                              handleStartEdit(row.rowNumber, header, value);
                            }
                          }}
                        >
                          <Tooltip title={value || "(empty)"}>
                            <Typography
                              variant="body2"
                              noWrap
                              sx={{
                                maxWidth: 150,
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                              }}
                            >
                              {value || "-"}
                            </Typography>
                          </Tooltip>
                          {error && !row.isSkipped && (
                            <Tooltip title={error.message}>
                              <ErrorIcon
                                color="error"
                                sx={{ fontSize: 14, ml: 0.5 }}
                              />
                            </Tooltip>
                          )}
                        </Stack>
                      )}
                    </td>
                  );
                })}
                <td
                  style={{
                    padding: "8px",
                    textAlign: "center",
                    borderBottom: "1px solid #eee",
                  }}
                >
                  <Stack direction="row" spacing={0.5} justifyContent="center">
                    {onToggleSkipRow && (
                      <Tooltip title={row.isSkipped ? "Include row" : "Skip row"}>
                        <IconButton
                          size="small"
                          color={row.isSkipped ? "primary" : "default"}
                          onClick={() => onToggleSkipRow(row.rowNumber)}
                        >
                          <SkipIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                    <Tooltip title="Delete row">
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => onRowDelete(row.rowNumber)}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Stack>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Box>

      {/* Pagination */}
      {totalPages > 1 && (
        <Box
          sx={{
            p: 2,
            display: "flex",
            justifyContent: "center",
            borderTop: 1,
            borderColor: "divider",
          }}
        >
          <Pagination
            count={totalPages}
            page={page}
            onChange={(_, newPage) => setPage(newPage)}
            color="primary"
          />
        </Box>
      )}

      {/* Error Summary */}
      {parseResult.errorRows > 0 && (
        <Box sx={{ p: 2, borderTop: 1, borderColor: "divider", bgcolor: "#fff3e0" }}>
          <Typography variant="subtitle2" color="error" gutterBottom>
            Error Details:
          </Typography>
          <Stack spacing={0.5}>
            {parseResult.rows
              .filter((r) => r.status === "error" && !r.isSkipped)
              .slice(0, 5)
              .map((row) => (
                <Typography key={row.rowNumber} variant="caption">
                  Row {row.rowNumber}: {row.errors.map((e) => e.message).join(", ")}
                </Typography>
              ))}
            {parseResult.errorRows > 5 && (
              <Typography variant="caption" color="text.secondary">
                ...and {parseResult.errorRows - 5} more errors
              </Typography>
            )}
          </Stack>
        </Box>
      )}
    </Paper>
  );
}

export default DataPreviewTable;
