import type {
  CompetitionStandingsMode,
  CompetitionStandingsSourceStatus,
} from "./competition-standings.js";

export type CompetitionManualSourceStatus = "pending" | "mapped" | "not_applicable";

export interface CompetitionSourceRegistryPlatformSource {
  status: CompetitionManualSourceStatus;
  sourceCompetitionId: string | null;
  competitionName: string | null;
  countryName: string | null;
  url: string | null;
  notes: string | null;
}

export interface CompetitionSourceRegistryZerozeroSource
  extends CompetitionSourceRegistryPlatformSource {
  variantUrls: string[];
  variantCompetitionNames: string[];
}

export interface CompetitionSourceRegistryEntry {
  sofascoreCompetitionId: string;
  competitionName: string;
  countryName: string;
  competitionAliases: string[];
  countryAliases: string[];
  standings: {
    enabled: boolean;
    mode: CompetitionStandingsMode | null;
    status: CompetitionStandingsSourceStatus | null;
    primaryZerozeroUrl: string | null;
    variantZerozeroUrls: string[];
  };
  sources: {
    zerozero: CompetitionSourceRegistryZerozeroSource;
    fotmob: CompetitionSourceRegistryPlatformSource;
    soccerRating: CompetitionSourceRegistryPlatformSource;
  };
}

export interface CompetitionSourceRegistry {
  generatedAtUtc: string;
  sourcePath: string;
  entryCount: number;
  entries: CompetitionSourceRegistryEntry[];
}
