import type {
  TeamContextAvailability,
  TeamContextAvailabilityStatus,
  TeamContextCoverage,
  TeamContextHealthEntry,
  TeamContextPlayer,
  TeamContextSimilarTeam,
  TeamContextSnapshot,
} from "../../domain/team-context.js";

const SOCCER_RATING_BASE_URL = "https://www.soccer-rating.com";

interface TeamPathMetadata {
  seasonLabel: string | null;
  countrySlug: string | null;
  teamId: string | null;
  teamSlug: string | null;
}

export interface ParseSoccerRatingTeamContextOptions {
  html: string;
  inputPath: string;
  collectedAtUtc: string;
  season?: string;
  countrySlug?: string;
  teamId?: string;
  teamSlug?: string;
}

export interface ParsedSoccerRatingTeamContextResult {
  snapshot: TeamContextSnapshot;
  fieldCount: number;
  seasonFs: string;
  countrySlug: string;
  teamId: string;
  teamSlug: string;
}

export function parseSoccerRatingTeamContextHtml(
  options: ParseSoccerRatingTeamContextOptions,
): ParsedSoccerRatingTeamContextResult {
  const inputMeta = parseSoccerRatingInputPath(options.inputPath);
  const seasonLabel =
    normalizeSeasonLabel(options.season) ??
    inputMeta.seasonLabel ??
    deriveSeasonLabelFromCurrentDate(new Date());
  const seasonFs = seasonLabel.replaceAll("/", "-");
  const countrySlug = options.countrySlug ?? inputMeta.countrySlug ?? "unknown";
  const teamId = options.teamId ?? inputMeta.teamId ?? "unknown";
  const teamName = extractTeamName(options.html);
  const teamSlug = options.teamSlug ?? inputMeta.teamSlug ?? slugify(teamName);
  const country =
    matchSingle(
      options.html,
      /Country:<\/td><td[^>]*>(?:<img[^>]*>\s*)?<a[^>]*class="highlight">([^<]+)<\/a>/i,
    )?.[1] ?? null;
  const sourceUrl = buildSourceUrl(teamName, teamId);

  const overallRating = parseNumber(
    matchSingle(options.html, /Rating Total:<\/td><td>([^<]+)<\/td>/i)?.[1] ?? null,
  );
  const homeRating = parseNumber(
    matchSingle(options.html, /Rating Home:<\/td><td>([^<]+)<\/td>/i)?.[1] ?? null,
  );
  const awayRating = parseNumber(
    matchSingle(options.html, /Rating Away:<\/td><td>([^<]+)<\/td>/i)?.[1] ?? null,
  );

  const rankingMatch = matchSingle(
    options.html,
    /is ranked #(\d+)\s+in\s+([^<]+?)\s+and #(\d+)\s+in Europe/i,
  );
  const similarTeams = extractSimilarTeams(options.html);
  const predictionBlock = extractPredictionBlock(options.html);
  const formLast3 = extractLast3Form(predictionBlock);
  const openingOdds = extractOddsRow(predictionBlock, "Opening Odds");
  const closingOdds = extractOddsRow(predictionBlock, "Closing Odds");
  const fairOdds = extractOddsRow(predictionBlock, "Fair Odds");
  const tipMatch = matchSingle(
    stripTags(predictionBlock),
    /Bet on \(([^)]+)\)\s+([^()]+?)\s+\(Stake\s+(\d+)\/10\)/i,
  );
  const favoriteMatch = matchSingle(
    stripTags(predictionBlock),
    /is\s+([a-z ]+?)\s+against/i,
  );

  const injuriesSection = extractTableById(options.html, "inj1");
  const injuries = extractHealthEntries(injuriesSection);
  const lineupPlayers = extractLineupPlayers(extractTableById(options.html, "line1"));
  const lineupPlayerMap = new Map(lineupPlayers.map((player) => [slugify(player.name), player]));
  const squadPlayers = extractSquadPlayers(
    extractTableById(options.html, "squad1"),
    lineupPlayerMap,
  );
  const averageLineupRating = parseScaledRating(
    matchSingle(
      options.html,
      /Expected Lineup[\s\S]*?<a href="javascript:showLine\(\)">\s*[^<]+<\/a><br>[^<]*?(?:&empty;|∅)\s*([0-9]+)\s*Rating/i,
    )?.[1] ?? null,
  );

  const fieldCount = countFields({
    overallRating,
    homeRating,
    awayRating,
    rankings: rankingMatch ? 1 : 0,
    form: formLast3.length > 0 ? 1 : 0,
    odds: openingOdds || fairOdds ? 1 : 0,
    injuries: injuriesSection.length > 0 ? 1 : 0,
    lineup: lineupPlayers.length > 0 ? 1 : 0,
    squad: squadPlayers.length > 0 ? 1 : 0,
    similarTeams: similarTeams.length > 0 ? 1 : 0,
    tip: tipMatch ? 1 : 0,
  });

  const isCurrent = seasonLabel === deriveSeasonLabelFromCurrentDate(new Date());
  const availability = buildAvailability({ fieldCount, isCurrent });

  return {
    snapshot: {
      team: {
        id: teamId,
        name: teamName,
        slug: teamSlug,
        country,
        logoUrl: null,
      },
      season: {
        id: seasonLabel,
        label: seasonLabel,
        isCurrent,
      },
      source: {
        provider: "soccer-rating",
        url: sourceUrl,
        collectedAtUtc: options.collectedAtUtc,
      },
      availability,
      ratings: {
        overall: overallRating,
        home: homeRating,
        away: awayRating,
      },
      rankings: {
        national: parseInteger(rankingMatch?.[1] ?? null),
        europe: parseInteger(rankingMatch?.[3] ?? null),
      },
      form: {
        last3: formLast3,
      },
      prediction: {
        tip: normalizeTipCode(tipMatch?.[1] ?? null),
        tipLabel: tipMatch ? collapseWhitespace(tipMatch[0]) : null,
        confidencePct: tipMatch ? Number(tipMatch[3]) * 10 : null,
        strengthComparison: favoriteMatch
          ? collapseWhitespace(favoriteMatch[1]).replaceAll(" ", "_")
          : null,
      },
      oddsMarket: {
        opening1X2: openingOdds,
        fair1X2: fairOdds,
        movementSummary: summarizeOddsMovement(openingOdds, closingOdds),
      },
      squadHealth: {
        injuries,
        suspensions: [],
      },
      expectedLineup: {
        formation: null,
        averageRating: averageLineupRating,
        players: lineupPlayers,
      },
      squad: squadPlayers,
      recentMatches: [],
      similarTeams,
    },
    fieldCount,
    seasonFs,
    countrySlug,
    teamId,
    teamSlug,
  };
}

