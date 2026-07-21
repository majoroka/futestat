export function buildSofascoreDateUrl(baseUrl: string, date: string): string {
  return new URL(`/football/${date}`, baseUrl).toString();
}

export function absoluteMatchUrl(baseUrl: string, href: string): string {
  return new URL(href, baseUrl).toString();
}
