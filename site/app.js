import { getStandingsZonePreset } from "./standings-zone-presets.js";
import { buildStandingsTableLayout } from "./standings-table-groups.js";

const datesEl = document.querySelector("[data-date-filters]");
const groupsEl = document.querySelector("[data-fixture-groups]");
const stateEl = document.querySelector("[data-fixture-state]");
const detailEl = document.querySelector("[data-fixture-detail]");
const footerMetaEl = document.querySelector("[data-fixture-footer-meta]");
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
  expandedCompetitionKeys: new Set(),
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
  if (!state.snapshot || !footerMetaEl) {
    return;
  }

  const windowLabel =
    state.snapshot.datesIncluded.length > 1
      ? `${state.snapshot.datesIncluded[0]} → ${state.snapshot.datesIncluded.at(-1)}`
      : state.snapshot.datesIncluded[0] ?? "Sem datas";

  footerMetaEl.textContent = [
    `Jogos visíveis: ${state.snapshot.visibleFixtureCount}`,
    `Janela ativa: ${windowLabel}`,
    `Snapshot: ${formatTimestamp(state.snapshot.scrapedAtUtc)}`,
  ].join(" · ");
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
    const key = buildCompetitionGroupKey(state.selectedDate, fixture);
    const group = byCompetition.get(key) ?? {
      key,
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
  bindCompetitionGroupInteractions();
  preloadVisibleMatchViews(fixtures);
}

function renderCompetitionGroup(group) {
  const fixtureCards = group.fixtures
    .sort(compareFixtures)
    .map((fixture) => renderFixtureCard(fixture))
    .join("");
  const countryFlag = renderCompetitionCountryFlag(group.countryName);
  const fixtureCount = group.fixtures.length;
  const isExpanded = state.expandedCompetitionKeys.has(group.key);

  return `
    <details class="competition-group" data-competition-key="${escapeAttribute(group.key)}" ${isExpanded ? "open" : ""}>
      <summary class="competition-group__summary">
        <span class="competition-group__summary-copy">
          <span class="competition-group__flag" aria-hidden="true">${countryFlag}</span>
          <span class="competition-group__country">${escapeHtml(group.countryName)}</span>
          <span class="competition-group__separator" aria-hidden="true">·</span>
          <span class="competition-group__title">${escapeHtml(group.competitionName)}</span>
        </span>
        <span class="competition-group__summary-meta">
          <span class="competition-group__count">${escapeHtml(String(fixtureCount))}</span>
          <span class="competition-group__arrow" aria-hidden="true"></span>
        </span>
      </summary>
      <div class="competition-group__fixtures">
        ${fixtureCards}
      </div>
    </details>
  `;
}

function bindCompetitionGroupInteractions() {
  for (const groupEl of groupsEl?.querySelectorAll("[data-competition-key]") ?? []) {
    groupEl.addEventListener("toggle", () => {
      const groupKey = groupEl.getAttribute("data-competition-key");
      if (!groupKey) {
        return;
      }

      if (groupEl.open) {
        state.expandedCompetitionKeys.add(groupKey);
        return;
      }

      state.expandedCompetitionKeys.delete(groupKey);
    });
  }
}

function renderCompetitionCountryFlag(countryName) {
  const flag = competitionCountryFlags.get(String(countryName ?? "").trim()) ?? null;
  return flag ?? "🌐";
}

