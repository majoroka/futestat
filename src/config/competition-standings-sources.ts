import type {
  CompetitionStandingsMode,
  CompetitionStandingsSourceStatus,
} from "../domain/competition-standings.js";
import {
  matchesCompetitionIdentity,
  normalizeCompetitionToken,
  type FixtureCompetitionIdentity,
} from "../lib/competition-matcher.js";

export interface CompetitionStandingsSource {
  competitionId: string;
  competitionName: string;
  countryName: string;
  zerozeroUrl: string;
  mode: CompetitionStandingsMode;
  status: CompetitionStandingsSourceStatus;
  enabled: boolean;
  competitionAliases?: string[];
  countryAliases?: string[];
}

export const DEFAULT_COMPETITION_STANDINGS_SOURCES: CompetitionStandingsSource[] = [
  { competitionId: "7", competitionName: "UEFA Champions League", countryName: "Europe", zerozeroUrl: "https://www.zerozero.pt/competicao/liga-dos-campeoes", mode: "league_phase", status: "needs_phase_rules", enabled: true },
  { competitionId: "7", competitionName: "UEFA Champions League, Qualification", countryName: "Europe", zerozeroUrl: "https://www.zerozero.pt/competicao/liga-dos-campeoes-qualificacao-", mode: "league_phase", status: "needs_phase_rules", enabled: true, competitionAliases: ["UEFA Champions League"] },
  { competitionId: "679", competitionName: "UEFA Europa League", countryName: "Europe", zerozeroUrl: "https://www.zerozero.pt/competicao/liga-europa", mode: "league_phase", status: "needs_phase_rules", enabled: true },
  { competitionId: "679", competitionName: "UEFA Europa League, Qualification", countryName: "Europe", zerozeroUrl: "https://www.zerozero.pt/competicao/europa-league-qualificacao-/3276", mode: "league_phase", status: "needs_phase_rules", enabled: true, competitionAliases: ["UEFA Europa League"] },
  { competitionId: "17015", competitionName: "UEFA Conference League", countryName: "Europe", zerozeroUrl: "https://www.zerozero.pt/competicao/liga-conferencia", mode: "league_phase", status: "needs_phase_rules", enabled: true },
  { competitionId: "17015", competitionName: "UEFA Conference League, Qualification", countryName: "Europe", zerozeroUrl: "https://www.zerozero.pt/competicao/liga-conferencia-qualificacao-", mode: "league_phase", status: "needs_phase_rules", enabled: true, competitionAliases: ["UEFA Conference League"] },
  { competitionId: "17", competitionName: "Premier League", countryName: "England", zerozeroUrl: "https://www.zerozero.pt/competicao/liga-inglesa", mode: "single_table", status: "ready", enabled: true },
  { competitionId: "8", competitionName: "LaLiga", countryName: "Spain", zerozeroUrl: "https://www.zerozero.pt/competicao/liga-espanhola", mode: "single_table", status: "ready", enabled: true },
  { competitionId: "23", competitionName: "Serie A", countryName: "Italy", zerozeroUrl: "https://www.zerozero.pt/competicao/liga-italiana", mode: "single_table", status: "ready", enabled: true },
  { competitionId: "35", competitionName: "Bundesliga", countryName: "Germany", zerozeroUrl: "https://www.zerozero.pt/competicao/liga-alema", mode: "single_table", status: "ready", enabled: true },
  { competitionId: "34", competitionName: "Ligue 1", countryName: "France", zerozeroUrl: "https://www.zerozero.pt/competicao/liga-francesa", mode: "single_table", status: "ready", enabled: true },
  { competitionId: "238", competitionName: "Liga Portugal", countryName: "Portugal", zerozeroUrl: "https://www.zerozero.pt/competicao/liga-portuguesa", mode: "single_table", status: "ready", enabled: true },
  { competitionId: "37", competitionName: "Eredivisie", countryName: "Netherlands", zerozeroUrl: "https://www.zerozero.pt/competicao/liga-neerlandesa", mode: "single_table", status: "ready", enabled: true },
  { competitionId: "40", competitionName: "Pro League", countryName: "Belgium", zerozeroUrl: "https://www.zerozero.pt/competicao/liga-belga", mode: "regular_plus_playoffs", status: "needs_phase_rules", enabled: true },
  { competitionId: "36", competitionName: "Premiership", countryName: "Scotland", zerozeroUrl: "https://www.zerozero.pt/competicao/liga-escocesa", mode: "regular_plus_playoffs", status: "needs_phase_rules", enabled: true },
  { competitionId: "52", competitionName: "Super Lig", countryName: "Turkey", zerozeroUrl: "https://www.zerozero.pt/competicao/liga-turca", mode: "single_table", status: "ready", enabled: true },
  { competitionId: "45", competitionName: "Bundesliga", countryName: "Austria", zerozeroUrl: "https://www.zerozero.pt/competicao/liga-austriaca", mode: "regular_plus_playoffs", status: "needs_phase_rules", enabled: true },
  { competitionId: "215", competitionName: "Super League", countryName: "Switzerland", zerozeroUrl: "https://www.zerozero.pt/competicao/liga-suica", mode: "regular_plus_playoffs", status: "needs_phase_rules", enabled: true, competitionAliases: ["Swiss Super League"] },
  { competitionId: "39", competitionName: "Superliga", countryName: "Denmark", zerozeroUrl: "https://www.zerozero.pt/competicao/liga-dinamarquesa", mode: "regular_plus_playoffs", status: "needs_phase_rules", enabled: true },
  { competitionId: "20", competitionName: "Eliteserien", countryName: "Norway", zerozeroUrl: "https://www.zerozero.pt/competicao/liga-norueguesa", mode: "single_table", status: "ready", enabled: true },
  { competitionId: "43", competitionName: "Allsvenskan", countryName: "Sweden", zerozeroUrl: "https://www.zerozero.pt/competicao/liga-sueca", mode: "single_table", status: "ready", enabled: true },
  { competitionId: "67", competitionName: "Veikkausliiga", countryName: "Finland", zerozeroUrl: "https://www.zerozero.pt/competicao/liga-finlandesa", mode: "regular_plus_playoffs", status: "needs_phase_rules", enabled: true },
  { competitionId: "47", competitionName: "Ekstraklasa", countryName: "Poland", zerozeroUrl: "https://www.zerozero.pt/competicao/liga-polaca", mode: "single_table", status: "ready", enabled: true },
  { competitionId: "49", competitionName: "Chance Liga", countryName: "Czech Republic", zerozeroUrl: "https://www.zerozero.pt/competicao/liga-checa", mode: "regular_plus_playoffs", status: "needs_phase_rules", enabled: true },
  { competitionId: "152", competitionName: "SuperLiga", countryName: "Romania", zerozeroUrl: "https://www.zerozero.pt/competicao/liga-romena", mode: "regular_plus_playoffs", status: "needs_phase_rules", enabled: true },
  { competitionId: "53", competitionName: "NB I", countryName: "Hungary", zerozeroUrl: "https://www.zerozero.pt/competicao/liga-hungara", mode: "single_table", status: "ready", enabled: true },
  { competitionId: "170", competitionName: "HNL", countryName: "Croatia", zerozeroUrl: "https://www.zerozero.pt/competicao/liga-croata", mode: "single_table", status: "ready", enabled: true },
  { competitionId: "210", competitionName: "SuperLiga", countryName: "Serbia", zerozeroUrl: "https://www.zerozero.pt/competicao/liga-servia", mode: "regular_plus_playoffs", status: "needs_phase_rules", enabled: true },
  { competitionId: "211", competitionName: "Nike Liga", countryName: "Slovakia", zerozeroUrl: "https://www.zerozero.pt/competicao/liga-eslovaca", mode: "regular_plus_playoffs", status: "needs_phase_rules", enabled: true },
  { competitionId: "212", competitionName: "PrvaLiga", countryName: "Slovenia", zerozeroUrl: "https://www.zerozero.pt/competicao/liga-eslovena", mode: "single_table", status: "ready", enabled: true },
  { competitionId: "247", competitionName: "Parva Liga", countryName: "Bulgaria", zerozeroUrl: "https://www.zerozero.pt/competicao/liga-bulgara", mode: "regular_plus_playoffs", status: "needs_phase_rules", enabled: true },
  { competitionId: "185", competitionName: "Super League", countryName: "Greece", zerozeroUrl: "https://www.zerozero.pt/competicao/liga-grega", mode: "regular_plus_playoffs", status: "needs_phase_rules", enabled: true },
  { competitionId: "218", competitionName: "Premier League", countryName: "Ukraine", zerozeroUrl: "https://www.zerozero.pt/competicao/liga-ucraniana", mode: "single_table", status: "ready", enabled: true },
  { competitionId: "203", competitionName: "Premier League", countryName: "Russia", zerozeroUrl: "https://www.zerozero.pt/competicao/liga-russa", mode: "single_table", status: "ready", enabled: true },
  { competitionId: "59", competitionName: "Premier League", countryName: "Israel", zerozeroUrl: "https://www.zerozero.pt/competicao/liga-israelita", mode: "regular_plus_playoffs", status: "needs_phase_rules", enabled: true },
  { competitionId: "325", competitionName: "Brasileirao Serie A", countryName: "Brazil", zerozeroUrl: "https://www.zerozero.pt/competicao/brasileirao-serie-a", mode: "single_table", status: "ready", enabled: true, competitionAliases: ["Brasileirao Betano", "Brasileirão Betano"] },
  { competitionId: "155", competitionName: "Liga Profesional", countryName: "Argentina", zerozeroUrl: "https://www.zerozero.pt/competicao/i-divisao-argentina", mode: "regular_plus_playoffs", status: "needs_validation", enabled: true, competitionAliases: ["Liga Profesional, Clausura", "Liga Profesional, Apertura"] },
];

