"use client";

import { useState, useCallback } from "react";
import {
  Box,
  Stepper,
  Step,
  StepLabel,
  Button,
  Stack,
  Alert,
  Typography,
} from "@mui/material";
import {
  ArrowBack as BackIcon,
  ArrowForward as NextIcon,
  Upload as ImportIcon,
} from "@mui/icons-material";
import {
  MassUploadTableName,
  ParseResult,
  WizardStep,
  ImportProgress,
  ImportResult,
  ValidateResponse,
} from "@/types/mass-upload.types";
import { getTableConfig } from "@/lib/mass-upload/tableConfigs";
import {
  toggleRowSkip,
  skipAllSampleRows,
  deleteRow,
  updateRowCell,
  getRowsForImport,
} from "@/lib/mass-upload/csvParser";
import { TableSelector } from "./TableSelector";
import { TemplateDownloader } from "./TemplateDownloader";
import { CSVUploader } from "./CSVUploader";
import { ValidationSummary } from "./ValidationSummary";
import { DataPreviewTable } from "./DataPreviewTable";
import { ImportProgressDialog } from "./ImportProgressDialog";

interface MassUploadWizardProps {
  sites: Array<{ id: string; name: string }>;
  userId: string;
  userName: string;
}

const STEPS: { key: WizardStep; label: string }[] = [
  { key: "select-table", label: "Select Data Type" },
  { key: "upload", label: "Upload CSV" },
  { key: "preview", label: "Review & Edit" },
  { key: "import", label: "Import" },
];

