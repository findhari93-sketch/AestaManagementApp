"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  TextField,
  Typography,
  Stack,
  Checkbox,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Avatar,
  CircularProgress,
  IconButton,
  InputAdornment,
} from "@mui/material";
import {
  Search as SearchIcon,
  Close as CloseIcon,
} from "@mui/icons-material";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { wrapQueryFn } from "@/lib/utils/timeout";

export interface PickerLaborer {
  id: string;
  name: string;
  categoryName: string | null;
  teamName: string | null;
}

interface MidLaborerPickerDialogProps {
  open: boolean;
  onClose: () => void;
  /**
   * IDs that are already part of the entry (pre-checked on dialog open).
   */
  preSelectedIds: Set<string>;
  /**
   * Called with the full laborer rows (id+name+meta) of all laborers the user
   * confirmed. Caller should reconcile with prior selection itself.
   */
  onConfirm: (selected: PickerLaborer[]) => void;
}

/**
 * Lighter cousin of LaborerSelectionDialog — for Mid-mode day entry.
 * No rate / workDays state, just multi-select with name+category+team meta.
 * Returns full row objects so the caller can render chips with names without
 * refetching.
 */
export function MidLaborerPickerDialog({
  open,
  onClose,
  preSelectedIds,
  onConfirm,
}: MidLaborerPickerDialogProps) {
  const supabase = createClient();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [teamFilter, setTeamFilter] = useState<string>("all");
  const [picked, setPicked] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (open) {
      setPicked(new Set(preSelectedIds));
      setSearch("");
      setCategoryFilter("all");
      setTeamFilter("all");
    }
  }, [open, preSelectedIds]);

  const { data: laborers, isLoading } = useQuery({
    queryKey: ["mid-laborer-picker"],
    enabled: open,
    staleTime: 60 * 1000,
    queryFn: wrapQueryFn(async (): Promise<PickerLaborer[]> => {
      const sb = supabase as any;
      const { data, error } = await sb
        .from("laborers")
        .select(
          "id, name, labor_categories:category_id(name), teams:team_id(name)"
        )
        .eq("status", "active")
        .order("name");
      if (error) throw error;
      return ((data ?? []) as Array<{
        id: string;
        name: string;
        labor_categories: { name: string } | null;
        teams: { name: string } | null;
      }>).map((r) => ({
        id: r.id,
        name: r.name,
        categoryName: r.labor_categories?.name ?? null,
        teamName: r.teams?.name ?? null,
      }));
    }, { operationName: "useMidLaborerPicker" }),
  });

  const filtered = useMemo(() => {
    if (!laborers) return [] as PickerLaborer[];
    const q = search.trim().toLowerCase();
    return laborers.filter((l) => {
      if (categoryFilter !== "all" && l.categoryName !== categoryFilter) return false;
      if (teamFilter !== "all" && l.teamName !== teamFilter) return false;
      if (q) {
        const hay = `${l.name} ${l.categoryName ?? ""} ${l.teamName ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [laborers, search, categoryFilter, teamFilter]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const l of laborers ?? []) if (l.categoryName) set.add(l.categoryName);
    return Array.from(set).sort();
  }, [laborers]);

  const teams = useMemo(() => {
    const set = new Set<string>();
    for (const l of laborers ?? []) if (l.teamName) set.add(l.teamName);
    return Array.from(set).sort();
  }, [laborers]);

  const toggle = (id: string) => {
    setPicked((curr) => {
      const next = new Set(curr);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleConfirm = () => {
    const selectedRows = (laborers ?? []).filter((l) => picked.has(l.id));
    onConfirm(selectedRows);
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", pr: 1 }}>
        Add laborers to today
        <IconButton size="small" onClick={onClose}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        {/* Filters */}
        <Stack spacing={1.5} sx={{ mb: 2 }}>
          <TextField
            size="small"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, team, or category"
            fullWidth
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
            }}
          />
          <Stack direction="row" spacing={1}>
            <FormControl size="small" sx={{ flex: 1 }}>
              <InputLabel>Category</InputLabel>
              <Select
                label="Category"
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
              >
                <MenuItem value="all">All categories</MenuItem>
                {categories.map((c) => (
                  <MenuItem key={c} value={c}>
                    {c}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ flex: 1 }}>
              <InputLabel>Team</InputLabel>
              <Select
                label="Team"
                value={teamFilter}
                onChange={(e) => setTeamFilter(e.target.value)}
              >
                <MenuItem value="all">All teams</MenuItem>
                {teams.map((t) => (
                  <MenuItem key={t} value={t}>
                    {t}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Stack>
        </Stack>

        {/* List */}
        {isLoading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
            <CircularProgress size={24} />
          </Box>
        ) : filtered.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: "center", py: 4 }}>
            No laborers match the filters.
          </Typography>
        ) : (
          <Stack spacing={0.5} sx={{ maxHeight: 360, overflowY: "auto" }}>
            {filtered.map((l) => {
              const checked = picked.has(l.id);
              return (
                <Box
                  key={l.id}
                  onClick={() => toggle(l.id)}
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 1,
                    p: 1,
                    borderRadius: 1,
                    cursor: "pointer",
                    bgcolor: checked ? "primary.50" : "transparent",
                    "&:hover": { bgcolor: checked ? "primary.50" : "action.hover" },
                    border: 1,
                    borderColor: checked ? "primary.main" : "divider",
                  }}
                >
                  <Checkbox checked={checked} size="small" sx={{ p: 0.5 }} />
                  <Avatar sx={{ width: 32, height: 32, fontSize: "0.8rem" }}>
                    {l.name[0]?.toUpperCase()}
                  </Avatar>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="body2" fontWeight={600} noWrap>
                      {l.name}
                    </Typography>
                    <Stack direction="row" spacing={0.5}>
                      {l.categoryName && (
                        <Chip
                          label={l.categoryName}
                          size="small"
                          sx={{ height: 18, fontSize: "0.6rem" }}
                        />
                      )}
                      {l.teamName && (
                        <Chip
                          label={l.teamName}
                          size="small"
                          variant="outlined"
                          sx={{ height: 18, fontSize: "0.6rem" }}
                        />
                      )}
                    </Stack>
                  </Box>
                </Box>
              );
            })}
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Typography variant="caption" color="text.secondary" sx={{ flex: 1, ml: 2 }}>
          {picked.size} selected
        </Typography>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleConfirm} disabled={picked.size === 0}>
          Add {picked.size > 0 ? `(${picked.size})` : ""}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
