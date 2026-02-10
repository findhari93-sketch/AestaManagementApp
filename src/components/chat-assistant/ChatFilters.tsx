"use client";

import {
  Box,
  ToggleButton,
  ToggleButtonGroup,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  SelectChangeEvent,
} from "@mui/material";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { useSitesData } from "@/contexts/SiteContext";
import type { ChatFilters as ChatFiltersType } from "@/lib/chat-assistant/types";
import dayjs, { Dayjs } from "dayjs";

interface ChatFiltersProps {
  filters: ChatFiltersType;
  onChange: (filters: ChatFiltersType) => void;
}

export default function ChatFilters({ filters, onChange }: ChatFiltersProps) {
  const { sites } = useSitesData();

  const handleScopeChange = (
    _: React.MouseEvent<HTMLElement>,
    newScope: "site" | "all" | null
  ) => {
    if (newScope === null) return; // Ignore deselection

    if (newScope === "all") {
      onChange({ ...filters, siteId: "all" });
    }
    // Keep current siteId when switching to "This Site"
  };

  const handleSiteChange = (e: SelectChangeEvent<string>) => {
    onChange({ ...filters, siteId: e.target.value });
  };

  const handleDateFromChange = (date: Dayjs | null) => {
    onChange({ ...filters, dateFrom: date?.toDate() || null });
  };

  const handleDateToChange = (date: Dayjs | null) => {
    onChange({ ...filters, dateTo: date?.toDate() || null });
  };

  return (
    <Box
      sx={{
        p: 2,
        borderBottom: 1,
        borderColor: "divider",
        display: "flex",
        flexDirection: "column",
        gap: 1.5,
      }}
    >
      {/* Site Scope Toggle */}
      <ToggleButtonGroup
        value={filters.siteId === "all" ? "all" : "site"}
        exclusive
        onChange={handleScopeChange}
        size="small"
        fullWidth
        sx={{
          "& .MuiToggleButton-root": {
            textTransform: "none",
            py: 0.75,
          },
        }}
      >
        <ToggleButton value="site">This Site</ToggleButton>
        <ToggleButton value="all">All Sites</ToggleButton>
      </ToggleButtonGroup>

      {/* Site Selector (when "This Site" selected) */}
      {filters.siteId !== "all" && (
        <FormControl fullWidth size="small">
          <InputLabel id="chat-site-select-label">Site</InputLabel>
          <Select
            labelId="chat-site-select-label"
            value={filters.siteId}
            label="Site"
            onChange={handleSiteChange}
          >
            {sites.map((site) => (
              <MenuItem key={site.id} value={site.id}>
                {site.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      )}

      {/* Date Range */}
      <Box sx={{ display: "flex", gap: 1 }}>
        <DatePicker
          label="From"
          value={filters.dateFrom ? dayjs(filters.dateFrom) : null}
          onChange={handleDateFromChange}
          slotProps={{
            textField: {
              size: "small",
              fullWidth: true,
            },
          }}
        />
        <DatePicker
          label="To"
          value={filters.dateTo ? dayjs(filters.dateTo) : null}
          onChange={handleDateToChange}
          slotProps={{
            textField: {
              size: "small",
              fullWidth: true,
            },
          }}
        />
      </Box>
    </Box>
  );
}
