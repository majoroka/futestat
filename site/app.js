const summaryEl = document.querySelector("[data-fixture-summary]");
const datesEl = document.querySelector("[data-date-filters]");
const groupsEl = document.querySelector("[data-fixture-groups]");
const stateEl = document.querySelector("[data-fixture-state]");
const detailEl = document.querySelector("[data-fixture-detail]");
const displayTimeZone = "Europe/Lisbon";

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
}

function renderCompetitionGroup(group) {
  const fixtureCards = group.fixtures
    .sort(compareFixtures)
    .map(
      (fixture) => `
        <article class="fixture-card ${fixture.sourceEventId === state.selectedFixtureId ? "fixture-card--selected" : ""}" data-fixture-id="${fixture.sourceEventId}">
          <div class="fixture-card__meta">
            <span>${formatFixtureMeta(fixture)}</span>
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
          </div>
        </article>
      `,
    )
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
    return `
      <div class="fixture-detail__stack">
        <section class="fixture-detail__subsection">
          <h4>Resumo</h4>
          <div class="fixture-detail__info-list">
            ${detailInfoRow("Data e hora", formatMatchViewDateTime(view))}
            ${detailInfoRow("Competição", formatMatchViewCompetition(view))}
            ${detailInfoRow("Recinto", fallbackText(view.match.details.venueName))}
            ${detailInfoRow("Localização", formatMatchViewLocation(view))}
            ${detailInfoRow("Árbitro", formatMatchViewReferee(view))}
            ${detailInfoRow("Odds 1/X/2", formatMatchViewOdds(view.match.details.odds))}
            ${detailInfoRow("TV em Portugal", formatMatchViewWatch(view.match.details.watch))}
          </div>
        </section>
        <section class="fixture-detail__subsection">
          <h4>Comparativo rápido</h4>
          <div class="fixture-detail__team-panels">
            ${renderTeamSnapshotPanel("Casa", view.homeTeam)}
            ${renderTeamSnapshotPanel("Fora", view.awayTeam)}
          </div>
        </section>
      </div>
    `;
  }

  if (matchViewState?.status === "loading") {
    return `
      ${renderBasicFixtureDetails(fixture)}
      <p class="fixture-detail__note">A carregar vista detalhada do jogo...</p>
    `;
  }

  return `
    ${renderBasicFixtureDetails(fixture)}
    <p class="fixture-detail__note">Ainda não existe match view publicada para este jogo.</p>
  `;
}

function renderBasicFixtureDetails(fixture) {
  return `
    <section class="fixture-detail__subsection">
      <h4>Resumo</h4>
      <div class="fixture-detail__info-list">
        ${detailInfoRow("Data e hora", `${formatFixtureDetailDate(fixture)} · ${formatFixtureDetailTime(fixture)}`)}
        ${detailInfoRow("Competição", [fixture.competitionName, fixture.countryName].filter(Boolean).join(" · ") || "Indisponível")}
        ${detailInfoRow("Estado", formatStatusLabel(fixture))}
        ${detailInfoRow("Resultado", formatScoreline(fixture))}
      </div>
    </section>
  `;
}

