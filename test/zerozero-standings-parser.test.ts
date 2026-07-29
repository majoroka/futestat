import test from "node:test";
import assert from "node:assert/strict";

import { extractCompetitionStandingsFromHtml } from "../src/infrastructure/zerozero/zerozero-standings-parser.js";

test("extractCompetitionStandingsFromHtml parses a standard zerozero standings table", () => {
  const snapshot = extractCompetitionStandingsFromHtml({
    html: `
      <div id="page_submenu">
        <a href="/edicao/liga-portugal-betclic-2026-27/218294?fase=240072"><b>Campeonato</b></a>
        <input name="id_edicao" type="hidden" value="218294" />
        <input name="fase" type="hidden" value="240072" />
      </div>
      <div class="card-data">
        <div class="card-data__header"><h2 class="header">Classificação</h2></div>
        <div class="card-data__body">
          <div id="edition_table">
            <table class="zztable stats zz-datatable">
              <thead>
                <tr><th></th><th></th><th></th><th>P</th><th>J</th><th>V</th><th>E</th><th>D</th><th>GM</th><th>GS</th><th>DG</th><th></th></tr>
              </thead>
              <tbody>
                <tr>
                  <td>1</td>
                  <td><a href="/equipa/benfica"><img alt="Benfica"></a></td>
                  <td class="text"><a href="/equipa/benfica">Benfica</a></td>
                  <td><strong>82</strong></td>
                  <td><a>34</a></td>
                  <td><a>26</a></td>
                  <td><a>4</a></td>
                  <td><a>4</a></td>
                  <td><a>84</a></td>
                  <td><a>27</a></td>
                  <td>+57</td>
                  <td><a><span class="icn_zerozero plus">a</span></a></td>
                </tr>
                <tr>
                  <td>2</td>
                  <td><a href="/equipa/fc-porto"><img alt="FC Porto"></a></td>
                  <td class="text"><a href="/equipa/fc-porto">FC Porto</a></td>
                  <td><strong>79</strong></td>
                  <td><a>34</a></td>
                  <td><a>25</a></td>
                  <td><a>4</a></td>
                  <td><a>5</a></td>
                  <td><a>76</a></td>
                  <td><a>30</a></td>
                  <td>+46</td>
                  <td><a><span class="icn_zerozero plus">a</span></a></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `,
    competitionId: "238",
    competitionName: "Liga Portugal",
    countryName: "Portugal",
    zerozeroUrl: "https://www.zerozero.pt/competicao/liga-portuguesa",
    mode: "single_table",
    status: "ready",
    scrapedAtUtc: "2026-07-29T10:00:00.000Z",
  });

  assert.equal(snapshot.source, "zerozero");
  assert.equal(snapshot.competitionId, "238");
  assert.equal(snapshot.editionId, "218294");
  assert.equal(snapshot.phaseId, "240072");
  assert.equal(snapshot.tables.length, 1);
  assert.equal(snapshot.tables[0]?.name, "Campeonato");
  assert.equal(snapshot.tables[0]?.rows[0]?.teamName, "Benfica");
  assert.equal(snapshot.tables[0]?.rows[0]?.points, 82);
  assert.equal(snapshot.tables[0]?.rows[0]?.goalDifference, "+57");
  assert.equal(snapshot.tables[0]?.rows[1]?.teamUrl, "https://www.zerozero.pt/equipa/fc-porto");
});
