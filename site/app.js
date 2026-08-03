const summaryEl = document.querySelector("[data-fixture-summary]");
const datesEl = document.querySelector("[data-date-filters]");
const groupsEl = document.querySelector("[data-fixture-groups]");
const stateEl = document.querySelector("[data-fixture-state]");
const detailEl = document.querySelector("[data-fixture-detail]");
const displayTimeZone = "Europe/Lisbon";
const STANDINGS_ZONE_PRESETS = {
  "8": [
    { from: 1, to: 4, tone: "ucl", label: "Liga dos Campeões" },
    { from: 5, to: 5, tone: "uel", label: "Liga Europa" },
    { from: 6, to: 6, tone: "uecl", label: "Liga Conferência" },
    { from: 18, to: 20, tone: "relegation", label: "Despromoção" },
  ],
  "17": [
    { from: 1, to: 4, tone: "ucl", label: "Liga dos Campeões" },
    { from: 5, to: 5, tone: "uel", label: "Liga Europa" },
    { from: 6, to: 6, tone: "uecl", label: "Liga Conferência" },
    { from: 18, to: 20, tone: "relegation", label: "Despromoção" },
  ],
  "23": [
    { from: 1, to: 4, tone: "ucl", label: "Liga dos Campeões" },
    { from: 5, to: 5, tone: "uel", label: "Liga Europa" },
    { from: 6, to: 6, tone: "uecl", label: "Liga Conferência" },
    { from: 18, to: 20, tone: "relegation", label: "Despromoção" },
  ],
  "35": [
    { from: 1, to: 4, tone: "ucl", label: "Liga dos Campeões" },
    { from: 5, to: 5, tone: "uel", label: "Liga Europa" },
    { from: 6, to: 6, tone: "uecl", label: "Liga Conferência" },
    { from: 16, to: 16, tone: "playoff", label: "Play-off manutenção" },
    { from: 17, to: 18, tone: "relegation", label: "Despromoção" },
  ],
  "39": [
    { from: 1, to: 6, tone: "championship", label: "Play-off Campeão" },
    { from: 7, to: 12, tone: "relegation", label: "Play-off Despromoção" },
  ],
  "238": [
    { from: 1, to: 2, tone: "ucl", label: "Liga dos Campeões" },
    { from: 3, to: 3, tone: "uel", label: "Liga Europa" },
    { from: 4, to: 4, tone: "uecl", label: "Liga Conferência" },
    { from: 16, to: 16, tone: "playoff", label: "Play-off manutenção" },
    { from: 17, to: 18, tone: "relegation", label: "Despromoção" },
  ],
};

const formatter = new Intl.DateTimeFormat("pt-PT", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: displayTimeZone,
});

const timeOnlyFormatter = new Intl.DateTimeFormat("pt-PT", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: displayTimeZone,
});

const state = {
  snapshot: null,
  selectedDate: null,
  selectedFixtureId: null,
  selectedDetailTab: "details",
  matchViewCache: new Map(),
  standingsCache: new Map(),
};

bootstrap().catch((error) => {
  renderError(error instanceof Error ? error.message : String(error));
});

async function bootstrap() {
  const response = await fetch("./fixtures/latest.json", { cache: "no-store" });

  if (!response.ok) {
    throw new Error(`Snapshot de jogos indisponível (${response.status}).`);
  }

  state.snapshot = await response.json();
  state.selectedDate =
    state.snapshot.referenceDate && state.snapshot.datesIncluded.includes(state.snapshot.referenceDate)
      ? state.snapshot.referenceDate
      : state.snapshot.datesIncluded[0] ?? null;
  state.selectedFixtureId =
    state.snapshot.fixtures.find((fixture) => fixture.matchDate === state.selectedDate)
      ?.sourceEventId ?? null;

  renderSummary();
  renderDateFilters();
  renderFixtures();
  renderFixtureDetail();
}

function renderSummary() {
  if (!state.snapshot || !summaryEl) {
    return;
  }

  const windowLabel =
    state.snapshot.datesIncluded.length > 1
      ? `${state.snapshot.datesIncluded[0]} → ${state.snapshot.datesIncluded.at(-1)}`
      : state.snapshot.datesIncluded[0] ?? "Sem datas";

  summaryEl.innerHTML = [
    metricCard("Jogos visíveis", String(state.snapshot.visibleFixtureCount)),
    metricCard("Janela ativa", windowLabel),
    metricCard("Snapshot", formatTimestamp(state.snapshot.scrapedAtUtc)),
  ].join("");
}

function renderDateFilters() {
  if (!state.snapshot || !datesEl) {
    return;
  }

  const dates = state.snapshot.datesIncluded;
  const selectedIndex = Math.max(dates.indexOf(state.selectedDate), 0);
  const previousDisabled = selectedIndex <= 0;
  const nextDisabled = selectedIndex >= dates.length - 1;

  datesEl.innerHTML = `
    <div class="date-selector" role="group" aria-label="Selecionar dia">
      <button
        class="date-selector__step"
        type="button"
        data-date-nav="prev"
        aria-label="Dia anterior"
        ${previousDisabled ? "disabled" : ""}
      >
        <span aria-hidden="true">‹</span>
      </button>
      <label class="date-selector__field">
        <span class="date-selector__label">Dia</span>
        <select class="date-selector__select" data-date-select>
          ${dates
            .map(
              (date) => `
                <option value="${escapeAttribute(date)}" ${date === state.selectedDate ? "selected" : ""}>
                  ${escapeHtml(formatDateOptionLabel(date))}
                </option>
              `,
            )
            .join("")}
        </select>
      </label>
      <button
        class="date-selector__step"
        type="button"
        data-date-nav="next"
        aria-label="Dia seguinte"
        ${nextDisabled ? "disabled" : ""}
      >
        <span aria-hidden="true">›</span>
      </button>
    </div>
  `;

  const select = datesEl.querySelector("[data-date-select]");
  select?.addEventListener("change", (event) => {
    const target = event.currentTarget;
    if (!(target instanceof HTMLSelectElement)) {
      return;
    }

    selectDate(target.value);
  });

  const previousButton = datesEl.querySelector('[data-date-nav="prev"]');
  previousButton?.addEventListener("click", () => {
    if (previousDisabled) {
      return;
    }

    selectDate(dates[selectedIndex - 1] ?? state.selectedDate);
  });

  const nextButton = datesEl.querySelector('[data-date-nav="next"]');
  nextButton?.addEventListener("click", () => {
    if (nextDisabled) {
      return;
    }

    selectDate(dates[selectedIndex + 1] ?? state.selectedDate);
  });
}

