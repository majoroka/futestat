import type {
  CompetitionStandingsMode,
  CompetitionStandingsSourceStatus,
} from "../domain/competition-standings.js";
import type { CompetitionStandingsPhaseRule } from "./competition-standings-phase-rules.js";
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
  defaultPhaseNotes?: string[];
  defaultRuleProfileId?: string | null;
  phaseRules?: CompetitionStandingsPhaseRule[];
}

const regularSeasonSplitRules: CompetitionStandingsPhaseRule[] = [
  {
    matchPhaseNames: ["campeonato", "fase regular", "temporada regular"],
    matchTableNames: ["campeonato", "classificacao"],
    status: "ready",
    phaseNotes: [
      "Tabela da fase regular.",
      "Quando a competição dividir em grupos ou playoffs, as zonas finais podem mudar.",
    ],
    ruleProfileId: "regular-season-before-split",
  },
];

const championshipGroupRules: CompetitionStandingsPhaseRule[] = [
  {
    matchPhaseNames: ["grupo do campeao", "playoff campeao", "play-off campeao", "championship"],
    matchTableNames: ["grupo do campeao", "playoff campeao", "championship"],
    status: "ready",
    phaseNotes: [
      "Tabela do grupo de campeão ou ronda final pelo título.",
    ],
    ruleProfileId: "championship-round",
  },
  {
    matchPhaseNames: ["grupo manutencao", "playoff despromocao", "play-off despromocao", "relegation"],
    matchTableNames: ["grupo manutencao", "playoff despromocao", "relegation"],
    status: "ready",
    phaseNotes: [
      "Tabela do grupo de manutenção ou despromoção.",
    ],
    ruleProfileId: "relegation-round",
  },
];

const titleRoundRules: CompetitionStandingsPhaseRule[] = [
  {
    matchPhaseNames: ["grupo titulo", "title group", "title round", "championship round"],
    matchTableNames: ["grupo titulo", "title group", "title round", "championship round"],
    status: "ready",
    phaseNotes: [
      "Tabela da ronda final pelo título.",
    ],
    ruleProfileId: "title-round",
  },
];

const qualificationRoundRules: CompetitionStandingsPhaseRule[] = [
  {
    matchPhaseNames: ["grupo europeu", "europe group", "qualification group", "qualification round"],
    matchTableNames: ["grupo europeu", "europe group", "qualification group", "qualification round"],
    status: "ready",
    phaseNotes: [
      "Tabela da ronda intermédia de apuramento europeu ou manutenção.",
    ],
    ruleProfileId: "qualification-round",
  },
];

const europePlayoffRules: CompetitionStandingsPhaseRule[] = [
  {
    matchPhaseNames: ["europa play off", "europa play-off", "europe play off", "europe play-off"],
    matchTableNames: ["europa play off", "europa play-off", "europe play off", "europe play-off"],
    status: "ready",
    phaseNotes: [
      "Tabela do playoff ou grupo de apuramento europeu.",
    ],
    ruleProfileId: "europe-round",
  },
];

const scottishSplitRules: CompetitionStandingsPhaseRule[] = [
  {
    matchPhaseNames: ["campeonato", "fase regular"],
    matchTableNames: ["campeonato", "classificacao"],
    status: "ready",
    phaseNotes: [
      "Tabela da fase regular antes da divisão em top-6 e bottom-6.",
    ],
    ruleProfileId: "regular-season-before-split",
  },
  {
    matchPhaseNames: ["championship round"],
    matchTableNames: ["championship round"],
    status: "ready",
    phaseNotes: [
      "Tabela da ronda final do top-6.",
    ],
    ruleProfileId: "championship-round",
  },
  {
    matchPhaseNames: ["relegation round"],
    matchTableNames: ["relegation round"],
    status: "ready",
    phaseNotes: [
      "Tabela da ronda final de manutenção e despromoção.",
    ],
    ruleProfileId: "relegation-round",
  },
];

const belgianPlayoffRules: CompetitionStandingsPhaseRule[] = [
  {
    matchPhaseNames: ["campeonato", "fase regular"],
    matchTableNames: ["campeonato", "classificacao"],
    status: "ready",
    phaseNotes: [
      "Tabela da fase regular antes dos playoffs finais.",
    ],
    ruleProfileId: "regular-season-before-split",
  },
  {
    matchPhaseNames: ["championship play off", "championship play-off"],
    matchTableNames: ["championship play off", "championship play-off"],
    status: "ready",
    phaseNotes: [
      "Tabela do playoff de campeão.",
    ],
    ruleProfileId: "championship-round",
  },
  {
    matchPhaseNames: ["europa play off", "europa play-off", "europe play off", "europe play-off"],
    matchTableNames: ["europa play off", "europa play-off", "europe play off", "europe play-off"],
    status: "ready",
    phaseNotes: [
      "Tabela do playoff de apuramento europeu.",
    ],
    ruleProfileId: "europe-round",
  },
  {
    matchPhaseNames: ["relegation play off", "relegation play-off"],
    matchTableNames: ["relegation play off", "relegation play-off"],
    status: "ready",
    phaseNotes: [
      "Tabela do playoff de manutenção ou despromoção.",
    ],
    ruleProfileId: "relegation-round",
  },
];

