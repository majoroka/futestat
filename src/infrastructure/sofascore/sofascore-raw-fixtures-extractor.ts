import type { Page } from "playwright";

import type { RawSofascoreFixture } from "./sofascore-types.js";

export async function extractRawFixturesFromPage(
  page: Pick<Page, "evaluate">,
  params: { baseUrl: string; date: string },
): Promise<RawSofascoreFixture[]> {
  return page.evaluate<RawSofascoreFixture[], { baseUrl: string; date: string }>(
    ({ baseUrl, date: matchDate }) => {
      const scheduleCards = Array.from(
        document.querySelectorAll<HTMLAnchorElement>('a[class*="event-hl-"]'),
      );

      const sectionNodes = Array.from(
        new Set(scheduleCards.map((card) => card.parentElement).filter(Boolean)),
      ) as HTMLElement[];

      const fixtures: RawSofascoreFixture[] = [];

      for (const sectionNode of sectionNodes) {
        let currentCompetitionId: string | null = null;
        let currentCompetition: string | null = null;
        let currentCompetitionLogoUrl: string | null = null;
        let currentCountry: string | null = null;

        for (const child of Array.from(sectionNode.children)) {
          if (!(child instanceof HTMLElement)) {
            continue;
          }

          const tournamentAnchors = Array.from(
            child.querySelectorAll<HTMLAnchorElement>('a[href*="/football/tournament/"]'),
          );
          const tournamentLinks = tournamentAnchors
            .map((anchor) => anchor.textContent?.trim() ?? "")
            .filter(Boolean);

          if (tournamentLinks.length > 0) {
            const tournamentAnchor = tournamentAnchors[0] ?? null;
            const tournamentImage = child.querySelector<HTMLImageElement>(
              'img[src*="/api/v1/unique-tournament/"]',
            );
            currentCompetition = tournamentLinks[0] ?? currentCompetition;
            currentCompetitionId =
              tournamentImage?.src.match(
                /\/api\/v1\/unique-tournament\/(\d+)\/image(?:\/dark|\/small)?$/,
              )?.[1] ??
              tournamentAnchor?.getAttribute("href")?.match(/\/(\d+)(?:[?#].*)?$/)?.[1] ??
              currentCompetitionId;
            currentCompetitionLogoUrl =
              tournamentImage?.src ??
              (currentCompetitionId
                ? `https://img.sofascore.com/api/v1/unique-tournament/${currentCompetitionId}/image/dark`
                : currentCompetitionLogoUrl);

            const countryLink = Array.from(
              child.querySelectorAll<HTMLAnchorElement>('a[href^="/football/"]'),
            ).find((anchor) => {
              const href = anchor.getAttribute("href") ?? "";
              const text = anchor.textContent?.trim() ?? "";

              return (
                text.length > 0 &&
                !href.includes("/football/tournament/") &&
                !href.includes("/football/match/")
              );
            });

            currentCountry = countryLink?.textContent?.trim() ?? currentCountry;
            continue;
          }

          if (!child.matches('a[class*="event-hl-"]')) {
            continue;
          }

          const href = child.getAttribute("href") ?? "";
          const className = child.className;
          const eventId =
            className.match(/event-hl-(\d+)/)?.[1] ?? href.match(/#id:(\d+)/)?.[1] ?? null;

          const smallTexts = Array.from(
            child.querySelectorAll<HTMLElement>('bdi[class*="textStyle_body.small"]'),
          )
            .map((node) => node.textContent?.trim() ?? "")
            .filter(Boolean);

          const scoreTexts = Array.from(child.querySelectorAll<HTMLElement>("span.score"))
            .map((node) => node.textContent?.trim() ?? "")
            .filter(Boolean);

          const teams = Array.from(
            child.querySelectorAll<HTMLElement>('bdi[class*="textStyle_body.medium"]'),
          )
            .map((node) => node.textContent?.trim() ?? "")
            .filter(Boolean);

          const teamImages = Array.from(
            child.querySelectorAll<HTMLImageElement>('img[src*="/api/v1/team/"]'),
          ).slice(0, 2);

          if (!eventId || teams.length < 2) {
            continue;
          }

          const marker = scoreTexts[0] ?? smallTexts.find((text) => text !== matchDate) ?? "";
          const kickoffTime = smallTexts.find((text) => /^\d{2}:\d{2}$/.test(text)) ?? null;
          const numericScores = scoreTexts
            .filter((text) => /^\d+$/.test(text))
            .map((text) => Number.parseInt(text, 10));
          const scorePair =
            numericScores.length >= 4
              ? [numericScores[0] ?? null, numericScores[2] ?? null]
              : numericScores.length >= 2
                ? [numericScores[0] ?? null, numericScores[1] ?? null]
                : null;
          const status =
            (marker === "-" && Boolean(kickoffTime)) || /^\d{2}:\d{2}$/.test(marker)
              ? "upcoming"
              : /^(FT|AET|PEN|AWD|WO|AP|Ended)$/i.test(marker) ||
                  /^(Full Time|After Extra Time|Penalties)$/i.test(marker)
                ? "finished"
                : /^(Postponed|PPD)$/i.test(marker)
                  ? "postponed"
                  : /^(Cancelled|Canceled|CANC|Abandoned|ABD)$/i.test(marker)
                    ? "cancelled"
                    : marker.includes("'") || /^(HT|1ST|2ND|ET|BT)$/i.test(marker)
                      ? "live"
                      : "unknown";

          fixtures.push({
            eventId,
            matchDate,
            kickoffTime,
            competitionId: currentCompetitionId,
            competitionName: currentCompetition,
            competitionLogoUrl: currentCompetitionLogoUrl,
            countryName: currentCountry,
            homeTeamId:
              teamImages[0]?.src.match(/\/api\/v1\/team\/(\d+)\/image(?:\/small)?$/)?.[1] ??
              null,
            homeTeamName: teams[0] ?? null,
            homeTeamLogoUrl: teamImages[0]?.src ?? null,
            awayTeamId:
              teamImages[1]?.src.match(/\/api\/v1\/team\/(\d+)\/image(?:\/small)?$/)?.[1] ??
              null,
            awayTeamName: teams[1] ?? null,
            awayTeamLogoUrl: teamImages[1]?.src ?? null,
            status,
            resultLabel: marker === "-" || /^\d{2}:\d{2}$/.test(marker) ? null : marker || null,
            homeScore: scorePair?.[0] ?? null,
            awayScore: scorePair?.[1] ?? null,
            href: new URL(href, baseUrl).toString(),
          });
        }
      }

      return fixtures;
    },
    params,
  );
}
