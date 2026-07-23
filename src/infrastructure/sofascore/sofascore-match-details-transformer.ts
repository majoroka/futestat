import type { MatchFixture, FixtureStatus } from "../../domain/fixture.js";
import type {
  MatchDetailOdds,
  MatchDetailRecentContext,
  MatchDetailSnapshot,
  MatchDetailTieContext,
  MatchDetailWatchInfo,
  RelatedMatchSummary,
} from "../../domain/match-detail.js";
import { absoluteMatchUrl } from "./sofascore-helpers.js";

export interface CollectedMatchDetailPayloads {
  event: unknown;
  tv: unknown;
  odds: { providerId: number | null; payload: unknown } | null;
  h2hEvents: unknown;
  homeLast: unknown;
  awayLast: unknown;
  homeNext: unknown;
  awayNext: unknown;
}

export function buildMatchDetailSnapshot(params: {
  baseUrl: string;
  fixture: MatchFixture;
  scrapedAtUtc: string;
  payloads: CollectedMatchDetailPayloads;
}): MatchDetailSnapshot {
  const { baseUrl, fixture, scrapedAtUtc, payloads } = params;
  const event = readObject(readObject(payloads.event)?.event);
  const h2hEvents = readArray(readObject(payloads.h2hEvents)?.events);

  return {
    source: "sofascore",
    sourceEventId: fixture.sourceEventId,
    matchUrl: fixture.matchUrl,
    status: "upcoming",
    scrapedAtUtc,
    fixtureLastSeenAtUtc: fixture.lastSeenAtUtc,
    fixtureLastChangedAtUtc: fixture.lastChangedAtUtc,
    overview: {
      kickoffAtUtc: fixture.kickoffAtUtc,
      competitionId: fixture.competitionId,
      competitionName:
        readString(readObject(readObject(event)?.tournament)?.name) ?? fixture.competitionName,
      competitionLogoUrl: fixture.competitionLogoUrl,
      competitionStage:
        readString(readObject(readObject(event)?.roundInfo)?.name) ??
        readString(readObject(readObject(event)?.season)?.name),
      countryName:
        readString(readObject(readObject(readObject(event)?.tournament)?.category)?.name) ??
        fixture.countryName,
      venueName: readString(readObject(readObject(event)?.venue)?.name),
      venueCity: readString(readObject(readObject(readObject(event)?.venue)?.city)?.name),
      venueCountry:
        readString(readObject(readObject(readObject(event)?.venue)?.country)?.name) ??
        readString(readObject(readObject(readObject(readObject(event)?.venue)?.city)?.country)?.name),
      refereeName: readString(readObject(readObject(event)?.referee)?.name),
      refereeCountry: readString(readObject(readObject(readObject(event)?.referee)?.country)?.name),
    },
    watch: buildWatchInfo(payloads.tv),
    odds: buildOdds(payloads.odds),
    tieContext: buildTieContext({
      baseUrl,
      currentEventId: fixture.sourceEventId,
      tieFormat:
        readNumber(readObject(event)?.cupMatchesInRound) === 2 ? "Two legs" : null,
      h2hEvents,
    }),
    recent: buildRecentContext({
      baseUrl,
      currentEventId: fixture.sourceEventId,
      homeLast: payloads.homeLast,
      awayLast: payloads.awayLast,
      homeNext: payloads.homeNext,
      awayNext: payloads.awayNext,
    }),
  };
}

function buildWatchInfo(payload: unknown): MatchDetailWatchInfo {
  const channels = readObject(payload)?.countryChannels;
  const mapping = readObject(channels);
  const countryCodes = mapping ? Object.keys(mapping).sort() : [];
  const hasPortugalChannels = readArray(mapping?.PT).length > 0;

  let note: string | null = null;
  if (hasPortugalChannels) {
    note = "Canais disponíveis para Portugal.";
  } else if (countryCodes.length > 0) {
    note = "Sem canais para Portugal; existe cobertura noutros países.";
  } else {
    note = "Sem agenda de TV disponível.";
  }

  return {
    hasPortugalChannels,
    availableCountryCodes: countryCodes,
    note,
  };
}

function buildOdds(
  payload: { providerId: number | null; payload: unknown } | null,
): MatchDetailOdds | null {
  if (!payload) {
    return null;
  }

  const featured = readObject(payload.payload)?.featured;
  const fullTime =
    readObject(featured)?.fullTime ??
    readObject(featured)?.default ??
    firstObjectValue(readObject(featured));

  const choices = readArray(readObject(fullTime)?.choices).map(readObject).filter(Boolean) as Array<
    Record<string, unknown>
  >;

  if (choices.length === 0) {
    return null;
  }

  const home = choices.find((choice) => readString(choice.name) === "1") ?? null;
  const draw = choices.find((choice) => readString(choice.name) === "X") ?? null;
  const away = choices.find((choice) => readString(choice.name) === "2") ?? null;

  return {
    providerId: payload.providerId,
    marketName: readString(readObject(fullTime)?.marketName),
    home: fractionalToDecimal(readString(home?.fractionalValue)),
    draw: fractionalToDecimal(readString(draw?.fractionalValue)),
    away: fractionalToDecimal(readString(away?.fractionalValue)),
    hasMoreOdds: readBoolean(readObject(payload.payload)?.hasMoreOdds) ?? false,
  };
}