function extractTeamName(html: string): string {
  return (
    matchSingle(html, /<th[^>]*>\s*<font[^>]*>\s*<b>([^<]+)<\/b>/i)?.[1] ??
    matchSingle(html, /<title>([^:]+):/i)?.[1] ??
    "Unknown team"
  ).trim();
}

function extractSimilarTeams(html: string): TeamContextSimilarTeam[] {
  const block = matchSingle(
    html,
    /Teams of same strength are([\s\S]*?)<\/td><\/tr><\/table>/i,
  )?.[1];

  if (!block) {
    return [];
  }

  return Array.from(block.matchAll(/<a[^>]*>([^<]+)<\/a>\s*\(([\d.]+)\)/gi)).map((match) => ({
    name: decodeHtml(match[1]),
    rating: parseNumber(match[2]),
  }));
}

function extractPredictionBlock(html: string): string {
  return (
    matchSingle(
      html,
      /Prediction &amp; Betting Advice<\/b><\/font><\/th><\/tr><tr><td><font[^>]*>([\s\S]*?)<\/font><\/td><\/tr><\/table>/i,
    )?.[1] ?? ""
  );
}

function extractLast3Form(predictionBlock: string): string[] {
  const match = matchSingle(
    predictionBlock,
    /Form Last 3 Games<\/td><td>[\s\S]*?\(([WDL]{3})\)<\/td>/i,
  );
  return match ? match[1].split("") : [];
}

function extractOddsRow(
  predictionBlock: string,
  label: "Opening Odds" | "Closing Odds" | "Fair Odds",
): { home: number | null; draw: number | null; away: number | null } | null {
  const escaped = label.replace(" ", "\\s+");
  const match = matchSingle(
    predictionBlock,
    new RegExp(
      `${escaped}:?<\\/td><td>([\\d.]+)<\\/td>[\\s\\S]*?<td>([\\d.]+)<\\/td><td>([\\d.]+)<\\/td>`,
      "i",
    ),
  );

  if (!match) {
    return null;
  }

  return {
    home: parseNumber(match[1]),
    draw: parseNumber(match[2]),
    away: parseNumber(match[3]),
  };
}

