"use client";

import { useEffect, useState } from "react";
import {
  Box,
  Container,
  Typography,
  Alert,
  CircularProgress,
  Card,
  CardContent,
  Chip,
} from "@mui/material";
import { createClient } from "@/lib/supabase/client";

export default function DebugPage() {
  const [status, setStatus] = useState<{
    envVarsLoaded: boolean;
    supabaseUrl?: string;
    connectionTest?: string;
    error?: string;
  }>({
    envVarsLoaded: false,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkConnection = async () => {
      try {
        // Check environment variables
        const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

        if (!url || !key) {
          setStatus({
            envVarsLoaded: false,
            error: "Environment variables not loaded",
          });
          return;
        }

        setStatus((prev) => ({
          ...prev,
          envVarsLoaded: true,
          supabaseUrl: url,
        }));

        // Try to create client and test connection
        const supabase = createClient();
        const { data, error } = await supabase
          .from("users")
          .select("count")
          .limit(1);

        if (error) {
          setStatus((prev) => ({
            ...prev,
            connectionTest: "Failed",
            error: error.message,
          }));
        } else {
          setStatus((prev) => ({
            ...prev,
            connectionTest: "Success",
          }));
        }
      } catch (err: any) {
        setStatus((prev) => ({
          ...prev,
          error: err.message,
        }));
      } finally {
        setLoading(false);
      }
    };

    checkConnection();
  }, []);

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Typography variant="h4" gutterBottom>
        Supabase Connection Debug
      </Typography>

      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
          <CircularProgress />
        </Box>
      ) : (
        <Card>
          <CardContent>
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle2" color="text.secondary">
                Environment Variables
              </Typography>
              <Chip
                label={status.envVarsLoaded ? "Loaded ✓" : "Not Loaded ✗"}
                color={status.envVarsLoaded ? "success" : "error"}
                size="small"
                sx={{ mt: 1 }}
              />
            </Box>

            {status.supabaseUrl && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle2" color="text.secondary">
                  Supabase URL
                </Typography>
                <Typography
                  variant="body2"
                  sx={{ fontFamily: "monospace", mt: 0.5 }}
                >
                  {status.supabaseUrl}
                </Typography>
              </Box>
            )}

            {status.connectionTest && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle2" color="text.secondary">
                  Connection Test
                </Typography>
                <Chip
                  label={status.connectionTest}
                  color={
                    status.connectionTest === "Success" ? "success" : "error"
                  }
                  size="small"
                  sx={{ mt: 1 }}
                />
              </Box>
            )}

            {status.error && (
              <Alert severity="error" sx={{ mt: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Error Details
                </Typography>
                <Typography
                  variant="body2"
                  sx={{ fontFamily: "monospace", fontSize: "0.875rem" }}
                >
                  {status.error}
                </Typography>
              </Alert>
            )}

            {!status.error && status.connectionTest === "Success" && (
              <Alert severity="success" sx={{ mt: 2 }}>
                Supabase connection is working correctly!
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      <Box sx={{ mt: 4 }}>
        <Typography variant="h6" gutterBottom>
          Troubleshooting Steps
        </Typography>
        <Typography variant="body2" component="div">
          <ol>
            <li>
              Verify .env.local file exists and contains
              NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY
            </li>
            <li>
              In Supabase Dashboard → Authentication → URL Configuration, add:
              <ul>
                <li>Site URL: http://localhost:3000</li>
                <li>Redirect URLs: http://localhost:3000/**</li>
              </ul>
            </li>
            <li>
              Ensure Email provider is enabled in Authentication → Providers
            </li>
            <li>Restart the Next.js dev server after changing .env.local</li>
          </ol>
        </Typography>
      </Box>
    </Container>
  );
}
