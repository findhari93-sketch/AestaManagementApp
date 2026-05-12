"use client";

import { useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  Stack,
  Typography,
} from "@mui/material";
import {
  Close as CloseIcon,
  WhatsApp as WhatsAppIcon,
  CheckCircle as RecordedIcon,
  HourglassEmpty as WaitingIcon,
  AccessTime as InProgressIcon,
  LocationOn as LocationIcon,
  EditNote as EditIcon,
} from "@mui/icons-material";
import dayjs from "dayjs";
import { useRouter } from "next/navigation";
import type { DailyPeekSite } from "@/hooks/queries/useCompanyDailyPeek";
import type { WorkPhoto } from "@/types/work-updates.types";
import PhotoLightbox from "./PhotoLightbox";

interface SitePeekModalProps {
  open: boolean;
  site: DailyPeekSite | null;
  date: string;
  onClose: () => void;
}

function buildWhatsAppUrl(phone: string, siteName: string, date: string): string {
  const cleaned = phone.replace(/[^\d+]/g, "");
  const message = `Hi, today's attendance for ${siteName} (${dayjs(date).format("DD MMM YYYY")}) isn't recorded yet. Could you update when free?`;
  return `https://wa.me/${cleaned.replace(/^\+/, "")}?text=${encodeURIComponent(message)}`;
}