function renderFixtureStandingsTab(fixture, matchViewState) {
  if (
    matchViewState?.status === "loaded" &&
    matchViewState.data?.standings?.available &&
    Array.isArray(matchViewState.data.standings.rows) &&
    matchViewState.data.standings.rows.length > 0
  ) {
    return `
      <div class="fixture-detail__standings">
        ${renderMatchViewStandingsTable(matchViewState.data.standings)}
      </div>
      <p class="fixture-detail__note">Classificação servida a partir da match view derivada.</p>
    `;
  }

  if (!fixture.competitionId) {
    return '<p class="fixture-detail__empty">Este jogo não tem competição mapeada para classificação.</p>';
  }

  const standingsState = state.standingsCache.get(fixture.competitionId) ?? null;

  if (standingsState?.status === "loaded" && Array.isArray(standingsState.data?.tables) && standingsState.data.tables.length > 0) {
    return `
      <div class="fixture-detail__standings">
        ${standingsState.data.tables.map((table) => renderStandingsTable(table, fixture)).join("")}
      </div>
      ${renderStandingsStateNote(standingsState)}
    `;
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

function renderMatchViewStandingsTable(standings) {
  const title = [standings.tableName, formatStandingType(standings.tableType)]
    .filter(Boolean)
    .join(" · ");

  return `
    <section class="fixture-detail__standings-table">
      ${title ? `<h3 class="fixture-detail__standings-title">${escapeHtml(title)}</h3>` : ""}
      <div class="fixture-detail__standings-grid" role="table" aria-label="${escapeAttribute(title || "Classificação")}">
        <div class="fixture-detail__standings-head" role="row">
          <span>#</span>
          <span>Equipa</span>
          <span>J</span>
          <span>V</span>
          <span>E</span>
          <span>D</span>
          <span>DG</span>
          <span>P</span>
        </div>
        ${standings.rows.map((row) => renderMatchViewStandingsRow(row)).join("")}
      </div>
    </section>
  `;
}

function renderMatchViewStandingsRow(row) {
  return `
    <div class="fixture-detail__standings-row ${row.highlight ? `fixture-detail__standings-row--${row.highlight}` : ""}" role="row">
      <span>${escapeHtml(stringValue(row.position, "—"))}</span>
      <span class="fixture-detail__standings-team">${escapeHtml(row.teamName)}</span>
      <span>${escapeHtml(stringValue(row.matches, "—"))}</span>
      <span>${escapeHtml(stringValue(row.wins, "—"))}</span>
      <span>${escapeHtml(stringValue(row.draws, "—"))}</span>
      <span>${escapeHtml(stringValue(row.losses, "—"))}</span>
      <span>${escapeHtml(row.goalDifference ?? "—")}</span>
      <span>${escapeHtml(stringValue(row.points, "—"))}</span>
    </div>
  `;
}

function renderStandingsTable(table, fixture) {
  const title = [table.name, formatStandingType(table.type)].filter(Boolean).join(" · ");

  return `
    <section class="fixture-detail__standings-table">
      ${title ? `<h3 class="fixture-detail__standings-title">${escapeHtml(title)}</h3>` : ""}
      <div class="fixture-detail__standings-grid" role="table" aria-label="${escapeAttribute(title || "Classificação")}">
        <div class="fixture-detail__standings-head" role="row">
          <span>#</span>
          <span>Equipa</span>
          <span>J</span>
          <span>V</span>
          <span>E</span>
          <span>D</span>
          <span>DG</span>
          <span>P</span>
        </div>
        ${table.rows.map((row) => renderStandingsRow(row, fixture)).join("")}
      </div>
    </section>
  `;
}

function renderStandingsRow(row, fixture) {
  const highlight = resolveStandingRowHighlight(row, fixture);

  return `
    <div class="fixture-detail__standings-row ${highlight ? `fixture-detail__standings-row--${highlight}` : ""}" role="row">
      <span>${escapeHtml(stringValue(row.position, "—"))}</span>
      <span class="fixture-detail__standings-team">${escapeHtml(row.teamName)}</span>
      <span>${escapeHtml(stringValue(row.matches, "—"))}</span>
      <span>${escapeHtml(stringValue(row.wins, "—"))}</span>
      <span>${escapeHtml(stringValue(row.draws, "—"))}</span>
      <span>${escapeHtml(stringValue(row.losses, "—"))}</span>
      <span>${escapeHtml(row.goalDifference ?? "—")}</span>
      <span>${escapeHtml(stringValue(row.points, "—"))}</span>
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

function renderStandingsStateNote(standingsState) {
  if (standingsState?.status === "error") {
    return '<p class="fixture-detail__note">Falhou o carregamento da classificação desta competição.</p>';
  }

  if (standingsState?.status === "missing") {
    return '<p class="fixture-detail__note">Ainda não existe classificação publicada para esta competição.</p>';
  }

  return "";
}

function renderTeamSnapshotPanel(sideLabel, team) {
  return `
    <article class="fixture-detail__team-panel">
      <span class="fixture-detail__team-panel-side">${escapeHtml(sideLabel)}</span>
      <h3 class="fixture-detail__team-panel-name">${escapeHtml(team.identity.name)}</h3>
      <div class="fixture-detail__team-panel-grid">
        ${renderTeamSnapshotMetric("Rating", decimalValue(team.headerStats.overallRating))}
        ${renderTeamSnapshotMetric("Forma", formatForm(team.headerStats.formLast3))}
        ${renderTeamSnapshotMetric("Rank nacional", stringValue(team.headerStats.nationalRank, "—"))}
        ${renderTeamSnapshotMetric("Rank Europa", stringValue(team.headerStats.europeRank, "—"))}
        ${renderTeamSnapshotMetric("xG", decimalValue(team.headerStats.xgFor))}
        ${renderTeamSnapshotMetric("xGA", decimalValue(team.headerStats.xgAgainst))}
        ${renderTeamSnapshotMetric("Posse", percentValue(team.headerStats.averagePossessionPct))}
        ${renderTeamSnapshotMetric("Clean sheets", stringValue(team.headerStats.cleanSheets, "—"))}
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

function formatMatchViewDateTime(view) {
  if (!view.match.kickoffAtUtc) {
    return view.match.date;
  }

  return `${formatLongDate(view.match.kickoffAtUtc)} · ${formatKickoffTime(view.match.kickoffAtUtc)}`;
}

function formatMatchViewCompetition(view) {
  return [view.match.competition.name, view.match.details.competitionStage]
    .filter(Boolean)
    .join(", ") || "Indisponível";
}

function formatMatchViewLocation(view) {
  return [view.match.details.venueCity, view.match.details.venueCountry]
    .filter(Boolean)
    .join(", ") || fallbackText(view.match.competition.country);
}

function formatMatchViewReferee(view) {
  return [view.match.details.refereeName, view.match.details.refereeCountry]
    .filter(Boolean)
    .join(" · ") || "Indisponível";
}

function formatMatchViewOdds(odds) {
  if (!odds || (!odds.home && !odds.draw && !odds.away)) {
    return "Indisponível";
  }

  return [`1 ${odds.home ?? "—"}`, `X ${odds.draw ?? "—"}`, `2 ${odds.away ?? "—"}`].join(" · ");
}

function formatMatchViewWatch(watch) {
  if (!watch) {
    return "Indisponível";
  }

  if (watch.hasPortugalChannels) {
    return watch.note ? `Disponível · ${watch.note}` : "Disponível";
  }

  return watch.note ?? "Sem canais PT detetados";
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
