export type TeamManualSourceStatus = "pending" | "mapped" | "not_applicable";

export interface TeamSourceRegistryFotmobSource {
  status: TeamManualSourceStatus;
  sourceTeamId: string | null;
  teamSlug: string | null;
  competitionId: string | null;
  competitionSlug: string | null;
  url: string | null;
  notes: string | null;
}

export interface TeamSourceRegistrySoccerRatingSource {
  status: TeamManualSourceStatus;
  sourceTeamId: string | null;
  teamSlug: string | null;
  countrySlug: string | null;
  url: string | null;
  notes: string | null;
}

export interface TeamSourceRegistryEntry {
  sofascoreTeamId: string;
  teamName: string;
  countryName: string | null;
  competitionId: string | null;
  competitionName: string | null;
  activeInCurrentWindow: boolean;
  fixtureAppearancesInCurrentWindow: number;
  firstSeenReferenceDate: string;
  lastSeenReferenceDate: string;
  sources: {
    fotmob: TeamSourceRegistryFotmobSource;
    soccerRating: TeamSourceRegistrySoccerRatingSource;
  };
}

export interface TeamSourceRegistry {
  generatedAtUtc: string;
  referenceDate: string;
  snapshotPath: string;
  entries: TeamSourceRegistryEntry[];
}
