export function buildStandingsTableLayout(tables, fixture, context = {}) {
  const candidates = Array.isArray(tables)
    ? tables.map((table, index) => analyzeStandingsTable(table, fixture, index, context))
        .sort(compareStandingsTableCandidates)
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

function analyzeStandingsTable(table, fixture, index, context) {
  const rows = Array.isArray(table?.rows) ? table.rows : [];
  const homeToken = normalizeTeamName(fixture?.homeTeamName);
  const awayToken = normalizeTeamName(fixture?.awayTeamName);
  const tableName = normalizeTeamName(table?.name);

  let hasHome = false;
  let hasAway = false;

  for (const row of rows) {
    const rowToken = normalizeTeamName(row?.teamName);
    if (!rowToken) {
      continue;
    }

    if (matchesTeamReference(homeToken, rowToken)) {
      hasHome = true;
    }

    if (matchesTeamReference(awayToken, rowToken)) {
      hasAway = true;
    }
  }

  return {
    table,
    index,
    coverage: hasHome && hasAway ? "both" : hasHome ? "home" : hasAway ? "away" : "none",
    relevance: scoreTableRelevance(tableName, context?.ruleProfileId),
  };
}

function scoreTableRelevance(tableName, ruleProfileId) {
  if (!tableName || !ruleProfileId) {
    return 0;
  }

  const profiles = {
    "regular-season-before-split": ["campeonato", "classificacao", "fase regular", "regular"],
    "league-phase": ["league", "liga", "classificacao", "campeonato"],
    "group-stage": ["grupo", "serie", "série"],
    "arg-group-stage": ["grupo", "zona"],
    "championship-round": ["championship", "campeao", "campeão", "titulo", "title"],
    "title-round": ["title", "titulo", "campeao", "campeão"],
    "qualification-round": ["qualification", "qualificacao", "qualificação", "europe", "europ"],
    "europe-round": ["europe", "europ"],
    "relegation-round": ["relegation", "despromoc", "manutenc", "playout", "play out"],
  };

  const candidates = profiles[ruleProfileId] ?? [];
  return candidates.reduce((best, candidate) => {
    const normalizedCandidate = normalizeTeamName(candidate);
    if (!normalizedCandidate) {
      return best;
    }
    if (tableName.includes(normalizedCandidate)) {
      return Math.max(best, normalizedCandidate.length);
    }
    return best;
  }, 0);
}

function compareStandingsTableCandidates(left, right) {
  return (
    coveragePriority(right.coverage) - coveragePriority(left.coverage) ||
    right.relevance - left.relevance ||
    left.index - right.index
  );
}

function coveragePriority(coverage) {
  switch (coverage) {
    case "both":
      return 3;
    case "home":
    case "away":
      return 2;
    default:
      return 1;
  }
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
