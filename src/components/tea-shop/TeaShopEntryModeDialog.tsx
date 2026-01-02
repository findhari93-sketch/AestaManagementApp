"use client";

import React from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  Box,
  Typography,
  Button,
  IconButton,
  Paper,
  Chip,
} from "@mui/material";
import {
  Close as CloseIcon,
  Groups as GroupsIcon,
  Store as StoreIcon,
  CheckCircle as CheckCircleIcon,
} from "@mui/icons-material";

interface TeaShopEntryModeDialogProps {
  open: boolean;
  onClose: () => void;
  siteName: string;
  groupSites: string[];
  onSelectGroupEntry: () => void;
  onSelectSiteEntry: () => void;
}

export default function TeaShopEntryModeDialog({
  open,
  onClose,
  siteName,
  groupSites,
  onSelectGroupEntry,
  onSelectSiteEntry,
}: TeaShopEntryModeDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xs"
      fullWidth
      PaperProps={{ sx: { borderRadius: 2 } }}
    >
      <DialogTitle>
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <Typography variant="h6" fontWeight={600}>
            T&S Entry Type
          </Typography>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {/* Group Entry Option - Recommended */}
          <Paper
            variant="outlined"
            sx={{
              p: 2,
              cursor: "pointer",
              borderColor: "secondary.main",
              borderWidth: 2,
              bgcolor: "secondary.50",
              "&:hover": { bgcolor: "secondary.100" },
            }}
            onClick={onSelectGroupEntry}
          >
            <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.5 }}>
              <GroupsIcon color="secondary" sx={{ mt: 0.5 }} />
              <Box sx={{ flex: 1 }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <Typography variant="subtitle1" fontWeight={600}>
                    Group Entry
                  </Typography>
                  <Chip
                    label="Recommended"
                    size="small"
                    color="secondary"
                    sx={{ height: 20, fontSize: "0.65rem" }}
                  />
                </Box>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  This entry will be split across all group sites based on attendance:
                </Typography>
                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, mt: 1 }}>
                  {groupSites.map((site) => (
                    <Chip
                      key={site}
                      label={site}
                      size="small"
                      variant="outlined"
                      sx={{ fontSize: "0.7rem", height: 22 }}
                    />
                  ))}
                </Box>
              </Box>
              <CheckCircleIcon color="secondary" />
            </Box>
          </Paper>

          {/* Site-Specific Entry Option */}
          <Paper
            variant="outlined"
            sx={{
              p: 2,
              cursor: "pointer",
              "&:hover": { bgcolor: "grey.50" },
            }}
            onClick={onSelectSiteEntry}
          >
            <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.5 }}>
              <StoreIcon color="action" sx={{ mt: 0.5 }} />
              <Box sx={{ flex: 1 }}>
                <Typography variant="subtitle1" fontWeight={600}>
                  Site-Specific Entry
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  This entry is only for <strong>{siteName}</strong>. Use this if the expense
                  is not shared with other sites.
                </Typography>
              </Box>
            </Box>
          </Paper>

          <Button variant="text" color="inherit" onClick={onClose} sx={{ mt: 1 }}>
            Cancel
          </Button>
        </Box>
      </DialogContent>
    </Dialog>
  );
}
