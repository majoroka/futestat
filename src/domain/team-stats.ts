export type TeamStatsAvailabilityStatus =
  | "not_started"
  | "partial"
  | "available"
  | "unavailable"
  | "archived";

export type TeamStatsCoverage = "none" | "low" | "medium" | "high";

export interface TeamStatsAvailability {
  status: TeamStatsAvailabilityStatus;
  coverage: TeamStatsCoverage;
  notes: string | null;
}

export interface TeamStatsOverview {
  teamRating: number | null;
  goalsPerMatch: number | null;
  goalsConcededPerMatch: number | null;
  averagePossessionPct: number | null;
  cleanSheets: number | null;
  attendanceAverage: number | null;
}

export interface TeamStatsAttack {
  xg: number | null;
  xgDiff: number | null;
  shotsOnTargetPerMatch: number | null;
  bigChances: number | null;
  bigChancesMissed: number | null;
  accuratePassesPerMatch: number | null;
  accurateLongBallsPerMatch: number | null;
  accurateCrossesPerMatch: number | null;
  penaltiesAwarded: number | null;
  touchesInOppBoxPerMatch: number | null;
  cornersPerMatch: number | null;
  setPieceGoals: number | null;
}

export interface TeamStatsDefense {
  xgConceded: number | null;
  interceptionsPerMatch: number | null;
  tacklesPerMatch: number | null;
  clearancesPerMatch: number | null;
  finalThirdRecoveriesPerMatch: number | null;
  setPieceGoalsConceded: number | null;
  penaltiesConceded: number | null;
  savesPerMatch: number | null;
}

export interface TeamStatsDiscipline {
  foulsPerMatch: number | null;
  yellowCardsPerMatch: number | null;
  redCardsPerMatch: number | null;
}

export interface TeamStatsSeasonSnapshot {
  team: {
    id: string;
    name: string;
    slug: string;
    country: string | null;
    logoUrl: string | null;
  };
  competition: {
    id: string;
    name: string;
  };
  season: {
    id: string;
    label: string;
    isCurrent: boolean;
  };
  source: {
    provider: "fotmob";
    url: string;
    collectedAtUtc: string;
  };
  availability: TeamStatsAvailability;
  overview: TeamStatsOverview;
  attack: TeamStatsAttack;
  defense: TeamStatsDefense;
  discipline: TeamStatsDiscipline;
}

export interface TeamStatsIndexEntry {
  season: string;
  competitionId: string;
  competitionSlug: string;
  teamId: string;
  teamSlug: string;
  jsonPath: string;
  sourceHtmlPath: string;
  parsedAtUtc: string;
  availabilityStatus: TeamStatsAvailabilityStatus;
}

export interface TeamStatsIndex {
  generatedAtUtc: string;
  entries: TeamStatsIndexEntry[];
}
