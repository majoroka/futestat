const NON_DISTINCTIVE_TOKENS = new Set([
  "ac",
  "afc",
  "and",
  "athletic",
  "atletico",
  "bk",
  "ca",
  "cd",
  "cf",
  "club",
  "cp",
  "csa",
  "de",
  "del",
  "deportivo",
  "do",
  "e",
  "el",
  "fc",
  "fk",
  "football",
  "fotball",
  "futebol",
  "if",
  "il",
  "jk",
  "la",
  "las",
  "los",
  "nk",
  "sc",
  "sd",
  "sk",
  "sv",
  "the",
  "ud",
  "y",
]);

const STRUCTURAL_TOKENS = new Set([
  "a",
  "b",
  "ii",
  "iii",
  "iv",
  "u17",
  "u18",
  "u19",
  "u20",
  "u21",
  "u23",
  "w",
  "women",
  "woman",
  "female",
  "feminino",
  "feminina",
  "reserves",
  "reserve",
]);

const TOKEN_ALIASES = new Map<string, string>([
  ["afs", "avs"],
  ["def", "defensa"],
  ["dep", "deportivo"],
  ["dinamo", "dynamo"],
  ["epicenter", "epicentr"],
  ["epitsentr", "epicentr"],
  ["est", "estrela"],
  ["ind", "independiente"],
  ["int", "internacional"],
  ["jr", "juniors"],
  ["jrs", "juniors"],
  ["kharkov", "kharkiv"],
  ["mg", "mineiro"],
  ["moskva", "moscow"],
  ["rb", "redbull"],
  ["st", "saint"],
  ["tolyatti", "togliatti"],
  ["u", "universitatea"],
  ["utd", "united"],
  ["zorya", "zoria"],
]);

export type TeamNameMatchMethod = "normalized_name" | "heuristic_name";

export interface TeamNameProfile {
  strict: string;
  canonicalCompact: string;
  canonicalTokens: string[];
  distinctiveTokens: string[];
  structuralTokens: string[];
}

export interface TeamNameMatchCandidate<TCandidate> {
  candidate: TCandidate;
  name: string;
}

export interface TeamNameMatchResult<TCandidate> {
  candidate: TCandidate;
  matchMethod: TeamNameMatchMethod;
  score: number;
  reasons: string[];
}

export function normalizeTeamName(value: string | null | undefined): string {
  return String(value ?? "")
    .replaceAll("ø", "o")
    .replaceAll("Ø", "O")
    .replaceAll("ö", "o")
    .replaceAll("Ö", "O")
    .replaceAll("ä", "a")
    .replaceAll("Ä", "A")
    .replaceAll("å", "a")
    .replaceAll("Å", "A")
    .replaceAll("æ", "ae")
    .replaceAll("Æ", "AE")
    .replaceAll("ü", "u")
    .replaceAll("Ü", "U")
    .replaceAll("ß", "ss")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export function buildTeamNameProfile(value: string): TeamNameProfile {
  const strict = normalizeTeamName(value);
  const canonicalTokens = mergeCompoundTokens(
    strict
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => TOKEN_ALIASES.get(token) ?? token),
  );
  const structuralTokens = canonicalTokens.filter((token) => isStructuralToken(token));
  const distinctiveTokens = canonicalTokens.filter(
    (token) => !NON_DISTINCTIVE_TOKENS.has(token) && !isStructuralToken(token),
  );

  return {
    strict,
    canonicalCompact: distinctiveTokens.join(""),
    canonicalTokens,
    distinctiveTokens,
    structuralTokens,
  };
}

function isStructuralToken(token: string): boolean {
  return STRUCTURAL_TOKENS.has(token) || /^\d{2,4}$/.test(token);
}