function buildTieContext(params: {
  baseUrl: string;
  currentEventId: string;
  tieFormat: string | null;
  h2hEvents: unknown[];
}): MatchDetailTieContext | null {
  const related = params.h2hEvents
    .map((event) => simplifyEvent(params.baseUrl, event))
    .filter((event): event is RelatedMatchSummary => event !== null);

  if (related.length === 0 && !params.tieFormat) {
    return null;
  }

  const current = related.find((event) => event.sourceEventId === params.currentEventId) ?? null;
  const others = related.filter((event) => event.sourceEventId !== params.currentEventId);
  const previousLeg =
    current?.previousLegEventId
      ? others.find((event) => event.sourceEventId === current.previousLegEventId) ?? null
      : null;
  const nextLeg =
    others.find((event) => event.previousLegEventId === params.currentEventId) ?? null;

  return {
    tieFormat: params.tieFormat,
    previousLeg,
    nextLeg,
    h2h: others.slice(0, 5),
  };
}

function buildRecentContext(params: {
  baseUrl: string;
  currentEventId: string;
  homeLast: unknown;
  awayLast: unknown;
  homeNext: unknown;
  awayNext: unknown;
}): MatchDetailRecentContext {
  return {
    homeLast: simplifyEventList(params.baseUrl, params.homeLast, params.currentEventId, 3),
    homeNext: simplifyEventList(params.baseUrl, params.homeNext, params.currentEventId, 2),
    awayLast: simplifyEventList(params.baseUrl, params.awayLast, params.currentEventId, 3),
    awayNext: simplifyEventList(params.baseUrl, params.awayNext, params.currentEventId, 2),
  };
}

function simplifyEventList(
  baseUrl: string,
  payload: unknown,
  currentEventId: string,
  limit: number,
): RelatedMatchSummary[] {
  return readArray(readObject(payload)?.events)
    .map((event) => simplifyEvent(baseUrl, event))
    .filter((event): event is RelatedMatchSummary => event !== null)
    .filter((event) => event.sourceEventId !== currentEventId)
    .slice(0, limit);
}

function simplifyEvent(baseUrl: string, value: unknown): RelatedMatchSummary | null {
  const event = readObject(value);
  const id = readString(event?.id);
  const homeTeam = readObject(event?.homeTeam);
  const awayTeam = readObject(event?.awayTeam);

  if (!id) {
    return null;
  }

  return {
    sourceEventId: id,
    matchUrl: buildRelatedMatchUrl(baseUrl, event),
    kickoffAtUtc: startTimestampToIso(readNumber(event?.startTimestamp)),
    competitionName: readString(readObject(event?.tournament)?.name),
    countryName: readString(readObject(readObject(event?.tournament)?.category)?.name),
    roundName: readString(readObject(event?.roundInfo)?.name),
    homeTeamId: readString(homeTeam?.id),
    homeTeamName: readString(homeTeam?.name) ?? "Desconhecido",
    awayTeamId: readString(awayTeam?.id),
    awayTeamName: readString(awayTeam?.name) ?? "Desconhecido",
    homeScore: readScore(readObject(event?.homeScore)),
    awayScore: readScore(readObject(event?.awayScore)),
    status: mapEventStatus(readObject(event?.status)),
    resultLabel: eventResultLabel(readObject(event?.status)),
    previousLegEventId: readString(event?.previousLegEventId),
    winnerCode: readNumber(event?.winnerCode),
  };
}

function buildRelatedMatchUrl(baseUrl: string, event: Record<string, unknown> | null): string | null {
  const slug = readString(event?.slug);
  const customId = readString(event?.customId);
  const eventId = readString(event?.id);

  if (!slug || !customId || !eventId) {
    return null;
  }

  return absoluteMatchUrl(baseUrl, `/football/match/${slug}/${customId}#id:${eventId}`);
}

function startTimestampToIso(value: number | null): string | null {
  if (value === null) {
    return null;
  }

  return new Date(value * 1_000).toISOString();
}

function fractionalToDecimal(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const match = value.match(/^(\d+)\/(\d+)$/);
  if (!match) {
    return null;
  }

  const numerator = Number.parseInt(match[1] ?? "", 10);
  const denominator = Number.parseInt(match[2] ?? "", 10);
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) {
    return null;
  }

  return (1 + numerator / denominator).toFixed(2);
}

function readScore(score: Record<string, unknown> | null): number | null {
  return readNumber(score?.current) ?? readNumber(score?.display) ?? null;
}

function mapEventStatus(status: Record<string, unknown> | null): FixtureStatus | null {
  const type = readString(status?.type);

  switch (type) {
    case "notstarted":
      return "upcoming";
    case "finished":
      return "finished";
    case "inprogress":
      return "live";
    case "postponed":
      return "postponed";
    case "canceled":
      return "cancelled";
    default:
      return type ? "unknown" : null;
  }
}

function eventResultLabel(status: Record<string, unknown> | null): string | null {
  const description = readString(status?.description);
  if (description === "Ended") {
    return "FT";
  }

  return description;
}

function firstObjectValue(value: Record<string, unknown> | null): Record<string, unknown> | null {
  if (!value) {
    return null;
  }

  for (const candidate of Object.values(value)) {
    const objectCandidate = readObject(candidate);
    if (objectCandidate) {
      return objectCandidate;
    }
  }

  return null;
}

function readArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function readObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function readString(value: unknown): string | null {
  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return null;
}

function readNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function readBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

export const __testables = {
  fractionalToDecimal,
  buildWatchInfo,
  simplifyEvent,
};