function renderFixtures() {
  if (!groupsEl || !stateEl) {
    return;
  }

  if (!state.snapshot || !state.selectedDate) {
    stateEl.textContent = "Ainda não existe snapshot de jogos disponível.";
    groupsEl.innerHTML = "";
    return;
  }

  const fixtures = state.snapshot.fixtures.filter((fixture) => fixture.matchDate === state.selectedDate);

  if (fixtures.length === 0) {
    stateEl.textContent = buildFixtureStateCopy(0, state.selectedDate);
    groupsEl.innerHTML = "";
    return;
  }

  if (!fixtures.some((fixture) => fixture.sourceEventId === state.selectedFixtureId)) {
    state.selectedFixtureId = fixtures[0]?.sourceEventId ?? null;
  }

  stateEl.textContent = buildFixtureStateCopy(fixtures.length, state.selectedDate);

  const byCompetition = new Map();
  for (const fixture of fixtures) {
    const key = `${fixture.countryName ?? "Desconhecido"}__${fixture.competitionName ?? "Competição desconhecida"}`;
    const group = byCompetition.get(key) ?? {
      countryName: fixture.countryName ?? "Desconhecido",
      competitionName: fixture.competitionName ?? "Competição desconhecida",
      fixtures: [],
    };
    group.fixtures.push(fixture);
    byCompetition.set(key, group);
  }

  groupsEl.innerHTML = Array.from(byCompetition.values())
    .map((group) => renderCompetitionGroup(group))
    .join("");

  bindFixtureInteractions();
  preloadVisibleMatchViews(fixtures);
}

function renderCompetitionGroup(group) {
  const fixtureCards = group.fixtures
    .sort(compareFixtures)
    .map((fixture) => renderFixtureCard(fixture))
    .join("");

  return `
    <details class="competition-group" open>
      <summary class="competition-group__summary">
        <span class="competition-group__summary-copy">
          <span class="competition-group__country">${escapeHtml(group.countryName)}</span>
          <span class="competition-group__separator" aria-hidden="true">·</span>
          <span class="competition-group__title">${escapeHtml(group.competitionName)}</span>
        </span>
        <span class="competition-group__arrow" aria-hidden="true"></span>
      </summary>
      <div class="competition-group__fixtures">
        ${fixtureCards}
      </div>
    </details>
  `;
}

function renderFixtureCard(fixture) {
  const matchViewState = state.matchViewCache.get(fixture.sourceEventId) ?? null;
  const cardClasses = [
    "fixture-card",
    fixture.sourceEventId === state.selectedFixtureId ? "fixture-card--selected" : "",
    `fixture-card--status-${fixture.status}`,
  ]
    .filter(Boolean)
    .join(" ");

  return `
    <article class="${cardClasses}" data-fixture-id="${fixture.sourceEventId}">
      <div class="fixture-card__meta">
        <span class="fixture-card__time">${escapeHtml(formatFixtureMeta(fixture))}</span>
        ${renderFixtureStatusTag(fixture)}
      </div>
      <div class="fixture-card__teams">
        ${renderTeamLine({
          name: fixture.homeTeamName,
          logoUrl: fixture.homeTeamLogoUrl,
          teamId: fixture.homeTeamId,
          score: fixture.homeScore,
          status: fixture.status,
        })}
        ${renderTeamLine({
          name: fixture.awayTeamName,
          logoUrl: fixture.awayTeamLogoUrl,
          teamId: fixture.awayTeamId,
          score: fixture.awayScore,
          status: fixture.status,
        })}
        ${renderFixtureOddsStrip(fixture, matchViewState)}
      </div>
    </article>
  `;
}

function bindFixtureInteractions() {
  for (const card of document.querySelectorAll("[data-fixture-id]")) {
    card.addEventListener("click", () => {
      const fixtureId = card.getAttribute("data-fixture-id");

      if (!fixtureId || fixtureId === state.selectedFixtureId) {
        return;
      }

      state.selectedFixtureId = fixtureId;
      state.selectedDetailTab = "details";
      renderFixtures();
      renderFixtureDetail();
    });
  }
}

