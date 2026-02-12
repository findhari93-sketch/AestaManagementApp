"use client";

import { useState } from "react";
import {
  Fab,
  Drawer,
  Box,
  Typography,
  IconButton,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import SmartToyIcon from "@mui/icons-material/SmartToy";
import CloseIcon from "@mui/icons-material/Close";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import { useSelectedSite } from "@/contexts/SiteContext";
import { useChatAssistant } from "@/hooks/useChatAssistant";
import ChatMessageList from "./ChatMessageList";
import ChatInput from "./ChatInput";
import ChatFilters from "./ChatFilters";
import QuickActionChips from "./QuickActionChips";

export default function ChatAssistant() {
  const [open, setOpen] = useState(false);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const { selectedSite } = useSelectedSite();

  const {
    messages,
    filters,
    setFilters,
    isLoading,
    sendMessage,
    handleSuggestionClick,
    clearChat,
  } = useChatAssistant({
    initialSiteId: selectedSite?.id,
  });

  const handleOpen = () => setOpen(true);
  const handleClose = () => setOpen(false);

  return (
    <>
      {/* Floating Action Button */}
      <Fab
        color="primary"
        aria-label="chat assistant"
        onClick={handleOpen}
        sx={{
          position: "fixed",
          bottom: { xs: 80, md: 24 }, // Above mobile nav on mobile
          right: 16,
          zIndex: theme.zIndex.fab,
          boxShadow: 4,
          "&:hover": {
            boxShadow: 6,
          },
        }}
      >
        <SmartToyIcon />
      </Fab>

      {/* Chat Drawer */}
      <Drawer
        anchor="right"
        open={open}
        onClose={handleClose}
        PaperProps={{
          sx: {
            width: isMobile ? "100%" : 400,
            display: "flex",
            flexDirection: "column",
            height: "100%",
          },
        }}
      >
        {/* Header */}
        <Box
          sx={{
            p: 2,
            borderBottom: 1,
            borderColor: "divider",
            bgcolor: "primary.main",
            color: "white",
          }}
        >
          <Box
            sx={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <SmartToyIcon />
              <Typography variant="h6" fontWeight={700}>
                AESTA Assistant
              </Typography>
            </Box>
            <Box>
              <IconButton
                onClick={clearChat}
                size="small"
                sx={{ color: "white", mr: 0.5 }}
                title="Clear chat"
              >
                <DeleteOutlineIcon fontSize="small" />
              </IconButton>
              <IconButton
                onClick={handleClose}
                size="small"
                sx={{ color: "white" }}
              >
                <CloseIcon />
              </IconButton>
            </Box>
          </Box>
        </Box>

        {/* Filters */}
        <ChatFilters filters={filters} onChange={setFilters} />

        {/* Messages */}
        <ChatMessageList
          messages={messages}
          isLoading={isLoading}
          onSuggestionClick={handleSuggestionClick}
        />

        {/* Quick Actions */}
        <QuickActionChips onSelect={sendMessage} />

        {/* Input */}
        <ChatInput onSend={sendMessage} isLoading={isLoading} />
      </Drawer>
    </>
  );
}
