"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
  Box,
  Button,
  Chip,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Stack,
  IconButton,
  Alert,
  Paper,
  Tooltip,
  Tabs,
  Tab,
  Card,
  CardContent,
  Collapse,
  Fade,
  alpha,
  useTheme,
} from "@mui/material";
import {
  Add,
  Edit,
  Delete,
  ExpandMore,
  AccountTree,
  ViewList,
} from "@mui/icons-material";
import PageHeader from "@/components/layout/PageHeader";
import { useAuth } from "@/contexts/AuthContext";
import { createClient } from "@/lib/supabase/client";
import { hasEditPermission } from "@/lib/permissions";
import type {
  ConstructionPhase,
  ConstructionSubphase,
} from "@/types/database.types";

// Flow Chart Node Component
function PhaseNode({
  phase,
  subphases,
  onEdit,
  onDelete,
  onAddSubphase,
  onEditSubphase,
  onDeleteSubphase,
  canEdit,
  isLast,
}: {
  phase: ConstructionPhase;
  subphases: ConstructionSubphase[];
  onEdit: () => void;
  onDelete: () => void;
  onAddSubphase: () => void;
  onEditSubphase: (s: ConstructionSubphase) => void;
  onDeleteSubphase: (id: string) => void;
  canEdit: boolean;
  isLast: boolean;
}) {
  const theme = useTheme();

  return (
    <Box sx={{ display: "flex", alignItems: "flex-start", mb: 3 }}>
      {/* Main Phase Card */}
      <Card
        elevation={0}
        sx={{
          minWidth: 280,
          maxWidth: 320,
          border: `2px solid ${theme.palette.primary.main}`,
          borderRadius: 3,
          background: `linear-gradient(135deg, ${alpha(
            theme.palette.primary.main,
            0.05
          )} 0%, ${alpha(theme.palette.primary.main, 0.1)} 100%)`,
          transition: "all 0.2s ease",
          "&:hover": {
            boxShadow: `0 8px 24px ${alpha(theme.palette.primary.main, 0.2)}`,
            transform: "translateY(-2px)",
          },
        }}
      >
        <CardContent sx={{ p: 2.5, "&:last-child": { pb: 2.5 } }}>
          {/* Phase Header */}
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            mb={1.5}
          >
            <Chip
              label={`Phase ${phase.sequence_order}`}
              size="small"
              sx={{
                bgcolor: theme.palette.primary.main,
                color: "white",
                fontWeight: 600,
                fontSize: "0.7rem",
              }}
            />
            <Stack direction="row" spacing={0.5}>
              {canEdit && (
                <>
                  <Tooltip title="Edit Phase">
                    <IconButton
                      size="small"
                      onClick={onEdit}
                      sx={{ color: theme.palette.primary.main }}
                    >
                      <Edit fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Delete Phase">
                    <IconButton
                      size="small"
                      onClick={onDelete}
                      sx={{ color: theme.palette.error.main }}
                    >
                      <Delete fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </>
              )}
            </Stack>
          </Stack>

          {/* Phase Name */}
          <Typography
            variant="h6"
            sx={{
              fontWeight: 700,
              color: theme.palette.text.primary,
              mb: 0.5,
              lineHeight: 1.3,
            }}
          >
            {phase.name}
          </Typography>

          {phase.description && (
            <Typography
              variant="body2"
              sx={{
                color: theme.palette.text.secondary,
                mb: 2,
                lineHeight: 1.5,
              }}
            >
              {phase.description}
            </Typography>
          )}

          {/* SubPhases Section */}
          <Box
            sx={{
              bgcolor: "white",
              borderRadius: 2,
              p: 1.5,
              mt: 1,
              border: `1px solid ${alpha(theme.palette.divider, 0.5)}`,
            }}
          >
            <Stack
              direction="row"
              alignItems="center"
              justifyContent="space-between"
              mb={1}
            >
              <Typography
                variant="caption"
                sx={{
                  fontWeight: 600,
                  color: theme.palette.text.secondary,
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                }}
              >
                SubPhases ({subphases.length})
              </Typography>
              {canEdit && (
                <Tooltip title="Add SubPhase">
                  <IconButton
                    size="small"
                    onClick={onAddSubphase}
                    sx={{
                      bgcolor: alpha(theme.palette.success.main, 0.1),
                      color: theme.palette.success.main,
                      "&:hover": {
                        bgcolor: alpha(theme.palette.success.main, 0.2),
                      },
                    }}
                  >
                    <Add fontSize="small" />
                  </IconButton>
                </Tooltip>
              )}
            </Stack>

            {subphases.length === 0 ? (
              <Typography
                variant="body2"
                sx={{
                  color: theme.palette.text.disabled,
                  fontStyle: "italic",
                  py: 1,
                }}
              >
                No subphases added yet
              </Typography>
            ) : (
              <Stack spacing={0.75}>
                {subphases.map((subphase) => (
                  <Box
                    key={subphase.id}
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      py: 0.75,
                      px: 1.5,
                      bgcolor: alpha(theme.palette.info.main, 0.05),
                      borderRadius: 1.5,
                      border: `1px solid ${alpha(
                        theme.palette.info.main,
                        0.2
                      )}`,
                      transition: "all 0.15s ease",
                      "&:hover": {
                        bgcolor: alpha(theme.palette.info.main, 0.1),
                      },
                    }}
                  >
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <Box
                        sx={{
                          width: 8,
                          height: 8,
                          borderRadius: "50%",
                          bgcolor: theme.palette.info.main,
                        }}
                      />
                      <Typography
                        variant="body2"
                        sx={{
                          fontWeight: 500,
                          color: theme.palette.text.primary,
                        }}
                      >
                        {subphase.name}
                      </Typography>
                    </Stack>
                    {canEdit && (
                      <Stack direction="row" spacing={0.25}>
                        <IconButton
                          size="small"
                          onClick={() => onEditSubphase(subphase)}
                          sx={{ p: 0.5 }}
                        >
                          <Edit
                            sx={{
                              fontSize: 14,
                              color: theme.palette.text.secondary,
                            }}
                          />
                        </IconButton>
                        <IconButton
                          size="small"
                          onClick={() => onDeleteSubphase(subphase.id)}
                          sx={{ p: 0.5 }}
                        >
                          <Delete
                            sx={{
                              fontSize: 14,
                              color: theme.palette.error.light,
                            }}
                          />
                        </IconButton>
                      </Stack>
                    )}
                  </Box>
                ))}
              </Stack>
            )}
          </Box>
        </CardContent>
      </Card>

      {/* Arrow connector to next phase */}
      {!isLast && (
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            px: 2,
            pt: 5,
          }}
        >
          <Box
            sx={{
              width: 40,
              height: 2,
              bgcolor: theme.palette.primary.main,
              position: "relative",
              "&::after": {
                content: '""',
                position: "absolute",
                right: -8,
                top: "50%",
                transform: "translateY(-50%)",
                borderLeft: `10px solid ${theme.palette.primary.main}`,
                borderTop: "6px solid transparent",
                borderBottom: "6px solid transparent",
              },
            }}
          />
        </Box>
      )}
    </Box>
  );
}

