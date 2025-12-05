"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  Chip,
  Divider,
  Drawer,
  IconButton,
  LinearProgress,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
  CircularProgress,
} from "@mui/material";
import {
  Add,
  CheckCircle,
  Close,
  Edit,
  Save,
  WarningAmber,
  Delete,
} from "@mui/icons-material";
import { SupabaseClient } from "@supabase/supabase-js";
import type { PaymentPhase } from "@/types/database.types";

export type SitePlanUpdatePayload = {
  planName: string;
  totalAmount: number;
  phases: PaymentPhase[];
};

type Props = {
  open: boolean;
  onClose: () => void;
  supabase: SupabaseClient<any>;
  siteId: string;
  siteName?: string;
  onPlanUpdated?: (payload: SitePlanUpdatePayload) => void;
};

type EditablePhase = PaymentPhase & { isNew?: boolean };

export default function SitePaymentPlanDrawer({
  open,
  onClose,
  supabase,
  siteId,
  siteName,
  onPlanUpdated,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [planName, setPlanName] = useState("Payment Plan");
  const [contractValue, setContractValue] = useState(0);
  const [phases, setPhases] = useState<EditablePhase[]>([]);

  const totalPercentage = useMemo(
    () => phases.reduce((sum, p) => sum + (p.percentage || 0), 0),
    [phases]
  );

  const totalAmount = useMemo(
    () => phases.reduce((sum, p) => sum + (p.amount || 0), 0),
    [phases]
  );

  const percentageChipColor = useMemo(() => {
    if (totalPercentage === 100) return "success" as const;
    if (totalPercentage > 100) return "error" as const;
    return "warning" as const;
  }, [totalPercentage]);

  const loadPlan = useCallback(async () => {
    if (!siteId) return;
    setLoading(true);
    try {
      const [siteRes, milestonesRes] = await Promise.all([
        supabase
          .from("sites")
          .select("name, project_contract_value")
          .eq("id", siteId)
          .maybeSingle(),
        supabase
          .from("site_payment_milestones")
          .select("*")
          .eq("site_id", siteId)
          .order("sequence_order", { ascending: true }),
      ]);

      if (siteRes.error) throw siteRes.error;
      if (milestonesRes.error && milestonesRes.error.code !== "PGRST116")
        throw milestonesRes.error;

      const siteMeta = (siteRes.data || {}) as any;
      const normalized = (milestonesRes.data || []).map(
        (m: any, idx: number) => ({
          id: m.id,
          payment_plan_id: `site-${siteId}`,
          phase_name: m.milestone_name,
          description: m.milestone_description,
          percentage: m.percentage,
          amount: m.amount,
          expected_date: m.expected_date,
          sequence_order: m.sequence_order || idx + 1,
          is_milestone: true,
          construction_phase_id: null,
          notes: m.notes,
          created_at: m.created_at,
          updated_at: m.updated_at,
        })
      ) as EditablePhase[];

      setPlanName(
        siteMeta?.name ? `${siteMeta.name} Payment Plan` : "Payment Plan"
      );
      setContractValue(
        siteMeta?.project_contract_value ||
          normalized.reduce((sum, p) => sum + (p.amount || 0), 0)
      );
      setPhases(normalized);
    } catch (err) {
      console.error("Failed to load plan", err);
    } finally {
      setLoading(false);
    }
  }, [siteId, supabase]);

  useEffect(() => {
    if (open) {
      loadPlan();
      setEditing(false);
    }
  }, [open, loadPlan]);

  const handlePhaseChange = (
    id: string,
    key: keyof EditablePhase,
    value: string | number | null
  ) => {
    setPhases((prev) =>
      prev.map((p) => (p.id === id ? { ...p, [key]: value } : p))
    );
  };

  const handleAddPhase = () => {
    const nextSequence = (phases?.[phases.length - 1]?.sequence_order || 0) + 1;
    setPhases((prev) => [
      ...prev,
      {
        id: `temp-${Date.now()}`,
        payment_plan_id: `site-${siteId}`,
        phase_name: "New milestone",
        description: "",
        percentage: 0,
        amount: 0,
        expected_date: null,
        sequence_order: nextSequence,
        is_milestone: true,
        construction_phase_id: null,
        notes: null,
        created_at: "",
        updated_at: "",
        isNew: true,
      },
    ]);
  };

  const handleDeletePhase = (id: string) => {
    setPhases((prev) => prev.filter((p) => p.id !== id));
  };

  const handleSave = async () => {
    if (!siteId) return;
    setSaving(true);
    try {
      // Persist contract value on site
      await supabase
        .from("sites")
        .update({ project_contract_value: contractValue || null })
        .eq("id", siteId);

      // Replace milestones for this site
      await supabase
        .from("site_payment_milestones")
        .delete()
        .eq("site_id", siteId);

      const payload = phases.map((p, idx) => ({
        site_id: siteId,
        milestone_name: p.phase_name,
        milestone_description: p.description || null,
        percentage: p.percentage,
        amount: p.amount || (contractValue * (p.percentage || 0)) / 100,
        expected_date: p.expected_date || null,
        sequence_order: p.sequence_order || idx + 1,
        status: "pending" as const,
        notes: p.notes || null,
      }));

      const { data: inserted, error } = await supabase
        .from("site_payment_milestones")
        .insert(payload)
        .select();

      if (error) throw error;

      const normalized = (inserted || []).map((m: any, idx: number) => ({
        id: m.id,
        payment_plan_id: `site-${siteId}`,
        phase_name: m.milestone_name,
        description: m.milestone_description,
        percentage: m.percentage,
        amount: m.amount,
        expected_date: m.expected_date,
        sequence_order: m.sequence_order || idx + 1,
        is_milestone: true,
        construction_phase_id: null,
        notes: m.notes,
        created_at: m.created_at,
        updated_at: m.updated_at,
      })) as PaymentPhase[];

      onPlanUpdated?.({
        planName,
        totalAmount: contractValue,
        phases: normalized,
      });
      setPhases(normalized as EditablePhase[]);
      setEditing(false);
    } catch (err) {
      console.error("Failed to save plan", err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={() => {
        setEditing(false);
        onClose();
      }}
      PaperProps={{ sx: { width: { xs: "100%", sm: 520 } } }}
    >
      <Box sx={{ p: 2, display: "flex", alignItems: "center", gap: 1 }}>
        <Typography variant="h6" fontWeight={700} sx={{ flex: 1 }} noWrap>
          {planName}
        </Typography>
        <Chip
          size="small"
          color="info"
          label={siteName ? `Site: ${siteName}` : "Site plan"}
          sx={{ mr: 1 }}
        />
        <IconButton onClick={onClose}>
          <Close />
        </IconButton>
      </Box>
      <Divider />

      {loading ? (
        <Box sx={{ p: 3, display: "flex", justifyContent: "center" }}>
          <CircularProgress size={32} />
        </Box>
      ) : (
        <Box sx={{ p: 2, display: "flex", flexDirection: "column", gap: 2 }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <Chip
              color="primary"
              label={`Contract: ₹${(contractValue || 0).toLocaleString(
                "en-IN"
              )}`}
            />
            <Chip color="default" label={`${phases.length} milestones`} />
            <Tooltip title="Total of all milestone percentages">
              <Chip
                color={percentageChipColor}
                icon={
                  totalPercentage === 100 ? <CheckCircle /> : <WarningAmber />
                }
                label={`Coverage: ${totalPercentage}%`}
              />
            </Tooltip>
          </Stack>

          <LinearProgress
            variant="determinate"
            value={Math.min(
              100,
              Math.max(0, (totalAmount / (contractValue || 1)) * 100)
            )}
            sx={{ height: 8, borderRadius: 1 }}
          />
          <Stack direction="row" spacing={2}>
            <Typography variant="body2" color="text.secondary">
              Planned value: ₹{totalAmount.toLocaleString("en-IN")}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Contract value: ₹{(contractValue || 0).toLocaleString("en-IN")}
            </Typography>
          </Stack>

          <Box sx={{ display: "flex", gap: 1 }}>
            <Button
              startIcon={editing ? <Close /> : <Edit />}
              variant="outlined"
              onClick={() => setEditing((prev) => !prev)}
            >
              {editing
                ? "Cancel edit"
                : phases.length
                ? "Edit plan"
                : "Create plan"}
            </Button>
            {editing && (
              <Button
                variant="contained"
                startIcon={<Save />}
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? "Saving..." : "Save plan"}
              </Button>
            )}
            {!editing && (
              <Button variant="text" onClick={loadPlan} disabled={loading}>
                Refresh
              </Button>
            )}
          </Box>

          {editing && (
            <Stack spacing={1}>
              <TextField
                label="Plan name"
                value={planName}
                onChange={(e) => setPlanName(e.target.value)}
              />
              <TextField
                label="Contract value"
                type="number"
                value={contractValue}
                onChange={(e) =>
                  setContractValue(parseFloat(e.target.value) || 0)
                }
              />
            </Stack>
          )}

          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: "action.hover" }}>
                <TableCell>Milestone</TableCell>
                <TableCell align="right">% / Amount</TableCell>
                <TableCell>Due</TableCell>
                {editing && <TableCell align="right">Actions</TableCell>}
              </TableRow>
            </TableHead>
            <TableBody>
              {phases.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={editing ? 4 : 3}
                    align="center"
                    sx={{ py: 3 }}
                  >
                    <Typography color="text.secondary">
                      No milestones yet.{" "}
                      {editing
                        ? "Add your first one."
                        : "Switch to edit to create."}
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                phases.map((phase) => (
                  <TableRow key={phase.id} hover>
                    <TableCell sx={{ width: "50%" }}>
                      {editing ? (
                        <TextField
                          fullWidth
                          size="small"
                          value={phase.phase_name}
                          onChange={(e) =>
                            handlePhaseChange(
                              phase.id,
                              "phase_name",
                              e.target.value
                            )
                          }
                        />
                      ) : (
                        <Stack spacing={0.25}>
                          <Typography fontWeight={700}>
                            {phase.phase_name}
                          </Typography>
                          {phase.description && (
                            <Typography
                              variant="caption"
                              color="text.secondary"
                            >
                              {phase.description}
                            </Typography>
                          )}
                        </Stack>
                      )}
                    </TableCell>
                    <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                      {editing ? (
                        <Stack direction="row" spacing={1} alignItems="center">
                          <TextField
                            type="number"
                            size="small"
                            label="%"
                            value={phase.percentage}
                            onChange={(e) =>
                              handlePhaseChange(
                                phase.id,
                                "percentage",
                                parseFloat(e.target.value) || 0
                              )
                            }
                            sx={{ width: 90 }}
                          />
                          <TextField
                            type="number"
                            size="small"
                            label="Amount"
                            value={phase.amount}
                            onChange={(e) =>
                              handlePhaseChange(
                                phase.id,
                                "amount",
                                parseFloat(e.target.value) || 0
                              )
                            }
                            sx={{ width: 130 }}
                          />
                        </Stack>
                      ) : (
                        <Stack spacing={0.25} alignItems="flex-end">
                          <Typography fontWeight={700}>
                            {phase.percentage}%
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            ₹{(phase.amount || 0).toLocaleString("en-IN")}
                          </Typography>
                        </Stack>
                      )}
                    </TableCell>
                    <TableCell sx={{ minWidth: 120 }}>
                      {editing ? (
                        <TextField
                          type="date"
                          size="small"
                          value={phase.expected_date || ""}
                          InputLabelProps={{ shrink: true }}
                          onChange={(e) =>
                            handlePhaseChange(
                              phase.id,
                              "expected_date",
                              e.target.value
                            )
                          }
                        />
                      ) : (
                        <Typography variant="body2">
                          {phase.expected_date
                            ? new Date(phase.expected_date).toLocaleDateString()
                            : "Not set"}
                        </Typography>
                      )}
                    </TableCell>
                    {editing && (
                      <TableCell align="right">
                        <IconButton onClick={() => handleDeletePhase(phase.id)}>
                          <Delete />
                        </IconButton>
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {editing && (
            <Button
              variant="outlined"
              startIcon={<Add />}
              onClick={handleAddPhase}
              sx={{ alignSelf: "flex-start" }}
            >
              Add milestone
            </Button>
          )}
        </Box>
      )}
    </Drawer>
  );
}
