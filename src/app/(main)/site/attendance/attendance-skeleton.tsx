"use client";

import { Box, Skeleton, Card, CardContent, Grid, Paper } from "@mui/material";

export default function AttendanceSkeleton() {
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
        <Box sx={{ display: "flex", gap: 1 }}>
          <Skeleton variant="rounded" width={100} height={36} />
          <Skeleton variant="rounded" width={140} height={36} />
        </Box>
      </Box>

      {/* Summary stats card skeleton */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={3}>
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Grid key={i} size={{ xs: 6, sm: 4, md: 2 }}>
                <Skeleton variant="text" width={80} height={20} />
                <Skeleton variant="text" width={100} height={32} />
              </Grid>
            ))}
          </Grid>
        </CardContent>
      </Card>

      {/* Weekly separator skeleton */}
      <Paper sx={{ mb: 2, p: 2, bgcolor: "primary.50", borderRadius: 2 }}>
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Skeleton variant="text" width={200} height={28} />
          <Skeleton variant="rounded" width={120} height={32} />
        </Box>
      </Paper>

      {/* Date cards skeleton */}
      {[1, 2, 3, 4, 5].map((row) => (
        <Paper
          key={row}
          sx={{
            mb: 2,
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
              bgcolor: "grey.50",
              alignItems: "center",
            }}
          >
            <Skeleton variant="circular" width={40} height={40} />
            <Box sx={{ flex: 1 }}>
              <Skeleton variant="text" width={150} height={24} />
              <Skeleton variant="text" width={100} height={16} />
            </Box>
            <Box sx={{ display: "flex", gap: 2 }}>
              <Skeleton variant="text" width={80} height={20} />
              <Skeleton variant="text" width={80} height={20} />
              <Skeleton variant="text" width={100} height={20} />
            </Box>
            <Skeleton variant="circular" width={36} height={36} />
          </Box>

          {/* Collapsed content hint */}
          <Box sx={{ p: 1, borderTop: 1, borderColor: "divider" }}>
            <Box sx={{ display: "flex", gap: 1 }}>
              {[1, 2, 3].map((chip) => (
                <Skeleton key={chip} variant="rounded" width={70} height={24} />
              ))}
            </Box>
          </Box>
        </Paper>
      ))}
    </Box>
  );
}