function renderFixtureDetail() {
  if (!detailEl) {
    return;
  }

  const fixture = state.snapshot?.fixtures.find(
    (candidate) => candidate.sourceEventId === state.selectedFixtureId,
  );
  const matchViewState = fixture ? state.matchViewCache.get(fixture.sourceEventId) ?? null : null;

  if (!fixture) {
    detailEl.innerHTML = `
      <p class="fixture-detail__eyebrow">Painel do jogo</p>
      <h2>Detalhes do jogo</h2>
      <p class="fixture-detail__empty">
        Seleciona um jogo na coluna da esquerda. Esta área fica reservada para informação mais detalhada em futuras iterações.
      </p>
    `;
    return;
  }

  const centerTime = fixture.kickoffAtUtc ? formatKickoffTime(fixture.kickoffAtUtc) : "Sem hora";
  const competitionLogo = buildCompetitionLogoUrl(
    fixture.competitionLogoUrl,
    fixture.competitionId,
  );

  detailEl.innerHTML = `
    <p class="fixture-detail__eyebrow">Painel do jogo</p>
    <div class="fixture-detail__hero">
      <div class="fixture-detail__competition">
        ${
          competitionLogo
            ? `<img class="fixture-detail__competition-logo" src="${escapeAttribute(
                competitionLogo,
              )}" alt="${escapeAttribute(
                fixture.competitionName ?? "Competição",
              )}" loading="lazy" decoding="async" referrerpolicy="no-referrer">`
            : `<span class="fixture-detail__competition-mark" aria-hidden="true"></span>`
        }
        <div class="fixture-detail__competition-copy">
          <span class="fixture-detail__competition-country">${escapeHtml(
            fixture.countryName ?? "País desconhecido",
          )}</span>
          <strong class="fixture-detail__competition-name">${escapeHtml(
            fixture.competitionName ?? "Competição desconhecida",
          )}</strong>
        </div>
      </div>
      <div class="fixture-detail__matchboard">
        ${renderDetailMatchSide(fixture.homeTeamName, fixture.homeTeamLogoUrl, fixture.homeTeamId)}
        <div class="fixture-detail__matchboard-center">
          <strong class="fixture-detail__matchboard-time">${escapeHtml(centerTime)}</strong>
          <span class="fixture-detail__matchboard-day">${escapeHtml(formatFixtureHeroDayLabel(fixture))}</span>
          <span class="fixture-detail__matchboard-meta">${escapeHtml(formatFixtureHeroMeta(fixture))}</span>
        </div>
        ${renderDetailMatchSide(fixture.awayTeamName, fixture.awayTeamLogoUrl, fixture.awayTeamId)}
      </div>
      <div class="fixture-detail__badges">
        <span class="fixture-detail__badge fixture-detail__badge--accent">${escapeHtml(
          formatStatusLabel(fixture),
        )}</span>
        <span class="fixture-detail__badge">${escapeHtml(formatScoreline(fixture))}</span>
      </div>
    </div>
    ${renderFixtureDetailTabs()}
    <section class="fixture-detail__section fixture-detail__section--tabbed">
      ${
        state.selectedDetailTab === "standings"
          ? renderFixtureStandingsTab(fixture, matchViewState)
          : renderFixtureDetailsTab(fixture, matchViewState)
      }
    </section>
  `;

  bindFixtureDetailTabs();
  if (shouldLoadMatchView(fixture.sourceEventId)) {
    void loadMatchView(fixture);
  }
  if (fixture.competitionId && shouldLoadCompetitionStandings(fixture.competitionId)) {
    void loadCompetitionStandings(fixture.competitionId);
  }
}

function renderFixtureDetailTabs() {
  return `
    <nav class="fixture-detail__tabs" aria-label="Separadores do jogo">
      <button
        type="button"
        class="fixture-detail__tab ${state.selectedDetailTab === "details" ? "fixture-detail__tab--active" : ""}"
        data-detail-tab="details"
      >
        Detalhes
      </button>
      <button
        type="button"
        class="fixture-detail__tab ${state.selectedDetailTab === "standings" ? "fixture-detail__tab--active" : ""}"
        data-detail-tab="standings"
      >
        Classificação
      </button>
    </nav>
  `;
}

function bindFixtureDetailTabs() {
  for (const button of detailEl?.querySelectorAll("[data-detail-tab]") ?? []) {
    button.addEventListener("click", () => {
      const tab = button.getAttribute("data-detail-tab");
      if (!tab || tab === state.selectedDetailTab) {
        return;
      }

      state.selectedDetailTab = tab;
      renderFixtureDetail();
    });
  }
}

function renderFixtureDetailsTab(fixture, matchViewState) {
  if (matchViewState?.status === "loaded" && matchViewState.data) {
    const view = matchViewState.data;
    const venueRows = [
      detailInfoRowIf("Estádio", view.match.details.venueName),
      detailInfoRowIf("Cidade", formatMatchViewVenueCity(view)),
      detailInfoRowIf("Capacidade", formatMatchViewVenueCapacity(view.match.details.venueCapacity)),
    ].join("");
    const coverageRows = [
      detailInfoRowIf("Árbitro", formatMatchViewReferee(view)),
      detailInfoRow("TV em Portugal", formatMatchViewWatch(view.match.details.watch)),
      detailInfoRowIf("Formato", formatMatchViewTieFormat(view.match.details.tieContext)),
      detailInfoRow("Atualização", formatTimestamp(view.builtAtUtc)),
    ].join("");

    return `
      <div class="fixture-detail__stack">
        <section class="fixture-detail__subsection">
          <h4>Detalhes</h4>
          <div class="fixture-detail__summary-grid">
            ${renderDetailSummaryCard(
              "Jogo",
              [
                detailInfoRow("Data e hora", formatMatchViewDateTime(view)),
                detailInfoRow("Competição", formatMatchViewCompetitionName(view)),
                detailInfoRowIf("Fase", view.match.details.competitionStage),
                detailInfoRowIf("País", view.match.competition.country),
              ].join(""),
            )}
            ${renderDetailSummaryCard("Recinto", venueRows || renderSummaryEmpty("Sofascore ainda não expôs estádio, cidade ou capacidade para este jogo."))}
            ${renderDetailSummaryCard("Cobertura", coverageRows || renderSummaryEmpty("Ainda não existe arbitragem ou agenda de TV confirmada para este jogo."))}
          </div>
          ${renderDetailsCoverageHint(view)}
        </section>
        ${renderTieContextSection(view)}
        ${renderRecentContextSection(view)}
      </div>
    `;
  }

  if (matchViewState?.status === "loading") {
    return `
      ${renderBasicFixtureDetails(
        fixture,
        "A carregar vista detalhada do jogo. O painel será enriquecido assim que a match view terminar de carregar.",
      )}
    `;
  }

  return `
    ${renderBasicFixtureDetails(
      fixture,
      "Ainda não existe match view publicada para este jogo. Estádio, TV em Portugal e outros campos avançados ficam disponíveis depois do próximo refresh/publicação manual.",
    )}
  `;
}

function renderBasicFixtureDetails(fixture, note = null) {
  return `
    <section class="fixture-detail__subsection">
      <h4>Resumo</h4>
      <div class="fixture-detail__summary-grid">
        ${renderDetailSummaryCard(
          "Jogo",
          [
            detailInfoRow("Data e hora", `${formatFixtureDetailDate(fixture)} · ${formatFixtureDetailTime(fixture)}`),
            detailInfoRow("Competição", [fixture.competitionName, fixture.countryName].filter(Boolean).join(" · ") || "Indisponível"),
            detailInfoRow("Estado", formatStatusLabel(fixture)),
            detailInfoRow("Resultado", formatScoreline(fixture)),
          ].join(""),
        )}
        ${renderDetailSummaryCard(
          "Estado da vista",
          [
            note ? renderSummaryEmpty(note) : renderSummaryEmpty("A vista detalhada deste jogo ainda não foi publicada."),
            renderSummaryHint(
              `<a class="fixture-detail__inline-link" href="${escapeAttribute(fixture.matchUrl)}" target="_blank" rel="noreferrer">Abrir jogo no Sofascore</a>`,
            ),
          ].join(""),
        )}
      </div>
    </section>
  `;
}

function renderFixtureStandingsTab(fixture, matchViewState) {
  const standingsState = fixture.competitionId
    ? state.standingsCache.get(fixture.competitionId) ?? null
    : null;

  if (standingsState?.status === "loaded" && Array.isArray(standingsState.data?.tables) && standingsState.data.tables.length > 0) {
    return renderCompetitionStandingsSnapshot(standingsState.data, fixture);
  }

  if (
    matchViewState?.status === "loaded" &&
    matchViewState.data?.standings?.available &&
    Array.isArray(matchViewState.data.standings.rows) &&
    matchViewState.data.standings.rows.length > 0
  ) {
    return `
      <div class="fixture-detail__standings">
        ${renderMatchViewStandingsTable(matchViewState.data.standings, fixture)}
      </div>
      <p class="fixture-detail__note">Classificação servida a partir da match view derivada.</p>
    `;
  }

  if (!fixture.competitionId) {
    return '<p class="fixture-detail__empty">Este jogo não tem competição mapeada para classificação.</p>';
  }

  const message =
    standingsState?.status === "loading"
      ? "A carregar classificação..."
      : "Classificação indisponível para este jogo ou competição.";

  return `
    <p class="fixture-detail__empty">${escapeHtml(message)}</p>
    ${renderStandingsStateNote(standingsState)}
  `;
}

function renderCompetitionStandingsSnapshot(snapshot, fixture) {
  const meta = [
    snapshot.mode !== "single_table" ? formatStandingsMode(snapshot.mode) : null,
    snapshot.status !== "ready" ? formatStandingsStatus(snapshot.status) : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return `
    <div class="fixture-detail__standings">
      ${meta ? `<p class="fixture-detail__note">${escapeHtml(meta)}</p>` : ""}
      ${snapshot.tables.map((table) => renderStandingsTableCard(table, fixture, snapshot.competitionId)).join("")}
      ${renderStandingsLegend(snapshot.competitionId, snapshot.tables)}
      ${snapshot.zerozeroUrl ? `<a class="fixture-detail__link" href="${escapeAttribute(snapshot.zerozeroUrl)}" target="_blank" rel="noreferrer">Ver classificação detalhada</a>` : ""}
    </div>
  `;
}

function renderMatchViewStandingsTable(standings, fixture) {
  const title = [standings.tableName, formatStandingType(standings.tableType)]
    .filter(Boolean)
    .join(" · ");

  return `
    <section class="fixture-detail__standings-table">
      ${title ? `<h3 class="fixture-detail__standings-title">${escapeHtml(title)}</h3>` : ""}
      ${renderStandingsGrid({
        title,
        rows: standings.rows,
        fixture,
        competitionId: standings.competitionId,
      })}
      ${renderStandingsLegend(standings.competitionId, [{ rows: standings.rows }])}
    </section>
  `;
}

function renderStandingsTableCard(table, fixture, competitionId) {
  const title = [table.name, formatStandingType(table.type)].filter(Boolean).join(" · ");

  return `
    <section class="fixture-detail__standings-table">
      ${title ? `<h3 class="fixture-detail__standings-title">${escapeHtml(title)}</h3>` : ""}
      ${renderStandingsGrid({
        title,
        rows: table.rows,
        fixture,
        competitionId,
      })}
    </section>
  `;
}

function renderStandingsGrid({ title, rows, fixture, competitionId }) {
  return `
    <div class="fixture-detail__standings-scroll">
      <div class="fixture-detail__standings-grid" role="table" aria-label="${escapeAttribute(title || "Classificação")}">
        <div class="fixture-detail__standings-head" role="row">
          <span>#</span>
          <span>Equipa</span>
          <span>P</span>
          <span>J</span>
          <span>V</span>
          <span>E</span>
          <span>D</span>
          <span>GM</span>
          <span>GS</span>
          <span>DG</span>
        </div>
        ${rows.map((row) => renderStandingsRow(row, fixture, competitionId)).join("")}
      </div>
    </div>
  `;
}

function renderStandingsRow(row, fixture, competitionId) {
  const highlight = row.highlight ?? resolveStandingRowHighlight(row, fixture);
  const zone = resolveStandingsZone(competitionId, row.position);
  const teamMarker = highlight === "home" ? "Casa" : highlight === "away" ? "Fora" : null;
  const classes = [
    "fixture-detail__standings-row",
    highlight ? `fixture-detail__standings-row--${highlight}` : "",
    zone ? `fixture-detail__standings-row--zone-${zone.tone}` : "",
  ]
    .filter(Boolean)
    .join(" ");

  return `
    <div class="${classes}" role="row">
      <span>${escapeHtml(stringValue(row.position, "—"))}</span>
      <span class="fixture-detail__standings-team">
        ${escapeHtml(row.teamName)}
        ${teamMarker ? `<span class="fixture-detail__standings-team-tag fixture-detail__standings-team-tag--${highlight}">${escapeHtml(teamMarker)}</span>` : ""}
      </span>
      <span>${escapeHtml(stringValue(row.points, "—"))}</span>
      <span>${escapeHtml(stringValue(row.matches, "—"))}</span>
      <span>${escapeHtml(stringValue(row.wins, "—"))}</span>
      <span>${escapeHtml(stringValue(row.draws, "—"))}</span>
      <span>${escapeHtml(stringValue(row.losses, "—"))}</span>
      <span>${escapeHtml(stringValue(row.goalsFor, "—"))}</span>
      <span>${escapeHtml(stringValue(row.goalsAgainst, "—"))}</span>
      <span>${escapeHtml(row.goalDifference ?? "—")}</span>
    </div>
  `;
}

function renderStandingsLegend(competitionId, tables) {
  const zones = collectLegendZones(competitionId, tables);
  if (zones.length === 0) {
    return "";
  }

  return `
    <div class="fixture-detail__standings-legend">
      ${zones
        .map(
          (zone) => `
            <div class="fixture-detail__standings-legend-item">
              <span class="fixture-detail__standings-legend-swatch fixture-detail__standings-legend-swatch--${escapeAttribute(zone.tone)}" aria-hidden="true"></span>
              <span>${escapeHtml(zone.label)}</span>
            </div>
          `,
        )
        .join("")}
    </div>
  `;
}

function detailInfoRow(label, value) {
  return `
    <article class="fixture-detail__info-item">
      <span class="fixture-detail__info-label">${escapeHtml(label)}</span>
      <strong class="fixture-detail__info-value">${escapeHtml(value)}</strong>
    </article>
  `;
}

function detailInfoRowIf(label, value) {
  if (value === null || value === undefined || value === "") {
    return "";
  }

  return detailInfoRow(label, String(value));
}

function renderDetailSummaryCard(title, content) {
  return `
    <article class="fixture-detail__summary-card">
      <h3 class="fixture-detail__summary-card-title">${escapeHtml(title)}</h3>
      <div class="fixture-detail__info-list">
        ${content}
      </div>
    </article>
  `;
}

function renderSummaryEmpty(message) {
  return `<p class="fixture-detail__summary-empty">${escapeHtml(message)}</p>`;
}

function renderSummaryHint(content) {
  return `<p class="fixture-detail__summary-hint">${content}</p>`;
}

function renderTieContextSection(view) {
  const tieContext = view.match.details.tieContext ?? null;
  const legRows = [
    detailInfoRowIf("Formato", formatMatchViewTieFormat(tieContext)),
    tieContext?.previousLeg ? renderRelatedMatchMiniRow("Mão anterior", tieContext.previousLeg) : "",
    tieContext?.nextLeg ? renderRelatedMatchMiniRow("Próxima mão", tieContext.nextLeg) : "",
  ].join("");
  const h2hRows = (tieContext?.h2h ?? [])
    .slice(0, 3)
    .map((match) => renderRelatedMatchMiniRow(null, match))
    .join("");

  if (!legRows && !h2hRows) {
    return "";
  }

  return `
    <section class="fixture-detail__subsection">
      <h4>Contexto competitivo</h4>
      <div class="fixture-detail__summary-grid">
        ${renderDetailSummaryCard(
          "Eliminatória",
          legRows || renderSummaryEmpty("Este jogo não tem contexto de duas mãos publicado."),
        )}
        ${renderDetailSummaryCard(
          "H2H curto",
          h2hRows || renderSummaryEmpty("Ainda não existe histórico direto resumido para este jogo."),
        )}
      </div>
    </section>
  `;
}

function renderRecentContextSection(view) {
  const homeRows = renderTeamMomentumCard({
    title: `Casa · ${view.homeTeam.identity.name}`,
    form: view.homeTeam.headerStats.formLast3,
    lastMatches: view.match.details.recent?.homeLast ?? [],
    nextMatches: view.match.details.recent?.homeNext ?? [],
    fallbackHistory: view.homeTeam.history,
    teamName: view.homeTeam.identity.name,
  });
  const awayRows = renderTeamMomentumCard({
    title: `Fora · ${view.awayTeam.identity.name}`,
    form: view.awayTeam.headerStats.formLast3,
    lastMatches: view.match.details.recent?.awayLast ?? [],
    nextMatches: view.match.details.recent?.awayNext ?? [],
    fallbackHistory: view.awayTeam.history,
    teamName: view.awayTeam.identity.name,
  });

  if (!homeRows && !awayRows) {
    return "";
  }

  return `
    <section class="fixture-detail__subsection">
      <h4>Momento das equipas</h4>
      <div class="fixture-detail__summary-grid">
        ${homeRows}
        ${awayRows}
      </div>
    </section>
  `;
}

function renderTeamMomentumCard({ title, form, lastMatches, nextMatches, fallbackHistory, teamName }) {
  const lastRows = lastMatches.length > 0
    ? renderMiniGroup(
        "Últimos jogos",
        lastMatches.slice(0, 3).map((match) => renderRelatedMatchMiniRow(null, match)).join(""),
      )
    : fallbackHistory.length > 0
      ? renderMiniGroup(
          "Últimos jogos",
          fallbackHistory.slice(0, 3).map((match) => renderTeamHistoryMiniRow(match, teamName)).join(""),
        )
      : "";
  const nextRows = nextMatches.length > 0
    ? renderMiniGroup(
        "Próximos jogos",
        nextMatches.slice(0, 2).map((match) => renderRelatedMatchMiniRow(null, match)).join(""),
      )
    : "";
  const body = [
    renderTeamFormPills(form),
    lastRows,
    nextRows,
  ]
    .filter(Boolean)
    .join("");

  return renderDetailSummaryCard(
    title,
    body || renderSummaryEmpty("Sem contexto recente publicado para esta equipa."),
  );
}

function renderMiniGroup(title, content) {
  return `
    <div class="fixture-detail__mini-group">
      <p class="fixture-detail__mini-title">${escapeHtml(title)}</p>
      <div class="fixture-detail__mini-list">
        ${content}
      </div>
    </div>
  `;
}

function renderRelatedMatchMiniRow(label, match) {
  const title = [label, `${match.homeTeamName} vs ${match.awayTeamName}`].filter(Boolean).join(" · ");
  const meta = [
    formatRelatedMatchDate(match.kickoffAtUtc),
    match.competitionName,
    match.roundName,
  ]
    .filter(Boolean)
    .join(" · ");
  const outcome = formatRelatedMatchOutcome(match);
  const strongContent = match.matchUrl
    ? `<a class="fixture-detail__inline-link" href="${escapeAttribute(match.matchUrl)}" target="_blank" rel="noreferrer">${escapeHtml(title)}</a>`
    : escapeHtml(title);

  return `
    <article class="fixture-detail__mini-row">
      <strong>${strongContent}</strong>
      ${meta ? `<span class="fixture-detail__mini-meta">${escapeHtml(meta)}</span>` : ""}
      ${outcome ? `<span class="fixture-detail__mini-copy">${escapeHtml(outcome)}</span>` : ""}
    </article>
  `;
}

function renderTeamHistoryMiniRow(match, teamName) {
  const opponent = resolveTeamHistoryOpponent(match, teamName);
  const title = opponent ?? `${match.homeTeam} vs ${match.awayTeam}`;
  const meta = [formatHistoryMatchDate(match.date), match.result].filter(Boolean).join(" · ");
  const rating = formatHistoryRating(match, teamName);

  return `
    <article class="fixture-detail__mini-row">
      <strong>${escapeHtml(title)}</strong>
      ${meta ? `<span class="fixture-detail__mini-meta">${escapeHtml(meta)}</span>` : ""}
      ${rating ? `<span class="fixture-detail__mini-copy">${escapeHtml(rating)}</span>` : ""}
    </article>
  `;
}

function renderDetailMatchSide(name, logoUrl, teamId) {
  const safeName = escapeHtml(name);
  const displayLogoUrl = buildTeamDisplayLogoUrl(logoUrl, teamId);
  const crest = displayLogoUrl
    ? `<img class="fixture-detail__team-crest" src="${escapeAttribute(displayLogoUrl)}" alt="${safeName}" loading="lazy" decoding="async" referrerpolicy="no-referrer">`
    : `<span class="fixture-detail__team-crest fixture-detail__team-crest--fallback" aria-hidden="true">${escapeHtml(
        buildTeamInitials(name, teamId),
      )}</span>`;

  return `
    <article class="fixture-detail__matchboard-side">
      ${crest}
      <strong class="fixture-detail__matchboard-team-name">${safeName}</strong>
    </article>
  `;
}

function formatFixtureHeroDayLabel(fixture) {
  if (fixture.matchDate === state.snapshot?.referenceDate) {
    return "Hoje";
  }

  if (!fixture.kickoffAtUtc) {
    return fixture.matchDate;
  }

  const date = new Date(fixture.kickoffAtUtc);
  return Number.isNaN(date.getTime())
    ? fixture.matchDate
    : new Intl.DateTimeFormat("pt-PT", {
        day: "2-digit",
        month: "short",
        timeZone: displayTimeZone,
      }).format(date);
}

function formatFixtureHeroMeta(fixture) {
  if (fixture.homeScore !== null && fixture.awayScore !== null) {
    return `${fixture.homeScore} - ${fixture.awayScore}`;
  }

  return "Hora de Lisboa";
}

function buildCompetitionLogoUrl(existingUrl, competitionId) {
  if (existingUrl) {
    return existingUrl;
  }

  if (!competitionId) {
    return null;
  }

  return `https://img.sofascore.com/api/v1/unique-tournament/${competitionId}/image/dark`;
}

