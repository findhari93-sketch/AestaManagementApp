"use client";

import { Box, Chip } from "@mui/material";
import { QUICK_ACTIONS } from "@/lib/chat-assistant/constants";

interface QuickActionChipsProps {
  onSelect: (query: string) => void;
}

export default function QuickActionChips({ onSelect }: QuickActionChipsProps) {
  return (
    <Box
      sx={{
        px: 2,
        py: 1.5,
        borderTop: 1,
        borderColor: "divider",
        overflowX: "auto",
        display: "flex",
        gap: 1,
        "&::-webkit-scrollbar": {
          height: 4,
        },
        "&::-webkit-scrollbar-thumb": {
          bgcolor: "grey.300",
          borderRadius: 2,
        },
      }}
    >
      {QUICK_ACTIONS.map((action, index) => (
        <Chip
          key={index}
          label={action.label}
          size="small"
          variant="outlined"
          onClick={() => onSelect(action.query)}
          sx={{
            flexShrink: 0,
            cursor: "pointer",
            borderColor: "primary.main",
            color: "primary.main",
            "&:hover": {
              bgcolor: "primary.50",
              borderColor: "primary.dark",
            },
          }}
        />
      ))}
    </Box>
  );
}
