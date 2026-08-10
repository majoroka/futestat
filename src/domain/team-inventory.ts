import type { TeamManualSourceStatus } from "./team-source-registry.js";

export interface TeamInventorySourceSummary {
  status: TeamManualSourceStatus | "unknown";
  sourceTeamId: string | null;
  url: string | null;
}

export interface TeamInventoryTeamReport {
  inventoryTeamName: string;
  source: "standings" | "registry";
  matchedRegistry: boolean;
  matchMethod: "sofascoreTeamId" | "normalized_name" | null;
  sofascoreTeamId: string | null;
  registryTeamName: string | null;
  sources: {
    fotmob: TeamInventorySourceSummary;
    soccerRating: TeamInventorySourceSummary;
  };
}

export interface TeamInventoryCompetitionReport {
  competitionId: string;
  competitionName: string;
  countryName: string;
  hasStandingsSnapshot: boolean;
  standingsPath: string | null;
  teamCount: number;
  matchedRegistryTeams: number;
  missingRegistryTeams: number;
  teams: TeamInventoryTeamReport[];
}

export interface TeamInventoryReport {
  source: "whitelist-plus-standings";
  generatedAtUtc: string;
  referenceDate: string | null;
  registryPath: string | null;
  standingsDir: string;
  summary: {
    competitions: number;
    competitionsWithStandings: number;
    competitionsWithoutStandings: number;
    teams: number;
    matchedRegistryTeams: number;
    missingRegistryTeams: number;
  };
  competitions: TeamInventoryCompetitionReport[];
}
