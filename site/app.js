const summaryEl = document.querySelector("[data-fixture-summary]");
const datesEl = document.querySelector("[data-date-filters]");
const groupsEl = document.querySelector("[data-fixture-groups]");
const stateEl = document.querySelector("[data-fixture-state]");
const detailEl = document.querySelector("[data-fixture-detail]");

const formatter = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "UTC",
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
    throw new Error(`Fixtures snapshot unavailable (${response.status}).`);
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
    metricCard("Upcoming fixtures", String(state.snapshot.fixtureCount)),
    metricCard("Dates scraped", dates || "None"),
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
    stateEl.textContent = "No fixture snapshot available yet.";
    groupsEl.innerHTML = "";
    return;
  }

  const fixtures = state.snapshot.fixtures.filter(
    (fixture) => fixture.scrapeDate === state.selectedDate,
  );

  if (fixtures.length === 0) {
    stateEl.textContent = `No upcoming fixtures found for ${state.selectedDate}.`;
    groupsEl.innerHTML = "";
    return;
  }

  if (!fixtures.some((fixture) => fixture.sourceEventId === state.selectedFixtureId)) {
    state.selectedFixtureId = fixtures[0]?.sourceEventId ?? null;
  }

  stateEl.textContent = `${fixtures.length} upcoming fixtures for ${state.selectedDate}.`;

  const byCompetition = new Map();
  for (const fixture of fixtures) {
    const key = `${fixture.countryName ?? "Unknown"}__${fixture.competitionName ?? "Unknown"}`;
    const group = byCompetition.get(key) ?? {
      countryName: fixture.countryName ?? "Unknown",
      competitionName: fixture.competitionName ?? "Unknown competition",
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
            <span>${formatKickoff(fixture.kickoffAtUtc)}</span>
            <span>UTC</span>
          </div>
          <div class="fixture-card__teams">
            <strong>${escapeHtml(fixture.homeTeamName)}</strong>
            <span class="fixture-card__vs">vs</span>
            <strong>${escapeHtml(fixture.awayTeamName)}</strong>
          </div>
          <button class="fixture-card__action" type="button">View</button>
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
      <p class="fixture-detail__eyebrow">Match panel</p>
      <h2>Fixture details</h2>
      <p class="fixture-detail__empty">
        Select a fixture from the left column. This area is reserved for match details in future iterations.
      </p>
    `;
    return;
  }

  detailEl.innerHTML = `
    <p class="fixture-detail__eyebrow">Match panel</p>
    <h2>${escapeHtml(fixture.homeTeamName)} vs ${escapeHtml(fixture.awayTeamName)}</h2>
    <div class="fixture-detail__stack">
      <div class="fixture-detail__row">
        <span>Kickoff</span>
        <strong>${formatKickoff(fixture.kickoffAtUtc)} UTC</strong>
      </div>
      <div class="fixture-detail__row">
        <span>Competition</span>
        <strong>${escapeHtml(fixture.competitionName ?? "Unknown competition")}</strong>
      </div>
      <div class="fixture-detail__row">
        <span>Country</span>
        <strong>${escapeHtml(fixture.countryName ?? "Unknown")}</strong>
      </div>
      <div class="fixture-detail__row">
        <span>Event ID</span>
        <strong>${escapeHtml(fixture.sourceEventId)}</strong>
      </div>
    </div>
    <p class="fixture-detail__note">
      This right column is the reserved slot for richer match information in the next phase.
    </p>
    <a class="fixture-detail__link" href="${fixture.matchUrl}" target="_blank" rel="noreferrer">
      Open match page
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

function formatKickoff(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("en-GB", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "UTC",
      }).format(date);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