export function buildCompetitionStandingsSourceMap(): ReadonlyMap<string, CompetitionStandingsSource> {
  return new Map(
    DEFAULT_COMPETITION_STANDINGS_SOURCES
      .filter((source) => source.enabled)
      .map((source) => [source.competitionId, source]),
  );
}

export function findCompetitionStandingsSource(
  fixture: FixtureCompetitionIdentity,
): CompetitionStandingsSource | null {
  let bestMatch: CompetitionStandingsSource | null = null;
  let bestScore = -1;

  for (const source of DEFAULT_COMPETITION_STANDINGS_SOURCES) {
    if (!source.enabled) {
      continue;
    }

    if (matchesCompetitionIdentity(source, fixture)) {
      const score = sourceSpecificityScore(source, fixture);
      if (score > bestScore) {
        bestMatch = source;
        bestScore = score;
      }
    }
  }

  return bestMatch;
}

function sourceSpecificityScore(
  source: CompetitionStandingsSource,
  fixture: FixtureCompetitionIdentity,
): number {
  const competitionValue = normalizeCompetitionToken(fixture.competitionName);
  if (!competitionValue) {
    return 0;
  }

  return [source.competitionName, ...(source.competitionAliases ?? [])]
    .map(normalizeCompetitionToken)
    .filter(Boolean)
    .reduce((best, candidate) => {
      if (
        competitionValue === candidate ||
        competitionValue.startsWith(candidate) ||
        candidate.startsWith(competitionValue)
      ) {
        return Math.max(best, candidate.length);
      }

      return best;
    }, 0);
}
