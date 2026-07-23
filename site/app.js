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
    <section class="fixture-detail__section">
      <h3>Pré-jogo</h3>
      ${
        renderFixturePreMatchSection(fixture, detailState?.status === "loaded" ? detailState.data : null) ??
        '<p class="fixture-detail__empty">Ainda sem detalhe adicional publicado para este jogo.</p>'
      }
    </section>
    ${
      detailState?.status === "loaded" && detailState.data.tieContext
        ? `
    <section class="fixture-detail__section">
      <h3>Eliminatória e confronto</h3>
      ${renderFixtureTieContext(detailState.data.tieContext)}
    </section>
    `
        : ""
    }
    ${
      detailState?.status === "loaded"
        ? `
    <section class="fixture-detail__section">
      <h3>Contexto das equipas</h3>
      ${renderFixtureRecentContext(detailState.data.recent)}
    </section>
    `
        : ""
    }
    <section class="fixture-detail__section">
      <h3>Recolha</h3>
      <div class="fixture-detail__stack">
        <div class="fixture-detail__row">
          <span>Primeira deteção</span>
          <strong>${escapeHtml(formatTimestamp(fixture.firstSeenAtUtc))}</strong>
        </div>
        <div class="fixture-detail__row">
          <span>Última deteção</span>
          <strong>${escapeHtml(formatTimestamp(fixture.lastSeenAtUtc))}</strong>
        </div>
        <div class="fixture-detail__row">
          <span>Última alteração</span>
          <strong>${escapeHtml(formatTimestamp(fixture.lastChangedAtUtc))}</strong>
        </div>
      </div>
    </section>
    <section class="fixture-detail__section">
      <h3>Identificação</h3>
      <div class="fixture-detail__stack">
        <div class="fixture-detail__row">
          <span>ID do evento</span>
          <strong>${escapeHtml(fixture.sourceEventId)}</strong>
        </div>
        <div class="fixture-detail__row">
          <span>Fonte</span>
          <strong>${escapeHtml(fixture.source)}</strong>
        </div>
        <div class="fixture-detail__row">
          <span>Link</span>
          <strong class="fixture-detail__value-link">
            <a class="fixture-detail__inline-link" href="${fixture.matchUrl}" target="_blank" rel="noreferrer">Abrir no Sofascore</a>
          </strong>
        </div>
      </div>
    </section>
    ${
      detailState?.status === "loading"
        ? '<p class="fixture-detail__note">A carregar detalhe adicional do jogo...</p>'
        : detailState?.status === "error"
          ? '<p class="fixture-detail__note">Falhou o carregamento do detalhe adicional deste jogo. O snapshot base continua disponível.</p>'
          : detailState?.status === "missing"
            ? '<p class="fixture-detail__note">Este jogo ainda não tem detalhe adicional publicado. A base atual continua disponível.</p>'
            : '<p class="fixture-detail__note">Odds 1/X/2 já podem ser recolhidas nesta fase, mas a colocação na coluna esquerda fica para o próximo ajuste de layout.</p>'
    }
    <a class="fixture-detail__link" href="${fixture.matchUrl}" target="_blank" rel="noreferrer">
      Abrir página do jogo
    </a>
  `;

  if (fixture.status === "upcoming" && !detailState) {
    void loadFixtureDetail(fixture);
  }
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

function renderFixturePreMatchSection(fixture, detail) {
  if (!detail) {
    return null;
  }

  const rows = [
    detail.overview?.competitionStage ? detailRow("Ronda", detail.overview.competitionStage) : "",
    detail.tieContext?.tieFormat ? detailRow("Formato", detail.tieContext.tieFormat) : "",
    detail.overview?.venueName ? detailRow("Estádio", detail.overview.venueName) : "",
    detail.overview?.venueCity || detail.overview?.venueCountry
      ? detailRow(
          "Localização",
          [detail.overview.venueCity, detail.overview.venueCountry].filter(Boolean).join(", "),
        )
      : "",
    detail.overview?.refereeName ? detailRow("Árbitro", detail.overview.refereeName) : "",
    detail.watch?.note ? detailRow("TV", detail.watch.note) : "",
  ]
    .filter(Boolean)
    .join("");

  return rows ? `<div class="fixture-detail__stack">${rows}</div>` : null;
}

function renderFixtureTieContext(tieContext) {
  const blocks = [];

  if (tieContext.previousLeg) {
    blocks.push(renderRelatedMatchCard("Jogo anterior", tieContext.previousLeg));
  }

  if (tieContext.nextLeg) {
    blocks.push(renderRelatedMatchCard("Jogo seguinte", tieContext.nextLeg));
  }

  if (Array.isArray(tieContext.h2h) && tieContext.h2h.length > 0) {
    blocks.push(`
      <div class="fixture-detail__subsection">
        <h4>H2H</h4>
        <div class="fixture-detail__mini-list">
          ${tieContext.h2h.slice(0, 4).map((match) => renderMiniMatchRow(match)).join("")}
        </div>
      </div>
    `);
  }

  return blocks.join("");
}

function renderFixtureRecentContext(recent) {
  const sections = [
    renderRecentGroup("Casa · últimos jogos", recent.homeLast),
    renderRecentGroup("Casa · próximos jogos", recent.homeNext),
    renderRecentGroup("Fora · últimos jogos", recent.awayLast),
    renderRecentGroup("Fora · próximos jogos", recent.awayNext),
  ].filter(Boolean);

  return sections.join("");
}

function renderRecentGroup(title, matches) {
  if (!Array.isArray(matches) || matches.length === 0) {
    return "";
  }

  return `
    <div class="fixture-detail__subsection">
      <h4>${escapeHtml(title)}</h4>
      <div class="fixture-detail__mini-list">
        ${matches.map((match) => renderMiniMatchRow(match)).join("")}
      </div>
    </div>
  `;
}

function renderRelatedMatchCard(title, match) {
  return `
    <div class="fixture-detail__subsection">
      <h4>${escapeHtml(title)}</h4>
      <div class="fixture-detail__mini-list">
        ${renderMiniMatchRow(match)}
      </div>
    </div>
  `;
}

function renderMiniMatchRow(match) {
  const score = match.homeScore !== null && match.awayScore !== null
    ? `${match.homeScore} - ${match.awayScore}${match.resultLabel ? ` (${match.resultLabel})` : ""}`
    : "Sem resultado";
  const kickoff = match.kickoffAtUtc ? formatKickoff(match.kickoffAtUtc) : "Sem hora";
  const competition = [match.competitionName, match.roundName].filter(Boolean).join(" · ");

  return `
    <div class="fixture-detail__mini-row">
      <span class="fixture-detail__mini-meta">${escapeHtml(kickoff)}</span>
      <strong>${escapeHtml(`${match.homeTeamName} vs ${match.awayTeamName}`)}</strong>
      <span class="fixture-detail__mini-copy">${escapeHtml(score)}</span>
      ${competition ? `<span class="fixture-detail__mini-copy">${escapeHtml(competition)}</span>` : ""}
    </div>
  `;
}

function detailRow(label, value) {
  return `
    <div class="fixture-detail__row">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
    </div>
  `;
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
