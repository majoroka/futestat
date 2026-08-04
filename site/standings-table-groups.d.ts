export interface StandingsPresentationTable {
  name: string | null;
  type: string | null;
  rows: unknown[];
  badge: string | null;
  role: string | null;
}

export interface StandingsTableLayout {
  summary: string | null;
  primaryTables: StandingsPresentationTable[];
  secondaryTables: StandingsPresentationTable[];
}

export declare function buildStandingsTableLayout(
  tables: unknown[],
  fixture: {
    homeTeamName: string;
    awayTeamName: string;
  },
): StandingsTableLayout;
