"use client";

import {
  Box,
  Paper,
  Typography,
  Stack,
  Chip,
  Button,
  LinearProgress,
  Alert,
} from "@mui/material";
import {
  CheckCircle as ValidIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  Download as DownloadIcon,
} from "@mui/icons-material";
import { ParseResult, MassUploadTableName } from "@/types/mass-upload.types";
import { exportFailedRowsToCSV } from "@/lib/mass-upload/csvParser";

interface ValidationSummaryProps {
  parseResult: ParseResult;
  tableName: MassUploadTableName;
  showActions?: boolean;
  onRemoveInvalidRows?: () => void;
}

export function ValidationSummary({
  parseResult,
  tableName,
  showActions = true,
  onRemoveInvalidRows,
}: ValidationSummaryProps) {
  const { totalRows, validRows, warningRows, errorRows } = parseResult;
  const validPercentage = totalRows > 0 ? (validRows / totalRows) * 100 : 0;

  const handleDownloadErrors = () => {
    const csv = exportFailedRowsToCSV(parseResult, tableName);
    if (!csv) return;

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${tableName}_errors.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <Paper sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom>
        Validation Summary
      </Typography>

      {/* Progress Bar */}
      <Box mb={2}>
        <Stack direction="row" justifyContent="space-between" mb={1}>
          <Typography variant="body2" color="text.secondary">
            {validRows} of {totalRows} rows valid
          </Typography>
          <Typography variant="body2" fontWeight="medium">
            {validPercentage.toFixed(0)}%
          </Typography>
        </Stack>
        <LinearProgress
          variant="determinate"
          value={validPercentage}
          color={errorRows > 0 ? "error" : warningRows > 0 ? "warning" : "success"}
          sx={{ height: 8, borderRadius: 4 }}
        />
      </Box>

      {/* Status Chips */}
      <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap mb={2}>
        <Chip
          icon={<ValidIcon />}
          label={`${validRows} Valid`}
          color="success"
          variant={validRows > 0 ? "filled" : "outlined"}
        />
        {warningRows > 0 && (
          <Chip
            icon={<WarningIcon />}
            label={`${warningRows} Warnings`}
            color="warning"
            variant="filled"
          />
        )}
        {errorRows > 0 && (
          <Chip
            icon={<ErrorIcon />}
            label={`${errorRows} Errors`}
            color="error"
            variant="filled"
          />
        )}
      </Stack>

      {/* Status Messages */}
      {errorRows === 0 && warningRows === 0 && validRows > 0 && (
        <Alert severity="success" sx={{ mb: 2 }}>
          All {validRows} rows passed validation and are ready to import.
        </Alert>
      )}

      {errorRows > 0 && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {errorRows} row{errorRows > 1 ? "s have" : " has"} errors and cannot be
          imported. Fix the errors or remove invalid rows to continue.
        </Alert>
      )}

      {warningRows > 0 && errorRows === 0 && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {warningRows} row{warningRows > 1 ? "s have" : " has"} warnings but can
          still be imported. Review the warnings before proceeding.
        </Alert>
      )}

      {/* Actions */}
      {showActions && errorRows > 0 && (
        <Stack direction="row" spacing={2}>
          <Button
            variant="outlined"
            color="error"
            startIcon={<DownloadIcon />}
            onClick={handleDownloadErrors}
            size="small"
          >
            Download Error Rows
          </Button>
          {onRemoveInvalidRows && (
            <Button
              variant="outlined"
              color="warning"
              onClick={onRemoveInvalidRows}
              size="small"
            >
              Remove Invalid Rows ({errorRows})
            </Button>
          )}
        </Stack>
      )}
    </Paper>
  );
}

export default ValidationSummary;
