import test from "node:test";
import assert from "node:assert/strict";

import { buildMatchDetailSnapshot, __testables } from "../src/infrastructure/sofascore/sofascore-match-details-transformer.js";

test("fractionalToDecimal converts odds to decimal format", () => {
  assert.equal(__testables.fractionalToDecimal("91/25"), "4.64");
  assert.equal(__testables.fractionalToDecimal("7/20"), "1.35");
  assert.equal(__testables.fractionalToDecimal(null), null);
});

test("buildMatchDetailSnapshot maps structured upcoming detail payloads", () => {
  const detail = buildMatchDetailSnapshot({
    baseUrl: "https://www.sofascore.com",
    fixture: {
      source: "sofascore",
      sourceEventId: "16357256",
      matchDate: "2026-07-23",
      kickoffAtUtc: "2026-07-23T14:30:00.000Z",
      competitionId: "17015",
      competitionName: "UEFA Conference League, Qualification",
      competitionLogoUrl: "https://img.sofascore.com/api/v1/unique-tournament/17015/image",
      countryName: "Europe",
      homeTeamId: "325494",
      homeTeamName: "FC Malisheva",
      homeTeamLogoUrl: "https://img.sofascore.com/api/v1/team/325494/image/small",
      awayTeamId: "2354",
      awayTeamName: "Hibernian",
      awayTeamLogoUrl: "https://img.sofascore.com/api/v1/team/2354/image/small",
      status: "upcoming",
      resultLabel: null,
      homeScore: null,
      awayScore: null,
      matchUrl: "https://www.sofascore.com/football/match/fc-malisheva-hibernian/eXsUjFc#id:16357256",
      firstSeenAtUtc: "2026-07-21T20:23:22.396Z",
      lastSeenAtUtc: "2026-07-23T13:33:09.050Z",
      lastChangedAtUtc: "2026-07-23T13:33:09.050Z",
    },
    scrapedAtUtc: "2026-07-23T14:00:00.000Z",
    payloads: {
      event: {
        event: {
          tournament: {
            name: "UEFA Conference League, Qualification",
            category: { name: "Europe" },
          },
          season: { name: "UEFA Conference League 26/27" },
          roundInfo: { name: "Qualification Round 2" },
          venue: {
            name: "Stadiumi Fadil Vokrri",
            city: { name: "Prishtinë" },
            country: { name: "Kosovo" },
          },
          referee: {
            name: "Romain Lissorgue",
            country: { name: "France" },
          },
          cupMatchesInRound: 2,
        },
      },
      tv: {
        countryChannels: {
          BR: [7548],
        },
      },
      odds: {
        providerId: 801,
        payload: {
          featured: {
            fullTime: {
              marketName: "Full time",
              choices: [
                { name: "1", fractionalValue: "91/25" },
                { name: "X", fractionalValue: "137/50" },
                { name: "2", fractionalValue: "7/20" },
              ],
            },
          },
          hasMoreOdds: false,
        },
      },
      h2hEvents: {
        events: [
          {
            id: 16357256,
            customId: "eXsUjFc",
            slug: "fc-malisheva-hibernian",
            startTimestamp: 1784817000,
            tournament: { name: "UEFA Conference League, Qualification", category: { name: "Europe" } },
            roundInfo: { name: "Qualification Round 2" },
            status: { type: "notstarted", description: "Not started" },
            homeTeam: { id: 325494, name: "FC Malisheva" },
            awayTeam: { id: 2354, name: "Hibernian" },
          },
          {
            id: 16462284,
            customId: "eXsUjFc",
            slug: "fc-malisheva-hibernian",
            startTimestamp: 1785438000,
            previousLegEventId: 16357256,
            tournament: { name: "UEFA Conference League, Qualification", category: { name: "Europe" } },
            roundInfo: { name: "Qualification Round 2" },
            status: { type: "notstarted", description: "Not started" },
            homeTeam: { id: 2354, name: "Hibernian" },
            awayTeam: { id: 325494, name: "FC Malisheva" },
          },
        ],
      },
      homeLast: {
        events: [
          {
            id: 150,
            customId: "abc",
            slug: "fc-malisheva-vllaznia",
            startTimestamp: 1784125800,
            tournament: { name: "UEFA Conference League, Qualification", category: { name: "Europe" } },
            roundInfo: { name: "Qualification Round 1" },
            status: { type: "finished", description: "Ended" },
            homeTeam: { id: 325494, name: "FC Malisheva" },
            awayTeam: { id: 999, name: "Vllaznia" },
            homeScore: { current: 5 },
            awayScore: { current: 0 },
            winnerCode: 1,
          },
        ],
      },
      awayLast: {
        events: [
          {
            id: 151,
            customId: "def",
            slug: "hibernian-rangers",
            startTimestamp: 1784000000,
            tournament: { name: "Premier Sports Cup", category: { name: "Scotland" } },
            roundInfo: { name: "Round 1" },
            status: { type: "finished", description: "Ended" },
            homeTeam: { id: 2354, name: "Hibernian" },
            awayTeam: { id: 1000, name: "Rangers" },
            homeScore: { current: 2 },
            awayScore: { current: 1 },
            winnerCode: 1,
          },
        ],
      },
      homeNext: { events: [] },
      awayNext: { events: [] },
    },
  });

  assert.equal(detail.overview.venueName, "Stadiumi Fadil Vokrri");
  assert.equal(detail.overview.refereeName, "Romain Lissorgue");
  assert.equal(detail.watch.hasPortugalChannels, false);
  assert.equal(detail.odds?.home, "4.64");
  assert.equal(detail.odds?.away, "1.35");
  assert.equal(detail.tieContext?.tieFormat, "Two legs");
  assert.equal(detail.tieContext?.nextLeg?.sourceEventId, "16462284");
  assert.equal(detail.recent.homeLast[0]?.homeTeamName, "FC Malisheva");
  assert.equal(detail.recent.awayLast[0]?.awayTeamName, "Rangers");
});
