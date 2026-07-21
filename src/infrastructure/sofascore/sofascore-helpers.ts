export function buildSofascoreDateUrl(baseUrl: string, date: string): string {
  return new URL(`/football/${date}`, baseUrl).toString();
}

export function absoluteMatchUrl(baseUrl: string, href: string): string {
  return new URL(href, baseUrl).toString();
}

export function parseTeamIdFromImageUrl(value: string): string | null {
  const match = value.match(/\/api\/v1\/team\/(\d+)\/image(?:\/small)?$/);
  return match?.[1] ?? null;
}

export function buildTeamLogoUrl(teamId: string, size: "default" | "small" = "small"): string {
  const suffix = size === "small" ? "/small" : "";
  return `https://img.sofascore.com/api/v1/team/${teamId}/image${suffix}`;
}
