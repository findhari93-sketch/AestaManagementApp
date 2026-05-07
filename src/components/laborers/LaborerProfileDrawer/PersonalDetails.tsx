"use client";

import { Box, Stack } from "@mui/material";
import { formatDate } from "@/lib/formatters";
import type { LaborerWithDetails } from "@/lib/data/laborers";
import { InfoRow, SectionTitle } from "./shared";

interface PersonalDetailsProps {
  laborer: LaborerWithDetails;
}

export default function PersonalDetails({ laborer }: PersonalDetailsProps) {
  return (
    <Box>
      <SectionTitle>Personal details</SectionTitle>
      <Stack>
        <InfoRow label="Phone" value={laborer.phone} />
        <InfoRow label="Alternate phone" value={laborer.alternate_phone} />
        <InfoRow label="Language" value={laborer.language} />
        <InfoRow label="Age" value={laborer.age} />
        <InfoRow label="Address" value={laborer.address} />
        <InfoRow label="ID proof type" value={laborer.id_proof_type} />
        <InfoRow label="ID proof number" value={laborer.id_proof_number} />
        <InfoRow
          label="Emergency contact"
          value={
            laborer.emergency_contact_name
              ? laborer.emergency_contact_phone
                ? `${laborer.emergency_contact_name} (${laborer.emergency_contact_phone})`
                : laborer.emergency_contact_name
              : null
          }
        />
        <InfoRow
          label="Joined"
          value={laborer.joining_date ? formatDate(laborer.joining_date) : null}
        />
        {laborer.status === "inactive" && laborer.deactivation_date && (
          <InfoRow
            label="Deactivated"
            value={formatDate(laborer.deactivation_date)}
          />
        )}
        {laborer.notes && <InfoRow label="Notes" value={laborer.notes} />}
      </Stack>
    </Box>
  );
}