export function MassUploadWizard({
  sites,
  userId,
  userName,
}: MassUploadWizardProps) {
  const [activeStep, setActiveStep] = useState(0);
  const [selectedTable, setSelectedTable] = useState<MassUploadTableName | null>(null);
  const [selectedSiteId, setSelectedSiteId] = useState<string>("");
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [importProgress, setImportProgress] = useState<ImportProgress>({
    status: "idle",
    currentRow: 0,
    totalRows: 0,
    successCount: 0,
    errorCount: 0,
  });
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  const currentStep = STEPS[activeStep].key;
  const config = selectedTable ? getTableConfig(selectedTable) : null;
  const requiresSite = config?.requiredContext.includes("site_id");

  // Get counts excluding skipped rows
  const getImportableRowCount = useCallback(() => {
    if (!parseResult) return 0;
    return parseResult.rows.filter(
      (r) => !r.isSkipped && (r.status === "valid" || r.status === "warning")
    ).length;
  }, [parseResult]);

  // Check if can proceed to next step
  const canProceed = useCallback(() => {
    switch (currentStep) {
      case "select-table":
        if (!selectedTable) return false;
        if (requiresSite && !selectedSiteId) return false;
        return true;
      case "upload":
        return parseResult !== null && parseResult.totalRows > 0;
      case "preview":
        return getImportableRowCount() > 0;
      case "import":
        return false; // No next step
      default:
        return false;
    }
  }, [currentStep, selectedTable, selectedSiteId, requiresSite, parseResult, getImportableRowCount]);

  // Handle next step
  const handleNext = async () => {
    setError(null);

    // Validate with server before moving to preview
    if (currentStep === "upload" && parseResult) {
      setIsValidating(true);
      try {
        // Only validate non-skipped rows
        const rowsToValidate = parseResult.rows
          .filter((r) => !r.isSkipped)
          .map((r) => r.originalData);

        const response = await fetch("/api/mass-upload/validate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tableName: selectedTable,
            siteId: selectedSiteId,
            rows: rowsToValidate,
          }),
        });

        const data: ValidateResponse = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data.lookupErrors?.[0]?.message || "Validation failed");
        }

        // Merge server validation results with existing rows, preserving skip status
        const updatedRows = parseResult.rows.map((row) => {
          if (row.isSkipped) return row;
          const serverRow = data.parsedRows.find((pr) => pr.rowNumber === row.rowNumber);
          if (serverRow) {
            return {
              ...serverRow,
              isSkipped: row.isSkipped,
              isSampleRow: row.isSampleRow,
            };
          }
          return row;
        });

        setParseResult({
          ...parseResult,
          rows: updatedRows,
          validRows: updatedRows.filter((r) => r.status === "valid" && !r.isSkipped).length,
          warningRows: updatedRows.filter((r) => r.status === "warning" && !r.isSkipped).length,
          errorRows: updatedRows.filter((r) => r.status === "error" && !r.isSkipped).length,
        });
      } catch (err) {
        console.error("Validation error:", err);
        // Continue anyway - server validation is optional
      } finally {
        setIsValidating(false);
      }
    }

    setActiveStep((prev) => Math.min(prev + 1, STEPS.length - 1));
  };

  // Handle back
  const handleBack = () => {
    setError(null);
    setActiveStep((prev) => Math.max(prev - 1, 0));
  };

  // Handle reset
  const handleReset = () => {
    setActiveStep(0);
    setSelectedTable(null);
    setSelectedSiteId("");
    setUploadedFile(null);
    setParseResult(null);
    setError(null);
    setImportResult(null);
    setImportProgress({
      status: "idle",
      currentRow: 0,
      totalRows: 0,
      successCount: 0,
      errorCount: 0,
    });
  };

  // Handle CSV parse complete
  const handleParseComplete = (result: ParseResult, file: File) => {
    setParseResult(result);
    setUploadedFile(file);
    setError(null);
  };

  // Handle row update in preview
  const handleRowUpdate = (rowNumber: number, field: string, value: string) => {
    if (!parseResult) return;
    setParseResult(updateRowCell(parseResult, rowNumber, field, value));
  };

  // Handle row delete in preview
  const handleRowDelete = (rowNumber: number) => {
    if (!parseResult) return;
    setParseResult(deleteRow(parseResult, rowNumber));
  };

  // Handle toggle skip row
  const handleToggleSkipRow = (rowNumber: number) => {
    if (!parseResult) return;
    setParseResult(toggleRowSkip(parseResult, rowNumber));
  };

  // Handle skip all sample rows
  const handleSkipAllSampleRows = () => {
    if (!parseResult) return;
    setParseResult(skipAllSampleRows(parseResult));
  };

  // Handle remove all invalid rows
  const handleRemoveInvalidRows = () => {
    if (!parseResult) return;

    const validRows = parseResult.rows.filter((r) => r.status !== "error" || r.isSkipped);
    setParseResult({
      ...parseResult,
      rows: validRows,
      totalRows: validRows.length,
      validRows: validRows.filter((r) => r.status === "valid" && !r.isSkipped).length,
      warningRows: validRows.filter((r) => r.status === "warning" && !r.isSkipped).length,
      errorRows: 0,
    });
  };

  // Handle import
  const handleImport = async () => {
    if (!parseResult || !selectedTable) return;

    const rowsToImport = getRowsForImport(parseResult);
    const importableRows = rowsToImport.filter(
      (r) => r.status === "valid" || r.status === "warning"
    );

    setShowImportDialog(true);
    setImportProgress({
      status: "importing",
      currentRow: 0,
      totalRows: importableRows.length,
      successCount: 0,
      errorCount: 0,
    });

    try {
      const response = await fetch("/api/mass-upload/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tableName: selectedTable,
          siteId: selectedSiteId,
          rows: importableRows.map((r) => r.transformedData),
          userId,
          userName,
        }),
      });

      const result: ImportResult = await response.json();

      setImportResult(result);
      setImportProgress({
        status: result.success ? "completed" : "error",
        currentRow: result.summary.total,
        totalRows: result.summary.total,
        successCount: result.summary.inserted + result.summary.updated,
        errorCount: result.summary.errors,
        message: result.success
          ? `Successfully imported ${result.summary.inserted} records`
          : "Import completed with errors",
      });
    } catch (err) {
      console.error("Import error:", err);
      setImportProgress({
        status: "error",
        currentRow: 0,
        totalRows: importableRows.length,
        successCount: 0,
        errorCount: importableRows.length,
        message: err instanceof Error ? err.message : "Import failed",
      });
    }
  };

  const importableRowCount = getImportableRowCount();

  return (
    <Box>
      {/* Stepper */}
      <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
        {STEPS.map((step, index) => (
          <Step key={step.key} completed={index < activeStep}>
            <StepLabel>{step.label}</StepLabel>
          </Step>
        ))}
      </Stepper>

      {/* Error Alert */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Step Content */}
      <Box mb={4}>
        {currentStep === "select-table" && (
          <TableSelector
            selectedTable={selectedTable}
            onSelectTable={setSelectedTable}
            selectedSiteId={selectedSiteId}
            onSelectSite={setSelectedSiteId}
            sites={sites}
          />
        )}

        {currentStep === "upload" && selectedTable && (
          <Stack spacing={3}>
            <TemplateDownloader tableName={selectedTable} />
            <CSVUploader
              tableName={selectedTable}
              onParseComplete={handleParseComplete}
              onError={setError}
            />
            {parseResult && (
              <ValidationSummary
                parseResult={parseResult}
                tableName={selectedTable}
                showActions={false}
              />
            )}
          </Stack>
        )}

        {currentStep === "preview" && selectedTable && parseResult && (
          <Stack spacing={3}>
            <ValidationSummary
              parseResult={parseResult}
              tableName={selectedTable}
              onRemoveInvalidRows={handleRemoveInvalidRows}
            />
            <DataPreviewTable
              parseResult={parseResult}
              tableName={selectedTable}
              onRowUpdate={handleRowUpdate}
              onRowDelete={handleRowDelete}
              onToggleSkipRow={handleToggleSkipRow}
              onSkipAllSampleRows={handleSkipAllSampleRows}
            />
          </Stack>
        )}

        {currentStep === "import" && parseResult && (
          <Stack spacing={3} alignItems="center">
            <Typography variant="h6">
              Ready to import {importableRowCount} rows
            </Typography>
            <Typography color="text.secondary">
              Click the Import button to start importing data to the database.
              {parseResult.rows.filter((r) => r.isSkipped).length > 0 && (
                <><br />({parseResult.rows.filter((r) => r.isSkipped).length} rows will be skipped)</>
              )}
            </Typography>
            <Button
              variant="contained"
              size="large"
              startIcon={<ImportIcon />}
              onClick={handleImport}
              disabled={importableRowCount === 0}
            >
              Import {importableRowCount} Rows
            </Button>
          </Stack>
        )}
      </Box>

      {/* Navigation Buttons */}
      <Stack direction="row" justifyContent="space-between">
        <Button
          variant="outlined"
          startIcon={<BackIcon />}
          onClick={activeStep === 0 ? handleReset : handleBack}
          disabled={isValidating}
        >
          {activeStep === 0 ? "Reset" : "Back"}
        </Button>

        {currentStep !== "import" && (
          <Button
            variant="contained"
            endIcon={<NextIcon />}
            onClick={handleNext}
            disabled={!canProceed() || isValidating}
          >
            {isValidating ? "Validating..." : "Next"}
          </Button>
        )}
      </Stack>

      {/* Import Progress Dialog */}
      <ImportProgressDialog
        open={showImportDialog}
        onClose={() => {
          setShowImportDialog(false);
          if (importResult?.success) {
            handleReset();
          }
        }}
        progress={importProgress}
        result={importResult}
      />
    </Box>
  );
}

export default MassUploadWizard;