function buildTeamDisplayLogoUrl(existingUrl, teamId) {
  if (teamId) {
    return `https://img.sofascore.com/api/v1/team/${teamId}/image`;
  }

  return existingUrl ? existingUrl.replace(/\/small$/, "") : null;
}

function preloadVisibleMatchViews(fixtures) {
  for (const fixture of fixtures) {
    if (fixture.status !== "upcoming") {
      continue;
    }

    if (shouldLoadMatchView(fixture.sourceEventId)) {
      void loadMatchView(fixture);
    }
  }
}

async function loadMatchView(fixture) {
  const cached = state.matchViewCache.get(fixture.sourceEventId) ?? null;
  if (cached?.status === "loading" || cached?.status === "loaded" || cached?.status === "missing") {
    return;
  }

  state.matchViewCache.set(fixture.sourceEventId, { status: "loading" });
  if (state.selectedFixtureId === fixture.sourceEventId) {
    renderFixtureDetail();
  }

  try {
    const response = await fetch(`./match-view/${fixture.matchDate}/${fixture.sourceEventId}.json`, {
      cache: "no-store",
    });

    if (response.status === 404) {
      state.matchViewCache.set(fixture.sourceEventId, { status: "missing", data: null });
    } else if (!response.ok) {
      throw new Error(`Match view indisponível (${response.status})`);
    } else {
      state.matchViewCache.set(fixture.sourceEventId, {
        status: "loaded",
        data: await response.json(),
      });
    }
  } catch (error) {
    state.matchViewCache.set(fixture.sourceEventId, {
      status: "error",
      data: null,
      error,
    });
  }

  if (fixture.matchDate === state.selectedDate) {
    renderFixtures();
  }

  if (state.selectedFixtureId === fixture.sourceEventId) {
    renderFixtureDetail();
  }
}