const competitionCountryFlags = new Map([
  ["Argentina", "🇦🇷"],
  ["Austria", "🇦🇹"],
  ["Belgium", "🇧🇪"],
  ["Brazil", "🇧🇷"],
  ["Bulgaria", "🇧🇬"],
  ["Croatia", "🇭🇷"],
  ["Czech Republic", "🇨🇿"],
  ["Denmark", "🇩🇰"],
  ["England", "🏴"],
  ["Europe", "🌐"],
  ["Finland", "🇫🇮"],
  ["France", "🇫🇷"],
  ["Germany", "🇩🇪"],
  ["Greece", "🇬🇷"],
  ["Hungary", "🇭🇺"],
  ["International", "🌐"],
  ["Israel", "🇮🇱"],
  ["Italy", "🇮🇹"],
  ["Netherlands", "🇳🇱"],
  ["Norway", "🇳🇴"],
  ["Poland", "🇵🇱"],
  ["Portugal", "🇵🇹"],
  ["Romania", "🇷🇴"],
  ["Russia", "🇷🇺"],
  ["Scotland", "🏴"],
  ["Serbia", "🇷🇸"],
  ["Slovakia", "🇸🇰"],
  ["Slovenia", "🇸🇮"],
  ["Spain", "🇪🇸"],
  ["Sweden", "🇸🇪"],
  ["Switzerland", "🇨🇭"],
  ["Turkey", "🇹🇷"],
  ["Ukraine", "🇺🇦"],
  ["World", "🌐"],
]);

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
          : state.selectedDetailTab === "statistics"
            ? renderFixtureStatisticsTab(fixture, matchViewState)
            : state.selectedDetailTab === "squad"
              ? renderFixtureSquadTab(fixture, matchViewState)
              : state.selectedDetailTab === "history"
                ? renderFixtureHistoryTab(fixture, matchViewState)
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
      <button
        type="button"
        class="fixture-detail__tab ${state.selectedDetailTab === "statistics" ? "fixture-detail__tab--active" : ""}"
        data-detail-tab="statistics"
      >
        Estatísticas
      </button>
      <button
        type="button"
        class="fixture-detail__tab ${state.selectedDetailTab === "squad" ? "fixture-detail__tab--active" : ""}"
        data-detail-tab="squad"
      >
        Plantel
      </button>
      <button
        type="button"
        class="fixture-detail__tab ${state.selectedDetailTab === "history" ? "fixture-detail__tab--active" : ""}"
        data-detail-tab="history"
      >
        Histórico
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
      <div class="fixture-detail__tab-panel fixture-detail__stack">
        ${renderFixtureDetailContextSection(fixture, view)}
        ${renderFixtureDetailFormSection(view)}
        ${renderFixtureDetailLineupSection(view)}
        ${renderFixtureDetailAvailabilitySection(view)}
        ${renderFixtureDetailFooter(fixture, view)}
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
    <div class="fixture-detail__tab-panel fixture-detail__stack">
      <section class="fixture-detail__subsection">
        <h4>Contexto competitivo</h4>
        <div class="fixture-detail__summary-grid">
          ${renderDetailPlainBlock(
            "Competição",
            [
              detailInfoRow("Data e hora", `${formatFixtureDetailDate(fixture)} · ${formatFixtureDetailTime(fixture)}`),
              detailInfoRow("Competição", [fixture.competitionName, fixture.countryName].filter(Boolean).join(" · ") || "n/d"),
              detailInfoRow("Fase", "n/d"),
              detailInfoRow("Contexto", "n/d"),
            ].join(""),
          )}
          ${renderDetailPlainBlock(
            "Jogo",
            [
              detailInfoRow("Estádio", "n/d"),
              detailInfoRow("Capacidade", "n/d"),
              detailInfoRow("Cidade", "n/d"),
              detailInfoRow("Árbitro", "n/d"),
              detailInfoRow("TV em Portugal", "n/d"),
            ].join(""),
          )}
        </div>
      </section>
      <section class="fixture-detail__subsection">
        <h4>Forma recente</h4>
        <div class="fixture-detail__summary-grid">
          ${renderDetailPlainBlock(`Casa · ${fixture.homeTeamName}`, renderUnavailableFormRow("n/d", fixture.homeTeamLogoUrl, fixture.homeTeamId))}
          ${renderDetailPlainBlock(`Fora · ${fixture.awayTeamName}`, renderUnavailableFormRow("n/d", fixture.awayTeamLogoUrl, fixture.awayTeamId))}
        </div>
      </section>
      <section class="fixture-detail__subsection">
        <h4>Equipa provável</h4>
        <div class="fixture-detail__lineup-grid">
          ${renderUnavailableLineupCard("Casa", fixture.homeTeamName, "home")}
          ${renderUnavailableLineupCard("Fora", fixture.awayTeamName, "away")}
        </div>
      </section>
      <section class="fixture-detail__subsection">
        <h4>Lesionados e suspensos</h4>
        <div class="fixture-detail__availability-grid">
          ${renderUnavailableAvailabilityCard("Casa", fixture.homeTeamName, "home")}
          ${renderUnavailableAvailabilityCard("Fora", fixture.awayTeamName, "away")}
        </div>
      </section>
      <section class="fixture-detail__subsection">
        <h4>Estado da vista</h4>
        <p class="fixture-detail__note">${escapeHtml(note ?? "Alguns blocos continuam em n/d até existir uma match view publicada para este jogo.")}</p>
        ${renderFixtureDetailFooter(fixture, null)}
      </section>
    </div>
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
      <div class="fixture-detail__tab-panel fixture-detail__standings">
        ${renderFixtureTabIntro({
          eyebrow: "Classificação",
          title: "Tabela contextual do jogo",
          copy: "Fallback servido pela match view derivada quando ainda não existe snapshot dedicado da competição.",
          badges: ["Fonte derivada"],
        })}
        ${renderMatchViewStandingsTable(matchViewState.data.standings, fixture)}
      </div>
    `;
  }

  if (!fixture.competitionId) {
    return `
      <div class="fixture-detail__tab-panel">
        ${renderFixtureTabIntro({
          eyebrow: "Classificação",
          title: "Tabela indisponível",
          copy: "Este jogo ainda não tem competição mapeada para classificação pública.",
        })}
        ${renderFixtureTabEmptyState(
          "Sem competição associada",
          "Não foi possível determinar a competição necessária para carregar a classificação deste jogo.",
        )}
      </div>
    `;
  }

  const message =
    standingsState?.status === "loading"
      ? "A carregar classificação..."
      : "Classificação indisponível para este jogo ou competição.";

  return `
    <div class="fixture-detail__tab-panel">
      ${renderFixtureTabIntro({
        eyebrow: "Classificação",
        title: "Tabela da competição",
        copy: "Quando existir snapshot publicado para esta competição, a classificação surge automaticamente neste separador.",
      })}
      ${renderFixtureTabEmptyState(
        standingsState?.status === "loading" ? "A carregar classificação" : "Classificação indisponível",
        message,
        renderStandingsStateNote(standingsState),
        {
          statusLabel: standingsState?.status === "loading" ? "A carregar" : "Sem snapshot",
          links: [createFixtureExternalLink(fixture.matchUrl, "Abrir no Sofascore")],
        },
      )}
    </div>
  `;
}

function renderFixtureStatisticsTab(fixture, matchViewState) {
  if (matchViewState?.status === "loaded" && matchViewState.data) {
    const view = matchViewState.data;
    if (hasAnyTeamStatistics(view)) {
      return `
        <div class="fixture-detail__tab-panel fixture-detail__stats">
          ${renderFixtureTabIntro({
            eyebrow: "Estatísticas",
            title: "Comparação agregada casa vs fora",
            copy: "Leitura comparativa construída com os blocos estatísticos já normalizados na match view.",
            badges: [view.match.season?.label ?? null, "Fonte manual"],
          })}
          ${renderStatisticsHero(view)}
          ${renderStatisticsSection("Visão geral", [
            createStatisticsMetric("Golos/jogo", "goalsPerMatch"),
            createStatisticsMetric("Golos sofridos/jogo", "goalsConcededPerMatch", "decimal", false),
            createStatisticsMetric("Posse média", "averagePossessionPct", "percent"),
            createStatisticsMetric("Assistência média", "attendanceAverage", "integer"),
          ], view, "overview")}
          ${renderStatisticsSection("Ataque", [
            createStatisticsMetric("xG", "xg", "decimal"),
            createStatisticsMetric("xG diff", "xgDiff", "decimal"),
            createStatisticsMetric("Remates à baliza", "shotsOnTargetPerMatch", "decimal"),
            createStatisticsMetric("Grandes ocasiões", "bigChances", "decimal"),
            createStatisticsMetric("Grandes ocasiões falhadas", "bigChancesMissed", "decimal"),
            createStatisticsMetric("Passes certos", "accuratePassesPerMatch", "integer"),
            createStatisticsMetric("Bolas longas certas", "accurateLongBallsPerMatch", "decimal"),
            createStatisticsMetric("Cruzamentos certos", "accurateCrossesPerMatch", "decimal"),
            createStatisticsMetric("Toques na área", "touchesInOppBoxPerMatch", "decimal"),
            createStatisticsMetric("Cantos/jogo", "cornersPerMatch", "decimal"),
            createStatisticsMetric("Golos de bola parada", "setPieceGoals", "integer"),
            createStatisticsMetric("Penáltis ganhos", "penaltiesAwarded", "integer"),
          ], view, "attack")}
          ${renderStatisticsSection("Defesa", [
            createStatisticsMetric("xGA", "xgConceded", "decimal", false),
            createStatisticsMetric("Interceções/jogo", "interceptionsPerMatch", "decimal"),
            createStatisticsMetric("Desarmes/jogo", "tacklesPerMatch", "decimal"),
            createStatisticsMetric("Cortes/jogo", "clearancesPerMatch", "decimal"),
            createStatisticsMetric("Recuperações altas", "finalThirdRecoveriesPerMatch", "decimal"),
            createStatisticsMetric("Golos sofridos de bola parada", "setPieceGoalsConceded", "integer", false),
            createStatisticsMetric("Penáltis cometidos", "penaltiesConceded", "integer", false),
            createStatisticsMetric("Defesas/jogo", "savesPerMatch", "decimal"),
          ], view, "defense")}
          ${renderStatisticsSection("Disciplina", [
            createStatisticsMetric("Faltas/jogo", "foulsPerMatch", "decimal", false),
            createStatisticsMetric("Amarelos/jogo", "yellowCardsPerMatch", "decimal", false),
            createStatisticsMetric("Vermelhos/jogo", "redCardsPerMatch", "decimal", false),
            createStatisticsMetric("Penáltis cometidos", "penaltiesConceded", "integer", false),
          ], view, "discipline")}
        </div>
      `;
    }

    return `
      <div class="fixture-detail__tab-panel">
        ${renderFixtureTabIntro({
          eyebrow: "Estatísticas",
          title: "Bloco estatístico ainda vazio",
          copy: "Este separador depende dos dados de equipa previamente normalizados na match view.",
        })}
        ${renderFixtureTabEmptyState(
          "Sem métricas publicadas",
          "Ainda não existem estatísticas agregadas disponíveis para este jogo.",
          "Quando o bloco estatístico da match view existir, esta comparação será preenchida sem scraping adicional ao vivo.",
          {
            statusLabel: "Sem dados",
            links: [createFixtureExternalLink(fixture.matchUrl, "Abrir no Sofascore")],
          },
        )}
      </div>
    `;
  }

  if (matchViewState?.status === "loading") {
    return `
      <div class="fixture-detail__tab-panel">
        ${renderFixtureTabIntro({
          eyebrow: "Estatísticas",
          title: "A preparar comparação estatística",
          copy: "A match view está a carregar e este separador será preenchido assim que terminar.",
        })}
        ${renderFixtureTabEmptyState(
          "Carregamento em curso",
          "Estamos a montar as métricas comparativas deste jogo.",
          null,
          {
            statusLabel: "A carregar",
            links: [createFixtureExternalLink(fixture.matchUrl, "Abrir no Sofascore")],
          },
        )}
      </div>
    `;
  }

  return `
    <div class="fixture-detail__tab-panel">
      ${renderFixtureTabIntro({
        eyebrow: "Estatísticas",
        title: "Comparação ainda indisponível",
        copy: "Este jogo ainda não tem match view publicada com estatísticas agregadas.",
      })}
      ${renderFixtureTabEmptyState(
        "Sem match view publicada",
        "Ainda não existe match view publicada para mostrar estatísticas deste jogo.",
        "Depois do próximo refresh/publicação manual, este separador poderá ser preenchido sem novo scraping ao vivo.",
        {
          statusLabel: "Snapshot público",
          links: [createFixtureExternalLink(fixture.matchUrl, "Abrir no Sofascore")],
        },
      )}
    </div>
  `;
}

function renderFixtureSquadTab(fixture, matchViewState) {
  if (matchViewState?.status === "loaded" && matchViewState.data) {
    const view = matchViewState.data;
    if (hasAnyTeamSquad(view)) {
      return `
        <div class="fixture-detail__tab-panel fixture-detail__squad">
          ${renderFixtureTabIntro({
            eyebrow: "Plantel",
            title: "Elencos e disponibilidade",
            copy: "Vista pública do plantel ordenada por impacto recente, com contexto rápido de sistema e baixas.",
            badges: [
              `${countAvailablePlayers(view.homeTeam.squad)} casa`,
              `${countAvailablePlayers(view.awayTeam.squad)} fora`,
            ],
          })}
          <section class="fixture-detail__subsection">
            <h4>Leitura rápida</h4>
            <div class="fixture-detail__highlights">
              ${renderDetailHighlight("Casa", `${countAvailablePlayers(view.homeTeam.squad)} jogadores`, "accent")}
              ${renderDetailHighlight("Fora", `${countAvailablePlayers(view.awayTeam.squad)} jogadores`)}
              ${renderDetailHighlight("Sistema casa", fallbackText(view.homeTeam.overview.expectedLineup?.formation))}
              ${renderDetailHighlight("Sistema fora", fallbackText(view.awayTeam.overview.expectedLineup?.formation))}
            </div>
          </section>
          <section class="fixture-detail__subsection">
            <h4>Elencos por equipa</h4>
            <div class="fixture-detail__squad-panels">
              ${renderSquadPanel("Casa", view.homeTeam, "home")}
              ${renderSquadPanel("Fora", view.awayTeam, "away")}
            </div>
          </section>
        </div>
      `;
    }

    return `
      <div class="fixture-detail__tab-panel">
        ${renderFixtureTabIntro({
          eyebrow: "Plantel",
          title: "Elencos ainda não publicados",
          copy: "Este separador depende do bloco `squad` já normalizado na match view.",
        })}
        ${renderFixtureTabEmptyState(
          "Sem plantel disponível",
          "Ainda não existe plantel publicado para este jogo.",
          "Quando o bloco `squad` estiver presente na match view, o painel será preenchido automaticamente.",
          {
            statusLabel: "Sem dados",
            links: [createFixtureExternalLink(fixture.matchUrl, "Abrir no Sofascore")],
          },
        )}
      </div>
    `;
  }

  if (matchViewState?.status === "loading") {
    return `
      <div class="fixture-detail__tab-panel">
        ${renderFixtureTabIntro({
          eyebrow: "Plantel",
          title: "A preparar elencos",
          copy: "A match view está a carregar e o plantel ficará visível quando a composição terminar.",
        })}
        ${renderFixtureTabEmptyState(
          "Carregamento em curso",
          "Estamos a preparar os elencos deste jogo.",
          null,
          {
            statusLabel: "A carregar",
            links: [createFixtureExternalLink(fixture.matchUrl, "Abrir no Sofascore")],
          },
        )}
      </div>
    `;
  }

  return `
    <div class="fixture-detail__tab-panel">
      ${renderFixtureTabIntro({
        eyebrow: "Plantel",
        title: "Elencos ainda indisponíveis",
        copy: "Este jogo ainda não tem match view publicada com contexto de plantel.",
      })}
      ${renderFixtureTabEmptyState(
        "Sem match view publicada",
        "Ainda não existe match view publicada para mostrar o plantel deste jogo.",
        "Depois do próximo refresh/publicação manual, este separador poderá ser preenchido com os dados já capturados do Soccer-Rating.",
        {
          statusLabel: "Snapshot público",
          links: [createFixtureExternalLink(fixture.matchUrl, "Abrir no Sofascore")],
        },
      )}
    </div>
  `;
}

function renderFixtureHistoryTab(fixture, matchViewState) {
  if (matchViewState?.status === "loaded" && matchViewState.data) {
    const view = matchViewState.data;
    if (hasAnyTeamHistory(view)) {
      return `
        <div class="fixture-detail__tab-panel fixture-detail__history">
          ${renderFixtureTabIntro({
            eyebrow: "Histórico",
            title: "Momento recente das equipas",
            copy: "Últimos jogos agregados por equipa para ajudar a ler forma, resultados e contexto curto.",
            badges: [
              `${countHistoryMatches(view.homeTeam.history)} casa`,
              `${countHistoryMatches(view.awayTeam.history)} fora`,
            ],
          })}
          <section class="fixture-detail__subsection">
            <h4>Leitura rápida</h4>
            <div class="fixture-detail__highlights">
              ${renderDetailHighlight("Últimos jogos casa", `${countHistoryMatches(view.homeTeam.history)} entradas`, "accent")}
              ${renderDetailHighlight("Últimos jogos fora", `${countHistoryMatches(view.awayTeam.history)} entradas`)}
              ${renderDetailHighlight("Forma casa", formatForm(view.homeTeam.headerStats.formLast3))}
              ${renderDetailHighlight("Forma fora", formatForm(view.awayTeam.headerStats.formLast3))}
            </div>
          </section>
          <section class="fixture-detail__subsection">
            <h4>Últimos jogos por equipa</h4>
            <div class="fixture-detail__history-panels">
              ${renderHistoryPanel("Casa", view.homeTeam, "home")}
              ${renderHistoryPanel("Fora", view.awayTeam, "away")}
            </div>
          </section>
        </div>
      `;
    }

    return `
      <div class="fixture-detail__tab-panel">
        ${renderFixtureTabIntro({
          eyebrow: "Histórico",
          title: "Momento recente ainda vazio",
          copy: "Este separador depende do bloco `history` já presente na match view.",
        })}
        ${renderFixtureTabEmptyState(
          "Sem histórico disponível",
          "Ainda não existe histórico publicado para este jogo.",
          "Quando o bloco `history` estiver presente na match view, o painel será preenchido automaticamente.",
          {
            statusLabel: "Sem dados",
            links: [createFixtureExternalLink(fixture.matchUrl, "Abrir no Sofascore")],
          },
        )}
      </div>
    `;
  }

  if (matchViewState?.status === "loading") {
    return `
      <div class="fixture-detail__tab-panel">
        ${renderFixtureTabIntro({
          eyebrow: "Histórico",
          title: "A preparar jogos recentes",
          copy: "A match view está a carregar e o histórico ficará visível quando a composição terminar.",
        })}
        ${renderFixtureTabEmptyState(
          "Carregamento em curso",
          "Estamos a preparar os últimos jogos de cada equipa.",
          null,
          {
            statusLabel: "A carregar",
            links: [createFixtureExternalLink(fixture.matchUrl, "Abrir no Sofascore")],
          },
        )}
      </div>
    `;
  }

  return `
    <div class="fixture-detail__tab-panel">
      ${renderFixtureTabIntro({
        eyebrow: "Histórico",
        title: "Jogos recentes ainda indisponíveis",
        copy: "Este jogo ainda não tem match view publicada com histórico recente das equipas.",
      })}
      ${renderFixtureTabEmptyState(
        "Sem match view publicada",
        "Ainda não existe match view publicada para mostrar o histórico deste jogo.",
        "Depois do próximo refresh/publicação manual, este separador poderá ser preenchido com os jogos recentes de cada equipa.",
        {
          statusLabel: "Snapshot público",
          links: [createFixtureExternalLink(fixture.matchUrl, "Abrir no Sofascore")],
        },
      )}
    </div>
  `;
}

function renderCompetitionStandingsSnapshot(snapshot, fixture) {
  const layout = buildStandingsTableLayout(snapshot.tables, fixture, {
    ruleProfileId: snapshot.ruleProfileId,
  });
  const metaItems = [
    snapshot.phaseName ? `Fase: ${snapshot.phaseName}` : null,
    snapshot.mode !== "single_table" ? formatStandingsMode(snapshot.mode) : null,
    snapshot.status !== "ready" ? formatStandingsStatus(snapshot.status) : null,
  ]
    .filter(Boolean);

  return `
    <div class="fixture-detail__tab-panel fixture-detail__standings">
      ${renderFixtureTabIntro({
        eyebrow: "Classificação",
        title: "Tabela oficial da competição",
        copy: "Classificação pública servida a partir do Zerozero e contextualizada para o jogo selecionado.",
        badges: [
          snapshot.phaseName ?? null,
          snapshot.mode !== "single_table" ? formatStandingsMode(snapshot.mode) : null,
          "Fonte Zerozero",
        ],
      })}
      ${renderStandingsMeta(metaItems)}
      ${renderStandingsPhaseNotes(snapshot.phaseNotes)}
      ${layout.summary ? `<p class="fixture-detail__standings-context">${escapeHtml(layout.summary)}</p>` : ""}
      ${layout.primaryTables
        .map((table) =>
          renderStandingsTableCard(table, fixture, {
            competitionId: snapshot.competitionId,
            ruleProfileId: snapshot.ruleProfileId,
            isPrimary: true,
          }),
        )
        .join("")}
      ${renderSecondaryStandingsTables(layout.secondaryTables, fixture, {
        competitionId: snapshot.competitionId,
        ruleProfileId: snapshot.ruleProfileId,
      })}
      ${renderStandingsLegend(
        {
          competitionId: snapshot.competitionId,
          ruleProfileId: snapshot.ruleProfileId,
        },
        layout.primaryTables.length > 0 ? layout.primaryTables : snapshot.tables,
      )}
      ${renderFixtureActionLinks([
        snapshot.zerozeroUrl ? createFixtureExternalLink(snapshot.zerozeroUrl, "Abrir no Zerozero") : null,
        createFixtureExternalLink(fixture.matchUrl, "Abrir no Sofascore"),
      ])}
    </div>
  `;
}

function renderMatchViewStandingsTable(standings, fixture) {
  const metaItems = [
    standings.phaseName ? `Fase: ${standings.phaseName}` : null,
    standings.tableType ? formatStandingsMode(standings.tableType) : null,
    standings.sourceStatus !== "ready" ? formatStandingsStatus(standings.sourceStatus) : null,
  ]
    .filter(Boolean);
  const title = [standings.tableName, formatStandingType(standings.tableType)]
    .filter(Boolean)
    .join(" · ");

  return `
    <section class="fixture-detail__standings-table">
      ${renderStandingsMeta(metaItems)}
      ${renderStandingsPhaseNotes(standings.phaseNotes)}
      ${
        title
          ? `
            <div class="fixture-detail__standings-table-head">
              <div>
                <h3 class="fixture-detail__standings-title">${escapeHtml(title)}</h3>
              </div>
            </div>
          `
          : ""
      }
      ${renderStandingsGrid({
        title,
        rows: standings.rows,
        fixture,
        competitionId: standings.competitionId,
        ruleProfileId: standings.ruleProfileId,
      })}
      ${renderStandingsLegend(
        {
          competitionId: standings.competitionId,
          ruleProfileId: standings.ruleProfileId,
        },
        [{ rows: standings.rows }],
      )}
    </section>
  `;
}

function renderStandingsTableCard(table, fixture, standingsContext) {
  const title = [table.name, formatStandingType(table.type)].filter(Boolean).join(" · ");
  const classes = [
    "fixture-detail__standings-table",
    standingsContext?.isPrimary ? "fixture-detail__standings-table--primary" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return `
    <section class="${classes}">
      ${
        table.badge || title
          ? `
            <div class="fixture-detail__standings-table-head">
              <div>
                ${table.badge ? `<p class="fixture-detail__standings-badge">${escapeHtml(table.badge)}</p>` : ""}
                ${title ? `<h3 class="fixture-detail__standings-title">${escapeHtml(title)}</h3>` : ""}
              </div>
            </div>
          `
          : ""
      }
      ${renderStandingsGrid({
        title,
        rows: table.rows,
        fixture,
        competitionId: standingsContext?.competitionId ?? null,
        ruleProfileId: standingsContext?.ruleProfileId ?? null,
      })}
    </section>
  `;
}

function renderSecondaryStandingsTables(tables, fixture, standingsContext) {
  if (!Array.isArray(tables) || tables.length === 0) {
    return "";
  }

  return `
    <details class="fixture-detail__standings-more">
      <summary class="fixture-detail__standings-more-summary">
        <span class="fixture-detail__standings-more-summary-copy">
          <strong class="fixture-detail__standings-more-title">Outras tabelas desta fase</strong>
          <span class="fixture-detail__standings-more-subtitle">Grupos, quadros ou rankings adicionais da mesma competição.</span>
        </span>
        <span class="fixture-detail__standings-more-count">${escapeHtml(String(tables.length))}</span>
      </summary>
      <div class="fixture-detail__standings-more-body">
        ${tables
          .map((table) =>
            renderStandingsTableCard(table, fixture, {
              ...standingsContext,
              isPrimary: false,
            }),
          )
          .join("")}
      </div>
    </details>
  `;
}

function renderStandingsGrid({ title, rows, fixture, competitionId, ruleProfileId }) {
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
        ${rows.map((row) => renderStandingsRow(row, fixture, { competitionId, ruleProfileId })).join("")}
      </div>
    </div>
  `;
}