export function findBestTeamNameMatch<TCandidate>(
  targetName: string,
  candidates: TeamNameMatchCandidate<TCandidate>[],
): TeamNameMatchResult<TCandidate> | null {
  const exactTarget = normalizeTeamName(targetName);
  const exactCandidate = candidates.find((candidate) => normalizeTeamName(candidate.name) === exactTarget);
  if (exactCandidate) {
    return {
      candidate: exactCandidate.candidate,
      matchMethod: "normalized_name",
      score: 1,
      reasons: ["strict-match"],
    };
  }

  const targetProfile = buildTeamNameProfile(targetName);
  const scored = candidates
    .map((candidate) => {
      const profile = buildTeamNameProfile(candidate.name);
      const { score, reasons } = scoreTeamNameProfiles(targetProfile, profile);
      return {
        candidate,
        score,
        reasons,
      };
    })
    .sort((left, right) => right.score - left.score);

  const [best, second] = scored;
  if (!best) {
    return null;
  }

  const threshold = 0.9;
  const gap = second ? best.score - second.score : best.score;
  if (best.score < threshold || gap < 0.08) {
    if (!second || second.score < 0.84 || best.score < threshold) {
      if (best.score < threshold) {
        return null;
      }
    } else {
      return null;
    }
  }

  return {
    candidate: best.candidate.candidate,
    matchMethod: "heuristic_name",
    score: best.score,
    reasons: best.reasons,
  };
}

function scoreTeamNameProfiles(
  target: TeamNameProfile,
  candidate: TeamNameProfile,
): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  let score = 0;

  if (target.canonicalCompact && target.canonicalCompact === candidate.canonicalCompact) {
    score += 0.92;
    reasons.push("canonical-match");
  }

  const canonicalSimilarity = measureStringSimilarity(
    target.canonicalCompact,
    candidate.canonicalCompact,
  );
  score += canonicalSimilarity * 0.55;
  if (canonicalSimilarity >= 0.9) {
    reasons.push("canonical-similar");
  }

  const overlap = measureTokenOverlap(target.distinctiveTokens, candidate.distinctiveTokens);
  score += overlap.coverage * 0.32 + overlap.jaccard * 0.2;
  if (overlap.coverage >= 0.9) {
    reasons.push("token-coverage");
  }

  const structuralOverlap = measureTokenOverlap(target.structuralTokens, candidate.structuralTokens);
  if (structuralOverlap.sharedCount > 0) {
    score += Math.min(0.14, structuralOverlap.coverage * 0.14);
    reasons.push("structural-token-match");
  }

  if (hasInitialsAlignment(target.distinctiveTokens, candidate.distinctiveTokens)) {
    score += 0.45;
    reasons.push("initials-match");
  }

  if (hasSingleTokenClubMatch(target.distinctiveTokens, candidate.distinctiveTokens)) {
    score += 0.28;
    reasons.push("single-token-club-match");
  }

  if (hasLeadingSingleTokenMatch(target.distinctiveTokens, candidate.distinctiveTokens)) {
    score += 0.24;
    reasons.push("leading-single-token-match");
  }

  if (hasOrderedPrefixMatch(target.distinctiveTokens, candidate.distinctiveTokens)) {
    score += 0.18;
    reasons.push("ordered-prefix-match");
  }

  if (isTokenSubsetMatch(target.distinctiveTokens, candidate.distinctiveTokens)) {
    score += 0.15;
    reasons.push("subset-match");
  }

  const targetHasStructural = target.structuralTokens.length > 0;
  const candidateHasStructural = candidate.structuralTokens.length > 0;
  if (!targetHasStructural && candidateHasStructural) {
    score -= 0.25;
    reasons.push("structural-penalty");
  }

  if (
    target.distinctiveTokens.length > 0 &&
    candidate.distinctiveTokens.length > 0 &&
    overlap.sharedCount === 0 &&
    !hasInitialsAlignment(target.distinctiveTokens, candidate.distinctiveTokens)
  ) {
    score -= 0.2;
    reasons.push("no-token-overlap");
  }

  return {
    score,
    reasons,
  };
}

function hasSingleTokenClubMatch(left: string[], right: string[]): boolean {
  const [shorter, longer] = left.length <= right.length ? [left, right] : [right, left];
  if (shorter.length !== 1) {
    return false;
  }

  const token = shorter[0];
  if (!token || token.length < 3 || longer.length > 3) {
    return false;
  }

  return longer.includes(token);
}

function hasLeadingSingleTokenMatch(left: string[], right: string[]): boolean {
  const [shorter, longer] = left.length <= right.length ? [left, right] : [right, left];
  if (shorter.length !== 1 || longer.length < 2) {
    return false;
  }

  const token = shorter[0];
  if (!token || token.length < 3 || longer.length > 3) {
    return false;
  }

  return longer[0] === token;
}