function extractHealthEntries(sectionHtml: string): TeamContextHealthEntry[] {
  if (!sectionHtml || /<i>\s*None\s*<\/i>/i.test(sectionHtml)) {
    return [];
  }

  return Array.from(
    sectionHtml.matchAll(
      /<tr><td[^>]*>\s*<\/td><td[^>]*>[\s\S]*?<div class="nomobil">[\s\S]*?\s([A-Za-zÀ-ÿ' .-]+)\s*\(([A-Z]{2})\)<\/div>[\s\S]*?<\/td>/gi,
    ),
  ).map((match) => ({
    player: collapseWhitespace(match[1]),
    status: "injury_or_suspension",
    description: null,
  }));
}

function extractLineupPlayers(sectionHtml: string): TeamContextPlayer[] {
  return Array.from(
    sectionHtml.matchAll(
      /<tr><td>#\d+<\/td><td>[\s\S]*?<div class="nomobil">[\s\S]*?\s([A-Za-zÀ-ÿ' .-]+)\s*\(([A-Z]{2})\)<\/div>[\s\S]*?<\/td><td>\s*([0-9]+)\/([0-9]+)<\/td><td[^>]*>\s*([0-9]+)<\/td><\/tr>/gi,
    ),
  ).map((match) => ({
    name: collapseWhitespace(match[1]),
    position: match[2],
    age: null,
    apps: parseInteger(match[3]),
    goals: parseInteger(match[4]),
    rating: parseScaledRating(match[5]),
  }));
}

function extractSquadPlayers(
  sectionHtml: string,
  lineupPlayerMap: Map<string, TeamContextPlayer>,
): TeamContextPlayer[] {
  return Array.from(
    sectionHtml.matchAll(
      /<tr><td(?:[^>]*)>[\s\S]*?<div class="nomobil">[\s\S]*?\s([A-Za-zÀ-ÿ' .-]+)\s*\((\d+)\)<\/div>[\s\S]*?<\/td><td>\s*([0-9]+)\/([0-9]+)<\/td><td[^>]*>\s*([0-9]+)<\/td><\/tr>/gi,
    ),
  ).map((match) => {
    const name = collapseWhitespace(match[1]);
    const lineupPlayer = lineupPlayerMap.get(slugify(name));

    return {
      name,
      position: lineupPlayer?.position ?? null,
      age: parseInteger(match[2]),
      apps: parseInteger(match[3]),
      goals: parseInteger(match[4]),
      rating: parseScaledRating(match[5]),
    };
  });
}

function extractTableById(html: string, id: string): string {
  return matchSingle(html, new RegExp(`id="${id}"[^>]*>([\\s\\S]*?)<\\/table>`, "i"))?.[1] ?? "";
}

function buildSourceUrl(teamName: string, teamId: string): string {
  const titleName = slugify(teamName)
    .split("-")
    .map(capitalizeWord)
    .join("-");
  return `${SOCCER_RATING_BASE_URL}/${titleName}/${teamId}/`;
}

function buildAvailability(input: {
  fieldCount: number;
  isCurrent: boolean;
}): TeamContextAvailability {
  let status: TeamContextAvailabilityStatus;

  if (input.fieldCount === 0) {
    status = input.isCurrent ? "not_started" : "unavailable";
  } else if (!input.isCurrent) {
    status = "archived";
  } else if (input.fieldCount >= 7) {
    status = "available";
  } else {
    status = "partial";
  }

  return {
    status,
    coverage: buildCoverage(input.fieldCount),
    notes: buildAvailabilityNotes(status),
  };
}

function buildCoverage(fieldCount: number): TeamContextCoverage {
  if (fieldCount === 0) {
    return "none";
  }
  if (fieldCount >= 7) {
    return "high";
  }
  if (fieldCount >= 4) {
    return "medium";
  }
  return "low";
}

function buildAvailabilityNotes(status: TeamContextAvailabilityStatus): string | null {
  switch (status) {
    case "archived":
      return "Epoca anterior capturada para referencia estrutural.";
    case "partial":
      return "Pagina capturada com cobertura parcial do contexto de equipa.";
    case "not_started":
      return "Pagina capturada sem dados suficientes da epoca atual.";
    case "unavailable":
      return "Pagina capturada sem blocos extraiveis de contexto.";
    default:
      return null;
  }
}

function parseSoccerRatingInputPath(inputPath: string): TeamPathMetadata {
  const normalized = inputPath.replaceAll("\\", "/");
  const marker = "/soccer-rating/";
  const index = normalized.lastIndexOf(marker);

  if (index === -1) {
    return { seasonLabel: null, countrySlug: null, teamId: null, teamSlug: null };
  }

  const tail = normalized.slice(index + marker.length).split("/");
  if (tail.length < 3) {
    return { seasonLabel: null, countrySlug: null, teamId: null, teamSlug: null };
  }

  const [seasonFs, countrySlug, teamFile] = tail;
  const teamStem = teamFile.replace(/\.html$/i, "");
  const teamId = teamStem.split("-", 1)[0] ?? null;
  const teamSlug =
    teamStem.startsWith(`${teamId}-`) && teamId ? teamStem.slice(teamId.length + 1) : null;

  return {
    seasonLabel: normalizeSeasonLabel(seasonFs),
    countrySlug: countrySlug || null,
    teamId: teamId || null,
    teamSlug,
  };
}

function stripTags(value: string): string {
  return decodeHtml(value.replace(/<[^>]+>/g, " "));
}

function decodeHtml(value: string): string {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&gt;/g, ">")
    .replace(/&lt;/g, "<")
    .replace(/&empty;/g, "∅")
    .replace(/&#9660;/g, "▼")
    .replace(/&#9650;/g, "▲")
    .replace(/&#(\d+);/g, (_, num: string) => String.fromCodePoint(Number.parseInt(num, 10)));
}

function normalizeTipCode(value: string | null): string | null {
  switch (value) {
    case "1":
      return "home_win";
    case "X":
      return "draw";
    case "2":
      return "away_win";
    case "1X":
      return "home_or_draw";
    case "12":
      return "no_draw";
    case "X2":
      return "away_or_draw";
    default:
      return value ? collapseWhitespace(value).toLowerCase() : null;
  }
}

function summarizeOddsMovement(
  opening: { home: number | null; draw: number | null; away: number | null } | null,
  closing: { home: number | null; draw: number | null; away: number | null } | null,
): string | null {
  if (!opening || !closing || opening.home === null || opening.away === null || closing.home === null || closing.away === null) {
    return null;
  }

  const homeMovement =
    closing.home > opening.home ? "home_odds_up" : closing.home < opening.home ? "home_odds_down" : "home_odds_flat";
  const awayMovement =
    closing.away > opening.away ? "away_odds_up" : closing.away < opening.away ? "away_odds_down" : "away_odds_flat";

  return `${homeMovement}_${awayMovement}`;
}

function deriveSeasonLabelFromCurrentDate(now: Date): string {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth() + 1;
  const startYear = month >= 7 ? year : year - 1;
  return `${startYear}/${startYear + 1}`;
}

function normalizeSeasonLabel(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  if (/^\d{4}\/\d{4}$/.test(value)) {
    return value;
  }
  if (/^\d{4}-\d{4}$/.test(value)) {
    return value.replace("-", "/");
  }
  return null;
}

function collapseWhitespace(value: string): string {
  return decodeHtml(value).replace(/\s+/g, " ").trim();
}

function parseNumber(value: string | null): number | null {
  if (!value) {
    return null;
  }
  const parsed = Number(value.replace(/,/g, ".").replace(/[^\d.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function parseScaledRating(value: string | null): number | null {
  const parsed = parseNumber(value);
  return parsed === null ? null : parsed / 10;
}

function parseInteger(value: string | null): number | null {
  if (!value) {
    return null;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) ? parsed : null;
}

function countFields(input: {
  overallRating: number | null;
  homeRating: number | null;
  awayRating: number | null;
  rankings: number;
  form: number;
  odds: number;
  injuries: number;
  lineup: number;
  squad: number;
  similarTeams: number;
  tip: number;
}): number {
  let total = 0;
  if (input.overallRating !== null || input.homeRating !== null || input.awayRating !== null) {
    total += 1;
  }
  total +=
    input.rankings +
    input.form +
    input.odds +
    input.injuries +
    input.lineup +
    input.squad +
    input.similarTeams +
    input.tip;
  return total;
}

function slugify(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function capitalizeWord(value: string): string {
  return value.length === 0 ? value : value[0].toUpperCase() + value.slice(1);
}

function matchSingle(value: string, pattern: RegExp): RegExpMatchArray | null {
  return value.match(pattern);
}