export default function SitePeekModal({ open, site, date, onClose }: SitePeekModalProps) {
  const router = useRouter();
  const [lightbox, setLightbox] = useState<{ photos: WorkPhoto[]; index: number } | null>(null);

  if (!site) return null;

  const isWaiting = site.recordedStatus === "waiting";
  const isInProgress = site.recordedStatus === "in_progress";
  const allPhotos = [...site.morningPhotos, ...site.eveningPhotos];

  const openLightbox = (photos: WorkPhoto[], index: number) =>
    setLightbox({ photos, index });

  const phone = site.engineerPhone || site.recordedByPhone || "";
  const totalSettlement = site.dailyTotal + site.contractTotal;

  return (
    <>
      <Dialog
        open={open}
        onClose={onClose}
        maxWidth="sm"
        fullWidth
        slotProps={{ paper: { sx: { borderRadius: 2 } } }}
      >
        <DialogTitle sx={{ pr: 6, pb: 1 }}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="h6" fontWeight={700} noWrap>
                {site.siteName}
              </Typography>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.5 }}>
                {site.siteCity && (
                  <Stack direction="row" spacing={0.5} alignItems="center">
                    <LocationIcon sx={{ fontSize: 14, color: "text.disabled" }} />
                    <Typography variant="caption" color="text.secondary">
                      {site.siteCity}
                    </Typography>
                  </Stack>
                )}
                <Chip
                  size="small"
                  label={
                    isWaiting
                      ? "Waiting"
                      : isInProgress
                        ? "In progress"
                        : "Recorded"
                  }
                  color={isWaiting ? "warning" : isInProgress ? "info" : "success"}
                  icon={
                    isWaiting ? (
                      <WaitingIcon sx={{ fontSize: 14 }} />
                    ) : isInProgress ? (
                      <InProgressIcon sx={{ fontSize: 14 }} />
                    ) : (
                      <RecordedIcon sx={{ fontSize: 14 }} />
                    )
                  }
                  sx={{ height: 20, "& .MuiChip-label": { fontSize: 11, fontWeight: 600 } }}
                />
              </Stack>
              {(site.morningAt || site.eveningAt) && (
                <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.25 }}>
                  {site.morningAt && `Morning ${dayjs(site.morningAt).format("h:mm A")}`}
                  {site.morningAt && site.eveningAt && " · "}
                  {site.eveningAt && `Confirmed ${dayjs(site.eveningAt).format("h:mm A")}`}
                  {site.recordedByName && ` · ${site.recordedByName}`}
                </Typography>
              )}
            </Box>
          </Stack>
          <IconButton
            onClick={onClose}
            sx={{ position: "absolute", right: 8, top: 8 }}
            aria-label="Close"
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          {/* Waiting state */}
          {isWaiting && (
            <Stack spacing={2} sx={{ py: 2, textAlign: "center" }}>
              <WaitingIcon sx={{ fontSize: 56, color: "warning.main", mx: "auto", opacity: 0.6 }} />
              <Typography variant="body1" fontWeight={600} color="warning.dark">
                Attendance not recorded yet for{" "}
                {dayjs(date).isSame(dayjs(), "day") ? "today" : dayjs(date).format("DD MMM YYYY")}
              </Typography>
              {phone ? (
                <Button
                  variant="contained"
                  color="success"
                  startIcon={<WhatsAppIcon />}
                  size="large"
                  onClick={() => {
                    const url = buildWhatsAppUrl(phone, site.siteName, date);
                    window.open(url, "_blank", "noopener,noreferrer");
                  }}
                  sx={{ alignSelf: "center" }}
                >
                  Nudge on WhatsApp
                </Button>
              ) : (
                <Stack spacing={1.5} alignItems="center">
                  <Alert severity="info" sx={{ width: "100%" }}>
                    No engineer phone set for this site. Add one to enable WhatsApp nudge.
                  </Alert>
                  <Button
                    variant="outlined"
                    startIcon={<EditIcon />}
                    onClick={() => router.push(`/company/sites`)}
                  >
                    Add engineer phone
                  </Button>
                </Stack>
              )}
            </Stack>
          )}

          {/* Recorded / In-progress state */}
          {!isWaiting && (
            <Stack spacing={2.5} sx={{ py: 1 }}>
              {/* Plan */}
              {site.morningPlanText && (
                <Box>
                  <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: 1 }}>
                    Today&apos;s Plan
                  </Typography>
                  <Box
                    sx={{
                      mt: 0.5,
                      p: 1.5,
                      bgcolor: "warning.50",
                      borderLeft: "3px solid",
                      borderColor: "warning.main",
                      borderRadius: 1,
                    }}
                  >
                    <Typography variant="body2">{site.morningPlanText}</Typography>
                  </Box>
                </Box>
              )}

              {/* Photos */}
              {allPhotos.length > 0 && (
                <Box>
                  <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: 1 }}>
                    Photos · Tap to zoom
                  </Typography>
                  {site.morningPhotos.length > 0 && (
                    <Box sx={{ mt: 0.75 }}>
                      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.5 }}>
                        Morning
                      </Typography>
                      <Box
                        sx={{
                          display: "grid",
                          gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))",
                          gap: 1,
                        }}
                      >
                        {site.morningPhotos.map((p, idx) => (
                          <Box
                            key={`m-${p.id}-${p.url}`}
                            component="img"
                            src={p.url}
                            alt={p.description || `Morning photo ${p.id}`}
                            onClick={() => openLightbox(site.morningPhotos, idx)}
                            sx={{
                              width: "100%",
                              aspectRatio: "1 / 1",
                              objectFit: "cover",
                              borderRadius: 1,
                              cursor: "zoom-in",
                              border: "1px solid",
                              borderColor: "divider",
                              transition: "transform 0.15s",
                              "&:hover": { transform: "scale(1.03)", borderColor: "primary.main" },
                            }}
                          />
                        ))}
                      </Box>
                    </Box>
                  )}
                  {site.eveningPhotos.length > 0 && (
                    <Box sx={{ mt: 1.5 }}>
                      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.5 }}>
                        Evening
                      </Typography>
                      <Box
                        sx={{
                          display: "grid",
                          gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))",
                          gap: 1,
                        }}
                      >
                        {site.eveningPhotos.map((p, idx) => (
                          <Box
                            key={`e-${p.id}-${p.url}`}
                            component="img"
                            src={p.url}
                            alt={p.description || `Evening photo ${p.id}`}
                            onClick={() => openLightbox(site.eveningPhotos, idx)}
                            sx={{
                              width: "100%",
                              aspectRatio: "1 / 1",
                              objectFit: "cover",
                              borderRadius: 1,
                              cursor: "zoom-in",
                              border: "1px solid",
                              borderColor: "divider",
                              transition: "transform 0.15s",
                              "&:hover": { transform: "scale(1.03)", borderColor: "primary.main" },
                            }}
                          />
                        ))}
                      </Box>
                    </Box>
                  )}
                </Box>
              )}

              {/* Evening summary */}
              {site.eveningSummaryText && (
                <Box>
                  <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: 1 }}>
                    What Got Done
                  </Typography>
                  <Box
                    sx={{
                      mt: 0.5,
                      p: 1.5,
                      bgcolor: "grey.100",
                      borderRadius: 1,
                    }}
                  >
                    <Typography variant="body2">{site.eveningSummaryText}</Typography>
                  </Box>
                </Box>
              )}

              <Divider />

              {/* Workforce */}
              <Box>
                <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: 1 }}>
                  Workforce ({site.dailyCount + site.contractCount})
                </Typography>
                <Stack direction="row" spacing={0.75} sx={{ mt: 0.75, flexWrap: "wrap", gap: 0.75 }}>
                  {site.dailyCount > 0 && (
                    <Chip size="small" label={`${site.dailyCount} daily laborers`} />
                  )}
                  {site.contractCount > 0 && (
                    <Chip
                      size="small"
                      label={`${site.contractCount} contract crew`}
                      color="secondary"
                      variant="outlined"
                    />
                  )}
                  {site.dailyCount === 0 && site.contractCount === 0 && (
                    <Typography variant="body2" color="text.secondary">
                      No workforce details for this date.
                    </Typography>
                  )}
                </Stack>
              </Box>

              {/* Money */}
              <Box>
                <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: 1 }}>
                  Pending settlement
                </Typography>
                <Stack spacing={0.5} sx={{ mt: 0.5 }}>
                  <Stack direction="row" justifyContent="space-between">
                    <Typography variant="body2" color="text.secondary">
                      Daily laborers
                    </Typography>
                    <Typography variant="body2" fontWeight={600}>
                      ₹{site.dailyTotal.toLocaleString()}
                    </Typography>
                  </Stack>
                  <Stack direction="row" justifyContent="space-between">
                    <Typography variant="body2" color="text.secondary">
                      Contract
                    </Typography>
                    <Typography variant="body2" fontWeight={600}>
                      ₹{site.contractTotal.toLocaleString()}
                    </Typography>
                  </Stack>
                  <Divider sx={{ my: 0.5 }} />
                  <Stack direction="row" justifyContent="space-between">
                    <Typography variant="body2" fontWeight={700}>
                      Total
                    </Typography>
                    <Typography variant="body1" fontWeight={700} color="warning.dark">
                      ₹{totalSettlement.toLocaleString()}
                    </Typography>
                  </Stack>
                </Stack>
              </Box>
            </Stack>
          )}
        </DialogContent>
      </Dialog>

      <PhotoLightbox
        open={Boolean(lightbox)}
        photos={lightbox?.photos ?? []}
        startIndex={lightbox?.index ?? 0}
        onClose={() => setLightbox(null)}
      />
    </>
  );
}
