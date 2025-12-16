"use client";

import { Box, Skeleton, Paper } from "@mui/material";

export default function LaborersSkeleton() {
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
          <Skeleton variant="text" width={150} height={40} />
          <Skeleton variant="text" width={200} height={24} />
        </Box>
        <Skeleton variant="rounded" width={120} height={36} />
      </Box>

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
          {[180, 110, 130, 150, 100, 90, 120, 110, 130, 100].map((width, i) => (
            <Skeleton key={i} variant="text" width={width} height={24} />
          ))}
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
            {[180, 110, 130, 150, 100, 90, 120, 110, 130, 100].map(
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