// List View Card Component
function PhaseListCard({
  phase,
  subphases,
  isExpanded,
  onToggle,
  onEdit,
  onDelete,
  onAddSubphase,
  onEditSubphase,
  onDeleteSubphase,
  canEdit,
}: {
  phase: ConstructionPhase;
  subphases: ConstructionSubphase[];
  isExpanded: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onAddSubphase: () => void;
  onEditSubphase: (s: ConstructionSubphase) => void;
  onDeleteSubphase: (id: string) => void;
  canEdit: boolean;
}) {
  const theme = useTheme();

  return (
    <Card
      elevation={0}
      sx={{
        mb: 2,
        border: `1px solid ${alpha(theme.palette.divider, 0.8)}`,
        borderRadius: 2,
        overflow: "hidden",
        transition: "all 0.2s ease",
        "&:hover": {
          borderColor: theme.palette.primary.light,
          boxShadow: `0 4px 12px ${alpha(theme.palette.primary.main, 0.08)}`,
        },
      }}
    >
      {/* Phase Header */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          p: 2,
          bgcolor: isExpanded
            ? alpha(theme.palette.primary.main, 0.04)
            : "white",
          borderBottom: isExpanded
            ? `1px solid ${alpha(theme.palette.divider, 0.5)}`
            : "none",
          cursor: "pointer",
          transition: "background-color 0.2s ease",
          "&:hover": {
            bgcolor: alpha(theme.palette.primary.main, 0.06),
          },
        }}
        onClick={onToggle}
      >
        <Stack direction="row" alignItems="center" spacing={2}>
          <IconButton
            size="small"
            sx={{
              bgcolor: alpha(theme.palette.primary.main, 0.1),
              color: theme.palette.primary.main,
              transition: "transform 0.2s ease",
              transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
              "&:hover": { bgcolor: alpha(theme.palette.primary.main, 0.2) },
            }}
          >
            <ExpandMore />
          </IconButton>

          <Box>
            <Stack direction="row" alignItems="center" spacing={1.5}>
              <Chip
                label={`#${phase.sequence_order}`}
                size="small"
                sx={{
                  bgcolor: theme.palette.primary.main,
                  color: "white",
                  fontWeight: 600,
                  height: 24,
                  "& .MuiChip-label": { px: 1.5 },
                }}
              />
              <Typography
                variant="subtitle1"
                sx={{ fontWeight: 600, color: theme.palette.text.primary }}
              >
                {phase.name}
              </Typography>
              <Chip
                label={`${subphases.length} subphase${
                  subphases.length !== 1 ? "s" : ""
                }`}
                size="small"
                variant="outlined"
                sx={{
                  height: 22,
                  borderColor: alpha(theme.palette.info.main, 0.5),
                  color: theme.palette.info.main,
                  "& .MuiChip-label": { px: 1, fontSize: "0.7rem" },
                }}
              />
            </Stack>
            {phase.description && (
              <Typography
                variant="body2"
                sx={{ color: theme.palette.text.secondary, mt: 0.5 }}
              >
                {phase.description}
              </Typography>
            )}
          </Box>
        </Stack>

        <Stack
          direction="row"
          spacing={0.5}
          onClick={(e) => e.stopPropagation()}
        >
          {canEdit && (
            <>
              <Tooltip title="Add SubPhase">
                <IconButton
                  size="small"
                  onClick={onAddSubphase}
                  sx={{
                    color: theme.palette.success.main,
                    "&:hover": {
                      bgcolor: alpha(theme.palette.success.main, 0.1),
                    },
                  }}
                >
                  <Add />
                </IconButton>
              </Tooltip>
              <Tooltip title="Edit Phase">
                <IconButton
                  size="small"
                  onClick={onEdit}
                  sx={{
                    color: theme.palette.primary.main,
                    "&:hover": {
                      bgcolor: alpha(theme.palette.primary.main, 0.1),
                    },
                  }}
                >
                  <Edit />
                </IconButton>
              </Tooltip>
              <Tooltip title="Delete Phase">
                <IconButton
                  size="small"
                  onClick={onDelete}
                  sx={{
                    color: theme.palette.error.main,
                    "&:hover": {
                      bgcolor: alpha(theme.palette.error.main, 0.1),
                    },
                  }}
                >
                  <Delete />
                </IconButton>
              </Tooltip>
            </>
          )}
        </Stack>
      </Box>

      {/* SubPhases List */}
      <Collapse in={isExpanded}>
        <Box sx={{ p: 2, bgcolor: alpha(theme.palette.grey[50], 0.5) }}>
          {subphases.length === 0 ? (
            <Typography
              variant="body2"
              sx={{
                color: theme.palette.text.disabled,
                fontStyle: "italic",
                textAlign: "center",
                py: 2,
              }}
            >
              No subphases in this phase. Click the + button to add one.
            </Typography>
          ) : (
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.5 }}>
              {subphases.map((subphase) => (
                <Box
                  key={subphase.id}
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 1,
                    py: 1,
                    px: 2,
                    bgcolor: "white",
                    borderRadius: 2,
                    border: `1px solid ${alpha(theme.palette.info.main, 0.3)}`,
                    boxShadow: `0 1px 3px ${alpha(
                      theme.palette.common.black,
                      0.04
                    )}`,
                    transition: "all 0.15s ease",
                    "&:hover": {
                      borderColor: theme.palette.info.main,
                      boxShadow: `0 2px 8px ${alpha(
                        theme.palette.info.main,
                        0.15
                      )}`,
                    },
                  }}
                >
                  <Box
                    sx={{
                      width: 10,
                      height: 10,
                      borderRadius: "50%",
                      bgcolor: theme.palette.info.main,
                    }}
                  />
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>
                    {subphase.name}
                  </Typography>
                  {subphase.description && (
                    <Typography
                      variant="caption"
                      sx={{ color: theme.palette.text.secondary }}
                    >
                      ({subphase.description})
                    </Typography>
                  )}
                  {canEdit && (
                    <Stack direction="row" spacing={0.25} sx={{ ml: 1 }}>
                      <IconButton
                        size="small"
                        onClick={() => onEditSubphase(subphase)}
                        sx={{ p: 0.5 }}
                      >
                        <Edit
                          sx={{
                            fontSize: 14,
                            color: theme.palette.text.secondary,
                          }}
                        />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={() => onDeleteSubphase(subphase.id)}
                        sx={{ p: 0.5 }}
                      >
                        <Delete
                          sx={{
                            fontSize: 14,
                            color: theme.palette.error.light,
                          }}
                        />
                      </IconButton>
                    </Stack>
                  )}
                </Box>
              ))}
            </Box>
          )}
        </Box>
      </Collapse>
    </Card>
  );
}

