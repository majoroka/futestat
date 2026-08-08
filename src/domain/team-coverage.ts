export interface TeamCoverageSourceMatch {
  available: boolean;
  matchedBy: "sofascoreTeamId" | "teamSlug" | null;
  sourceTeamId: string | null;
  sourceTeamSlug: string | null;
  season: string | null;
  availabilityStatus: string | null;
  jsonPath: string | null;
}

export interface TeamCoverageTeamReport {
  sofascoreTeamId: string | null;
  teamName: string;
  fixtureAppearances: number;
  sources: {
    fotmob: TeamCoverageSourceMatch;
    soccerRating: TeamCoverageSourceMatch;
  };
  recommendedNextSteps: string[];
}

export interface TeamCoverageCompetitionReport {
  competitionId: string | null;
  competitionName: string | null;
  countryName: string | null;
  teamCount: number;
  coverage: {
    teamsWithFotmob: number;
    teamsWithSoccerRating: number;
    teamsComplete: number;
    teamsMissingBoth: number;
  };
  teams: TeamCoverageTeamReport[];
}

export interface TeamCoverageReport {
  source: "fixtures-window";
  generatedAtUtc: string;
  referenceDate: string;
  preferredSeasonFs: string;
  snapshotPath: string;
  summary: {
    competitions: number;
    teams: number;
    teamsWithFotmob: number;
    teamsWithSoccerRating: number;
    teamsComplete: number;
    teamsMissingBoth: number;
  };
  competitions: TeamCoverageCompetitionReport[];
}