function shouldLoadMatchView(fixtureId) {
  const cached = state.matchViewCache.get(fixtureId) ?? null;
  return cached === null || cached.status === "error";
}

async function loadCompetitionStandings(competitionId) {
  const cached = state.standingsCache.get(competitionId) ?? null;
  if (cached?.status === "loading" || cached?.status === "loaded" || cached?.status === "missing") {
    return;
  }

  state.standingsCache.set(competitionId, { status: "loading" });
  const selectedFixture = state.snapshot?.fixtures.find(
    (fixture) => fixture.sourceEventId === state.selectedFixtureId,
  );
  if (selectedFixture?.competitionId === competitionId) {
    renderFixtureDetail();
  }

  try {
    const response = await fetch(`./fixtures/standings/${competitionId}.json`, {
      cache: "no-store",
    });

    if (response.status === 404) {
      state.standingsCache.set(competitionId, { status: "missing", data: null });
    } else if (!response.ok) {
      throw new Error(`Classificação indisponível (${response.status})`);
    } else {
      state.standingsCache.set(competitionId, {
        status: "loaded",
        data: await response.json(),
      });
    }
  } catch (error) {
    state.standingsCache.set(competitionId, {
      status: "error",
      data: null,
      error,
    });
  }

  const currentSelectedFixture = state.snapshot?.fixtures.find(
    (fixture) => fixture.sourceEventId === state.selectedFixtureId,
  );
  if (currentSelectedFixture?.competitionId === competitionId) {
    renderFixtureDetail();
  }
}

