import type {
  CompetitionStandingsRow,
  CompetitionStandingsSourceStatus,
} from "./competition-standings.js";
import type { MatchDetailOdds, MatchDetailTieContext, MatchDetailWatchInfo } from "./match-detail.js";
import type {
  TeamContextHealthEntry,
  TeamContextPlayer,
  TeamContextRecentMatch,
  TeamContextSimilarTeam,
} from "./team-context.js";

export interface MatchViewSeasonRef {
  id: string;
  label: string;
}

export interface MatchViewTeamIdentity {
  id: string | null;
  name: string;
  logoUrl: string | null;
  sourceIds: {
    sofascore: string | null;
    fotmob: string | null;
    soccerRating: string | null;
  };
}

export interface MatchViewTeamHeaderStats {
  overallRating: number | null;
  nationalRank: number | null;
  europeRank: number | null;
  formLast3: string[];
  xgFor: number | null;
  xgAgainst: number | null;
  averagePossessionPct: number | null;
  cleanSheets: number | null;
}

export interface MatchViewTeamOverview {
  prediction: {
    tip: string | null;
    tipLabel: string | null;
    confidencePct: number | null;
    strengthComparison: string | null;
  } | null;
  squadHealth: {
    injuries: TeamContextHealthEntry[];
    suspensions: TeamContextHealthEntry[];
  } | null;
  expectedLineup: {
    formation: string | null;
    averageRating: number | null;
    players: TeamContextPlayer[];
  } | null;
  oddsMarket: {
    opening1X2: {
      home: number | null;
      draw: number | null;
      away: number | null;
    } | null;
    fair1X2: {
      home: number | null;
      draw: number | null;
      away: number | null;
    } | null;
    movementSummary: string | null;
  } | null;
}

export interface MatchViewTeamStatistics {
  overview: {
    goalsPerMatch: number | null;
    goalsConcededPerMatch: number | null;
    averagePossessionPct: number | null;
    attendanceAverage: number | null;
  } | null;
  attack: {
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
  } | null;
  defense: {
    xgConceded: number | null;
    interceptionsPerMatch: number | null;
    tacklesPerMatch: number | null;
    clearancesPerMatch: number | null;
    finalThirdRecoveriesPerMatch: number | null;
    setPieceGoalsConceded: number | null;
    penaltiesConceded: number | null;
    savesPerMatch: number | null;
  } | null;
  discipline: {
    foulsPerMatch: number | null;
    yellowCardsPerMatch: number | null;
    redCardsPerMatch: number | null;
    penaltiesConceded: number | null;
  } | null;
}

export interface MatchViewTeamBlock {
  identity: MatchViewTeamIdentity;
  headerStats: MatchViewTeamHeaderStats;
  overview: MatchViewTeamOverview;
  statistics: MatchViewTeamStatistics;
  squad: TeamContextPlayer[];
  history: TeamContextRecentMatch[];
  similarTeams: TeamContextSimilarTeam[];
}

export interface MatchViewStandingRow extends CompetitionStandingsRow {
  highlight: "home" | "away" | null;
}

export interface MatchViewStandingsBlock {
  available: boolean;
  competitionId: string | null;
  sourceStatus: CompetitionStandingsSourceStatus | "missing";
  tableName: string | null;
  tableType: string | null;
  rows: MatchViewStandingRow[];
}

export interface MatchViewDetailsBlock {
  competitionStage: string | null;
  venueName: string | null;
  venueCity: string | null;
  venueCountry: string | null;
  refereeName: string | null;
  refereeCountry: string | null;
  odds: MatchDetailOdds | null;
  watch: MatchDetailWatchInfo | null;
  tieContext: MatchDetailTieContext | null;
}

export interface MatchViewDataSourceRef {
  available: boolean;
  path: string | null;
  matchedBy: string | null;
}

export interface MatchViewSnapshot {
  builtAtUtc: string;
  match: {
    id: string;
    date: string;
    status: string;
    resultLabel: string | null;
    homeScore: number | null;
    awayScore: number | null;
    matchUrl: string;
    kickoffAtUtc: string | null;
    competition: {
      id: string | null;
      name: string | null;
      country: string | null;
      logoUrl: string | null;
    };
    season: MatchViewSeasonRef;
    details: MatchViewDetailsBlock;
  };
  homeTeam: MatchViewTeamBlock;
  awayTeam: MatchViewTeamBlock;
  standings: MatchViewStandingsBlock;
  sources: {
    fixture: MatchViewDataSourceRef;
    matchDetail: MatchViewDataSourceRef;
    competitionStandings: MatchViewDataSourceRef;
    homeTeamStats: MatchViewDataSourceRef;
    awayTeamStats: MatchViewDataSourceRef;
    homeTeamContext: MatchViewDataSourceRef;
    awayTeamContext: MatchViewDataSourceRef;
  };
}

export interface MatchViewIndexEntry {
  fixtureId: string;
  matchDate: string;
  jsonPath: string;
  builtAtUtc: string;
}

export interface MatchViewIndex {
  generatedAtUtc: string;
  entries: MatchViewIndexEntry[];
}
