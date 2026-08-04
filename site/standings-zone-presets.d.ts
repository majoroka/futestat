export interface StandingsZonePreset {
  from: number;
  to: number;
  tone: string;
  label: string;
}

export declare const STANDINGS_ZONE_PRESETS: Record<string, unknown>;

export declare function getStandingsZonePreset(
  competitionId: string | null | undefined,
  ruleProfileId?: string | null,
): StandingsZonePreset[];