function shouldLoadCompetitionStandings(competitionId) {
  const cached = state.standingsCache.get(competitionId) ?? null;

  return cached === null || cached.status === "error";
}

function renderError(message) {
  if (stateEl) {
    stateEl.textContent = message;
  }

  if (groupsEl) {
    groupsEl.innerHTML = "";
  }

  if (detailEl) {
    detailEl.innerHTML = "";
  }
}

function metricCard(label, value) {
  return `
    <article class="metric-card">
      <p>${escapeHtml(label)}</p>
      <strong>${escapeHtml(value)}</strong>
    </article>
  `;
}

function selectDate(date) {
  state.selectedDate = date;
  state.selectedFixtureId =
    state.snapshot.fixtures.find((fixture) => fixture.matchDate === date)?.sourceEventId ?? null;
  state.selectedDetailTab = "details";
  renderDateFilters();
  renderFixtures();
  renderFixtureDetail();
}

function buildFixtureStateCopy(count, date) {
  return `${count} jogos visíveis para ${date} - Hora de Lisboa`;
}

function formatDateOptionLabel(date) {
  if (date === state.snapshot?.referenceDate) {
    return `${date} · Hoje`;
  }

  return date;
}

function renderTeamLine({ name, logoUrl, teamId, score, status }) {
  const safeName = escapeHtml(name);
  const crest = logoUrl
    ? `<img class="team-line__crest" src="${escapeAttribute(logoUrl)}" alt="${safeName}" loading="lazy" decoding="async" referrerpolicy="no-referrer">`
    : `<span class="team-line__crest team-line__crest--fallback" aria-hidden="true">${escapeHtml(
        buildTeamInitials(name, teamId),
      )}</span>`;

  const scoreCopy =
    shouldRenderScore(status, score) ?
      `<span class="team-line__score">${escapeHtml(String(score))}</span>` :
      "";

  return `
    <span class="team-line">
      ${crest}
      <span class="team-line__name">${safeName}</span>
      ${scoreCopy}
    </span>
  `;
}

function shouldRenderScore(status, score) {
  return (status === "finished" || status === "live") && score !== null;
}

function formatTimestamp(value) {
  if (!value) {
    return "Indisponível";
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : formatter.format(date);
}

function formatFixtureMeta(fixture) {
  if (fixture.kickoffAtUtc) {
    return formatKickoffTime(fixture.kickoffAtUtc);
  }

  if (fixture.resultLabel) {
    return fixture.resultLabel;
  }

  return "Sem hora";
}

function formatFixtureDetailTime(fixture) {
  return fixture.kickoffAtUtc ? formatKickoff(fixture.kickoffAtUtc) : "Hora não disponível";
}

function formatFixtureDetailDate(fixture) {
  if (!fixture.kickoffAtUtc) {
    return fixture.matchDate;
  }

  return formatLongDate(fixture.kickoffAtUtc);
}

function formatKickoff(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("pt-PT", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: displayTimeZone,
      }).format(date);
}

function formatKickoffTime(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : timeOnlyFormatter.format(date);
}

function formatLongDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("pt-PT", {
        day: "2-digit",
        month: "long",
        year: "numeric",
        timeZone: displayTimeZone,
      }).format(date);
}

function formatStatusLabel(fixture) {
  switch (fixture.status) {
    case "finished":
      return fixture.resultLabel ?? "Terminado";
    case "upcoming":
      return "Agendado";
    case "postponed":
      return fixture.resultLabel ?? "Adiado";
    case "cancelled":
      return fixture.resultLabel ?? "Cancelado";
    case "live":
      return fixture.resultLabel ?? "Ao vivo";
    default:
      return "Desconhecido";
  }
}

function renderFixtureStatusTag(fixture) {
  if (fixture.status === "upcoming") {
    return "";
  }

  return `
    <span class="fixture-card__status fixture-card__status--${escapeAttribute(fixture.status)}">
      ${escapeHtml(formatCompactStatusLabel(fixture))}
    </span>
  `;
}

function renderFixtureOddsStrip(fixture, matchViewState) {
  if (fixture.status !== "upcoming") {
    return "";
  }

  const odds = matchViewState?.status === "loaded" ? matchViewState.data?.match?.details?.odds ?? null : null;
  if (!odds || (!odds.home && !odds.draw && !odds.away)) {
    return "";
  }

  return `
    <div class="fixture-card__odds" aria-label="Odds 1 X 2">
      ${renderFixtureOddsItem("1", odds.home)}
      ${renderFixtureOddsItem("X", odds.draw)}
      ${renderFixtureOddsItem("2", odds.away)}
    </div>
  `;
}

