import type {
  CompetitionStandingsMode,
  CompetitionStandingsSnapshot,
  CompetitionStandingsSourceStatus,
  CompetitionStandingsTable,
} from "../../domain/competition-standings.js";
import {
  resolveCompetitionStandingsPhaseMetadata,
  type CompetitionStandingsPhaseRule,
} from "../../config/competition-standings-phase-rules.js";

export function extractCompetitionStandingsFromHtml(params: {
  html: string;
  competitionId: string;
  competitionName: string | null;
  countryName: string | null;
  zerozeroUrl: string;
  mode: CompetitionStandingsMode;
  status: CompetitionStandingsSourceStatus;
  scrapedAtUtc: string;
  defaultPhaseNotes?: string[];
  defaultRuleProfileId?: string | null;
  phaseRules?: CompetitionStandingsPhaseRule[];
}): CompetitionStandingsSnapshot {
  const { html } = params;
  const editionId = firstMatch(html, /name="id_edicao" type="hidden" value="(\d+)"/i);
  const phaseId = firstMatch(html, /name="fase" type="hidden" value="(\d+)"/i);
  const pagePhase = decodeHtml(lastMatch(html, /<a href="\/edicao\/[^"]+\?fase=\d+"><b>(.*?)<\/b><\/a>/gi));
  const tables = extractTables(html, pagePhase, params.mode);

  if (tables.length === 0) {
    throw new Error(`No classification tables found for competition ${params.competitionId}.`);
  }

  const phaseMetadata = resolveCompetitionStandingsPhaseMetadata(
    {
      status: params.status,
      defaultPhaseNotes: params.defaultPhaseNotes,
      defaultRuleProfileId: params.defaultRuleProfileId,
      phaseRules: params.phaseRules,
    },
    {
      phaseId,
      phaseName: pagePhase,
      tableNames: tables.map((table) => table.name ?? ""),
    },
  );

  return {
    source: "zerozero",
    competitionId: params.competitionId,
    competitionName: params.competitionName,
    countryName: params.countryName,
    zerozeroUrl: params.zerozeroUrl,
    mode: params.mode,
    status: phaseMetadata.status,
    scrapedAtUtc: params.scrapedAtUtc,
    editionId,
    phaseId,
    phaseName: pagePhase,
    phaseNotes: phaseMetadata.phaseNotes,
    ruleProfileId: phaseMetadata.ruleProfileId,
    tables,
  };
}

function extractTables(
  html: string,
  pagePhase: string | null,
  mode: CompetitionStandingsMode,
): CompetitionStandingsTable[] {
  const tableRegex = /<table[^>]*class="[^"]*zz-datatable[^"]*"[^>]*>([\s\S]*?)<\/table>/gi;
  const tables: CompetitionStandingsTable[] = [];
  let match: RegExpExecArray | null = null;

  while ((match = tableRegex.exec(html)) !== null) {
    const tableHtml = match[1] ?? "";
    const start = match.index;
    const context = html.slice(Math.max(0, start - 1200), start);
    const title = decodeHtml(lastMatch(context, /<h2[^>]*>\s*(Classificação(?:\s*-\s*[^<]+)?)\s*<\/h2>/gi));
    const group = decodeHtml(lastMatch(context, /<h3[^>]*>\s*([^<]+)\s*<\/h3>/gi));
    const rows = extractRows(tableHtml);

    if (rows.length === 0) {
      continue;
    }

    tables.push({
      name: resolveTableName({ group, title, pagePhase }),
      type: mode,
      rows,
    });
  }

  return tables;
}

function extractRows(tableHtml: string) {
  const headers = extractHeaderCells(tableHtml);
  const columnIndexes = resolveColumnIndexes(headers);
  const bodyMatch = tableHtml.match(/<tbody>([\s\S]*?)<\/tbody>/i);
  const body = bodyMatch?.[1] ?? "";
  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  const rows = [];
  let match: RegExpExecArray | null = null;

  while ((match = rowRegex.exec(body)) !== null) {
    const cells = extractCells(match[1] ?? "");
    if (cells.length < 3) {
      continue;
    }

    const teamCell = resolveTeamCell(cells);
    const teamName = decodeHtml(stripTags(teamCell));
    if (!teamName) {
      continue;
    }

    rows.push({
      position: toInteger(decodeHtml(stripTags(cells[0] ?? ""))),
      teamName,
      teamUrl: absolutizeZerozeroPath(firstMatch(teamCell, /<a href="([^"]+)"/i)),
      points: readIntegerByIndex(cells, columnIndexes.points),
      matches: readIntegerByIndex(cells, columnIndexes.matches),
      wins: readIntegerByIndex(cells, columnIndexes.wins),
      draws: readIntegerByIndex(cells, columnIndexes.draws),
      losses: readIntegerByIndex(cells, columnIndexes.losses),
      goalsFor: readIntegerByIndex(cells, columnIndexes.goalsFor),
      goalsAgainst: readIntegerByIndex(cells, columnIndexes.goalsAgainst),
      goalDifference: readGoalDifferenceByIndex(cells, columnIndexes.goalDifference),
    });
  }

  return rows;
}

function extractHeaderCells(tableHtml: string): string[] {
  const headerMatch = tableHtml.match(/<thead>([\s\S]*?)<\/thead>/i);
  const header = headerMatch?.[1] ?? "";
  return extractCells(header).map((cell) => readCellText(cell));
}

function extractCells(rowHtml: string): string[] {
  const cells: string[] = [];
  const cellRegex = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
  let match: RegExpExecArray | null = null;

  while ((match = cellRegex.exec(rowHtml)) !== null) {
    cells.push(match[1] ?? "");
  }

  return cells;
}

function readCellText(value: string): string {
  return (decodeHtml(stripTags(value)) ?? "").replace(/\s+/g, " ").trim();
}

function readIntegerByIndex(cells: string[], index: number | null): number | null {
  if (index === null || index < 0 || index >= cells.length) {
    return null;
  }

  return toInteger(readCellText(cells[index] ?? ""));
}

function readGoalDifferenceByIndex(cells: string[], index: number | null): string | null {
  if (index === null || index < 0 || index >= cells.length) {
    return null;
  }

  return normalizeGoalDifference(readCellText(cells[index] ?? ""));
}

function stripTags(value: string): string {
  return value
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeGoalDifference(value: string): string | null {
  if (!value) {
    return null;
  }

  return value.replace(/\s+/g, "");
}

function resolveTeamCell(cells: string[]): string {
  for (const cell of cells) {
    const text = readCellText(cell);
    if (!text) {
      continue;
    }

    if (/[A-Za-zÀ-ÿ]/.test(text) && !/^\+?\-?\d+$/.test(text)) {
      return cell;
    }
  }

  return cells[2] ?? cells[1] ?? cells[0] ?? "";
}

function resolveColumnIndexes(headers: string[]) {
  const normalizedHeaders = headers.map(normalizeHeaderLabel);

  return {
    points: findHeaderIndex(normalizedHeaders, ["p", "pts", "pt"]),
    matches: findHeaderIndex(normalizedHeaders, ["j", "pj"]),
    wins: findHeaderIndex(normalizedHeaders, ["v"]),
    draws: findHeaderIndex(normalizedHeaders, ["e"]),
    losses: findHeaderIndex(normalizedHeaders, ["d"]),
    goalsFor: findHeaderIndex(normalizedHeaders, ["gm", "gf"]),
    goalsAgainst: findHeaderIndex(normalizedHeaders, ["gs", "ga"]),
    goalDifference: findHeaderIndex(normalizedHeaders, ["dg", "diff", "saldo"]),
  };
}

function findHeaderIndex(headers: string[], labels: string[]): number | null {
  const index = headers.findIndex((header) => labels.includes(header));
  return index >= 0 ? index : null;
}

function normalizeHeaderLabel(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "")
    .toLowerCase();
}

function toInteger(value: string | null): number | null {
  if (!value) {
    return null;
  }

  const normalized = value.replace(/[^\d-]/g, "");
  if (!normalized) {
    return null;
  }

  const parsed = Number.parseInt(normalized, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function firstMatch(value: string, regex: RegExp): string | null {
  const match = value.match(regex);
  return match?.[1]?.trim() ?? null;
}

function lastMatch(value: string, regex: RegExp): string | null {
  let found: string | null = null;
  let match: RegExpExecArray | null = null;

  while ((match = regex.exec(value)) !== null) {
    found = match[1]?.trim() ?? null;
  }

  return found;
}

function absolutizeZerozeroPath(value: string | null): string | null {
  if (!value) {
    return null;
  }

  return value.startsWith("http") ? value : `https://www.zerozero.pt${value}`;
}

function resolveTableName(params: {
  group: string | null;
  title: string | null;
  pagePhase: string | null;
}): string | null {
  if (params.group) {
    return params.group;
  }

  if (params.title && !isGenericStandingsTitle(params.title)) {
    return params.title;
  }

  return params.pagePhase ?? params.title;
}

function isGenericStandingsTitle(value: string): boolean {
  return /^classifica[çc][aã]o(?:\s*-\s*.+)?$/i.test(value.trim());
}

function decodeHtml(value: string | null): string | null {
  if (!value) {
    return null;
  }

  return value
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&Aacute;/g, "Á")
    .replace(/&aacute;/g, "á")
    .replace(/&Acirc;/g, "Â")
    .replace(/&acirc;/g, "â")
    .replace(/&Agrave;/g, "À")
    .replace(/&agrave;/g, "à")
    .replace(/&Atilde;/g, "Ã")
    .replace(/&atilde;/g, "ã")
    .replace(/&Eacute;/g, "É")
    .replace(/&eacute;/g, "é")
    .replace(/&Ecirc;/g, "Ê")
    .replace(/&ecirc;/g, "ê")
    .replace(/&Iacute;/g, "Í")
    .replace(/&iacute;/g, "í")
    .replace(/&Oacute;/g, "Ó")
    .replace(/&oacute;/g, "ó")
    .replace(/&Ocirc;/g, "Ô")
    .replace(/&ocirc;/g, "ô")
    .replace(/&Otilde;/g, "Õ")
    .replace(/&otilde;/g, "õ")
    .replace(/&Uacute;/g, "Ú")
    .replace(/&uacute;/g, "ú")
    .replace(/&Ccedil;/g, "Ç")
    .replace(/&ccedil;/g, "ç")
    .replace(/&uuml;/g, "ü")
    .replace(/&Uuml;/g, "Ü")
    .replace(/\s+/g, " ")
    .trim();
}
