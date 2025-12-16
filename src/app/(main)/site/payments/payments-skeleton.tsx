"use client";

import { Box, Skeleton, Card, CardContent, Grid, Paper, Tabs, Tab } from "@mui/material";

export default function PaymentsSkeleton() {
  return (
    <Box>
      {/* Header skeleton */}
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          mb: 3,
        }}
      >
        <Box>
          <Skeleton variant="text" width={200} height={40} />
          <Skeleton variant="text" width={350} height={24} />
        </Box>
      </Box>

      {/* Summary cards skeleton */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {[1, 2, 3, 4].map((i) => (
          <Grid key={i} size={{ xs: 6, sm: 3 }}>
            <Card>
              <CardContent sx={{ py: 1.5 }}>
                <Skeleton variant="text" width={80} height={20} />
                <Skeleton variant="text" width={100} height={32} />
                <Skeleton variant="text" width={60} height={16} />
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Tabs skeleton */}
      <Paper sx={{ mb: 3 }}>
        <Box sx={{ borderBottom: 1, borderColor: "divider" }}>
          <Tabs value={0}>
            <Tab
              label={
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <Skeleton variant="circular" width={24} height={24} />
                  <Skeleton variant="text" width={150} height={24} />
                </Box>
              }
            />
            <Tab
              label={
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <Skeleton variant="circular" width={24} height={24} />
                  <Skeleton variant="text" width={180} height={24} />
                </Box>
              }
            />
          </Tabs>
        </Box>

        <Box sx={{ p: 2 }}>
          {/* Filter bar skeleton */}
          <Box sx={{ display: "flex", gap: 2, mb: 3, flexWrap: "wrap" }}>
            <Skeleton variant="rounded" width={120} height={40} />
            <Skeleton variant="rounded" width={150} height={40} />
            <Skeleton variant="rounded" width={100} height={40} />
          </Box>

          {/* Weekly strip skeleton */}
          <Paper sx={{ mb: 2, p: 1.5, bgcolor: "primary.50", borderRadius: 2 }}>
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Skeleton variant="circular" width={24} height={24} />
                <Skeleton variant="text" width={180} height={28} />
              </Box>
              <Box sx={{ display: "flex", gap: 2, alignItems: "center" }}>
                <Box sx={{ textAlign: "center" }}>
                  <Skeleton variant="text" width={80} height={16} />
                  <Skeleton variant="text" width={100} height={24} />
                </Box>
                <Box sx={{ textAlign: "center" }}>
                  <Skeleton variant="text" width={60} height={16} />
                  <Skeleton variant="text" width={80} height={24} />
                </Box>
                <Skeleton variant="rounded" width={100} height={32} />
              </Box>
            </Box>
          </Paper>

          {/* Date group cards skeleton */}
          {[1, 2, 3, 4, 5].map((row) => (
            <Paper
              key={row}
              sx={{
                mb: 1.5,
                borderRadius: 2,
                overflow: "hidden",
              }}
            >
              {/* Date header */}
              <Box
                sx={{
                  display: "flex",
                  gap: 2,
                  p: 2,
                  alignItems: "center",
                }}
              >
                <Box sx={{ minWidth: 100 }}>
                  <Skeleton variant="text" width={100} height={24} />
                  <Skeleton variant="text" width={70} height={16} />
                </Box>

                <Box sx={{ display: "flex", gap: 3, flex: 1 }}>
                  <Box sx={{ textAlign: "center" }}>
                    <Skeleton variant="text" width={60} height={20} />
                    <Skeleton variant="text" width={80} height={16} />
                  </Box>
                  <Box sx={{ textAlign: "center" }}>
                    <Skeleton variant="text" width={70} height={20} />
                    <Skeleton variant="text" width={80} height={16} />
                  </Box>
                </Box>

                <Box sx={{ display: "flex", gap: 2, alignItems: "center" }}>
                  <Box sx={{ textAlign: "right" }}>
                    <Skeleton variant="text" width={60} height={14} />
                    <Skeleton variant="text" width={80} height={20} />
                  </Box>
                  <Box sx={{ textAlign: "right" }}>
                    <Skeleton variant="text" width={40} height={14} />
                    <Skeleton variant="text" width={80} height={20} />
                  </Box>
                </Box>

                <Box sx={{ display: "flex", gap: 1 }}>
                  <Skeleton variant="rounded" width={100} height={32} />
                  <Skeleton variant="rounded" width={100} height={32} />
                </Box>

                <Skeleton variant="circular" width={32} height={32} />
              </Box>
            </Paper>
          ))}
        </Box>
      </Paper>
    </Box>
  );
}
