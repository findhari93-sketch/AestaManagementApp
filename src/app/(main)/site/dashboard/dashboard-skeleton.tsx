"use client";

import { Box, Skeleton, Grid, Paper } from "@mui/material";

export default function DashboardSkeleton() {
  return (
    <Box>
      {/* Header skeleton */}
      <Box sx={{ mb: 3 }}>
        <Skeleton variant="text" width={200} height={40} />
        <Skeleton variant="text" width={300} height={24} />
      </Box>

      {/* Stats cards skeleton */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {[1, 2, 3, 4].map((i) => (
          <Grid key={i} size={{ xs: 12, sm: 6, md: 3 }}>
            <Skeleton variant="rounded" height={120} sx={{ borderRadius: 3 }} />
          </Grid>
        ))}
      </Grid>

      {/* Content skeleton */}
      <Grid container spacing={3}>
        {/* Recent Attendance */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Paper sx={{ p: 3, borderRadius: 3 }}>
            <Skeleton variant="text" width={150} height={32} sx={{ mb: 2 }} />
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} height={60} sx={{ mb: 1 }} />
            ))}
          </Paper>
        </Grid>

        {/* Pending Salaries */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Paper sx={{ p: 3, borderRadius: 3 }}>
            <Skeleton variant="text" width={150} height={32} sx={{ mb: 2 }} />
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} height={60} sx={{ mb: 1 }} />
            ))}
          </Paper>
        </Grid>

        {/* Weekly Trend Chart */}
        <Grid size={{ xs: 12, md: 8 }}>
          <Paper sx={{ p: 3, borderRadius: 3 }}>
            <Skeleton variant="text" width={150} height={32} sx={{ mb: 2 }} />
            <Skeleton variant="rectangular" height={300} />
          </Paper>
        </Grid>

        {/* Expense Breakdown */}
        <Grid size={{ xs: 12, md: 4 }}>
          <Paper sx={{ p: 3, borderRadius: 3 }}>
            <Skeleton variant="text" width={150} height={32} sx={{ mb: 2 }} />
            <Skeleton
              variant="circular"
              width={200}
              height={200}
              sx={{ mx: "auto" }}
            />
          </Paper>
        </Grid>

        {/* Quick Actions */}
        <Grid size={{ xs: 12 }}>
          <Paper sx={{ p: 3, borderRadius: 3 }}>
            <Skeleton variant="text" width={150} height={32} sx={{ mb: 2 }} />
            <Grid container spacing={2}>
              {[1, 2, 3, 4].map((i) => (
                <Grid key={i} size={{ xs: 12, sm: 6, md: 3 }}>
                  <Skeleton variant="rounded" height={50} />
                </Grid>
              ))}
            </Grid>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}
