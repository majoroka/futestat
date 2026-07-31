export type TeamContextAvailabilityStatus =
  | "not_started"
  | "partial"
  | "available"
  | "unavailable"
  | "archived";

export type TeamContextCoverage = "none" | "low" | "medium" | "high";

export interface TeamContextAvailability {
  status: TeamContextAvailabilityStatus;
  coverage: TeamContextCoverage;
  notes: string | null;
}

export interface TeamContextPlayer {
  name: string;
  position: string | null;
  age: number | null;
  apps: number | null;
  goals: number | null;
  rating: number | null;
}

export interface TeamContextHealthEntry {
  player: string;
  status: string;
  description: string | null;
}

export interface TeamContextRecentMatch {
  date: string | null;
  homeTeam: string;
  awayTeam: string;
  result: string | null;
  odds1X2: {
    home: number | null;
    draw: number | null;
    away: number | null;
  } | null;
  homeRating: number | null;
  awayRating: number | null;
}

export interface TeamContextSimilarTeam {
  name: string;
  rating: number | null;
}

export interface TeamContextSnapshot {
  team: {
    id: string;
    name: string;
    slug: string;
    country: string | null;
    logoUrl: string | null;
  };
  season: {
    id: string;
    label: string;
    isCurrent: boolean;
  };
  source: {
    provider: "soccer-rating";
    url: string;
    collectedAtUtc: string;
  };
  availability: TeamContextAvailability;
  ratings: {
    overall: number | null;
    home: number | null;
    away: number | null;
  };
  rankings: {
    national: number | null;
    europe: number | null;
  };
  form: {
    last3: string[];
  };
  prediction: {
    tip: string | null;
    tipLabel: string | null;
    confidencePct: number | null;
    strengthComparison: string | null;
  };
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
  };
  squadHealth: {
    injuries: TeamContextHealthEntry[];
    suspensions: TeamContextHealthEntry[];
  };
  expectedLineup: {
    formation: string | null;
    averageRating: number | null;
    players: TeamContextPlayer[];
  };
  squad: TeamContextPlayer[];
  recentMatches: TeamContextRecentMatch[];
  similarTeams: TeamContextSimilarTeam[];
}

export interface TeamContextIndexEntry {
  season: string;
  countrySlug: string;
  teamId: string;
  teamSlug: string;
  jsonPath: string;
  sourceHtmlPath: string;
  parsedAtUtc: string;
  availabilityStatus: TeamContextAvailabilityStatus;
}

export interface TeamContextIndex {
  generatedAtUtc: string;
  entries: TeamContextIndexEntry[];
}
