import type { TeamManualSourceStatus } from "./team-source-registry.js";

export interface TeamMappingSourceReport {
  status: TeamManualSourceStatus;
  sourceTeamId: string | null;
  teamSlug: string | null;
  url: string | null;
  notes: string | null;
}

export interface TeamMappingTeamReport {
  sofascoreTeamId: string;
  teamName: string;
  activeInCurrentWindow: boolean;
  fixtureAppearancesInCurrentWindow: number;
  firstSeenReferenceDate: string;
  lastSeenReferenceDate: string;
  sources: {
    fotmob: TeamMappingSourceReport;
    soccerRating: TeamMappingSourceReport;
  };
  mappingState: "complete" | "partial" | "missing";
  recommendedNextSteps: string[];
}

export interface TeamMappingCompetitionReport {
  competitionId: string | null;
  competitionName: string | null;
  countryName: string | null;
  teamCount: number;
  activeTeams: number;
  coverage: {
    complete: number;
    partial: number;
    missing: number;
    fotmobMapped: number;
    soccerRatingMapped: number;
  };
  teams: TeamMappingTeamReport[];
}

export interface TeamMappingReport {
  source: "team-source-registry";
  generatedAtUtc: string;
  referenceDate: string;
  registryPath: string;
  summary: {
    competitions: number;
    teams: number;
    activeTeams: number;
    complete: number;
    partial: number;
    missing: number;
    fotmobMapped: number;
    soccerRatingMapped: number;
  };
  competitions: TeamMappingCompetitionReport[];
}
