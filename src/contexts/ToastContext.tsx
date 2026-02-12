"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
} from "react";
import { Snackbar, Alert, AlertColor, Slide, SlideProps } from "@mui/material";

// Toast message interface
export interface ToastMessage {
  id: string;
  message: string;
  severity: AlertColor;
  duration?: number;
  action?: ReactNode;
}

interface ToastContextType {
  showToast: (
    message: string,
    severity?: AlertColor,
    duration?: number
  ) => void;
  showSuccess: (message: string, duration?: number) => void;
  showError: (message: string, duration?: number) => void;
  showWarning: (message: string, duration?: number) => void;
  showInfo: (message: string, duration?: number) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

function SlideTransition(props: SlideProps) {
  return <Slide {...props} direction="up" />;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = useCallback(
    (message: string, severity: AlertColor = "info", duration: number = 4000) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      setToasts((prev) => [...prev, { id, message, severity, duration }]);
    },
    []
  );

  const showSuccess = useCallback(
    (message: string, duration: number = 4000) => {
      showToast(message, "success", duration);
    },
    [showToast]
  );

  const showError = useCallback(
    (message: string, duration: number = 6000) => {
      showToast(message, "error", duration);
    },
    [showToast]
  );

  const showWarning = useCallback(
    (message: string, duration: number = 5000) => {
      showToast(message, "warning", duration);
    },
    [showToast]
  );

  const showInfo = useCallback(
    (message: string, duration: number = 4000) => {
      showToast(message, "info", duration);
    },
    [showToast]
  );

  const handleClose = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Get the current toast to display (first in queue)
  const currentToast = toasts[0];

  return (
    <ToastContext.Provider
      value={{
        showToast,
        showSuccess,
        showError,
        showWarning,
        showInfo,
      }}
    >
      {children}

      {/* Display toast messages */}
      <Snackbar
        open={!!currentToast}
        autoHideDuration={currentToast?.duration || 4000}
        onClose={() => currentToast && handleClose(currentToast.id)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        TransitionComponent={SlideTransition}
        sx={{ mb: { xs: 7, sm: 0 } }} // Account for mobile bottom nav
      >
        {currentToast ? (
          <Alert
            onClose={() => handleClose(currentToast.id)}
            severity={currentToast.severity}
            variant="filled"
            sx={{
              width: "100%",
              minWidth: 300,
              boxShadow: 3,
              "& .MuiAlert-message": {
                fontSize: "0.95rem",
              },
            }}
          >
            {currentToast.message}
          </Alert>
        ) : undefined}
      </Snackbar>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (context === undefined) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}
