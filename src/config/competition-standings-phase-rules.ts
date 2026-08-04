import type { CompetitionStandingsSourceStatus } from "../domain/competition-standings.js";

export interface CompetitionStandingsPhaseRule {
  matchPhaseIds?: string[];
  matchPhaseNames?: string[];
  matchTableNames?: string[];
  status?: CompetitionStandingsSourceStatus;
  phaseNotes?: string[];
  ruleProfileId?: string | null;
}

export interface CompetitionStandingsPhaseAwareConfig {
  status: CompetitionStandingsSourceStatus;
  defaultPhaseNotes?: string[];
  defaultRuleProfileId?: string | null;
  phaseRules?: CompetitionStandingsPhaseRule[];
}

export interface ResolvedCompetitionStandingsPhaseMetadata {
  status: CompetitionStandingsSourceStatus;
  phaseNotes: string[];
  ruleProfileId: string | null;
}

export function resolveCompetitionStandingsPhaseMetadata(
  config: CompetitionStandingsPhaseAwareConfig,
  context: {
    phaseId: string | null;
    phaseName: string | null;
    tableNames: string[];
  },
): ResolvedCompetitionStandingsPhaseMetadata {
  const rule =
    config.phaseRules?.find((candidate) => phaseRuleMatches(candidate, context)) ?? null;

  const notes = dedupeStrings([
    ...(config.defaultPhaseNotes ?? []),
    ...(rule?.phaseNotes ?? []),
  ]);

  return {
    status: rule?.status ?? config.status,
    phaseNotes: notes,
    ruleProfileId: rule?.ruleProfileId ?? config.defaultRuleProfileId ?? null,
  };
}

function phaseRuleMatches(
  rule: CompetitionStandingsPhaseRule,
  context: {
    phaseId: string | null;
    phaseName: string | null;
    tableNames: string[];
  },
): boolean {
  const hasMatchers =
    (rule.matchPhaseIds?.length ?? 0) > 0 ||
    (rule.matchPhaseNames?.length ?? 0) > 0 ||
    (rule.matchTableNames?.length ?? 0) > 0;

  if (!hasMatchers) {
    return false;
  }

  if (
    rule.matchPhaseIds?.length &&
    context.phaseId &&
    rule.matchPhaseIds.includes(context.phaseId)
  ) {
    return true;
  }

  const normalizedPhaseName = normalizeToken(context.phaseName);
  if (
    rule.matchPhaseNames?.length &&
    normalizedPhaseName &&
    rule.matchPhaseNames.some((candidate) => normalizedPhaseName.includes(normalizeToken(candidate)))
  ) {
    return true;
  }

  if (rule.matchTableNames?.length) {
    const normalizedTableNames = context.tableNames
      .map((value) => normalizeToken(value))
      .filter(Boolean);

    if (
      normalizedTableNames.some((tableName) =>
        rule.matchTableNames?.some((candidate) => tableName.includes(normalizeToken(candidate))),
      )
    ) {
      return true;
    }
  }

  return false;
}

function normalizeToken(value: string | null | undefined): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .toLowerCase();
}

function dedupeStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const items: string[] = [];

  for (const value of values) {
    const normalized = value.trim();
    if (!normalized) {
      continue;
    }

    const key = normalized.toLocaleLowerCase("pt-PT");
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    items.push(normalized);
  }

  return items;
}
