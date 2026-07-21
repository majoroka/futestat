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
  state.selectedDate = state.snapshot.datesScraped[0] ?? null;
  state.selectedFixtureId =
    state.snapshot.fixtures.find((fixture) => fixture.scrapeDate === state.selectedDate)
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

  const dates = state.snapshot.datesScraped.join(", ");
  summaryEl.innerHTML = [
    metricCard("Jogos agendados", String(state.snapshot.fixtureCount)),
    metricCard("Datas recolhidas", dates || "Nenhuma"),
    metricCard("Snapshot", formatTimestamp(state.snapshot.scrapedAtUtc)),
  ].join("");
}

function renderDateFilters() {
  if (!state.snapshot || !datesEl) {
    return;
  }

  datesEl.innerHTML = "";

  for (const date of state.snapshot.datesScraped) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = date === state.selectedDate ? "chip chip--active" : "chip";
    button.textContent = date;
    button.addEventListener("click", () => {
      state.selectedDate = date;
      state.selectedFixtureId =
        state.snapshot.fixtures.find((fixture) => fixture.scrapeDate === date)?.sourceEventId ??
        null;
      renderDateFilters();
      renderFixtures();
      renderFixtureDetail();
    });
    datesEl.appendChild(button);
  }
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

  const fixtures = state.snapshot.fixtures.filter(
    (fixture) => fixture.scrapeDate === state.selectedDate,
  );

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
    .sort((left, right) => left.kickoffAtUtc.localeCompare(right.kickoffAtUtc))
    .map(
      (fixture) => `
        <article class="fixture-card ${fixture.sourceEventId === state.selectedFixtureId ? "fixture-card--selected" : ""}" data-fixture-id="${fixture.sourceEventId}">
          <div class="fixture-card__meta">
            <span>${formatKickoffTime(fixture.kickoffAtUtc)}</span>
          </div>
          <div class="fixture-card__teams">
            <strong>${escapeHtml(fixture.homeTeamName)}</strong>
            <span class="fixture-card__vs">vs</span>
            <strong>${escapeHtml(fixture.awayTeamName)}</strong>
          </div>
          <button class="fixture-card__action" type="button">Ver</button>
        </article>
      `,
    )
    .join("");

  return `
    <details class="competition-group" open>
      <summary class="competition-group__summary">
        <span class="competition-group__summary-copy">
          <span class="competition-group__country">${escapeHtml(group.countryName)}</span>
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

  detailEl.innerHTML = `
    <p class="fixture-detail__eyebrow">Painel do jogo</p>
    <h2>${escapeHtml(fixture.homeTeamName)} vs ${escapeHtml(fixture.awayTeamName)}</h2>
    <div class="fixture-detail__stack">
      <div class="fixture-detail__row">
        <span>Hora</span>
        <strong>${formatKickoff(fixture.kickoffAtUtc)}</strong>
      </div>
      <div class="fixture-detail__row">
        <span>Competição</span>
        <strong>${escapeHtml(fixture.competitionName ?? "Competição desconhecida")}</strong>
      </div>
      <div class="fixture-detail__row">
        <span>País</span>
        <strong>${escapeHtml(fixture.countryName ?? "Desconhecido")}</strong>
      </div>
      <div class="fixture-detail__row">
        <span>ID do evento</span>
        <strong>${escapeHtml(fixture.sourceEventId)}</strong>
      </div>
    </div>
    <p class="fixture-detail__note">
      Esta coluna da direita fica reservada para informação mais rica do jogo na próxima fase.
    </p>
    <a class="fixture-detail__link" href="${fixture.matchUrl}" target="_blank" rel="noreferrer">
      Abrir página do jogo
    </a>
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

function formatTimestamp(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : formatter.format(date);
}

function buildFixtureStateCopy(count, date) {
  return `${count} upcoming fixtures for ${date} - Hora de Lisboa`;
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

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
