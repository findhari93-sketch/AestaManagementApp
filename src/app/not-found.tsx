import { Box, Typography, Button, Container } from "@mui/material";
import Link from "next/link";

export default function NotFound() {
  return (
    <html lang="en">
      <body>
        <Container>
          <Box
            sx={{
              minHeight: "100vh",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              textAlign: "center",
            }}
          >
            <Typography variant="h1" fontWeight={600} gutterBottom>
              404
            </Typography>
            <Typography variant="h5" color="text.secondary" gutterBottom>
              Page Not Found
            </Typography>
            <Button
              component={Link}
              href="/site/dashboard"
              variant="contained"
              sx={{ mt: 3 }}
            >
              Go to Dashboard
            </Button>
          </Box>
        </Container>
      </body>
    </html>
  );
}
