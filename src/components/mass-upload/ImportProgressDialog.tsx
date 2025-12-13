"use client";

import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  LinearProgress,
  Box,
  Stack,
  Chip,
  Alert,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
} from "@mui/material";
import {
  CheckCircle as SuccessIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
} from "@mui/icons-material";
import { ImportProgress, ImportResult } from "@/types/mass-upload.types";

interface ImportProgressDialogProps {
  open: boolean;
  onClose: () => void;
  progress: ImportProgress;
  result: ImportResult | null;
  onRetry?: () => void;
  onViewData?: () => void;
}

export function ImportProgressDialog({
  open,
  onClose,
  progress,
  result,
  onRetry,
  onViewData,
}: ImportProgressDialogProps) {
  const isComplete = progress.status === "completed" || progress.status === "error";
  const percentComplete =
    progress.totalRows > 0
      ? (progress.currentRow / progress.totalRows) * 100
      : 0;

  const getStatusColor = () => {
    if (progress.status === "error") return "error";
    if (progress.status === "completed") return "success";
    return "primary";
  };

  return (
    <Dialog open={open} maxWidth="sm" fullWidth>
      <DialogTitle>
        {progress.status === "idle" && "Preparing Import..."}
        {progress.status === "validating" && "Validating Data..."}
        {progress.status === "importing" && "Importing Data..."}
        {progress.status === "completed" && "Import Complete"}
        {progress.status === "error" && "Import Failed"}
      </DialogTitle>

      <DialogContent>
        {/* Progress Bar */}
        {!isComplete && (
          <Box mb={3}>
            <Stack direction="row" justifyContent="space-between" mb={1}>
              <Typography variant="body2" color="text.secondary">
                {progress.message || `Processing row ${progress.currentRow} of ${progress.totalRows}`}
              </Typography>
              <Typography variant="body2" fontWeight="medium">
                {percentComplete.toFixed(0)}%
              </Typography>
            </Stack>
            <LinearProgress
              variant="determinate"
              value={percentComplete}
              color={getStatusColor()}
              sx={{ height: 10, borderRadius: 5 }}
            />
          </Box>
        )}

        {/* Status Summary */}
        {progress.status === "importing" && (
          <Stack direction="row" spacing={2} mb={2}>
            <Chip
              icon={<SuccessIcon />}
              label={`${progress.successCount} Imported`}
              color="success"
              variant="outlined"
            />
            {progress.errorCount > 0 && (
              <Chip
                icon={<ErrorIcon />}
                label={`${progress.errorCount} Failed`}
                color="error"
                variant="outlined"
              />
            )}
          </Stack>
        )}

        {/* Result Summary */}
        {result && (
          <Box>
            {result.success ? (
              <Alert severity="success" sx={{ mb: 2 }}>
                Import completed successfully!
              </Alert>
            ) : (
              <Alert severity="error" sx={{ mb: 2 }}>
                Import completed with errors.
              </Alert>
            )}

            <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap mb={2}>
              <Chip
                label={`${result.summary.total} Total`}
                variant="outlined"
              />
              <Chip
                icon={<SuccessIcon />}
                label={`${result.summary.inserted} Inserted`}
                color="success"
                variant={result.summary.inserted > 0 ? "filled" : "outlined"}
              />
              {result.summary.updated > 0 && (
                <Chip
                  icon={<WarningIcon />}
                  label={`${result.summary.updated} Updated`}
                  color="info"
                  variant="filled"
                />
              )}
              {result.summary.skipped > 0 && (
                <Chip
                  label={`${result.summary.skipped} Skipped`}
                  variant="outlined"
                />
              )}
              {result.summary.errors > 0 && (
                <Chip
                  icon={<ErrorIcon />}
                  label={`${result.summary.errors} Failed`}
                  color="error"
                  variant="filled"
                />
              )}
            </Stack>

            {/* Error Details */}
            {result.errors.length > 0 && (
              <Box>
                <Typography variant="subtitle2" color="error" gutterBottom>
                  Error Details:
                </Typography>
                <List dense sx={{ maxHeight: 150, overflow: "auto" }}>
                  {result.errors.slice(0, 10).map((err, index) => (
                    <ListItem key={index} disableGutters>
                      <ListItemIcon sx={{ minWidth: 32 }}>
                        <ErrorIcon color="error" fontSize="small" />
                      </ListItemIcon>
                      <ListItemText
                        primary={`Row ${err.rowNumber}: ${err.error}`}
                        primaryTypographyProps={{ variant: "caption" }}
                      />
                    </ListItem>
                  ))}
                  {result.errors.length > 10 && (
                    <ListItem disableGutters>
                      <ListItemText
                        primary={`...and ${result.errors.length - 10} more errors`}
                        primaryTypographyProps={{
                          variant: "caption",
                          color: "text.secondary",
                        }}
                      />
                    </ListItem>
                  )}
                </List>
              </Box>
            )}
          </Box>
        )}

        {/* Error Message */}
        {progress.status === "error" && !result && (
          <Alert severity="error">
            {progress.message || "An error occurred during import."}
          </Alert>
        )}
      </DialogContent>

      <DialogActions>
        {isComplete && (
          <>
            {result?.summary.errors && result.summary.errors > 0 && onRetry && (
              <Button onClick={onRetry} color="warning">
                Retry Failed Rows
              </Button>
            )}
            {onViewData && result?.summary.inserted && result.summary.inserted > 0 && (
              <Button onClick={onViewData} color="primary">
                View Imported Data
              </Button>
            )}
            <Button onClick={onClose} variant="contained">
              Close
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
}

export default ImportProgressDialog;
