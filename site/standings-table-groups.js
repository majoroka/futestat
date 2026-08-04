export function buildStandingsTableLayout(tables, fixture) {
  const candidates = Array.isArray(tables)
    ? tables.map((table, index) => analyzeStandingsTable(table, fixture, index))
    : [];

  if (candidates.length <= 1) {
    return {
      summary: null,
      primaryTables: candidates.map(toPresentationTable),
      secondaryTables: [],
    };
  }

  const sharedTable = candidates.find((candidate) => candidate.coverage === "both") ?? null;
  if (sharedTable) {
    return {
      summary: "As duas equipas pertencem à mesma tabela nesta fase.",
      primaryTables: [
        toPresentationTable(sharedTable, "Tabela do jogo", "shared"),
      ],
      secondaryTables: candidates
        .filter((candidate) => candidate !== sharedTable)
        .map((candidate) => toPresentationTable(candidate)),
    };
  }

  const homeTable = candidates.find((candidate) => candidate.coverage === "home") ?? null;
  const awayTable = candidates.find((candidate) => candidate.coverage === "away") ?? null;

  if (homeTable || awayTable) {
    const primaryTables = [];
    const consumedIndexes = new Set();

    if (homeTable) {
      primaryTables.push(toPresentationTable(homeTable, "Grupo da equipa da casa", "home"));
      consumedIndexes.add(homeTable.index);
    }

    if (awayTable && !consumedIndexes.has(awayTable.index)) {
      primaryTables.push(toPresentationTable(awayTable, "Grupo da equipa visitante", "away"));
      consumedIndexes.add(awayTable.index);
    }

    return {
      summary:
        homeTable && awayTable && homeTable.index !== awayTable.index
          ? "As equipas aparecem em grupos ou tabelas diferentes nesta fase."
          : "Foi destacada a tabela mais próxima do jogo nesta fase.",
      primaryTables,
      secondaryTables: candidates
        .filter((candidate) => !consumedIndexes.has(candidate.index))
        .map((candidate) => toPresentationTable(candidate)),
    };
  }

  return {
    summary: "Existem várias tabelas nesta fase e não foi possível identificar automaticamente a mais relevante para este jogo.",
    primaryTables: [toPresentationTable(candidates[0], "Tabela principal da fase", "fallback")],
    secondaryTables: candidates.slice(1).map((candidate) => toPresentationTable(candidate)),
  };
}

function analyzeStandingsTable(table, fixture, index) {
  const rows = Array.isArray(table?.rows) ? table.rows : [];
  const homeToken = normalizeTeamName(fixture?.homeTeamName);
  const awayToken = normalizeTeamName(fixture?.awayTeamName);

  let hasHome = false;
  let hasAway = false;

  for (const row of rows) {
    const rowToken = normalizeTeamName(row?.teamName);
    if (!rowToken) {
      continue;
    }

    if (homeToken && rowToken === homeToken) {
      hasHome = true;
    }

    if (awayToken && rowToken === awayToken) {
      hasAway = true;
    }
  }

  return {
    table,
    index,
    coverage: hasHome && hasAway ? "both" : hasHome ? "home" : hasAway ? "away" : "none",
  };
}

function toPresentationTable(candidate, badge = null, role = null) {
  return {
    ...candidate.table,
    badge,
    role,
  };
}

function normalizeTeamName(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "")
    .toLowerCase();
}
