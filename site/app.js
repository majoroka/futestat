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
  detailCache: new Map(),
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

  const detailState = state.detailCache.get(fixture.sourceEventId) ?? null;
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
          ? renderFixtureStandingsTab(fixture, detailState)
          : renderFixtureDetailsTab(fixture, detailState)
      }
    </section>
  `;

  bindFixtureDetailTabs();

  if (!detailState) {
    void loadFixtureDetail(fixture);
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

function renderFixtureDetailsTab(fixture, detailState) {
  const detail = detailState?.status === "loaded" ? detailState.data : null;
  const rows = [
    detailInfoRow("Data e hora", formatDetailDateTime(fixture, detail)),
    detailInfoRow("Competição", formatCompetitionSummary(fixture, detail)),
    detailInfoRow("Recinto", detail?.overview?.venueName ?? "Por publicar"),
    detailInfoRow("Localização", formatLocation(detail?.overview) ?? "Por publicar"),
    detailInfoRow("Árbitro", formatReferee(detail?.overview) ?? "Por publicar"),
  ].join("");

  return `
    <div class="fixture-detail__info-list">
      ${rows}
    </div>
    ${renderDetailStateNote(detailState, "details")}
  `;
}

function renderFixtureStandingsTab(fixture, detailState) {
  if (detailState?.status === "loaded" && Array.isArray(detailState.data?.standings) && detailState.data.standings.length > 0) {
    return `
      <div class="fixture-detail__standings">
        ${detailState.data.standings.map((table) => renderStandingsTable(table)).join("")}
      </div>
      ${renderDetailStateNote(detailState, "standings")}
    `;
  }

  const message =
    detailState?.status === "loading"
      ? "A carregar classificação..."
      : "Classificação indisponível para este jogo ou competição.";

  return `
    <p class="fixture-detail__empty">${escapeHtml(message)}</p>
    ${renderDetailStateNote(detailState, "standings")}
  `;
}

function renderStandingsTable(table) {
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
        ${table.rows.map((row) => renderStandingsRow(row)).join("")}
      </div>
    </section>
  `;
}

function renderStandingsRow(row) {
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

function detailInfoRow(label, value) {
  return `
    <article class="fixture-detail__info-item">
      <span class="fixture-detail__info-label">${escapeHtml(label)}</span>
      <strong class="fixture-detail__info-value">${escapeHtml(value)}</strong>
    </article>
  `;
}

function renderDetailStateNote(detailState, tab) {
  if (detailState?.status === "loading") {
    return tab === "details"
      ? '<p class="fixture-detail__note">A carregar detalhe adicional do jogo...</p>'
      : "";
  }

  if (detailState?.status === "error") {
    return '<p class="fixture-detail__note">Falhou o carregamento do detalhe adicional deste jogo. A base atual continua disponível.</p>';
  }

  if (detailState?.status === "missing") {
    return '<p class="fixture-detail__note">Este jogo ainda não tem detalhe adicional publicado.</p>';
  }

  return "";
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

async function loadFixtureDetail(fixture) {
  if (state.detailCache.get(fixture.sourceEventId)?.status === "loading") {
    return;
  }

  state.detailCache.set(fixture.sourceEventId, { status: "loading" });
  if (state.selectedFixtureId === fixture.sourceEventId) {
    renderFixtureDetail();
  }

  try {
    const response = await fetch(`./fixtures/details/${fixture.sourceEventId}.json`, {
      cache: "no-store",
    });

    if (response.status === 404) {
      state.detailCache.set(fixture.sourceEventId, { status: "missing", data: null });
    } else if (!response.ok) {
      throw new Error(`Detalhe indisponível (${response.status})`);
    } else {
      state.detailCache.set(fixture.sourceEventId, {
        status: "loaded",
        data: await response.json(),
      });
    }
  } catch (error) {
    state.detailCache.set(fixture.sourceEventId, {
      status: "error",
      data: null,
      error,
    });
  }

  if (state.selectedFixtureId === fixture.sourceEventId) {
    renderFixtureDetail();
  }
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

  const date = new Date(fixture.kickoffAtUtc);
  return Number.isNaN(date.getTime())
    ? fixture.matchDate
    : new Intl.DateTimeFormat("pt-PT", {
        day: "2-digit",
        month: "long",
        year: "numeric",
        timeZone: displayTimeZone,
      }).format(date);
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

function formatDetailDateTime(fixture, detail) {
  const kickoffValue = detail?.overview?.kickoffAtUtc ?? fixture.kickoffAtUtc;
  if (!kickoffValue) {
    return fixture.matchDate;
  }

  const date = new Date(kickoffValue);
  return Number.isNaN(date.getTime())
    ? kickoffValue
    : new Intl.DateTimeFormat("pt-PT", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: displayTimeZone,
      })
        .format(date)
        .replace(", ", " · ");
}

function formatCompetitionSummary(fixture, detail) {
  const competitionName = detail?.overview?.competitionName ?? fixture.competitionName ?? "Competição desconhecida";
  const stage = detail?.overview?.competitionStage ?? null;
  const tieFormat = formatTieFormat(detail?.tieContext?.tieFormat ?? null);

  return `Futebol, ${[competitionName, stage].filter(Boolean).join(", ")}${tieFormat ? ` - ${tieFormat}` : ""}`;
}

function formatTieFormat(value) {
  if (value === "Two legs") {
    return "Duas mãos";
  }

  return value;
}

function formatLocation(overview) {
  const parts = [overview?.venueCity, overview?.venueCountry].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : null;
}

function formatReferee(overview) {
  if (!overview?.refereeName) {
    return null;
  }

  return [overview.refereeName, overview.refereeCountry].filter(Boolean).join(", ");
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
