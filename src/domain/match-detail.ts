export interface MatchDetailOdds {
  providerId: number | null;
  marketName: string | null;
  home: string | null;
  draw: string | null;
  away: string | null;
  hasMoreOdds: boolean;
}

export interface MatchDetailWatchInfo {
  hasPortugalChannels: boolean;
  availableCountryCodes: string[];
  note: string | null;
}

export interface RelatedMatchSummary {
  sourceEventId: string;
  matchUrl: string | null;
  kickoffAtUtc: string | null;
  competitionName: string | null;
  countryName: string | null;
  roundName: string | null;
  homeTeamId: string | null;
  homeTeamName: string;
  awayTeamId: string | null;
  awayTeamName: string;
  homeScore: number | null;
  awayScore: number | null;
  status: string | null;
  resultLabel: string | null;
  previousLegEventId: string | null;
  winnerCode: number | null;
}

export interface MatchDetailTieContext {
  tieFormat: string | null;
  previousLeg: RelatedMatchSummary | null;
  nextLeg: RelatedMatchSummary | null;
  h2h: RelatedMatchSummary[];
}

export interface MatchDetailRecentContext {
  homeLast: RelatedMatchSummary[];
  homeNext: RelatedMatchSummary[];
  awayLast: RelatedMatchSummary[];
  awayNext: RelatedMatchSummary[];
}

export interface MatchDetailOverview {
  kickoffAtUtc: string | null;
  competitionId: string | null;
  competitionName: string | null;
  competitionLogoUrl: string | null;
  competitionStage: string | null;
  countryName: string | null;
  venueName: string | null;
  venueCity: string | null;
  venueCountry: string | null;
  refereeName: string | null;
  refereeCountry: string | null;
}

export interface MatchDetailSnapshot {
  source: "sofascore";
  sourceEventId: string;
  matchUrl: string;
  status: "upcoming";
  scrapedAtUtc: string;
  fixtureLastSeenAtUtc: string;
  fixtureLastChangedAtUtc: string;
  overview: MatchDetailOverview;
  watch: MatchDetailWatchInfo;
  odds: MatchDetailOdds | null;
  tieContext: MatchDetailTieContext | null;
  recent: MatchDetailRecentContext;
}

export interface MatchDetailRefreshResult {
  attempted: number;
  refreshed: number;
  skipped: number;
  failed: number;
  refreshedEventIds: string[];
  outputDir: string;
}
