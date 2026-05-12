"use client";

import { useParams, useRouter } from "next/navigation";
import { Box, Button, CircularProgress, Alert } from "@mui/material";
import { ArrowBack as BackIcon } from "@mui/icons-material";
import PageHeader from "@/components/layout/PageHeader";
import { MaterialRequestJourney } from "@/components/materials/journey";
import { useRequestJourney } from "@/hooks/queries/useRequestJourney";

export default function MaterialRequestDetailsPage() {
  const params = useParams();
  const router = useRouter();

  const requestId = params.requestId as string;

  const { journey, isLoading, error } = useRequestJourney(requestId);

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" py={8}>
        <CircularProgress />
      </Box>
    );
  }

  if (error || !journey) {
    return (
      <Box p={4}>
        <Alert severity="error">
          Failed to load material request. It may have been deleted or you don&apos;t have access.
        </Alert>
        <Button startIcon={<BackIcon />} onClick={() => router.back()} sx={{ mt: 2 }}>
          Go Back
        </Button>
      </Box>
    );
  }

  return (
    <Box>
      <PageHeader
        title={`Request ${journey.request.request_number}`}
        actions={
          <Button startIcon={<BackIcon />} onClick={() => router.back()} size="small">
            Back
          </Button>
        }
      />

      <MaterialRequestJourney requestId={requestId} isFullPage={true} />
    </Box>
  );
}
