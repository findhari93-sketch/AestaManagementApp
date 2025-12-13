"use client";

import { useState } from "react";
import {
  Box,
  Paper,
  Typography,
  Stack,
  Card,
  CardContent,
  CardActionArea,
  Chip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
} from "@mui/material";
import {
  People as AttendanceIcon,
  Groups as MarketLaborIcon,
  Receipt as ExpenseIcon,
  Payment as PaymentIcon,
  Person as LaborerIcon,
  AccountBalance as AdvanceIcon,
  Description as ContractIcon,
} from "@mui/icons-material";
import { MassUploadTableName } from "@/types/mass-upload.types";
import { getAvailableTables, getTableConfig } from "@/lib/mass-upload/tableConfigs";

interface TableSelectorProps {
  selectedTable: MassUploadTableName | null;
  onSelectTable: (tableName: MassUploadTableName) => void;
  selectedSiteId: string | null;
  onSelectSite: (siteId: string) => void;
  sites: Array<{ id: string; name: string }>;
}

const TABLE_ICONS: Record<string, React.ReactNode> = {
  daily_attendance: <AttendanceIcon sx={{ fontSize: 40 }} />,
  market_laborer_attendance: <MarketLaborIcon sx={{ fontSize: 40 }} />,
  expenses: <ExpenseIcon sx={{ fontSize: 40 }} />,
  labor_payments: <PaymentIcon sx={{ fontSize: 40 }} />,
  laborers: <LaborerIcon sx={{ fontSize: 40 }} />,
  advances: <AdvanceIcon sx={{ fontSize: 40 }} />,
  subcontracts: <ContractIcon sx={{ fontSize: 40 }} />,
};

export function TableSelector({
  selectedTable,
  onSelectTable,
  selectedSiteId,
  onSelectSite,
  sites,
}: TableSelectorProps) {
  const availableTables = getAvailableTables();

  // Group tables by whether they require site context
  const siteSpecificTables = availableTables.filter((t) =>
    t.requiredContext.includes("site_id")
  );
  const globalTables = availableTables.filter(
    (t) => !t.requiredContext.includes("site_id")
  );

  const handleTableSelect = (tableName: MassUploadTableName) => {
    const config = getTableConfig(tableName);
    // If table doesn't require site, clear site selection
    if (config && !config.requiredContext.includes("site_id")) {
      onSelectSite("");
    }
    onSelectTable(tableName);
  };

  const selectedConfig = selectedTable ? getTableConfig(selectedTable) : null;
  const requiresSite = selectedConfig?.requiredContext.includes("site_id");

  return (
    <Box>
      {/* Site Selector */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Select Site
        </Typography>
        <Typography variant="body2" color="text.secondary" mb={2}>
          Most data uploads are site-specific. Select the site for your upload.
        </Typography>

        <FormControl fullWidth>
          <InputLabel>Site</InputLabel>
          <Select
            value={selectedSiteId || ""}
            label="Site"
            onChange={(e) => onSelectSite(e.target.value)}
          >
            {sites.map((site) => (
              <MenuItem key={site.id} value={site.id}>
                {site.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {requiresSite && !selectedSiteId && (
          <Alert severity="info" sx={{ mt: 2 }}>
            Please select a site to upload {selectedConfig?.displayName} data.
          </Alert>
        )}
      </Paper>

      {/* Table Selector */}
      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          Select Data Type
        </Typography>
        <Typography variant="body2" color="text.secondary" mb={3}>
          Choose the type of data you want to upload.
        </Typography>

        {/* Site-specific tables */}
        {siteSpecificTables.length > 0 && (
          <>
            <Typography variant="subtitle2" color="text.secondary" mb={2}>
              Site-Specific Data
            </Typography>
            <Stack
              direction="row"
              spacing={2}
              flexWrap="wrap"
              useFlexGap
              mb={3}
            >
              {siteSpecificTables.map((table) => (
                <Card
                  key={table.tableName}
                  sx={{
                    width: 180,
                    border: 2,
                    borderColor:
                      selectedTable === table.tableName
                        ? "primary.main"
                        : "transparent",
                    transition: "all 0.2s",
                  }}
                >
                  <CardActionArea
                    onClick={() =>
                      handleTableSelect(table.tableName as MassUploadTableName)
                    }
                    disabled={!selectedSiteId}
                    sx={{
                      opacity: !selectedSiteId ? 0.5 : 1,
                    }}
                  >
                    <CardContent>
                      <Stack alignItems="center" spacing={1}>
                        <Box color="primary.main">
                          {TABLE_ICONS[table.tableName] || (
                            <ContractIcon sx={{ fontSize: 40 }} />
                          )}
                        </Box>
                        <Typography
                          variant="subtitle2"
                          textAlign="center"
                          fontWeight={
                            selectedTable === table.tableName ? "bold" : "normal"
                          }
                        >
                          {table.displayName}
                        </Typography>
                        <Chip
                          label={`${table.fields.filter((f) => f.required).length} required`}
                          size="small"
                          variant="outlined"
                        />
                      </Stack>
                    </CardContent>
                  </CardActionArea>
                </Card>
              ))}
            </Stack>
          </>
        )}

        {/* Global tables */}
        {globalTables.length > 0 && (
          <>
            <Typography variant="subtitle2" color="text.secondary" mb={2}>
              Global Data (No Site Required)
            </Typography>
            <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
              {globalTables.map((table) => (
                <Card
                  key={table.tableName}
                  sx={{
                    width: 180,
                    border: 2,
                    borderColor:
                      selectedTable === table.tableName
                        ? "primary.main"
                        : "transparent",
                    transition: "all 0.2s",
                  }}
                >
                  <CardActionArea
                    onClick={() =>
                      handleTableSelect(table.tableName as MassUploadTableName)
                    }
                  >
                    <CardContent>
                      <Stack alignItems="center" spacing={1}>
                        <Box color="primary.main">
                          {TABLE_ICONS[table.tableName] || (
                            <ContractIcon sx={{ fontSize: 40 }} />
                          )}
                        </Box>
                        <Typography
                          variant="subtitle2"
                          textAlign="center"
                          fontWeight={
                            selectedTable === table.tableName ? "bold" : "normal"
                          }
                        >
                          {table.displayName}
                        </Typography>
                        <Chip
                          label={`${table.fields.filter((f) => f.required).length} required`}
                          size="small"
                          variant="outlined"
                        />
                      </Stack>
                    </CardContent>
                  </CardActionArea>
                </Card>
              ))}
            </Stack>
          </>
        )}
      </Paper>

      {/* Selected Table Details */}
      {selectedConfig && (
        <Paper sx={{ p: 3, mt: 3, backgroundColor: "primary.50" }}>
          <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
            {selectedConfig.displayName}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {selectedConfig.description}
          </Typography>
        </Paper>
      )}
    </Box>
  );
}

export default TableSelector;
