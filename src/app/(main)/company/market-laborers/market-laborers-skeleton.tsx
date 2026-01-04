"use client";

import { Box, Skeleton, Paper } from "@mui/material";

export default function MarketLaborersSkeleton() {
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
          <Skeleton variant="text" width={300} height={24} />
        </Box>
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
          {[180, 150, 120, 100, 80].map((width, i) => (
            <Skeleton key={i} variant="text" width={width} height={24} />
          ))}
        </Box>

        {/* Table rows - 5 market roles */}
        {[1, 2, 3, 4, 5].map((row) => (
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
            {[180, 150, 120, 100, 80].map((width, i) => (
              <Skeleton key={i} variant="text" width={width} height={20} />
            ))}
          </Box>
        ))}
      </Paper>
    </Box>
  );
}