function renderFixtureOddsItem(label, value) {
  return `
    <span class="fixture-card__odds-item">
      <span class="fixture-card__odds-label">${escapeHtml(label)}</span>
      <strong class="fixture-card__odds-value">${escapeHtml(value ?? "—")}</strong>
    </span>
  `;
}

function formatCompactStatusLabel(fixture) {
  switch (fixture.status) {
    case "finished":
      return fixture.resultLabel ?? "FT";
    case "postponed":
      return "Adiado";
    case "cancelled":
      return "Cancelado";
    case "live":
      return fixture.resultLabel ?? "Live";
    default:
      return formatStatusLabel(fixture);
  }
}

function renderStandingsStateNote(standingsState) {
  if (standingsState?.status === "error") {
    return '<p class="fixture-detail__note">Falhou o carregamento da classificação desta competição.</p>';
  }

  if (standingsState?.status === "missing") {
    return '<p class="fixture-detail__note">Ainda não existe classificação publicada para esta competição.</p>';
  }

  return "";
}

function renderTeamSnapshotPanel(sideLabel, team, side) {
  return `
    <article class="fixture-detail__team-panel fixture-detail__team-panel--${escapeAttribute(side)}">
      <span class="fixture-detail__team-panel-side">${escapeHtml(sideLabel)}</span>
      <h3 class="fixture-detail__team-panel-name">${escapeHtml(team.identity.name)}</h3>
      ${renderTeamFormPills(team.headerStats.formLast3)}
      <div class="fixture-detail__team-panel-grid">
        ${renderTeamSnapshotMetric("Rating", decimalValue(team.headerStats.overallRating))}
        ${renderTeamSnapshotMetric("Rank nacional", stringValue(team.headerStats.nationalRank, "—"))}
        ${renderTeamSnapshotMetric("Rank Europa", stringValue(team.headerStats.europeRank, "—"))}
        ${renderTeamSnapshotMetric("xG", decimalValue(team.headerStats.xgFor))}
        ${renderTeamSnapshotMetric("xGA", decimalValue(team.headerStats.xgAgainst))}
        ${renderTeamSnapshotMetric("Posse", percentValue(team.headerStats.averagePossessionPct))}
        ${renderTeamSnapshotMetric("Clean sheets", stringValue(team.headerStats.cleanSheets, "—"))}
      </div>
      <div class="fixture-detail__team-panel-copy">
        ${renderTeamDetailPill("Prognóstico", formatTeamPrediction(team))}
        ${renderTeamDetailPill("Sistema", fallbackText(team.overview.expectedLineup?.formation))}
        ${renderTeamDetailPill("Baixas", formatTeamAbsences(team))}
        ${renderTeamDetailPill("Último jogo", formatLatestHistory(team.history))}
      </div>
    </article>
  `;
}

function renderTeamSnapshotMetric(label, value) {
  return `
    <div class="fixture-detail__team-metric">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
    </div>
  `;
}

function renderTeamDetailPill(label, value) {
  return `
    <div class="fixture-detail__team-copy-row">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
    </div>
  `;
}

function renderTeamFormPills(values) {
  if (!Array.isArray(values) || values.length === 0) {
    return `<div class="fixture-detail__form-strip"><span class="fixture-detail__form-pill fixture-detail__form-pill--empty">Sem forma recente</span></div>`;
  }

  return `
    <div class="fixture-detail__form-strip">
      ${values.map((value) => `<span class="fixture-detail__form-pill fixture-detail__form-pill--${escapeAttribute(normalizeFormValue(value))}">${escapeHtml(value)}</span>`).join("")}
    </div>
  `;
}

function formatMatchViewDateTime(view) {
  if (!view.match.kickoffAtUtc) {
    return view.match.date;
  }

  return `${formatLongDate(view.match.kickoffAtUtc)} · ${formatKickoffTime(view.match.kickoffAtUtc)}`;
}

function formatMatchViewCompetitionName(view) {
  return view.match.competition.name ?? "Indisponível";
}

function formatMatchViewVenueCity(view) {
  return [view.match.details.venueCity, view.match.details.venueCountry]
    .filter(Boolean)
    .join(", ") || null;
}

function formatMatchViewReferee(view) {
  return [view.match.details.refereeName, view.match.details.refereeCountry]
    .filter(Boolean)
    .join(" · ") || null;
}

function formatMatchViewVenueCapacity(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  return new Intl.NumberFormat("pt-PT").format(value);
}

function formatMatchViewOdds(odds) {
  if (!odds || (!odds.home && !odds.draw && !odds.away)) {
    return "Indisponível";
  }

  return [`1 ${odds.home ?? "—"}`, `X ${odds.draw ?? "—"}`, `2 ${odds.away ?? "—"}`].join(" · ");
}

function formatMatchViewWatch(watch) {
  if (!watch) {
    return "Sem agenda de TV";
  }

  if (watch.hasPortugalChannels) {
    if (Array.isArray(watch.portugalChannels) && watch.portugalChannels.length > 0) {
      return watch.portugalChannels.join(" · ");
    }

    return watch.note ?? "Cobertura confirmada em Portugal";
  }

  if (Array.isArray(watch.availableCountryCodes) && watch.availableCountryCodes.length > 0) {
    return `Sem canais PT · ${formatCountryCodePreview(watch.availableCountryCodes)}`;
  }

  return watch.note ?? "Sem canais PT detetados";
}

function formatMatchViewTieFormat(tieContext) {
  if (!tieContext?.tieFormat) {
    return null;
  }

  if (tieContext.tieFormat === "Two legs") {
    return "Duas mãos";
  }

  return tieContext.tieFormat;
}

function formatCountryCodePreview(countryCodes) {
  if (!Array.isArray(countryCodes) || countryCodes.length === 0) {
    return "";
  }

  const codes = countryCodes.slice(0, 3);
  const suffix = countryCodes.length > 3 ? ` +${countryCodes.length - 3}` : "";
  return `${codes.join(" · ")}${suffix}`;
}

function renderDetailsCoverageHint(view) {
  const missing = [];

  if (!view.match.details.venueName && !view.match.details.venueCity && !view.match.details.venueCapacity) {
    missing.push("recinto");
  }

  if (!view.match.details.refereeName) {
    missing.push("árbitro");
  }

  if (!view.match.details.watch?.hasPortugalChannels) {
    missing.push("TV PT");
  }

  if (missing.length === 0) {
    return "";
  }

  return `
    <p class="fixture-detail__note">
      Campos ainda não expostos para este jogo: ${escapeHtml(missing.join(" · "))}.
    </p>
  `;
}

function resolveStandingsZone(competitionId, position) {
  if (!competitionId || typeof position !== "number") {
    return null;
  }

  const preset = STANDINGS_ZONE_PRESETS[String(competitionId)] ?? [];
  return preset.find((zone) => position >= zone.from && position <= zone.to) ?? null;
}