function renderStandingsRow(row, fixture, standingsContext) {
  const highlight = row.highlight ?? resolveStandingRowHighlight(row, fixture);
  const zone = resolveStandingsZone(standingsContext, row.position);
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

function renderStandingsLegend(standingsContext, tables) {
  const zones = collectLegendZones(standingsContext, tables);
  if (zones.length === 0) {
    return "";
  }

  return `
    <section class="fixture-detail__standings-legend-block">
      <h3 class="fixture-detail__standings-section-title">Legenda da fase</h3>
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
    </section>
  `;
}

function renderStandingsPhaseNotes(notes) {
  if (!Array.isArray(notes) || notes.length === 0) {
    return "";
  }

  return `
    <section class="fixture-detail__standings-notes-block">
      <h3 class="fixture-detail__standings-section-title">Notas da fase</h3>
      <div class="fixture-detail__standings-notes">
      ${notes
        .map(
          (note) => `
            <p class="fixture-detail__standings-note">${escapeHtml(note)}</p>
          `,
        )
        .join("")}
      </div>
    </section>
  `;
}

function renderStandingsMeta(items) {
  const visibleItems = Array.isArray(items) ? items.filter(Boolean) : [];
  if (visibleItems.length === 0) {
    return "";
  }

  return `
    <div class="fixture-detail__standings-meta">
      ${visibleItems.map((item) => `<span class="fixture-detail__state-badge">${escapeHtml(item)}</span>`).join("")}
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

function renderDetailPlainBlock(title, content) {
  return `
    <article class="fixture-detail__plain-block">
      <h3 class="fixture-detail__plain-block-title">${escapeHtml(title)}</h3>
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

function renderFixtureTabIntro({ eyebrow, title, copy, badges = [] }) {
  const visibleBadges = Array.isArray(badges)
    ? badges.filter((badge) => typeof badge === "string" && badge.trim().length > 0)
    : [];

  return `
    <section class="fixture-detail__tab-intro">
      <div class="fixture-detail__tab-intro-copy">
        ${eyebrow ? `<p class="fixture-detail__tab-kicker">${escapeHtml(eyebrow)}</p>` : ""}
        ${title ? `<h3 class="fixture-detail__tab-title">${escapeHtml(title)}</h3>` : ""}
        ${copy ? `<p class="fixture-detail__tab-copy">${escapeHtml(copy)}</p>` : ""}
      </div>
      ${
        visibleBadges.length > 0
          ? `
            <div class="fixture-detail__tab-badges">
              ${visibleBadges.map((badge) => `<span class="fixture-detail__badge">${escapeHtml(badge)}</span>`).join("")}
            </div>
          `
          : ""
      }
    </section>
  `;
}

function renderFixtureTabEmptyState(title, message, note = null, options = {}) {
  const renderedNote = note
    ? note.includes("fixture-detail__note")
      ? note
      : `<p class="fixture-detail__note">${escapeHtml(note)}</p>`
    : "";
  const statusLabel =
    typeof options.statusLabel === "string" && options.statusLabel.trim().length > 0
      ? options.statusLabel.trim()
      : null;
  const links = Array.isArray(options.links) ? options.links.filter(Boolean) : [];

  return `
    <section class="fixture-detail__empty-state">
      ${statusLabel ? `<span class="fixture-detail__state-badge">${escapeHtml(statusLabel)}</span>` : ""}
      <h3 class="fixture-detail__empty-title">${escapeHtml(title)}</h3>
      <p class="fixture-detail__empty">${escapeHtml(message)}</p>
      ${renderedNote}
      ${renderFixtureActionLinks(links)}
    </section>
  `;
}

function createFixtureExternalLink(href, label) {
  if (!href || !label) {
    return null;
  }

  return { href, label };
}

function renderFixtureActionLinks(links) {
  const visibleLinks = Array.isArray(links)
    ? links.filter((link) => link?.href && link?.label)
    : [];

  if (visibleLinks.length === 0) {
    return "";
  }

  return `
    <div class="fixture-detail__action-links">
      ${visibleLinks
        .map(
          (link) =>
            `<a class="fixture-detail__action-link" href="${escapeAttribute(link.href)}" target="_blank" rel="noreferrer">${escapeHtml(link.label)}</a>`,
        )
        .join("")}
    </div>
  `;
}

function renderFixtureDetailContextSection(fixture, view) {
  const contextRows = [
    detailInfoRow("Data e hora", formatMatchViewDateTime(view)),
    detailInfoRow("Competição", formatMatchViewCompetitionName(view)),
    detailInfoRow("Fase", stringValue(view.match.details.competitionStage, "n/d")),
    detailInfoRow("Formato", stringValue(formatMatchViewTieFormat(view.match.details.tieContext), "n/d")),
    renderPrimaryMatchContextRow(view),
  ]
    .filter(Boolean)
    .join("");
  const matchRows = [
    detailInfoRow("Estádio", stringValue(view.match.details.venueName, "n/d")),
    detailInfoRow("Capacidade", stringValue(formatMatchViewVenueCapacity(view.match.details.venueCapacity), "n/d")),
    detailInfoRow("Cidade", stringValue(formatMatchViewVenueCity(view), "n/d")),
    detailInfoRow("Árbitro", stringValue(formatMatchViewReferee(view), "n/d")),
    detailInfoRow("TV em Portugal", formatMatchViewWatch(view.match.details.watch)),
  ].join("");

  return `
    <section class="fixture-detail__subsection">
      <h4>Contexto competitivo</h4>
      <div class="fixture-detail__summary-grid">
        ${renderDetailPlainBlock("Competição", contextRows)}
        ${renderDetailPlainBlock("Jogo", matchRows)}
      </div>
    </section>
  `;
}

function renderPrimaryMatchContextRow(view) {
  const tieContext = view.match.details.tieContext ?? null;
  if (tieContext?.previousLeg) {
    return detailInfoRow("1.ª mão", formatRelatedMatchOutcome(tieContext.previousLeg) ?? "n/d");
  }

  const previousMeeting = resolvePreviousMeetingFromHistory(view);
  if (previousMeeting) {
    return detailInfoRow("Confronto anterior", previousMeeting);
  }

  return "";
}

function resolvePreviousMeetingFromHistory(view) {
  const entries = Array.isArray(view.match.details.tieContext?.h2h) ? view.match.details.tieContext.h2h : [];
  if (entries.length === 0) {
    return null;
  }

  return formatRelatedMatchOutcome(entries[0]);
}

function renderFixtureDetailFormSection(view) {
  return `
    <section class="fixture-detail__subsection">
      <h4>Forma recente</h4>
      ${renderFixtureTeamsHeader(view.homeTeam.identity, view.awayTeam.identity)}
      <div class="fixture-detail__comparison-grid">
        ${renderTeamRecentFormRow(view.homeTeam)}
        ${renderTeamRecentFormRow(view.awayTeam)}
      </div>
    </section>
  `;
}

function renderTeamRecentFormRow(team) {
  const entries = buildTeamRecentFormEntries(team).slice(0, 5);
  if (entries.length === 0) {
    return renderUnavailableFormRow();
  }

  const paddedEntries = [...entries];
  while (paddedEntries.length < 5) {
    paddedEntries.push({
      result: "empty",
      title: "n/d",
    });
  }

  return `
    <div class="fixture-detail__form-team">
      <div class="fixture-detail__form-strip">
        ${paddedEntries
          .map(
            (entry) => `
              <span
                class="fixture-detail__form-pill fixture-detail__form-pill--${escapeAttribute(entry.result)}"
                title="${escapeAttribute(entry.title)}"
              >
                ${escapeHtml(formatFormBadgeLabel(entry.result))}
              </span>
            `,
          )
          .join("")}
      </div>
    </div>
  `;
}

function renderUnavailableFormRow() {
  return `
    <div class="fixture-detail__form-team">
      <div class="fixture-detail__form-strip">
        ${Array.from({ length: 5 })
          .map(() => `<span class="fixture-detail__form-pill fixture-detail__form-pill--empty" title="n/d">—</span>`)
          .join("")}
      </div>
    </div>
  `;
}

function buildTeamRecentFormEntries(team) {
  if (!Array.isArray(team.history) || team.history.length === 0) {
    return [];
  }

  return team.history
    .map((match) => {
      const perspective = resolveHistoryPerspective(match, team.identity.name);
      if (!perspective) {
        return null;
      }

      const result = resolveHistoryResultCode(match, perspective);
      const opponentName = perspective === "home" ? match.awayTeam : match.homeTeam;
      const scoreLabel = match.result ?? "n/d";
      const dateLabel = formatHistoryMatchDate(match.date) ?? "Data n/d";
      return {
        result,
        title: `${dateLabel} · ${team.identity.name} ${scoreLabel} ${opponentName}`,
      };
    })
    .filter(Boolean);
}

function resolveHistoryPerspective(match, teamName) {
  if (matchesTeamReference(normalizeTeamName(match.homeTeam), normalizeTeamName(teamName))) {
    return "home";
  }

  if (matchesTeamReference(normalizeTeamName(match.awayTeam), normalizeTeamName(teamName))) {
    return "away";
  }

  return null;
}

function resolveHistoryResultCode(match, perspective) {
  const scores = String(match.result ?? "")
    .split("-")
    .map((value) => Number.parseInt(value.trim(), 10));

  if (scores.length !== 2 || scores.some((value) => !Number.isInteger(value))) {
    return "neutral";
  }

  const [homeScore, awayScore] = scores;
  if (homeScore === awayScore) {
    return "draw";
  }

  const homeWon = homeScore > awayScore;
  return perspective === "home"
    ? homeWon ? "win" : "loss"
    : homeWon ? "loss" : "win";
}

function formatFormBadgeLabel(value) {
  switch (value) {
    case "win":
      return "V";
    case "draw":
      return "E";
    case "loss":
      return "D";
    default:
      return "—";
  }
}

function renderFixtureDetailLineupSection(view) {
  return `
    <section class="fixture-detail__subsection">
      <h4>Equipa provável</h4>
      ${renderFixtureTeamsHeader(view.homeTeam.identity, view.awayTeam.identity)}
      <div class="fixture-detail__lineup-grid">
        ${renderExpectedLineupCard(view.homeTeam, "home", "left")}
        ${renderExpectedLineupCard(view.awayTeam, "away", "right")}
      </div>
    </section>
  `;
}

function renderExpectedLineupCard(team, side, align = "left") {
  const lineup = team.overview.expectedLineup ?? null;
  const players = Array.isArray(lineup?.players) ? lineup.players.slice(0, 11) : [];

  if (!lineup || players.length === 0) {
    return renderUnavailableLineupCard(side, align);
  }

  const groups = groupExpectedLineupPlayers(players);
  return `
    <article class="fixture-detail__lineup-card fixture-detail__lineup-card--${escapeAttribute(side)}">
      ${
        lineup.formation
          ? `
            <div class="fixture-detail__lineup-card-head">
              <div class="fixture-detail__lineup-card-badges">
                <span class="fixture-detail__badge">${escapeHtml(lineup.formation)}</span>
              </div>
            </div>
          `
          : ""
      }
      <div class="fixture-detail__lineup-field">
        ${groups.map((group) => renderExpectedLineupBand(group.label, group.players, align)).join("")}
      </div>
    </article>
  `;
}

function renderUnavailableLineupCard(side, align = "left") {
  return `
    <article class="fixture-detail__lineup-card fixture-detail__lineup-card--${escapeAttribute(side)}">
      <div class="fixture-detail__lineup-field fixture-detail__lineup-field--${escapeAttribute(align)}">
        <div class="fixture-detail__lineup-empty">n/d</div>
      </div>
    </article>
  `;
}

function renderFixtureDetailFooter(fixture, view) {
  return `
    <footer class="fixture-detail__detail-footer">
      <span>${escapeHtml(`Atualização local da match view: ${view ? formatTimestamp(view.builtAtUtc) : "n/d"}`)}</span>
      <a class="fixture-detail__inline-link" href="${escapeAttribute(fixture.matchUrl)}" target="_blank" rel="noreferrer">Abrir no Sofascore</a>
    </footer>
  `;
}

function renderInlineTeamLogo(existingUrl, teamId, teamName) {
  const logoUrl = buildTeamDisplayLogoUrl(existingUrl, teamId);
  if (logoUrl) {
    return `<img class="fixture-detail__form-team-logo" src="${escapeAttribute(logoUrl)}" alt="${escapeAttribute(teamName)}" loading="lazy" decoding="async" referrerpolicy="no-referrer">`;
  }

  return `<span class="fixture-detail__form-team-logo fixture-detail__form-team-logo--fallback" aria-hidden="true">${escapeHtml(buildTeamInitials(teamName, teamId))}</span>`;
}

function groupExpectedLineupPlayers(players) {
  const order = ["GK", "DEF", "MID", "FWD", "OTHER"];
  const buckets = new Map(order.map((key) => [key, []]));

  for (const player of players) {
    const bucket = normalizeLineupPositionBucket(player.position);
    buckets.get(bucket)?.push(player);
  }

  return order
    .map((key) => ({
      key,
      label:
        key === "GK" ? "Guarda-redes" :
        key === "DEF" ? "Defesa" :
        key === "MID" ? "Meio-campo" :
        key === "FWD" ? "Ataque" : "Outros",
      players: buckets.get(key) ?? [],
    }))
    .filter((group) => group.players.length > 0);
}

function normalizeLineupPositionBucket(position) {
  const token = String(position ?? "").trim().toUpperCase();
  if (!token) {
    return "OTHER";
  }

  if (["GK", "G"].includes(token)) {
    return "GK";
  }

  if (["DEF", "DF", "CB", "LB", "RB", "LWB", "RWB", "WB", "SW"].includes(token)) {
    return "DEF";
  }

  if (["MID", "MF", "CM", "DM", "AM", "LM", "RM", "LDM", "RDM", "CAM", "CDM"].includes(token)) {
    return "MID";
  }

  if (["FWD", "FW", "ST", "CF", "SS", "LW", "RW", "ATT"].includes(token)) {
    return "FWD";
  }

  return "OTHER";
}

function renderExpectedLineupBand(label, players, align = "left") {
  return `
    <div class="fixture-detail__lineup-band">
      <span class="fixture-detail__lineup-band-label">${escapeHtml(label)}</span>
      <div class="fixture-detail__lineup-row fixture-detail__lineup-row--${escapeAttribute(align)}">
        ${players.map((player) => renderExpectedLineupPlayer(player, align)).join("")}
      </div>
    </div>
  `;
}

function renderExpectedLineupPlayer(player, align = "left") {
  return `
    <article class="fixture-detail__lineup-player fixture-detail__lineup-player--${escapeAttribute(align)}" title="${escapeAttribute(player.position ?? "n/d")}">
      ${
        align === "right"
          ? `
            <span class="fixture-detail__lineup-player-rating">${escapeHtml(formatOptionalDecimal(player.rating))}</span>
            <strong>${escapeHtml(player.name)}</strong>
          `
          : `
            <strong>${escapeHtml(player.name)}</strong>
            <span class="fixture-detail__lineup-player-rating">${escapeHtml(formatOptionalDecimal(player.rating))}</span>
          `
      }
    </article>
  `;
}

function renderFixtureDetailAvailabilitySection(view) {
  return `
    <section class="fixture-detail__subsection">
      <h4>Lesionados e suspensos</h4>
      ${renderFixtureTeamsHeader(view.homeTeam.identity, view.awayTeam.identity)}
      <div class="fixture-detail__availability-grid">
        ${renderAvailabilityCard(view.homeTeam, "home")}
        ${renderAvailabilityCard(view.awayTeam, "away")}
      </div>
    </section>
  `;
}

function renderAvailabilityCard(team, side) {
  const squadHealth = team.overview.squadHealth ?? null;
  if (!squadHealth) {
    return renderUnavailableAvailabilityCard(side);
  }

  return `
    <article class="fixture-detail__availability-card fixture-detail__availability-card--${escapeAttribute(side)}">
      <div class="fixture-detail__availability-columns">
        ${renderAvailabilityList("Lesionados", squadHealth.injuries, "Sem lesionados")}
        ${renderAvailabilityList("Suspensos", squadHealth.suspensions, "Sem suspensos")}
      </div>
    </article>
  `;
}

function renderUnavailableAvailabilityCard(side) {
  return `
    <article class="fixture-detail__availability-card fixture-detail__availability-card--${escapeAttribute(side)}">
      <div class="fixture-detail__availability-columns">
        ${renderUnavailableAvailabilityList("Lesionados")}
        ${renderUnavailableAvailabilityList("Suspensos")}
      </div>
    </article>
  `;
}

function renderFixtureTeamsHeader(homeIdentity, awayIdentity) {
  return `
    <div class="fixture-detail__teams-header">
      <div class="fixture-detail__teams-header-side fixture-detail__teams-header-side--left">
        <strong>${escapeHtml(homeIdentity.name)}</strong>
        ${renderInlineTeamLogo(homeIdentity.logoUrl, homeIdentity.id, homeIdentity.name)}
      </div>
      <span class="fixture-detail__teams-header-separator" aria-hidden="true">-</span>
      <div class="fixture-detail__teams-header-side fixture-detail__teams-header-side--right">
        ${renderInlineTeamLogo(awayIdentity.logoUrl, awayIdentity.id, awayIdentity.name)}
        <strong>${escapeHtml(awayIdentity.name)}</strong>
      </div>
    </div>
  `;
}

function renderAvailabilityList(title, entries, emptyLabel) {
  if (!Array.isArray(entries) || entries.length === 0) {
    return `
      <div class="fixture-detail__availability-section">
        <h5>${escapeHtml(title)}</h5>
        <p class="fixture-detail__availability-empty">${escapeHtml(emptyLabel)}</p>
      </div>
    `;
  }

  return `
    <div class="fixture-detail__availability-section">
      <h5>${escapeHtml(title)}</h5>
      <div class="fixture-detail__availability-list">
        ${entries.map((entry) => renderAvailabilityEntry(entry)).join("")}
      </div>
    </div>
  `;
}

function renderUnavailableAvailabilityList(title) {
  return `
    <div class="fixture-detail__availability-section">
      <h5>${escapeHtml(title)}</h5>
      <p class="fixture-detail__availability-empty">n/d</p>
    </div>
  `;
}

function renderAvailabilityEntry(entry) {
  return `
    <article class="fixture-detail__availability-item">
      <strong>${escapeHtml(entry.player)}</strong>
      <span>${escapeHtml(formatHealthEntryReason(entry))}</span>
    </article>
  `;
}

function formatHealthEntryReason(entry) {
  const description = String(entry?.description ?? "").trim();
  if (!description) {
    return "n/d";
  }

  switch (description.toLowerCase()) {
    case "accumulated_cards":
      return "Acumulação de amarelos";
    case "red_card":
      return "Cartão vermelho";
    case "injury":
      return "Lesão";
    case "suspension":
      return "Suspensão";
    default:
      return description.replace(/_/g, " ");
  }
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

function renderDetailHighlights(items) {
  const visibleItems = Array.isArray(items)
    ? items.filter((item) => item && item.label && item.value)
    : [];

  if (visibleItems.length === 0) {
    return "";
  }

  return `
    <div class="fixture-detail__highlights">
      ${visibleItems
        .map((item) => renderDetailHighlight(item.label, item.value, item.tone ?? null))
        .join("")}
    </div>
  `;
}

function renderDetailHighlight(label, value, tone = null) {
  const classes = [
    "fixture-detail__highlight",
    tone ? `fixture-detail__highlight--${tone}` : "",
  ]
    .filter(Boolean)
    .join(" ");

  return `
    <article class="${classes}">
      <span class="fixture-detail__highlight-label">${escapeHtml(label)}</span>
      <strong class="fixture-detail__highlight-value">${escapeHtml(value)}</strong>
    </article>
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

function buildCompetitionGroupKey(selectedDate, fixture) {
  return [
    selectedDate ?? fixture.matchDate ?? "sem-data",
    fixture.countryName ?? "Desconhecido",
    fixture.competitionName ?? "Competição desconhecida",
  ].join("__");
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

function renderStatisticsHero(view) {
  return `
    <section class="fixture-detail__subsection">
      <h4>Resumo estatístico</h4>
      <div class="fixture-detail__highlights fixture-detail__highlights--compact">
        ${renderDetailHighlight("Época", view.match.season?.label ?? "Indisponível", "accent")}
        ${renderDetailHighlight("Casa", view.homeTeam.identity.name)}
        ${renderDetailHighlight("Fora", view.awayTeam.identity.name)}
        ${renderDetailHighlight("Fonte", "Match view manual")}
      </div>
    </section>
  `;
}

function renderSquadPanel(sideLabel, team, side) {
  const players = sortSquadPlayers(team.squad);
  const injuries = team.overview?.squadHealth?.injuries?.length ?? 0;
  const suspensions = team.overview?.squadHealth?.suspensions?.length ?? 0;

  return `
    <article class="fixture-detail__squad-panel fixture-detail__squad-panel--${escapeAttribute(side)}">
      <div class="fixture-detail__squad-panel-head">
        <div>
          <span class="fixture-detail__team-panel-side">${escapeHtml(sideLabel)}</span>
          <h3 class="fixture-detail__team-panel-name">${escapeHtml(team.identity.name)}</h3>
        </div>
        <div class="fixture-detail__squad-panel-badges">
          <span class="fixture-detail__badge">${escapeHtml(`${players.length} jogadores`)}</span>
        </div>
      </div>
      <div class="fixture-detail__highlights fixture-detail__highlights--compact">
        ${renderDetailHighlight("Sistema", fallbackText(team.overview.expectedLineup?.formation))}
        ${renderDetailHighlight("Lesões", String(injuries), injuries > 0 ? "accent" : null)}
        ${renderDetailHighlight("Suspensões", String(suspensions), suspensions > 0 ? "accent" : null)}
        ${renderDetailHighlight("Rating médio XI", formatOptionalDecimal(team.overview.expectedLineup?.averageRating))}
      </div>
      ${
        players.length > 0
          ? `
            <div class="fixture-detail__squad-list">
              <div class="fixture-detail__squad-head">
                <span>Jogador</span>
                <span>Pos</span>
                <span>Id</span>
                <span>J</span>
                <span>G</span>
                <span>Rt</span>
              </div>
              ${players.map((player) => renderSquadPlayerRow(player)).join("")}
            </div>
          `
          : `<p class="fixture-detail__summary-empty">Ainda não existe plantel publicado para esta equipa.</p>`
      }
    </article>
  `;
}

function renderHistoryPanel(sideLabel, team, side) {
  const history = Array.isArray(team.history) ? team.history.slice(0, 6) : [];

  return `
    <article class="fixture-detail__history-panel fixture-detail__history-panel--${escapeAttribute(side)}">
      <div class="fixture-detail__squad-panel-head">
        <div>
          <span class="fixture-detail__team-panel-side">${escapeHtml(sideLabel)}</span>
          <h3 class="fixture-detail__team-panel-name">${escapeHtml(team.identity.name)}</h3>
        </div>
        <div class="fixture-detail__squad-panel-badges">
          <span class="fixture-detail__badge">${escapeHtml(`${history.length} jogos`)}</span>
        </div>
      </div>
      ${renderTeamFormPills(team.headerStats.formLast3)}
      ${
        history.length > 0
          ? `
            <div class="fixture-detail__history-list">
              ${history.map((match) => renderHistoryEntry(match, team.identity.name)).join("")}
            </div>
          `
          : `<p class="fixture-detail__summary-empty">Ainda não existe histórico recente publicado para esta equipa.</p>`
      }
    </article>
  `;
}

function renderHistoryEntry(match, teamName) {
  const opponent = resolveTeamHistoryOpponent(match, teamName);
  const title = opponent ?? `${match.homeTeam} vs ${match.awayTeam}`;
  const meta = [formatHistoryMatchDate(match.date), match.result].filter(Boolean).join(" · ");
  const rating = formatHistoryRating(match, teamName);
  const odds = formatHistoryOdds(match.odds1X2);

  return `
    <article class="fixture-detail__history-row">
      <strong class="fixture-detail__history-title">${escapeHtml(title)}</strong>
      ${meta ? `<span class="fixture-detail__history-meta">${escapeHtml(meta)}</span>` : ""}
      <div class="fixture-detail__history-extras">
        ${rating ? `<span class="fixture-detail__history-pill">${escapeHtml(rating)}</span>` : ""}
        ${odds ? `<span class="fixture-detail__history-pill">${escapeHtml(odds)}</span>` : ""}
      </div>
    </article>
  `;
}

function hasAnyTeamHistory(view) {
  return countHistoryMatches(view.homeTeam.history) > 0 || countHistoryMatches(view.awayTeam.history) > 0;
}

function countHistoryMatches(history) {
  return Array.isArray(history) ? history.length : 0;
}

function renderSquadPlayerRow(player) {
  return `
    <article class="fixture-detail__squad-row">
      <strong class="fixture-detail__squad-player">${escapeHtml(player.name)}</strong>
      <span class="fixture-detail__squad-cell">${escapeHtml(player.position ?? "—")}</span>
      <span class="fixture-detail__squad-cell">${escapeHtml(stringValue(player.age, "—"))}</span>
      <span class="fixture-detail__squad-cell">${escapeHtml(stringValue(player.apps, "—"))}</span>
      <span class="fixture-detail__squad-cell">${escapeHtml(stringValue(player.goals, "—"))}</span>
      <span class="fixture-detail__squad-cell fixture-detail__squad-cell--accent">${escapeHtml(formatOptionalDecimal(player.rating))}</span>
    </article>
  `;
}

function hasAnyTeamSquad(view) {
  return countAvailablePlayers(view.homeTeam.squad) > 0 || countAvailablePlayers(view.awayTeam.squad) > 0;
}

function countAvailablePlayers(players) {
  return Array.isArray(players) ? players.length : 0;
}

function sortSquadPlayers(players) {
  return (Array.isArray(players) ? [...players] : []).sort((left, right) => {
    const ratingDelta = compareNullableNumberDesc(left.rating, right.rating);
    if (ratingDelta !== 0) {
      return ratingDelta;
    }

    const appsDelta = compareNullableNumberDesc(left.apps, right.apps);
    if (appsDelta !== 0) {
      return appsDelta;
    }

    const goalsDelta = compareNullableNumberDesc(left.goals, right.goals);
    if (goalsDelta !== 0) {
      return goalsDelta;
    }

    return String(left.name ?? "").localeCompare(String(right.name ?? ""), "pt");
  });
}

function compareNullableNumberDesc(left, right) {
  const leftNumber = typeof left === "number" ? left : Number.NEGATIVE_INFINITY;
  const rightNumber = typeof right === "number" ? right : Number.NEGATIVE_INFINITY;

  return rightNumber - leftNumber;
}

function renderStatisticsSection(title, metrics, view, blockKey) {
  const rows = metrics
    .map((metric) => buildStatisticsRow(metric, view, blockKey))
    .filter(Boolean);

  if (rows.length === 0) {
    return "";
  }

  return `
    <section class="fixture-detail__subsection">
      <h4>${escapeHtml(title)}</h4>
      <div class="fixture-detail__stats-card">
        <div class="fixture-detail__stats-head">
          <span>${escapeHtml(view.homeTeam.identity.name)}</span>
          <span>Métrica</span>
          <span>${escapeHtml(view.awayTeam.identity.name)}</span>
        </div>
        <div class="fixture-detail__stats-list">
          ${rows.join("")}
        </div>
      </div>
    </section>
  `;
}

function buildStatisticsRow(metric, view, blockKey) {
  const homeValue = view.homeTeam.statistics?.[blockKey]?.[metric.key];
  const awayValue = view.awayTeam.statistics?.[blockKey]?.[metric.key];

  if (homeValue === null || homeValue === undefined) {
    if (awayValue === null || awayValue === undefined) {
      return "";
    }
  }

  const homeDisplay = formatStatisticsValue(homeValue, metric.format);
  const awayDisplay = formatStatisticsValue(awayValue, metric.format);
  const winner = resolveStatisticsWinner(homeValue, awayValue, metric.higherIsBetter);

  return `
    <article class="fixture-detail__stats-row">
      <strong class="fixture-detail__stats-value ${winner === "home" ? "fixture-detail__stats-value--home" : ""}">
        ${escapeHtml(homeDisplay)}
      </strong>
      <span class="fixture-detail__stats-label">${escapeHtml(metric.label)}</span>
      <strong class="fixture-detail__stats-value ${winner === "away" ? "fixture-detail__stats-value--away" : ""}">
        ${escapeHtml(awayDisplay)}
      </strong>
    </article>
  `;
}

function createStatisticsMetric(label, key, format = "decimal", higherIsBetter = true) {
  return { label, key, format, higherIsBetter };
}

function hasAnyTeamStatistics(view) {
  return hasTeamStatistics(view.homeTeam) || hasTeamStatistics(view.awayTeam);
}

function hasTeamStatistics(team) {
  const statistics = team?.statistics ?? null;
  if (!statistics) {
    return false;
  }

  return ["overview", "attack", "defense", "discipline"].some((blockKey) => {
    const block = statistics[blockKey];
    return block && Object.values(block).some((value) => value !== null && value !== undefined);
  });
}

function formatStatisticsValue(value, format = "decimal") {
  if (value === null || value === undefined) {
    return "—";
  }

  switch (format) {
    case "integer":
      return new Intl.NumberFormat("pt-PT", { maximumFractionDigits: 0 }).format(Number(value));
    case "percent":
      return `${Number(value).toFixed(1)}%`;
    case "decimal":
    default:
      return Number(value).toFixed(1);
  }
}

function resolveStatisticsWinner(homeValue, awayValue, higherIsBetter = true) {
  if (
    homeValue === null ||
    homeValue === undefined ||
    awayValue === null ||
    awayValue === undefined
  ) {
    return null;
  }

  const homeNumber = Number(homeValue);
  const awayNumber = Number(awayValue);

  if (!Number.isFinite(homeNumber) || !Number.isFinite(awayNumber) || homeNumber === awayNumber) {
    return null;
  }

  if (higherIsBetter) {
    return homeNumber > awayNumber ? "home" : "away";
  }

  return homeNumber < awayNumber ? "home" : "away";
}

function renderTeamSnapshotPanel(sideLabel, team, side) {
  const badges = buildTeamSnapshotBadges(team);

  return `
    <article class="fixture-detail__team-panel fixture-detail__team-panel--${escapeAttribute(side)}">
      <div class="fixture-detail__team-panel-head">
        <div class="fixture-detail__team-panel-title">
          <span class="fixture-detail__team-panel-side">${escapeHtml(sideLabel)}</span>
          <h3 class="fixture-detail__team-panel-name">${escapeHtml(team.identity.name)}</h3>
        </div>
        ${
          badges.length > 0
            ? `
              <div class="fixture-detail__team-panel-badges">
                ${badges.map((badge) => `<span class="fixture-detail__badge">${escapeHtml(badge)}</span>`).join("")}
              </div>
            `
            : ""
        }
      </div>
      ${renderTeamFormPills(team.headerStats.formLast3)}
      <div class="fixture-detail__team-panel-grid">
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

function buildTeamSnapshotBadges(team) {
  const badges = [];

  if (typeof team.headerStats.overallRating === "number") {
    badges.push(`Rating ${decimalValue(team.headerStats.overallRating)}`);
  }

  if (team.headerStats.nationalRank !== null && team.headerStats.nationalRank !== undefined) {
    badges.push(`Rank nacional ${team.headerStats.nationalRank}`);
  }

  return badges;
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

function formatMatchViewWatchCompact(watch) {
  if (!watch) {
    return "Sem agenda";
  }

  if (watch.hasPortugalChannels) {
    if (Array.isArray(watch.portugalChannels) && watch.portugalChannels.length > 0) {
      if (watch.portugalChannels.length === 1) {
        return watch.portugalChannels[0];
      }

      return `${watch.portugalChannels[0]} +${watch.portugalChannels.length - 1}`;
    }

    return "Cobertura PT";
  }

  return "Sem canais PT";
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

function resolveStandingsZone(standingsContext, position) {
  if (!standingsContext?.competitionId || typeof position !== "number") {
    return null;
  }

  const preset = getStandingsZonePreset(
    standingsContext.competitionId,
    standingsContext.ruleProfileId ?? null,
  );
  return preset.find((zone) => position >= zone.from && position <= zone.to) ?? null;
}

function collectLegendZones(standingsContext, tables) {
  if (!standingsContext?.competitionId) {
    return [];
  }

  const preset = getStandingsZonePreset(
    standingsContext.competitionId,
    standingsContext.ruleProfileId ?? null,
  );
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

function formatHistoryOdds(odds) {
  if (!odds) {
    return null;
  }

  const values = [
    odds.home !== null && odds.home !== undefined ? `1 ${odds.home}` : null,
    odds.draw !== null && odds.draw !== undefined ? `X ${odds.draw}` : null,
    odds.away !== null && odds.away !== undefined ? `2 ${odds.away}` : null,
  ].filter(Boolean);

  return values.length > 0 ? values.join(" · ") : null;
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

function formatOptionalDecimal(value) {
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

  if (matchesTeamReference(normalizedHome, normalizedRow)) {
    return "home";
  }

  if (matchesTeamReference(normalizedAway, normalizedRow)) {
    return "away";
  }

  return null;
}

function normalizeTeamName(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function matchesTeamReference(expectedValue, candidateValue) {
  const expectedToken = normalizeTeamName(expectedValue);
  const candidateToken = normalizeTeamName(candidateValue);

  if (!expectedToken || !candidateToken) {
    return false;
  }

  const expectedCompact = compactTeamName(expectedToken);
  const candidateCompact = compactTeamName(candidateToken);

  if (
    expectedCompact === candidateCompact ||
    (expectedCompact.length >= 6 && candidateCompact.includes(expectedCompact)) ||
    (candidateCompact.length >= 6 && expectedCompact.includes(candidateCompact))
  ) {
    return true;
  }

  const expectedParts = tokenizeTeamName(expectedToken);
  const candidateParts = tokenizeTeamName(candidateToken);

  return (
    tokensCoverReference(expectedParts, candidateParts) ||
    tokensCoverReference(candidateParts, expectedParts)
  );
}

function compactTeamName(value) {
  return normalizeTeamName(value).replace(/\s+/g, "");
}

function tokenizeTeamName(value) {
  return normalizeTeamName(value)
    .split(" ")
    .map((token) => token.trim())
    .filter(Boolean)
    .filter((token) => !TEAM_NAME_STOPWORDS.has(token));
}

function tokensCoverReference(referenceParts, candidateParts) {
  if (!referenceParts.length || !candidateParts.length) {
    return false;
  }

  return referenceParts.every((referencePart) =>
    candidateParts.some((candidatePart) => tokensRoughlyMatch(referencePart, candidatePart)),
  );
}

function tokensRoughlyMatch(left, right) {
  if (left === right) {
    return true;
  }

  const shorter = left.length <= right.length ? left : right;
  const longer = left.length <= right.length ? right : left;

  if (shorter.length >= 3 && longer.startsWith(shorter)) {
    return true;
  }

  return shorter.length >= 5 && longer.includes(shorter);
}

const TEAM_NAME_STOPWORDS = new Set([
  "ac",
  "afc",
  "athletic",
  "atletico",
  "ca",
  "cd",
  "cf",
  "club",
  "cp",
  "fc",
  "fk",
  "foot",
  "football",
  "futebol",
  "if",
  "sc",
  "sd",
  "sv",
  "the",
  "ud",
]);

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