export default function ConstructionPhasesPage() {
  const { userProfile } = useAuth();
  const supabase = createClient();
  const theme = useTheme();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [phases, setPhases] = useState<ConstructionPhase[]>([]);
  const [subphases, setSubphases] = useState<ConstructionSubphase[]>([]);
  const [expandedPhaseIds, setExpandedPhaseIds] = useState<Set<string>>(
    new Set()
  );
  const [viewMode, setViewMode] = useState<"list" | "flowchart">("flowchart");

  // Panning state for flow chart
  const flowChartRef = useRef<HTMLDivElement>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, scrollLeft: 0 });

  const [phaseDialogOpen, setPhaseDialogOpen] = useState(false);
  const [editingPhase, setEditingPhase] = useState<ConstructionPhase | null>(
    null
  );
  const [phaseForm, setPhaseForm] = useState({
    name: "",
    description: "",
    sequence_order: 0,
  });

  const [subDialogOpen, setSubDialogOpen] = useState(false);
  const [editingSub, setEditingSub] = useState<ConstructionSubphase | null>(
    null
  );
  const [selectedPhaseIdForSubphase, setSelectedPhaseIdForSubphase] = useState<
    string | null
  >(null);
  const [subForm, setSubForm] = useState({
    name: "",
    description: "",
    sequence_order: 0,
  });

  const canEdit = hasEditPermission(userProfile?.role);

  // Panning handlers for flow chart
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!flowChartRef.current) return;
    setIsPanning(true);
    setPanStart({
      x: e.pageX,
      scrollLeft: flowChartRef.current.scrollLeft,
    });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isPanning || !flowChartRef.current) return;
    e.preventDefault();
    const dx = e.pageX - panStart.x;
    flowChartRef.current.scrollLeft = panStart.scrollLeft - dx;
  };

  const handleMouseUp = () => {
    setIsPanning(false);
  };

  const handleMouseLeave = () => {
    setIsPanning(false);
  };

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [phasesRes, subphasesRes] = await Promise.all([
        (supabase as any)
          .from("construction_phases")
          .select("*")
          .order("sequence_order"),
        (supabase as any)
          .from("construction_subphases")
          .select("*")
          .order("sequence_order"),
      ]);
      if (phasesRes.error) throw phasesRes.error;
      if (subphasesRes.error) throw subphasesRes.error;
      const phasesData = (phasesRes.data || []) as ConstructionPhase[];
      const subphasesData = (subphasesRes.data || []) as ConstructionSubphase[];
      setPhases(phasesData);
      setSubphases(subphasesData);
      // Auto-expand all phases for better UX
      if (phasesData.length > 0) {
        setExpandedPhaseIds(new Set(phasesData.map((p) => p.id)));
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const toggleExpandPhase = (phaseId: string) => {
    const newExpanded = new Set(expandedPhaseIds);
    if (newExpanded.has(phaseId)) {
      newExpanded.delete(phaseId);
    } else {
      newExpanded.add(phaseId);
    }
    setExpandedPhaseIds(newExpanded);
  };

  const handleSavePhase = async () => {
    if (!phaseForm.name.trim()) {
      setError("Phase name is required");
      return;
    }
    try {
      setLoading(true);
      const payload = {
        name: phaseForm.name,
        description: phaseForm.description || null,
        sequence_order: Number(phaseForm.sequence_order) || 0,
      };
      if (editingPhase) {
        const { error } = await (supabase as any)
          .from("construction_phases")
          .update(payload)
          .eq("id", editingPhase.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any)
          .from("construction_phases")
          .insert(payload);
        if (error) throw error;
      }
      setPhaseDialogOpen(false);
      setEditingPhase(null);
      setPhaseForm({ name: "", description: "", sequence_order: 0 });
      fetchData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSubphase = async () => {
    if (!subForm.name.trim() || !selectedPhaseIdForSubphase) {
      setError("SubPhase name and phase are required");
      return;
    }
    try {
      setLoading(true);
      const payload = {
        phase_id: selectedPhaseIdForSubphase,
        name: subForm.name,
        description: subForm.description || null,
        sequence_order: Number(subForm.sequence_order) || 0,
      };
      if (editingSub) {
        const { error } = await (supabase as any)
          .from("construction_subphases")
          .update(payload)
          .eq("id", editingSub.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any)
          .from("construction_subphases")
          .insert(payload);
        if (error) throw error;
      }
      setSubDialogOpen(false);
      setEditingSub(null);
      setSubForm({ name: "", description: "", sequence_order: 0 });
      setSelectedPhaseIdForSubphase(null);
      fetchData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePhase = async (id: string) => {
    if (!confirm("Delete this phase? All subphases will also be deleted."))
      return;
    try {
      setLoading(true);
      const { error } = await supabase
        .from("construction_phases")
        .delete()
        .eq("id", id);
      if (error) throw error;
      fetchData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSubphase = async (id: string) => {
    if (!confirm("Delete this subphase?")) return;
    try {
      setLoading(true);
      const { error } = await supabase
        .from("construction_subphases")
        .delete()
        .eq("id", id);
      if (error) throw error;
      fetchData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const openPhaseDialog = (phase?: ConstructionPhase) => {
    if (phase) {
      setEditingPhase(phase);
      setPhaseForm({
        name: phase.name,
        description: phase.description || "",
        sequence_order: phase.sequence_order,
      });
    } else {
      setEditingPhase(null);
      setPhaseForm({
        name: "",
        description: "",
        sequence_order: phases.length + 1,
      });
    }
    setPhaseDialogOpen(true);
  };

  const openSubphaseDialog = (
    phaseId: string,
    subphase?: ConstructionSubphase
  ) => {
    setSelectedPhaseIdForSubphase(phaseId);
    if (subphase) {
      setEditingSub(subphase);
      setSubForm({
        name: subphase.name,
        description: subphase.description || "",
        sequence_order: subphase.sequence_order,
      });
    } else {
      setEditingSub(null);
      const phaseSubphases = subphases.filter((s) => s.phase_id === phaseId);
      setSubForm({
        name: "",
        description: "",
        sequence_order: phaseSubphases.length + 1,
      });
    }
    setSubDialogOpen(true);
  };

  return (
    <Box>
      <PageHeader
        title="Construction Phases"
        subtitle="Manage your project phases and subphases in a visual workflow"
        onRefresh={fetchData}
        isLoading={loading}
        actions={
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={() => openPhaseDialog()}
            disabled={!canEdit}
            sx={{
              borderRadius: 2,
              textTransform: "none",
              fontWeight: 600,
              px: 3,
            }}
          >
            Add Phase
          </Button>
        }
      />

      {error && (
        <Alert
          severity="error"
          sx={{ mb: 3, borderRadius: 2 }}
          onClose={() => setError("")}
        >
          {error}
        </Alert>
      )}

      {/* View Toggle Tabs */}
      <Paper
        elevation={0}
        sx={{
          mb: 3,
          p: 0.5,
          bgcolor: alpha(theme.palette.grey[100], 0.8),
          borderRadius: 2,
          display: "inline-flex",
        }}
      >
        <Tabs
          value={viewMode}
          onChange={(_, v) => setViewMode(v)}
          sx={{
            minHeight: 40,
            "& .MuiTabs-indicator": {
              display: "none",
            },
            "& .MuiTab-root": {
              minHeight: 36,
              minWidth: 120,
              borderRadius: 1.5,
              textTransform: "none",
              fontWeight: 500,
              color: theme.palette.text.secondary,
              transition: "all 0.2s ease",
              "&.Mui-selected": {
                bgcolor: "white",
                color: theme.palette.primary.main,
                boxShadow: `0 1px 3px ${alpha(
                  theme.palette.common.black,
                  0.1
                )}`,
              },
            },
          }}
        >
          <Tab
            value="flowchart"
            label="Flow Chart"
            icon={<AccountTree sx={{ fontSize: 18 }} />}
            iconPosition="start"
          />
          <Tab
            value="list"
            label="List View"
            icon={<ViewList sx={{ fontSize: 18 }} />}
            iconPosition="start"
          />
        </Tabs>
      </Paper>

      {/* Content based on view mode */}
      {phases.length === 0 ? (
        <Paper
          elevation={0}
          sx={{
            p: 6,
            textAlign: "center",
            borderRadius: 3,
            border: `2px dashed ${alpha(theme.palette.divider, 0.5)}`,
            bgcolor: alpha(theme.palette.grey[50], 0.5),
          }}
        >
          <AccountTree
            sx={{ fontSize: 64, color: theme.palette.grey[300], mb: 2 }}
          />
          <Typography
            variant="h6"
            sx={{ color: theme.palette.text.secondary, mb: 1 }}
          >
            No construction phases yet
          </Typography>
          <Typography
            variant="body2"
            sx={{ color: theme.palette.text.disabled, mb: 3 }}
          >
            Start by creating your first phase to visualize your construction
            workflow
          </Typography>
          {canEdit && (
            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={() => openPhaseDialog()}
              sx={{ borderRadius: 2, textTransform: "none", fontWeight: 600 }}
            >
              Create First Phase
            </Button>
          )}
        </Paper>
      ) : viewMode === "flowchart" ? (
        /* Flow Chart View with Panning */
        <Fade in>
          <Paper
            ref={flowChartRef}
            elevation={0}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseLeave}
            sx={{
              p: 4,
              borderRadius: 3,
              border: `1px solid ${alpha(theme.palette.divider, 0.5)}`,
              bgcolor: "white",
              overflowX: "auto",
              cursor: isPanning ? "grabbing" : "grab",
              userSelect: "none",
              "&::-webkit-scrollbar": {
                height: 8,
              },
              "&::-webkit-scrollbar-track": {
                bgcolor: alpha(theme.palette.grey[200], 0.5),
                borderRadius: 4,
              },
              "&::-webkit-scrollbar-thumb": {
                bgcolor: alpha(theme.palette.primary.main, 0.3),
                borderRadius: 4,
                "&:hover": {
                  bgcolor: alpha(theme.palette.primary.main, 0.5),
                },
              },
            }}
          >
            <Typography
              variant="overline"
              sx={{
                display: "block",
                mb: 3,
                color: theme.palette.text.secondary,
                fontWeight: 600,
                letterSpacing: 1,
              }}
            >
              Construction Workflow • Drag to pan
            </Typography>
            <Box
              sx={{
                display: "flex",
                flexWrap: "nowrap",
                alignItems: "flex-start",
                pb: 2,
                minWidth: "fit-content",
              }}
            >
              {phases.map((phase, index) => {
                const phaseSubphases = subphases.filter(
                  (s) => s.phase_id === phase.id
                );
                return (
                  <PhaseNode
                    key={phase.id}
                    phase={phase}
                    subphases={phaseSubphases}
                    onEdit={() => openPhaseDialog(phase)}
                    onDelete={() => handleDeletePhase(phase.id)}
                    onAddSubphase={() => openSubphaseDialog(phase.id)}
                    onEditSubphase={(s) => openSubphaseDialog(phase.id, s)}
                    onDeleteSubphase={handleDeleteSubphase}
                    canEdit={canEdit}
                    isLast={index === phases.length - 1}
                  />
                );
              })}
            </Box>
          </Paper>
        </Fade>
      ) : (
        /* List View */
        <Fade in>
          <Box>
            {phases.map((phase) => {
              const phaseSubphases = subphases.filter(
                (s) => s.phase_id === phase.id
              );
              return (
                <PhaseListCard
                  key={phase.id}
                  phase={phase}
                  subphases={phaseSubphases}
                  isExpanded={expandedPhaseIds.has(phase.id)}
                  onToggle={() => toggleExpandPhase(phase.id)}
                  onEdit={() => openPhaseDialog(phase)}
                  onDelete={() => handleDeletePhase(phase.id)}
                  onAddSubphase={() => openSubphaseDialog(phase.id)}
                  onEditSubphase={(s) => openSubphaseDialog(phase.id, s)}
                  onDeleteSubphase={handleDeleteSubphase}
                  canEdit={canEdit}
                />
              );
            })}
          </Box>
        </Fade>
      )}

      {/* Phase Dialog */}
      <Dialog
        open={phaseDialogOpen}
        onClose={() => setPhaseDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: { borderRadius: 3 },
        }}
      >
        <DialogTitle sx={{ pb: 1 }}>
          <Typography variant="h6" fontWeight={600}>
            {editingPhase ? "Edit Phase" : "Create New Phase"}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {editingPhase
              ? "Update the phase details below"
              : "Define a new construction phase for your projects"}
          </Typography>
        </DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 2 }}>
            <TextField
              label="Phase Name"
              placeholder="e.g., Foundation, Structure, Finishing"
              value={phaseForm.name}
              onChange={(e) =>
                setPhaseForm({ ...phaseForm, name: e.target.value })
              }
              fullWidth
              required
              sx={{
                "& .MuiOutlinedInput-root": { borderRadius: 2 },
              }}
            />
            <TextField
              label="Description"
              placeholder="Brief description of what this phase involves"
              value={phaseForm.description}
              onChange={(e) =>
                setPhaseForm({ ...phaseForm, description: e.target.value })
              }
              multiline
              rows={2}
              fullWidth
              sx={{
                "& .MuiOutlinedInput-root": { borderRadius: 2 },
              }}
            />
            <TextField
              label="Sequence Order"
              type="number"
              value={phaseForm.sequence_order}
              onChange={(e) =>
                setPhaseForm({
                  ...phaseForm,
                  sequence_order: Number(e.target.value),
                })
              }
              fullWidth
              inputProps={{ min: 1 }}
              helperText="Determines the order in which phases appear"
              sx={{
                "& .MuiOutlinedInput-root": { borderRadius: 2 },
              }}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 2 }}>
          <Button
            onClick={() => setPhaseDialogOpen(false)}
            sx={{ borderRadius: 2, textTransform: "none" }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSavePhase}
            variant="contained"
            disabled={!canEdit || loading}
            sx={{
              borderRadius: 2,
              textTransform: "none",
              fontWeight: 600,
              px: 3,
            }}
          >
            {editingPhase ? "Update Phase" : "Create Phase"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* SubPhase Dialog */}
      <Dialog
        open={subDialogOpen}
        onClose={() => setSubDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: { borderRadius: 3 },
        }}
      >
        <DialogTitle sx={{ pb: 1 }}>
          <Typography variant="h6" fontWeight={600}>
            {editingSub ? "Edit SubPhase" : "Add New SubPhase"}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {editingSub
              ? "Update the subphase details below"
              : "Add a subphase to this phase"}
          </Typography>
        </DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 2 }}>
            <TextField
              label="SubPhase Name"
              placeholder="e.g., Walls, Roof, Floor, Plumbing"
              value={subForm.name}
              onChange={(e) => setSubForm({ ...subForm, name: e.target.value })}
              fullWidth
              required
              sx={{
                "& .MuiOutlinedInput-root": { borderRadius: 2 },
              }}
            />
            <TextField
              label="Description"
              placeholder="Brief description of this subphase work"
              value={subForm.description}
              onChange={(e) =>
                setSubForm({ ...subForm, description: e.target.value })
              }
              multiline
              rows={2}
              fullWidth
              sx={{
                "& .MuiOutlinedInput-root": { borderRadius: 2 },
              }}
            />
            <TextField
              label="Sequence Order"
              type="number"
              value={subForm.sequence_order}
              onChange={(e) =>
                setSubForm({
                  ...subForm,
                  sequence_order: Number(e.target.value),
                })
              }
              fullWidth
              inputProps={{ min: 1 }}
              helperText="Determines the order within the phase"
              sx={{
                "& .MuiOutlinedInput-root": { borderRadius: 2 },
              }}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 2 }}>
          <Button
            onClick={() => setSubDialogOpen(false)}
            sx={{ borderRadius: 2, textTransform: "none" }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSaveSubphase}
            variant="contained"
            disabled={!canEdit || loading}
            sx={{
              borderRadius: 2,
              textTransform: "none",
              fontWeight: 600,
              px: 3,
            }}
          >
            {editingSub ? "Update SubPhase" : "Add SubPhase"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
