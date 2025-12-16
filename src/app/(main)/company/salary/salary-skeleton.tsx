"use client";

import { Box, Skeleton, Card, CardContent, Grid, Paper } from "@mui/material";

export default function SalarySkeleton() {
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
        <Skeleton variant="rounded" width={160} height={36} />
      </Box>

      {/* Stats card skeleton */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={3}>
            {[1, 2, 3, 4].map((i) => (
              <Grid key={i} size={{ xs: 6, md: 3 }}>
                <Skeleton variant="text" width={100} height={20} />
                <Skeleton variant="text" width={120} height={36} />
              </Grid>
            ))}
          </Grid>
        </CardContent>
      </Card>

      {/* Table skeleton */}
      <Paper sx={{ borderRadius: 2, overflow: "hidden" }}>
        {/* Table header */}
        <Box
          sx={{
            display: "flex",
            gap: 2,
            p: 2,
            bgcolor: "grey.50",
            borderBottom: 1,
            borderColor: "divider",
          }}
        >
          {[100, 180, 140, 120, 80, 110, 100, 90, 120, 110, 100].map(
            (width, i) => (
              <Skeleton key={i} variant="text" width={width} height={24} />
            )
          )}
        </Box>

        {/* Table rows */}
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((row) => (
          <Box
            key={row}
            sx={{
              display: "flex",
              gap: 2,
              p: 2,
              borderBottom: 1,
              borderColor: "divider",
            }}
          >
            {[100, 180, 140, 120, 80, 110, 100, 90, 120, 110, 100].map(
              (width, i) => (
                <Skeleton key={i} variant="text" width={width} height={20} />
              )
            )}
          </Box>
        ))}
      </Paper>
    </Box>
  );
}
