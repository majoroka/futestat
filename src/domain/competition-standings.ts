export type CompetitionStandingsMode =
  | "single_table"
  | "regular_plus_playoffs"
  | "league_phase";

export type CompetitionStandingsSourceStatus =
  | "ready"
  | "needs_phase_rules"
  | "needs_validation";

export interface CompetitionStandingsRow {
  position: number | null;
  teamName: string;
  teamUrl: string | null;
  points: number | null;
  matches: number | null;
  wins: number | null;
  draws: number | null;
  losses: number | null;
  goalsFor: number | null;
  goalsAgainst: number | null;
  goalDifference: string | null;
}

export interface CompetitionStandingsTable {
  name: string | null;
  type: string | null;
  rows: CompetitionStandingsRow[];
}

export interface CompetitionStandingsSnapshot {
  source: "zerozero";
  competitionId: string;
  competitionName: string | null;
  countryName: string | null;
  zerozeroUrl: string;
  mode: CompetitionStandingsMode;
  status: CompetitionStandingsSourceStatus;
  scrapedAtUtc: string;
  editionId: string | null;
  phaseId: string | null;
  phaseName: string | null;
  phaseNotes: string[];
  ruleProfileId: string | null;
  tables: CompetitionStandingsTable[];
}

export interface CompetitionStandingsRefreshResult {
  attempted: number;
  refreshed: number;
  skipped: number;
  failed: number;
  refreshedCompetitionIds: string[];
  outputDir: string;
}
