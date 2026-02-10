"use client";

import { useState, KeyboardEvent } from "react";
import { Box, TextField, IconButton, InputAdornment } from "@mui/material";
import SendIcon from "@mui/icons-material/Send";

interface ChatInputProps {
  onSend: (message: string) => void;
  isLoading: boolean;
}

export default function ChatInput({ onSend, isLoading }: ChatInputProps) {
  const [input, setInput] = useState("");

  const handleSend = () => {
    const trimmed = input.trim();
    if (trimmed && !isLoading) {
      onSend(trimmed);
      setInput("");
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    // Enter to send (without Shift)
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <Box
      sx={{
        p: 2,
        borderTop: 1,
        borderColor: "divider",
        bgcolor: "background.paper",
      }}
    >
      <TextField
        fullWidth
        multiline
        maxRows={4}
        placeholder="Ask about attendance, salary, expenses..."
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={isLoading}
        size="small"
        slotProps={{
          input: {
            endAdornment: (
              <InputAdornment position="end">
                <IconButton
                  onClick={handleSend}
                  disabled={!input.trim() || isLoading}
                  color="primary"
                  size="small"
                  edge="end"
                >
                  <SendIcon />
                </IconButton>
              </InputAdornment>
            ),
            sx: {
              borderRadius: 2,
              bgcolor: "grey.50",
              "& fieldset": {
                borderColor: "grey.200",
              },
              "&:hover fieldset": {
                borderColor: "grey.300",
              },
              "&.Mui-focused fieldset": {
                borderColor: "primary.main",
              },
            },
          },
        }}
      />
    </Box>
  );
}