const argentinaGroupStageRules: CompetitionStandingsPhaseRule[] = [
  {
    matchPhaseNames: ["1 fase", "1a fase", "1. fase", "1ª fase", "fase inicial", "fase de grupos"],
    matchTableNames: ["grupo a", "grupo b", "grupo"],
    status: "ready",
    phaseNotes: [
      "Tabela da fase inicial por grupos.",
    ],
    ruleProfileId: "arg-group-stage",
  },
];

const knockoutEuropeanRules: CompetitionStandingsPhaseRule[] = [
  {
    matchPhaseNames: ["qualificacao", "qualifying", "pre-eliminatoria", "eliminatoria"],
    status: "needs_phase_rules",
    phaseNotes: [
      "Competição em formato a eliminar; a classificação pode não existir ou não ser relevante nesta fase.",
    ],
    ruleProfileId: "knockout-qualification",
  },
  {
    matchPhaseNames: ["league phase", "fase liga", "campeonato"],
    status: "ready",
    phaseNotes: [
      "Tabela da fase liga.",
    ],
    ruleProfileId: "league-phase",
  },
];

const portugalLeagueThreeRules: CompetitionStandingsPhaseRule[] = [
  {
    matchPhaseNames: ["1 fase", "1a fase", "1. fase", "1ª fase", "fase regular"],
    matchTableNames: ["serie a", "série a", "serie b", "série b", "grupo a", "grupo b"],
    status: "ready",
    phaseNotes: [
      "Tabela base da primeira fase por séries.",
      "Nesta fase o Futestat mostra a classificação do grupo ou zona em que o jogo se insere.",
    ],
    ruleProfileId: "group-stage",
  },
  {
    matchPhaseNames: ["apuramento de campeao", "apuramento de campeão", "championship"],
    matchTableNames: ["apuramento de campeao", "apuramento de campeão", "championship"],
    status: "ready",
    phaseNotes: [
      "Tabela da fase de apuramento de campeão e subida.",
    ],
    ruleProfileId: "championship-round",
  },
  {
    matchPhaseNames: ["manutencao", "manutenção", "relegation"],
    matchTableNames: ["manutencao", "manutenção", "serie 1", "série 1", "serie 2", "série 2", "relegation"],
    status: "ready",
    phaseNotes: [
      "Tabela da fase de manutenção ou despromoção.",
    ],
    ruleProfileId: "relegation-round",
  },
];

