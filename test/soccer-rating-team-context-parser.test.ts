import test from "node:test";
import assert from "node:assert/strict";

import { parseSoccerRatingTeamContextHtml } from "../src/infrastructure/soccer-rating/soccer-rating-team-context-parser.js";

test("parseSoccerRatingTeamContextHtml extracts a rich archived team context", () => {
  const html = `
    <html><head><title>Benfica Lisboa: Prediction (1x2), Betting Advice & FAIR ODDS</title></head><body>
      <table><tr><th><font><b>Benfica Lisboa</b></font></th></tr></table>
      <table>
        <tr>
          <td>Country:</td><td width="22%"><img src="/flags/PT.gif"><a href="/Portugal/" class="highlight">Portugal</a></td>
          <td>League:</td><td><a href="/Portugal/" class="highlight">Super Liga</a></td>
        </tr>
        <tr class="nomobil"><td>Rating Total:</td><td>2332.70</td><td></td><td>Rating Home:</td><td>2333.45</td><td></td><td>Rating Away:</td><td>2331.96</td></tr>
      </table>
      <table><tr><td colspan>Benfica Lisboa is ranked #1 in Portugal and #21 in Europe.
      <br>Teams of same strength are <a href="/AC-Milan/1590/">AC Milan</a> (2342.24) and <a href="/Borussia-Dortmund/147/">Borussia Dortmund</a> (2331.70).</td></tr></table>
      <table class="bigtable" style="margin-top:7px;"><tr><th><font><b>Benfica Lisboa Prediction &amp; Betting Advice</b></font></th></tr><tr><td><font style="line-height:1.5">
        <table class="bigtable" width="100%" border="0">
          <tr><td width="33%">09/08 PT1</td><td width="33%"> Benfica Lisboa</td><td width="33%"><a href="/Academico-Viseu/6047/"><u>Academico Viseu</u></a></td></tr>
          <tr><td>Form Last 3 Games</td><td>6 P., 9:3 (WLW)</td><td>5 P., 2:0 (DWD)</td></tr>
          <tr><td><b>Prediction:</b></td><td>2/10</td><td>5/10</td></tr>
        </table>
        <br>
        <table bgcolor="#eeeeee" width="100%"><tr><td>
          Benfica Lisboa (2333.41) is favorite against Academico Viseu (1847.86) according to ratings from last round.
          <p style="margin-bottom:0"><b>Betting Tip:</b><br>Bet on (X2) Academico Viseu (Stake 3/10) with odds 18.50.<br>
          Fair Odds seem to be Benfica Lisboa (1.18) and Academico Viseu (19.36).<br>
          Benfica Lisboa is slightly overrated by bookmakers.
          <div style="margin-top:10px"><b>Odds Development:</b></div>
          <table cellpadding="2">
            <tr><td>Opening Odds:</td><td>1.09</td><td></td><td>10.50</td><td>26.00</td><td></td><td>(OO 16.37)</td></tr>
            <tr><td>Closing Odds:</td><td>1.13</td><td></td><td>8.75</td><td>18.50</td><td></td><td>(AO 0.02)</td></tr>
            <tr><td>Fair Odds:</td><td>1.18</td><td></td><td>9.68</td><td>19.36</td><td></td><td>Calculated Odds</td></tr>
          </table>
        </td></tr></table>
      </font></td></tr></table>
      <table class="bigtable" style="margin-top:7px;">
        <tr><th><font><b>&#9660; Injuries &amp; Suspensions</b></font></th></tr>
        <tr><td width="50%"><a href="javascript:showInj()"> Benfica Lisboa (0)</a> 0/0</td><td width="50%">Opponent</td></tr>
        <tr><td valign="top"><table style="display:block" id="inj1" width="100%"><tr><td><i>None</i></td></tr></table></td><td></td></tr>
        <tr><th><font><b>Expected Lineup</b></font></th></tr>
        <tr><td width="50%"><a href="javascript:showLine()"> Benfica Lisboa (#11)</a><br>6/1 Games/Goals, &empty; 67 Rating</td><td></td></tr>
        <tr><td valign="top"><table style="display:block" id="line1" width="100%">
          <tr><td>#1</td><td><div class="nomobil"> Anatoliy Trubin (GK)</div><div class="ismobil">A. Trubin</div></td><td> 0/0</td><td class="cr1">68</td></tr>
          <tr><td>#2</td><td><div class="nomobil"> Antonio Silva (DF)</div><div class="ismobil">A. Silva</div></td><td> 0/0</td><td class="cr1">67</td></tr>
          <tr><td>#3</td><td><div class="nomobil"> Jhon Duran (ST)</div><div class="ismobil">J. Duran</div></td><td> 6/1</td><td class="cr1">76</td></tr>
        </table></td></tr>
        <tr><th><font><b>Squad</b></font></th></tr>
        <tr><td width="50%">Benfica Lisboa</td><td></td></tr>
        <tr><td valign="top"><table style="display:block" id="squad1" width="100%">
          <tr><td><i><div class="nomobil"> Anatoliy Trubin (24)</div><div class="ismobil">A. Trubin (24)</div></i></td><td> 0/0</td><td class="cr1">68</td></tr>
          <tr><td><i><div class="nomobil"> Antonio Silva (22)</div><div class="ismobil">A. Silva (22)</div></i></td><td> 0/0</td><td class="cr1">67</td></tr>
          <tr><td><div class="nomobil"> Jhon Duran (22)</div><div class="ismobil">J. Duran (22)</div></td><td> 6/1</td><td class="cr1">76</td></tr>
        </table></td></tr>
      </table>
    </body></html>
  `;

  const result = parseSoccerRatingTeamContextHtml({
    html,
    inputPath:
      "/Users/mariocabano/Documents/Futestat/raw/team-pages/soccer-rating/2025-2026/portugal/1076-benfica-lisboa.html",
    collectedAtUtc: "2026-07-31T18:00:00.000Z",
  });

  assert.equal(result.snapshot.team.id, "1076");
  assert.equal(result.snapshot.team.slug, "benfica-lisboa");
  assert.equal(result.snapshot.team.country, "Portugal");
  assert.equal(result.snapshot.season.label, "2025/2026");
  assert.equal(result.snapshot.season.isCurrent, false);
  assert.equal(result.snapshot.availability.status, "archived");
  assert.equal(result.snapshot.ratings.overall, 2332.7);
  assert.equal(result.snapshot.rankings.national, 1);
  assert.equal(result.snapshot.rankings.europe, 21);
  assert.deepEqual(result.snapshot.form.last3, ["W", "L", "W"]);
  assert.equal(result.snapshot.prediction.tip, "away_or_draw");
  assert.equal(result.snapshot.prediction.confidencePct, 30);
  assert.equal(result.snapshot.expectedLineup.averageRating, 6.7);
  assert.equal(result.snapshot.expectedLineup.players[2]?.name, "Jhon Duran");
  assert.equal(result.snapshot.expectedLineup.players[2]?.rating, 7.6);
  assert.equal(result.snapshot.squad[0]?.age, 24);
  assert.equal(result.snapshot.squad[2]?.position, "ST");
  assert.equal(result.snapshot.oddsMarket.opening1X2?.draw, 10.5);
  assert.equal(result.snapshot.oddsMarket.fair1X2?.away, 19.36);
  assert.equal(result.snapshot.oddsMarket.movementSummary, "home_odds_up_away_odds_down");
  assert.deepEqual(result.snapshot.squadHealth.injuries, []);
  assert.equal(result.snapshot.similarTeams.length, 2);
  assert.equal(result.fieldCount, 9);
});

test("parseSoccerRatingTeamContextHtml marks empty current season as not_started", () => {
  const html = `
    <html><head><title>Sporting CP: Prediction (1x2), Betting Advice & FAIR ODDS</title></head><body>
      <table><tr><th><font><b>Sporting CP</b></font></th></tr></table>
    </body></html>
  `;

  const result = parseSoccerRatingTeamContextHtml({
    html,
    inputPath:
      "/Users/mariocabano/Documents/Futestat/raw/team-pages/soccer-rating/2026-2027/portugal/9768-sporting-cp.html",
    collectedAtUtc: "2026-07-31T18:00:00.000Z",
  });

  assert.equal(result.snapshot.team.slug, "sporting-cp");
  assert.equal(result.snapshot.season.label, "2026/2027");
  assert.equal(result.snapshot.availability.status, "not_started");
  assert.equal(result.fieldCount, 0);
});