function mergeCompoundTokens(tokens: string[]): string[] {
  const merged: string[] = [];

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    const nextToken = tokens[index + 1];

    if (token === "red" && nextToken === "bull") {
      merged.push("redbull");
      index += 1;
      continue;
    }

    if (token) {
      merged.push(token);
    }
  }

  return merged;
}

function hasOrderedPrefixMatch(left: string[], right: string[]): boolean {
  const [shorter, longer] = left.length <= right.length ? [left, right] : [right, left];
  if (shorter.length < 2 || shorter.length === longer.length) {
    return false;
  }

  return shorter.every((token, index) => longer[index] === token);
}

function isTokenSubsetMatch(left: string[], right: string[]): boolean {
  const [shorter, longer] = left.length <= right.length ? [left, right] : [right, left];
  if (shorter.length === 0 || longer.length === 0 || shorter.length === longer.length) {
    return false;
  }

  return shorter.every((token) => longer.includes(token));
}

function hasInitialsAlignment(left: string[], right: string[]): boolean {
  return matchesInitialsSequence(left, right) || matchesInitialsSequence(right, left);
}

function matchesInitialsSequence(initialish: string[], expanded: string[]): boolean {
  if (initialish.length < 2 || expanded.length < 2) {
    return false;
  }

  let leftIndex = 0;
  let rightIndex = 0;
  let usedInitials = false;

  while (leftIndex < initialish.length && rightIndex < expanded.length) {
    const leftToken = initialish[leftIndex];
    const rightToken = expanded[rightIndex];
    if (!leftToken || !rightToken) {
      return false;
    }

    if (leftToken === rightToken) {
      leftIndex += 1;
      rightIndex += 1;
      continue;
    }

    if (leftToken.length === 1) {
      let nextLeft = leftIndex;
      let nextRight = rightIndex;

      while (nextLeft < initialish.length && initialish[nextLeft]?.length === 1) {
        const initial = initialish[nextLeft];
        const expandedToken = expanded[nextRight];
        if (!initial || !expandedToken || expandedToken[0] !== initial) {
          return false;
        }
        usedInitials = true;
        nextLeft += 1;
        nextRight += 1;
      }

      leftIndex = nextLeft;
      rightIndex = nextRight;
      continue;
    }

    return false;
  }

  return usedInitials && leftIndex === initialish.length && rightIndex === expanded.length;
}

function measureStringSimilarity(left: string, right: string): number {
  if (!left || !right) {
    return 0;
  }
  if (left === right) {
    return 1;
  }
  if (left.includes(right) || right.includes(left)) {
    return Math.min(left.length, right.length) / Math.max(left.length, right.length);
  }

  const leftBigrams = createNgrams(left, 2);
  const rightBigrams = createNgrams(right, 2);
  if (leftBigrams.size === 0 || rightBigrams.size === 0) {
    return 0;
  }

  let intersection = 0;
  for (const token of leftBigrams) {
    if (rightBigrams.has(token)) {
      intersection += 1;
    }
  }

  return intersection / Math.max(leftBigrams.size, rightBigrams.size);
}

function createNgrams(value: string, length: number): Set<string> {
  const grams = new Set<string>();
  if (value.length < length) {
    return grams;
  }

  for (let index = 0; index <= value.length - length; index += 1) {
    grams.add(value.slice(index, index + length));
  }

  return grams;
}

function measureTokenOverlap(
  left: string[],
  right: string[],
): { sharedCount: number; coverage: number; jaccard: number } {
  if (left.length === 0 || right.length === 0) {
    return {
      sharedCount: 0,
      coverage: 0,
      jaccard: 0,
    };
  }

  const leftSet = new Set(left);
  const rightSet = new Set(right);
  let sharedCount = 0;

  for (const token of leftSet) {
    if (rightSet.has(token)) {
      sharedCount += 1;
    }
  }

  return {
    sharedCount,
    coverage: sharedCount / leftSet.size,
    jaccard: sharedCount / new Set([...leftSet, ...rightSet]).size,
  };
}