export const DEFAULT_COMPETITION_STANDINGS_SOURCES: CompetitionStandingsSource[] = [
  { competitionId: "7", competitionName: "UEFA Champions League", countryName: "Europe", zerozeroUrl: "https://www.zerozero.pt/competicao/liga-dos-campeoes", mode: "league_phase", status: "needs_phase_rules", enabled: true, defaultPhaseNotes: ["Competição europeia com fases distintas ao longo da época."], phaseRules: knockoutEuropeanRules },
  { competitionId: "7", competitionName: "UEFA Champions League, Qualification", countryName: "Europe", zerozeroUrl: "https://www.zerozero.pt/competicao/liga-dos-campeoes-qualificacao-", mode: "league_phase", status: "needs_phase_rules", enabled: true, competitionAliases: ["UEFA Champions League"], defaultPhaseNotes: ["Qualificação europeia a eliminar."], phaseRules: knockoutEuropeanRules },
  { competitionId: "679", competitionName: "UEFA Europa League", countryName: "Europe", zerozeroUrl: "https://www.zerozero.pt/competicao/liga-europa", mode: "league_phase", status: "needs_phase_rules", enabled: true, defaultPhaseNotes: ["Competição europeia com fases distintas ao longo da época."], phaseRules: knockoutEuropeanRules },
  { competitionId: "679", competitionName: "UEFA Europa League, Qualification", countryName: "Europe", zerozeroUrl: "https://www.zerozero.pt/competicao/europa-league-qualificacao-/3276", mode: "league_phase", status: "needs_phase_rules", enabled: true, competitionAliases: ["UEFA Europa League"], defaultPhaseNotes: ["Qualificação europeia a eliminar."], phaseRules: knockoutEuropeanRules },
  { competitionId: "17015", competitionName: "UEFA Conference League", countryName: "Europe", zerozeroUrl: "https://www.zerozero.pt/competicao/liga-conferencia", mode: "league_phase", status: "needs_phase_rules", enabled: true, defaultPhaseNotes: ["Competição europeia com fases distintas ao longo da época."], phaseRules: knockoutEuropeanRules },
  { competitionId: "17015", competitionName: "UEFA Conference League, Qualification", countryName: "Europe", zerozeroUrl: "https://www.zerozero.pt/competicao/liga-conferencia-qualificacao-", mode: "league_phase", status: "needs_phase_rules", enabled: true, competitionAliases: ["UEFA Conference League"], defaultPhaseNotes: ["Qualificação europeia a eliminar."], phaseRules: knockoutEuropeanRules },
  { competitionId: "17", competitionName: "Premier League", countryName: "England", zerozeroUrl: "https://www.zerozero.pt/competicao/liga-inglesa", mode: "single_table", status: "ready", enabled: true },
  { competitionId: "18", competitionName: "Championship", countryName: "England", zerozeroUrl: "https://www.zerozero.pt/competicao/ii-liga-inglesa", mode: "single_table", status: "ready", enabled: true, competitionAliases: ["EFL Championship"] },
  { competitionId: "8", competitionName: "LaLiga", countryName: "Spain", zerozeroUrl: "https://www.zerozero.pt/competicao/liga-espanhola", mode: "single_table", status: "ready", enabled: true },
  { competitionId: "54", competitionName: "LaLiga 2", countryName: "Spain", zerozeroUrl: "https://www.zerozero.pt/competicao/segunda-liga-espanhola", mode: "single_table", status: "ready", enabled: true, competitionAliases: ["Segunda Division", "Segunda División", "LaLiga Hypermotion"] },
  { competitionId: "23", competitionName: "Serie A", countryName: "Italy", zerozeroUrl: "https://www.zerozero.pt/competicao/liga-italiana", mode: "single_table", status: "ready", enabled: true },
  { competitionId: "53", competitionName: "Serie B", countryName: "Italy", zerozeroUrl: "https://www.zerozero.pt/competicao/serie-b-italiana", mode: "single_table", status: "ready", enabled: true },
  { competitionId: "35", competitionName: "Bundesliga", countryName: "Germany", zerozeroUrl: "https://www.zerozero.pt/competicao/liga-alema", mode: "single_table", status: "ready", enabled: true },
  { competitionId: "44", competitionName: "2. Bundesliga", countryName: "Germany", zerozeroUrl: "https://www.zerozero.pt/competicao/2-bundesliga", mode: "single_table", status: "ready", enabled: true },
  { competitionId: "34", competitionName: "Ligue 1", countryName: "France", zerozeroUrl: "https://www.zerozero.pt/competicao/liga-francesa", mode: "single_table", status: "ready", enabled: true },
  { competitionId: "182", competitionName: "Ligue 2", countryName: "France", zerozeroUrl: "https://www.zerozero.pt/competicao/2-liga-francesa", mode: "single_table", status: "ready", enabled: true },
  { competitionId: "238", competitionName: "Liga Portugal", countryName: "Portugal", zerozeroUrl: "https://www.zerozero.pt/competicao/liga-portuguesa", mode: "single_table", status: "ready", enabled: true },
  { competitionId: "239", competitionName: "Liga Portugal 2", countryName: "Portugal", zerozeroUrl: "https://www.zerozero.pt/competicao/segunda-liga-portuguesa", mode: "single_table", status: "ready", enabled: true, defaultPhaseNotes: ["Tabela corrida da II Liga portuguesa."] },
  { competitionId: "17101", competitionName: "Liga 3", countryName: "Portugal", zerozeroUrl: "https://www.zerozero.pt/competicao/liga-3", mode: "regular_plus_playoffs", status: "needs_phase_rules", enabled: true, defaultPhaseNotes: ["Competição com fases e séries distintas ao longo da época."], phaseRules: portugalLeagueThreeRules },
  { competitionId: "37", competitionName: "Eredivisie", countryName: "Netherlands", zerozeroUrl: "https://www.zerozero.pt/competicao/liga-neerlandesa", mode: "single_table", status: "ready", enabled: true },
  { competitionId: "131", competitionName: "Eerste Divisie", countryName: "Netherlands", zerozeroUrl: "https://www.zerozero.pt/competicao/2-liga-neerlandesa", mode: "single_table", status: "ready", enabled: true, competitionAliases: ["Keuken Kampioen Divisie"] },
  { competitionId: "40", competitionName: "Pro League", countryName: "Belgium", zerozeroUrl: "https://www.zerozero.pt/competicao/liga-belga", mode: "regular_plus_playoffs", status: "needs_phase_rules", enabled: true, defaultPhaseNotes: ["Competição com fase regular e múltiplos playoffs finais."], phaseRules: belgianPlayoffRules },
  { competitionId: "36", competitionName: "Premiership", countryName: "Scotland", zerozeroUrl: "https://www.zerozero.pt/competicao/liga-escocesa", mode: "regular_plus_playoffs", status: "needs_phase_rules", enabled: true, defaultPhaseNotes: ["Competição com fase regular e divisão final entre top-6 e bottom-6."], phaseRules: scottishSplitRules },
  { competitionId: "52", competitionName: "Super Lig", countryName: "Turkey", zerozeroUrl: "https://www.zerozero.pt/competicao/liga-turca", mode: "single_table", status: "ready", enabled: true },
  { competitionId: "45", competitionName: "Bundesliga", countryName: "Austria", zerozeroUrl: "https://www.zerozero.pt/competicao/liga-austriaca", mode: "regular_plus_playoffs", status: "needs_phase_rules", enabled: true, defaultPhaseNotes: ["Competição com fase regular e ronda final por grupos."], phaseRules: [...regularSeasonSplitRules, ...championshipGroupRules, ...qualificationRoundRules] },
  { competitionId: "215", competitionName: "Super League", countryName: "Switzerland", zerozeroUrl: "https://www.zerozero.pt/competicao/liga-suica", mode: "regular_plus_playoffs", status: "needs_phase_rules", enabled: true, competitionAliases: ["Swiss Super League"], defaultPhaseNotes: ["Competição com fase regular e divisão final por grupos."], phaseRules: [...regularSeasonSplitRules, ...championshipGroupRules] },
  { competitionId: "39", competitionName: "Superliga", countryName: "Denmark", zerozeroUrl: "https://www.zerozero.pt/competicao/liga-dinamarquesa", mode: "regular_plus_playoffs", status: "needs_phase_rules", enabled: true, defaultPhaseNotes: ["Competição dividida entre play-off campeão e play-off despromoção."], phaseRules: [...regularSeasonSplitRules, ...championshipGroupRules] },
  { competitionId: "20", competitionName: "Eliteserien", countryName: "Norway", zerozeroUrl: "https://www.zerozero.pt/competicao/liga-norueguesa", mode: "single_table", status: "ready", enabled: true },
  { competitionId: "43", competitionName: "Allsvenskan", countryName: "Sweden", zerozeroUrl: "https://www.zerozero.pt/competicao/liga-sueca", mode: "single_table", status: "ready", enabled: true },
  { competitionId: "67", competitionName: "Veikkausliiga", countryName: "Finland", zerozeroUrl: "https://www.zerozero.pt/competicao/liga-finlandesa", mode: "regular_plus_playoffs", status: "needs_phase_rules", enabled: true, defaultPhaseNotes: ["Competição com fase regular e divisão final por séries."], phaseRules: [...regularSeasonSplitRules, ...championshipGroupRules, ...relegationRoundRules()] },
  { competitionId: "47", competitionName: "Ekstraklasa", countryName: "Poland", zerozeroUrl: "https://www.zerozero.pt/competicao/liga-polaca", mode: "single_table", status: "ready", enabled: true },
  { competitionId: "49", competitionName: "Chance Liga", countryName: "Czech Republic", zerozeroUrl: "https://www.zerozero.pt/competicao/liga-checa", mode: "regular_plus_playoffs", status: "needs_phase_rules", enabled: true, defaultPhaseNotes: ["Competição com fase regular e grupos finais diferenciados."], phaseRules: [...regularSeasonSplitRules, ...titleRoundRules, ...europePlayoffRules, ...relegationRoundRules()] },
  { competitionId: "152", competitionName: "SuperLiga", countryName: "Romania", zerozeroUrl: "https://www.zerozero.pt/competicao/liga-romena", mode: "regular_plus_playoffs", status: "needs_phase_rules", enabled: true, defaultPhaseNotes: ["Competição com fase regular seguida de playoff campeão e manutenção."], phaseRules: [...regularSeasonSplitRules, ...championshipGroupRules, ...relegationRoundRules()] },
  { competitionId: "187", competitionName: "NB I", countryName: "Hungary", zerozeroUrl: "https://www.zerozero.pt/competicao/liga-hungara", mode: "single_table", status: "ready", enabled: true },
  { competitionId: "170", competitionName: "HNL", countryName: "Croatia", zerozeroUrl: "https://www.zerozero.pt/competicao/liga-croata", mode: "single_table", status: "ready", enabled: true },
  { competitionId: "210", competitionName: "SuperLiga", countryName: "Serbia", zerozeroUrl: "https://www.zerozero.pt/competicao/liga-servia", mode: "regular_plus_playoffs", status: "needs_phase_rules", enabled: true, defaultPhaseNotes: ["Competição com divisão final após a fase regular."], phaseRules: [...regularSeasonSplitRules, ...championshipGroupRules, ...relegationRoundRules()] },
  { competitionId: "211", competitionName: "Nike Liga", countryName: "Slovakia", zerozeroUrl: "https://www.zerozero.pt/competicao/liga-eslovaca", mode: "regular_plus_playoffs", status: "needs_phase_rules", enabled: true, defaultPhaseNotes: ["Competição com fase regular e grupos finais."], phaseRules: [...regularSeasonSplitRules, ...championshipGroupRules, ...relegationRoundRules()] },
  { competitionId: "212", competitionName: "PrvaLiga", countryName: "Slovenia", zerozeroUrl: "https://www.zerozero.pt/competicao/liga-eslovena", mode: "single_table", status: "ready", enabled: true },
  { competitionId: "247", competitionName: "Parva Liga", countryName: "Bulgaria", zerozeroUrl: "https://www.zerozero.pt/competicao/liga-bulgara", mode: "regular_plus_playoffs", status: "needs_phase_rules", enabled: true, defaultPhaseNotes: ["Competição com fase regular e três grupos finais distintos."], phaseRules: [...regularSeasonSplitRules, ...titleRoundRules, ...europePlayoffRules, ...relegationRoundRules()] },
  { competitionId: "185", competitionName: "Super League", countryName: "Greece", zerozeroUrl: "https://www.zerozero.pt/competicao/liga-grega", mode: "regular_plus_playoffs", status: "needs_phase_rules", enabled: true, defaultPhaseNotes: ["Competição com fase regular e grupos finais por objetivo."], phaseRules: [...regularSeasonSplitRules, ...championshipGroupRules, ...europePlayoffRules, ...relegationRoundRules()] },
  { competitionId: "218", competitionName: "Premier League", countryName: "Ukraine", zerozeroUrl: "https://www.zerozero.pt/competicao/liga-ucraniana", mode: "single_table", status: "ready", enabled: true },
  { competitionId: "203", competitionName: "Premier League", countryName: "Russia", zerozeroUrl: "https://www.zerozero.pt/competicao/liga-russa", mode: "single_table", status: "ready", enabled: true },
  { competitionId: "59", competitionName: "Premier League", countryName: "Israel", zerozeroUrl: "https://www.zerozero.pt/competicao/liga-israelita", mode: "regular_plus_playoffs", status: "needs_phase_rules", enabled: true, defaultPhaseNotes: ["Competição com fase regular e grupos finais."], phaseRules: [...regularSeasonSplitRules, ...championshipGroupRules, ...relegationRoundRules()] },
  { competitionId: "325", competitionName: "Brasileirao Serie A", countryName: "Brazil", zerozeroUrl: "https://www.zerozero.pt/competicao/brasileirao-serie-a", mode: "single_table", status: "ready", enabled: true, competitionAliases: ["Brasileirao Betano", "Brasileirão Betano"], defaultPhaseNotes: ["Tabela corrida ao longo de toda a época."] },
  { competitionId: "155", competitionName: "Liga Profesional", countryName: "Argentina", zerozeroUrl: "https://www.zerozero.pt/competicao/i-divisao-argentina", mode: "regular_plus_playoffs", status: "needs_validation", enabled: true, competitionAliases: ["Liga Profesional, Clausura", "Liga Profesional, Apertura"], defaultPhaseNotes: ["Competição com grupos e fases internas; validar sempre a fase apresentada."], phaseRules: argentinaGroupStageRules },
];

function relegationRoundRules(): CompetitionStandingsPhaseRule[] {
  return [
    {
      matchPhaseNames: ["relegation round", "relegation group", "playout", "play-out"],
      matchTableNames: ["relegation round", "relegation group", "playout", "play-out"],
      status: "ready",
      phaseNotes: [
        "Tabela da ronda final de manutenção ou despromoção.",
      ],
      ruleProfileId: "relegation-round",
    },
  ];
}

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
