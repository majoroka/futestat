const summaryEl = document.querySelector("[data-fixture-summary]");
const datesEl = document.querySelector("[data-date-filters]");
const groupsEl = document.querySelector("[data-fixture-groups]");
const stateEl = document.querySelector("[data-fixture-state]");

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

  renderSummary();
  renderDateFilters();
  renderFixtures();
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
      renderDateFilters();
      renderFixtures();
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
}

function renderCompetitionGroup(group) {
  const fixtureCards = group.fixtures
    .sort((left, right) => left.kickoffAtUtc.localeCompare(right.kickoffAtUtc))
    .map(
      (fixture) => `
        <article class="fixture-card">
          <div class="fixture-card__meta">
            <span>${formatKickoff(fixture.kickoffAtUtc)}</span>
            <span>UTC</span>
          </div>
          <div class="fixture-card__teams">
            <strong>${escapeHtml(fixture.homeTeamName)}</strong>
            <span class="fixture-card__vs">vs</span>
            <strong>${escapeHtml(fixture.awayTeamName)}</strong>
          </div>
          <a class="fixture-card__link" href="${fixture.matchUrl}" target="_blank" rel="noreferrer">
            Open match page
          </a>
        </article>
      `,
    )
    .join("");

  return `
    <section class="competition-group">
      <header class="competition-group__header">
        <p>${escapeHtml(group.countryName)}</p>
        <h3>${escapeHtml(group.competitionName)}</h3>
      </header>
      <div class="competition-group__fixtures">
        ${fixtureCards}
      </div>
    </section>
  `;
}

function renderError(message) {
  if (stateEl) {
    stateEl.textContent = message;
  }

  if (groupsEl) {
    groupsEl.innerHTML = "";
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
