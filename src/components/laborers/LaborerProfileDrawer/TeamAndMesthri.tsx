"use client";

import { Box, Stack } from "@mui/material";
import type { Tables } from "@/types/database.types";
import type { LaborerWithDetails } from "@/lib/data/laborers";
import { InfoRow, SectionTitle } from "./shared";

type Team = Tables<"teams">;

interface TeamAndMesthriProps {
  laborer: LaborerWithDetails;
  teams: Team[];
}

export default function TeamAndMesthri({
  laborer,
  teams,
}: TeamAndMesthriProps) {
  const workTeam = laborer.team_id
    ? teams.find((t) => t.id === laborer.team_id)
    : undefined;
  const mesthriTeam = laborer.associated_team_id
    ? teams.find((t) => t.id === laborer.associated_team_id)
    : undefined;

  return (
    <Box>
      <SectionTitle>Team &amp; mesthri</SectionTitle>
      <Stack>
        <InfoRow
          label="Work team"
          value={workTeam?.name ?? laborer.team_name ?? "Not assigned"}
        />
        <InfoRow
          label="Mesthri team"
          value={
            mesthriTeam?.name ?? laborer.associated_team_name ?? "Not assigned"
          }
        />
        {mesthriTeam?.leader_name && (
          <InfoRow label="Mesthri leader" value={mesthriTeam.leader_name} />
        )}
        {mesthriTeam?.leader_phone && (
          <InfoRow label="Leader phone" value={mesthriTeam.leader_phone} />
        )}
      </Stack>
    </Box>
  );
}