function collectLegendZones(competitionId, tables) {
  if (!competitionId) {
    return [];
  }

  const preset = STANDINGS_ZONE_PRESETS[String(competitionId)] ?? [];
  const positions = new Set(
    (tables ?? [])
      .flatMap((table) => (Array.isArray(table.rows) ? table.rows : []))
      .map((row) => row.position)
      .filter((value) => typeof value === "number"),
  );

  return preset.filter((zone) => {
    for (let position = zone.from; position <= zone.to; position += 1) {
      if (positions.has(position)) {
        return true;
      }
    }

    return false;
  });
}

function formatStandingsMode(mode) {
  switch (mode) {
    case "regular_plus_playoffs":
      return "Competição com fase regular e playoffs";
    case "league_phase":
      return "Competição com várias fases ou grupos";
    default:
      return null;
  }
}

function formatStandingsStatus(status) {
  switch (status) {
    case "needs_phase_rules":
      return "A fase atual pode exigir leitura por grupos ou playoffs";
    case "needs_validation":
      return "Classificação publicada, mas ainda por validar";
    default:
      return null;
  }
}

function formatRelatedMatchDate(kickoffAtUtc) {
  if (!kickoffAtUtc) {
    return "Sem data";
  }

  return `${formatLongDate(kickoffAtUtc)} · ${formatKickoffTime(kickoffAtUtc)}`;
}

function formatRelatedMatchOutcome(match) {
  if (match.homeScore !== null && match.awayScore !== null) {
    return `${match.homeScore}-${match.awayScore}${match.resultLabel ? ` · ${match.resultLabel}` : ""}`;
  }

  if (match.resultLabel && match.resultLabel !== "Not started") {
    return match.resultLabel;
  }

  if (match.status === "upcoming") {
    return "Por jogar";
  }

  return match.status ? formatStatusToken(match.status) : "";
}

function formatStatusToken(status) {
  switch (status) {
    case "finished":
      return "Terminado";
    case "upcoming":
      return "Por jogar";
    case "postponed":
      return "Adiado";
    case "cancelled":
      return "Cancelado";
    case "live":
      return "Live";
    default:
      return String(status);
  }
}

function formatHistoryMatchDate(date) {
  if (!date) {
    return "Sem data";
  }

  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(date) ? `${date}T12:00:00Z` : date;
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    return date;
  }

  return new Intl.DateTimeFormat("pt-PT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: displayTimeZone,
  }).format(parsed);
}

function resolveTeamHistoryOpponent(match, teamName) {
  const normalizedTeamName = normalizeTeamName(teamName);
  const home = normalizeTeamName(match.homeTeam);
  const away = normalizeTeamName(match.awayTeam);

  if (home === normalizedTeamName) {
    return `vs ${match.awayTeam}`;
  }

  if (away === normalizedTeamName) {
    return `vs ${match.homeTeam}`;
  }

  return null;
}

function formatHistoryRating(match, teamName) {
  const normalizedTeamName = normalizeTeamName(teamName);
  const home = normalizeTeamName(match.homeTeam);
  const away = normalizeTeamName(match.awayTeam);

  if (home === normalizedTeamName && typeof match.homeRating === "number") {
    return `Rating ${match.homeRating.toFixed(1)}`;
  }

  if (away === normalizedTeamName && typeof match.awayRating === "number") {
    return `Rating ${match.awayRating.toFixed(1)}`;
  }

  return null;
}

function formatTeamPrediction(team) {
  return team.overview?.prediction?.tipLabel ?? "Indisponível";
}

function formatTeamAbsences(team) {
  const injuries = team.overview?.squadHealth?.injuries?.length ?? 0;
  const suspensions = team.overview?.squadHealth?.suspensions?.length ?? 0;

  if (injuries === 0 && suspensions === 0) {
    return "Sem baixas";
  }

  return `${injuries} lesionado(s) · ${suspensions} suspenso(s)`;
}

function formatLatestHistory(history) {
  if (!Array.isArray(history) || history.length === 0) {
    return "Sem histórico";
  }

  const latest = history[0];
  const date = latest.date ? latest.date : "Sem data";
  const result = latest.result ? ` · ${latest.result}` : "";
  return `${date}${result}`;
}

function formatStandingType(type) {
  switch (type) {
    case "total":
      return "Geral";
    case "home":
      return "Casa";
    case "away":
      return "Fora";
    default:
      return type ?? null;
  }
}

function stringValue(value, fallback) {
  return value === null || value === undefined ? fallback : String(value);
}

function percentValue(value) {
  return value === null || value === undefined ? "—" : `${value}%`;
}

function decimalValue(value) {
  return value === null || value === undefined ? "—" : Number(value).toFixed(1);
}

function fallbackText(value) {
  return value ? String(value) : "Indisponível";
}

function formatForm(values) {
  return Array.isArray(values) && values.length > 0 ? values.join(" · ") : "—";
}

function normalizeFormValue(value) {
  switch (String(value ?? "").toUpperCase()) {
    case "W":
      return "win";
    case "D":
      return "draw";
    case "L":
      return "loss";
    default:
      return "neutral";
  }
}

function resolveStandingRowHighlight(row, fixture) {
  const normalizedRow = normalizeTeamName(row.teamName);
  const normalizedHome = normalizeTeamName(fixture.homeTeamName);
  const normalizedAway = normalizeTeamName(fixture.awayTeamName);

  if (normalizedRow && normalizedRow === normalizedHome) {
    return "home";
  }

  if (normalizedRow && normalizedRow === normalizedAway) {
    return "away";
  }

  return null;
}

function normalizeTeamName(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "")
    .toLowerCase();
}

function formatScoreline(fixture) {
  if (fixture.homeScore !== null && fixture.awayScore !== null) {
    const suffix = fixture.resultLabel ? ` (${fixture.resultLabel})` : "";
    return `${fixture.homeScore} - ${fixture.awayScore}${suffix}`;
  }

  return fixture.status === "upcoming" ? "Ainda sem resultado" : "Resultado indisponível";
}

function buildTeamInitials(name, teamId) {
  const initials = String(name)
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  return initials || String(teamId ?? "?").slice(0, 2).toUpperCase();
}

function compareFixtures(left, right) {
  return (
    compareKickoff(left.kickoffAtUtc, right.kickoffAtUtc) ||
    compareNullable(left.countryName, right.countryName) ||
    compareNullable(left.competitionName, right.competitionName) ||
    left.homeTeamName.localeCompare(right.homeTeamName) ||
    left.awayTeamName.localeCompare(right.awayTeamName)
  );
}

function compareKickoff(left, right) {
  if (left === right) {
    return 0;
  }

  if (left === null) {
    return 1;
  }

  if (right === null) {
    return -1;
  }

  return left.localeCompare(right);
}

function compareNullable(left, right) {
  return String(left ?? "").localeCompare(String(right ?? ""));
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeAttribute(value) {
  return escapeHtml(value);
}
