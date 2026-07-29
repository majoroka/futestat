import test from "node:test";
import assert from "node:assert/strict";

import { extractCompetitionStandingsFromHtml } from "../src/infrastructure/zerozero/zerozero-standings-parser.js";

test("extractCompetitionStandingsFromHtml parses compact grouped standings tables", () => {
  const snapshot = extractCompetitionStandingsFromHtml({
    html: `
      <div id="page_submenu">
        <a href="/edicao/i-divisao-argentina-2026/218999?fase=240777"><b>1.ª Fase</b></a>
        <input name="id_edicao" type="hidden" value="218999" />
        <input name="fase" type="hidden" value="240777" />
      </div>
      <div class="card-data">
        <div class="card-data__header"><h2 class="header">Classificação</h2></div>
        <div class="card-data__body">
          <div id="edition_table">
            <h3>Grupo A</h3>
            <table class="zztable stats zz-datatable">
              <thead>
                <tr><th></th><th></th><th></th><th>J</th><th>GM</th><th>GS</th><th>P</th></tr>
              </thead>
              <tbody>
                <tr>
                  <td>1</td>
                  <td><a href="/equipa/tigre"><img alt="Tigre"></a></td>
                  <td class="text"><a href="/equipa/tigre">Tigre</a></td>
                  <td><a>2</a></td>
                  <td><a>3</a></td>
                  <td><a>1</a></td>
                  <td><strong>4</strong></td>
                </tr>
                <tr>
                  <td>2</td>
                  <td><a href="/equipa/rosario-central"><img alt="Rosario Central"></a></td>
                  <td class="text"><a href="/equipa/rosario-central">Rosario Central</a></td>
                  <td><a>2</a></td>
                  <td><a>2</a></td>
                  <td><a>1</a></td>
                  <td><strong>4</strong></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `,
    competitionId: "155",
    competitionName: "Liga Profesional",
    countryName: "Argentina",
    zerozeroUrl: "https://www.zerozero.pt/competicao/i-divisao-argentina",
    mode: "regular_plus_playoffs",
    status: "needs_validation",
    scrapedAtUtc: "2026-07-29T10:00:00.000Z",
  });

  assert.equal(snapshot.tables.length, 1);
  assert.equal(snapshot.tables[0]?.name, "Grupo A");
  assert.equal(snapshot.tables[0]?.rows[0]?.teamName, "Tigre");
  assert.equal(snapshot.tables[0]?.rows[0]?.matches, 2);
  assert.equal(snapshot.tables[0]?.rows[0]?.goalsFor, 3);
  assert.equal(snapshot.tables[0]?.rows[0]?.goalsAgainst, 1);
  assert.equal(snapshot.tables[0]?.rows[0]?.points, 4);
  assert.equal(snapshot.tables[0]?.rows[0]?.wins, null);
});
