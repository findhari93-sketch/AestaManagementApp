"use client";

import React from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Button,
  Typography,
  Alert,
  useTheme,
  useMediaQuery,
} from "@mui/material";
import {
  Warning as WarningIcon,
  ArrowForward as ArrowForwardIcon,
  EventNote as AttendanceIcon,
  Payment as PaymentIcon,
  Receipt as ExpenseIcon,
} from "@mui/icons-material";
import { useRouter } from "next/navigation";

interface RedirectConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  message: string;
  targetPage: "attendance" | "payments" | "expenses";
  targetParams?: {
    date?: string;
    recordId?: string;
    highlightType?: string;
    transactionId?: string;
  };
  icon?: React.ReactNode;
}

const pageConfig = {
  attendance: {
    label: "Attendance",
    path: "/site/attendance",
    icon: <AttendanceIcon />,
    buttonText: "Go to Attendance",
  },
  payments: {
    label: "Salary Settlement",
    path: "/site/payments",
    icon: <PaymentIcon />,
    buttonText: "Go to Salary Settlement",
  },
  expenses: {
    label: "Daily Expenses",
    path: "/site/expenses",
    icon: <ExpenseIcon />,
    buttonText: "Go to Expenses",
  },
};

export default function RedirectConfirmDialog({
  open,
  onClose,
  title,
  message,
  targetPage,
  targetParams,
  icon,
}: RedirectConfirmDialogProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const router = useRouter();

  const config = pageConfig[targetPage];

  const handleRedirect = () => {
    // Build URL with query params for highlighting
    const params = new URLSearchParams();

    if (targetParams?.date) {
      params.set("date", targetParams.date);
    }
    if (targetParams?.recordId) {
      params.set("highlight", targetParams.recordId);
    }
    if (targetParams?.highlightType) {
      params.set("highlightType", targetParams.highlightType);
    }
    if (targetParams?.transactionId) {
      params.set("transactionId", targetParams.transactionId);
    }
    params.set("action", "edit_or_delete");

    const queryString = params.toString();
    const url = queryString ? `${config.path}?${queryString}` : config.path;

    onClose();
    router.push(url);
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      fullScreen={isMobile}
    >
      <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
        {icon || <WarningIcon color="warning" />}
        <Typography variant="h6" component="span">
          {title}
        </Typography>
      </DialogTitle>

      <DialogContent>
        <Alert
          severity="info"
          icon={<WarningIcon />}
          sx={{ mb: 2 }}
        >
          <Typography variant="body2">
            {message}
          </Typography>
        </Alert>

        <Box
          sx={{
            p: 2,
            bgcolor: "action.hover",
            borderRadius: 1,
            display: "flex",
            alignItems: "center",
            gap: 2,
          }}
        >
          <Box sx={{ color: "primary.main" }}>
            {config.icon}
          </Box>
          <Box sx={{ flex: 1 }}>
            <Typography variant="subtitle2" fontWeight={600}>
              {config.label} Page
            </Typography>
            <Typography variant="body2" color="text.secondary">
              You will be redirected to the {config.label.toLowerCase()} page where you can make the necessary changes.
            </Typography>
          </Box>
          <ArrowForwardIcon color="action" />
        </Box>
      </DialogContent>

      <DialogActions sx={{ p: 2, gap: 1 }}>
        <Button onClick={onClose} variant="outlined">
          Cancel
        </Button>
        <Button
          variant="contained"
          color="primary"
          onClick={handleRedirect}
          endIcon={<ArrowForwardIcon />}
        >
          {config.buttonText}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
