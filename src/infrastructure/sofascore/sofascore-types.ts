import type { FixtureStatus } from "../../domain/fixture.js";

export interface RawSofascoreFixture {
  eventId: string;
  matchDate: string;
  kickoffTime: string | null;
  competitionId: string | null;
  competitionName: string | null;
  competitionLogoUrl: string | null;
  countryName: string | null;
  homeTeamId: string | null;
  homeTeamName: string;
  homeTeamLogoUrl: string | null;
  awayTeamId: string | null;
  awayTeamName: string;
  awayTeamLogoUrl: string | null;
  status: FixtureStatus;
  resultLabel: string | null;
  homeScore: number | null;
  awayScore: number | null;
  href: string;
}
