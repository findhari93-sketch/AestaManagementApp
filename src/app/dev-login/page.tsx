"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Box, CircularProgress, Typography } from "@mui/material";
import { useAuth } from "@/contexts/AuthContext";

const DEV_EMAIL = "Haribabu@nerasmclasses.onmicrosoft.com";
const DEV_PASSWORD = "Padma@123";

export default function DevLoginPage() {
  const { signIn, user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [status, setStatus] = useState("Checking session...");
  const [error, setError] = useState("");

  useEffect(() => {
    if (process.env.NODE_ENV === "production") {
      setError("Dev login is not available in production.");
      return;
    }

    if (authLoading) return;

    if (user) {
      setStatus("Already authenticated. Redirecting...");
      router.push("/site/dashboard");
      return;
    }

    let cancelled = false;

    async function autoLogin() {
      try {
        setStatus("Signing in...");
        await signIn(DEV_EMAIL, DEV_PASSWORD);
        if (!cancelled) {
          setStatus("Authenticated! Redirecting...");
          router.push("/site/dashboard");
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.message || "Auto-login failed");
        }
      }
    }

    autoLogin();

    return () => {
      cancelled = true;
    };
  }, [authLoading, user, signIn, router]);

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 2,
      }}
    >
      {error ? (
        <Typography color="error">{error}</Typography>
      ) : (
        <>
          <CircularProgress size={32} />
          <Typography color="text.secondary">{status}</Typography>
        </>
      )}
    </Box>
  );
}
