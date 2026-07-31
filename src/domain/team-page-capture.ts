export type TeamPageCaptureSource = "fotmob" | "soccer-rating";

export interface TeamPageCaptureManifestEntry {
  source: TeamPageCaptureSource;
  season: string;
  teamId: string;
  teamSlug: string;
  competitionId: string | null;
  competitionSlug: string | null;
  countrySlug: string | null;
  url: string;
  htmlPath: string;
  capturedAtUtc: string;
}

export interface TeamPageCaptureManifest {
  generatedAtUtc: string;
  entries: TeamPageCaptureManifestEntry[];
}
