import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { buildMatchView } from "../src/infrastructure/manual/match-view-builder.js";

test("buildMatchView composes fixture, standings, details and manual team data into a derived snapshot", async () => {
  const repoRoot = await mkdtemp(path.join(os.tmpdir(), "futestat-match-view-"));

  await mkdir(path.join(repoRoot, "data", "fixtures", "days"), { recursive: true });
  await mkdir(path.join(repoRoot, "data", "fixtures", "standings"), { recursive: true });
  await mkdir(path.join(repoRoot, "data", "fixtures", "details"), { recursive: true });
  await mkdir(path.join(repoRoot, "data", "team-stats", "fotmob", "2026-2027", "238-liga-portugal"), {
    recursive: true,
  });
  await mkdir(path.join(repoRoot, "data", "team-context", "soccer-rating", "2026-2027", "portugal"), {
    recursive: true,
  });

  await writeFile(
    path.join(repoRoot, "data", "fixtures", "days", "2026-08-15.json"),
    JSON.stringify(
      {
        source: "sofascore",
        date: "2026-08-15",
        collectionState: "open",
        firstScrapedAtUtc: "2026-08-01T10:00:00Z",
        lastScrapedAtUtc: "2026-08-01T10:00:00Z",
        frozenAtUtc: null,
        fixtureCount: 1,
        fixtures: [
          {
            source: "sofascore",
            sourceEventId: "16350227",
            matchDate: "2026-08-15",
            kickoffAtUtc: "2026-08-15T18:45:00Z",
            competitionId: "238",
            competitionName: "Liga Portugal",
            competitionLogoUrl: null,
            countryName: "Portugal",
            homeTeamId: "3006",
            homeTeamName: "Benfica",
            homeTeamLogoUrl: "https://img.sofascore.com/api/v1/team/3006/image/small",
            awayTeamId: "9768",
            awayTeamName: "Sporting CP",
            awayTeamLogoUrl: "https://img.sofascore.com/api/v1/team/9768/image/small",
            status: "upcoming",
            resultLabel: null,
            homeScore: null,
            awayScore: null,
            matchUrl: "https://www.sofascore.com/football/match/example/16350227",
            firstSeenAtUtc: "2026-08-01T10:00:00Z",
            lastSeenAtUtc: "2026-08-01T10:00:00Z",
            lastChangedAtUtc: "2026-08-01T10:00:00Z",
          },
        ],
        metadata: {
          browserTimezone: "UTC",
          scraperVersion: 2,
        },
      },
      null,
      2,
    ),
    "utf8",
  );

  await writeFile(
    path.join(repoRoot, "data", "fixtures", "standings", "238.json"),
    JSON.stringify(
      {
        source: "zerozero",
        competitionId: "238",
        competitionName: "Liga Portugal",
        countryName: "Portugal",
        zerozeroUrl: "https://www.zerozero.pt/competicao/liga-portuguesa",
        mode: "single_table",
        status: "ready",
        scrapedAtUtc: "2026-08-01T10:00:00Z",
        editionId: "1",
        phaseId: null,
        tables: [
          {
            name: "Classificacao",
            type: "total",
            rows: [
              {
                position: 1,
                teamName: "Benfica",
                teamUrl: null,
                points: 3,
                matches: 1,
                wins: 1,
                draws: 0,
                losses: 0,
                goalsFor: 2,
                goalsAgainst: 0,
                goalDifference: "+2",
              },
              {
                position: 2,
                teamName: "Sporting CP",
                teamUrl: null,
                points: 1,
                matches: 1,
                wins: 0,
                draws: 1,
                losses: 0,
                goalsFor: 1,
                goalsAgainst: 1,
                goalDifference: "0",
              },
            ],
          },
        ],
      },
      null,
      2,
    ),
    "utf8",
  );

  await writeFile(
    path.join(repoRoot, "data", "fixtures", "details", "16350227.json"),
    JSON.stringify(
      {
        source: "sofascore",
        sourceEventId: "16350227",
        matchUrl: "https://www.sofascore.com/football/match/example/16350227",
        status: "upcoming",
        scrapedAtUtc: "2026-08-01T10:05:00Z",
        fixtureLastSeenAtUtc: "2026-08-01T10:00:00Z",
        fixtureLastChangedAtUtc: "2026-08-01T10:00:00Z",
        overview: {
          kickoffAtUtc: "2026-08-15T18:45:00Z",
          competitionId: "238",
          competitionName: "Liga Portugal",
          competitionLogoUrl: null,
          competitionStage: "Jornada 1",
          countryName: "Portugal",
          venueName: "Estadio da Luz",
          venueCity: "Lisboa",
          venueCountry: "Portugal",
          refereeName: "Joao Pinheiro",
          refereeCountry: "Portugal",
        },
        watch: {
          hasPortugalChannels: true,
          availableCountryCodes: ["PT"],
          note: null,
        },
        odds: {
          providerId: 1,
          marketName: "1X2",
          home: "1.80",
          draw: "3.40",
          away: "4.50",
          hasMoreOdds: false,
        },
        standings: [],
        tieContext: null,
        recent: {
          homeLast: [],
          homeNext: [],
          awayLast: [],
          awayNext: [],
        },
      },
      null,
      2,
    ),
    "utf8",
  );

  await writeFile(
    path.join(repoRoot, "data", "team-stats", "fotmob", "index.json"),
    JSON.stringify(
      {
        generatedAtUtc: "2026-08-01T10:00:00Z",
        entries: [
          {
            season: "2026-2027",
            competitionId: "238",
            competitionSlug: "liga-portugal",
            teamId: "f-3006",
            teamSlug: "benfica",
            jsonPath: "data/team-stats/fotmob/2026-2027/238-liga-portugal/f-3006-benfica.json",
            sourceHtmlPath: "raw/team-pages/fotmob/2026-2027/238-liga-portugal/f-3006-benfica.html",
            parsedAtUtc: "2026-08-01T10:00:00Z",
            availabilityStatus: "partial",
          },
        ],
      },
      null,
      2,
    ),
    "utf8",
  );

  await writeFile(
    path.join(repoRoot, "data", "team-stats", "fotmob", "2026-2027", "238-liga-portugal", "f-3006-benfica.json"),
    JSON.stringify(
      {
        team: { id: "f-3006", name: "Benfica", slug: "benfica", country: "Portugal", logoUrl: null },
        competition: { id: "238", name: "Liga Portugal" },
        season: { id: "2026/2027", label: "2026/2027", isCurrent: true },
        source: { provider: "fotmob", url: "https://www.fotmob.com/teams/3006/stats/benfica/teams", collectedAtUtc: "2026-08-01T10:00:00Z" },
        availability: { status: "partial", coverage: "medium", notes: null },
        overview: { teamRating: 7.2, goalsPerMatch: 2.1, goalsConcededPerMatch: 0.8, averagePossessionPct: 59, cleanSheets: 1, attendanceAverage: 50000 },
        attack: { xg: 1.9, xgDiff: 0.7, shotsOnTargetPerMatch: 6.2, bigChances: 3.2, bigChancesMissed: 1.1, accuratePassesPerMatch: 430, accurateLongBallsPerMatch: 18, accurateCrossesPerMatch: 6, penaltiesAwarded: 1, touchesInOppBoxPerMatch: 20, cornersPerMatch: 7, setPieceGoals: 1 },
        defense: { xgConceded: 0.8, interceptionsPerMatch: 7.4, tacklesPerMatch: 14.2, clearancesPerMatch: 11.3, finalThirdRecoveriesPerMatch: 4.1, setPieceGoalsConceded: 0, penaltiesConceded: 0, savesPerMatch: 2.1 },
        discipline: { foulsPerMatch: 10.1, yellowCardsPerMatch: 1.8, redCardsPerMatch: 0 },
      },
      null,
      2,
    ),
    "utf8",
  );

  await writeFile(
    path.join(repoRoot, "data", "team-context", "soccer-rating", "index.json"),
    JSON.stringify(
      {
        generatedAtUtc: "2026-08-01T10:00:00Z",
        entries: [
          {
            season: "2026-2027",
            countrySlug: "portugal",
            teamId: "sr-1076",
            teamSlug: "benfica-lisboa",
            jsonPath: "data/team-context/soccer-rating/2026-2027/portugal/sr-1076-benfica-lisboa.json",
            sourceHtmlPath: "raw/team-pages/soccer-rating/2026-2027/portugal/sr-1076-benfica-lisboa.html",
            parsedAtUtc: "2026-08-01T10:00:00Z",
            availabilityStatus: "available",
          },
          {
            season: "2026-2027",
            countrySlug: "portugal",
            teamId: "sr-9768",
            teamSlug: "sporting-cp",
            jsonPath: "data/team-context/soccer-rating/2026-2027/portugal/sr-9768-sporting-cp.json",
            sourceHtmlPath: "raw/team-pages/soccer-rating/2026-2027/portugal/sr-9768-sporting-cp.html",
            parsedAtUtc: "2026-08-01T10:00:00Z",
            availabilityStatus: "available",
          },
        ],
      },
      null,
      2,
    ),
    "utf8",
  );

  await writeFile(
    path.join(repoRoot, "data", "team-context", "soccer-rating", "2026-2027", "portugal", "sr-1076-benfica-lisboa.json"),
    JSON.stringify(
      {
        team: { id: "sr-1076", name: "Benfica Lisboa", slug: "benfica-lisboa", country: "Portugal", logoUrl: null },
        season: { id: "2026/2027", label: "2026/2027", isCurrent: true },
        source: { provider: "soccer-rating", url: "https://www.soccer-rating.com/Benfica-Lisboa/1076/", collectedAtUtc: "2026-08-01T10:00:00Z" },
        availability: { status: "available", coverage: "high", notes: null },
        ratings: { overall: 7.8, home: 8.0, away: 7.4 },
        rankings: { national: 1, europe: 18 },
        form: { last3: ["W", "W", "D"] },
        prediction: { tip: "home_win", tipLabel: "Vitoria da equipa da casa", confidencePct: 72, strengthComparison: "slightly_superior" },
        oddsMarket: { opening1X2: { home: 1.8, draw: 3.5, away: 4.3 }, fair1X2: { home: 1.75, draw: 3.6, away: 4.5 }, movementSummary: "home_odds_down" },
        squadHealth: { injuries: [{ player: "Jogador A", status: "injury", description: "muscular" }], suspensions: [] },
        expectedLineup: { formation: "4-2-3-1", averageRating: 7.4, players: [] },
        squad: [{ name: "Jogador A", position: "FW", age: 24, apps: 1, goals: 1, rating: 7.6 }],
        recentMatches: [{ date: "2026-08-08", homeTeam: "Benfica", awayTeam: "Braga", result: "2-1", odds1X2: { home: 1.7, draw: 3.6, away: 4.7 }, homeRating: 7.5, awayRating: 6.8 }],
        similarTeams: [{ name: "FC Porto", rating: 7.9 }],
      },
      null,
      2,
    ),
    "utf8",
  );

  await writeFile(
    path.join(repoRoot, "data", "team-context", "soccer-rating", "2026-2027", "portugal", "sr-9768-sporting-cp.json"),
    JSON.stringify(
      {
        team: { id: "sr-9768", name: "Sporting CP", slug: "sporting-cp", country: "Portugal", logoUrl: null },
        season: { id: "2026/2027", label: "2026/2027", isCurrent: true },
        source: { provider: "soccer-rating", url: "https://www.soccer-rating.com/Sporting-CP/9768/", collectedAtUtc: "2026-08-01T10:00:00Z" },
        availability: { status: "available", coverage: "high", notes: null },
        ratings: { overall: 7.6, home: 7.8, away: 7.3 },
        rankings: { national: 2, europe: 21 },
        form: { last3: ["W", "D", "W"] },
        prediction: { tip: "draw_no_bet_away", tipLabel: "Sporting competitivo", confidencePct: 58, strengthComparison: "balanced" },
        oddsMarket: { opening1X2: { home: 2.4, draw: 3.3, away: 2.9 }, fair1X2: { home: 2.5, draw: 3.2, away: 2.8 }, movementSummary: null },
        squadHealth: { injuries: [], suspensions: [] },
        expectedLineup: { formation: "3-4-3", averageRating: 7.3, players: [] },
        squad: [],
        recentMatches: [],
        similarTeams: [],
      },
      null,
      2,
    ),
    "utf8",
  );

  const result = await buildMatchView(repoRoot, {
    fixtureId: "16350227",
    matchDate: "2026-08-15",
    force: true,
  });

  assert.equal(result.standingsAvailable, true);
  assert.equal(result.sources.homeTeamStats.available, true);
  assert.equal(result.sources.awayTeamStats.available, false);
  assert.equal(result.sources.homeTeamContext.available, true);
  assert.equal(result.sources.awayTeamContext.available, true);

  const outputPath = path.join(repoRoot, "data", "match-view", "2026-08-15", "16350227.json");
  const snapshot = JSON.parse(await readFile(outputPath, "utf8"));

  assert.equal(snapshot.match.competition.name, "Liga Portugal");
  assert.equal(snapshot.match.details.venueName, "Estadio da Luz");
  assert.equal(snapshot.homeTeam.headerStats.overallRating, 7.8);
  assert.equal(snapshot.homeTeam.headerStats.xgFor, 1.9);
  assert.equal(snapshot.homeTeam.overview.expectedLineup.formation, "4-2-3-1");
  assert.equal(snapshot.awayTeam.headerStats.overallRating, 7.6);
  assert.equal(snapshot.awayTeam.statistics.overview, null);
  assert.equal(snapshot.standings.rows[0].highlight, "home");
  assert.equal(snapshot.standings.rows[1].highlight, "away");
  assert.equal(snapshot.homeTeam.identity.sourceIds.fotmob, "f-3006");
  assert.equal(snapshot.homeTeam.identity.sourceIds.soccerRating, "sr-1076");
});
