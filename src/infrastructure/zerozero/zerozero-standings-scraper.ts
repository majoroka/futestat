import { chromium, type Browser, type BrowserContext, type Page } from "playwright";

import type { AppConfig } from "../../config/app-config.js";
import type { CompetitionStandingsSource } from "../../config/competition-standings-sources.js";
import type {
  CompetitionStandingsRefreshResult,
  CompetitionStandingsSnapshot,
} from "../../domain/competition-standings.js";
import { logStructuredEvent } from "../../lib/structured-logger.js";
import { extractCompetitionStandingsFromHtml } from "./zerozero-standings-parser.js";

const ZEROZERO_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36";

export class ZerozeroStandingsScraper {
  constructor(private readonly config: AppConfig) {}

  async refreshCompetitionStandings(
    sources: CompetitionStandingsSource[],
    onSnapshot: (snapshot: CompetitionStandingsSnapshot) => Promise<void>,
  ): Promise<CompetitionStandingsRefreshResult> {
    let refreshed = 0;
    let failed = 0;
    let preferBrowserTransport = false;
    const refreshedCompetitionIds: string[] = [];
    const browserRef: { current: Browser | null } = { current: null };
    const contextRef: { current: BrowserContext | null } = { current: null };
    const pageRef: { current: Page | null } = { current: null };

    const ensurePage = async (): Promise<Page> => {
      if (pageRef.current) {
        return pageRef.current;
      }

      browserRef.current = await chromium.launch({ headless: this.config.headless });
      contextRef.current = await browserRef.current.newContext({
        locale: "pt-PT",
        userAgent: ZEROZERO_USER_AGENT,
        extraHTTPHeaders: {
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "pt-PT,pt;q=0.9,en-US;q=0.8,en;q=0.7",
        },
      });
      pageRef.current = await contextRef.current.newPage();
      pageRef.current.setDefaultTimeout(this.config.timeoutMs);
      return pageRef.current;
    };

    try {
      for (const source of sources) {
        try {
          const result = await this.scrapeCompetition(
            source,
            ensurePage,
            preferBrowserTransport,
          );

          if (result.transport === "browser") {
            preferBrowserTransport = true;
          }

          await onSnapshot(result.snapshot);
          refreshed += 1;
          refreshedCompetitionIds.push(source.competitionId);
        } catch (error: unknown) {
          failed += 1;
          logStructuredEvent(this.config.structuredLogs, "warn", "competition_standings_refresh_failed", {
            competitionId: source.competitionId,
            zerozeroUrl: source.zerozeroUrl,
            errorMessage: error instanceof Error ? error.message : String(error),
          });
        }
      }
    } finally {
      if (contextRef.current) {
        await contextRef.current.close();
      }

      if (browserRef.current) {
        await browserRef.current.close();
      }
    }

    return {
      attempted: sources.length,
      refreshed,
      skipped: 0,
      failed,
      refreshedCompetitionIds,
      outputDir: this.config.competitionStandingsOutputDir,
    };
  }

  private async scrapeCompetition(
    source: CompetitionStandingsSource,
    ensurePage: () => Promise<Page>,
    preferBrowserTransport: boolean,
  ): Promise<{ snapshot: CompetitionStandingsSnapshot; transport: "fetch" | "browser" }> {
    if (!preferBrowserTransport) {
      try {
        const html = await this.fetchCompetitionHtml(source);
        return {
          snapshot: this.buildSnapshot(source, html),
          transport: "fetch",
        };
      } catch (error: unknown) {
        if (!shouldFallbackToBrowser(error)) {
          throw error;
        }

        logStructuredEvent(
          this.config.structuredLogs,
          "info",
          "competition_standings_refresh_browser_fallback",
          {
            competitionId: source.competitionId,
            zerozeroUrl: source.zerozeroUrl,
            reason: error instanceof Error ? error.message : String(error),
          },
        );
      }
    }

    const html = await this.fetchCompetitionHtmlWithBrowser(await ensurePage(), source);
    return {
      snapshot: this.buildSnapshot(source, html),
      transport: "browser",
    };
  }

  private async fetchCompetitionHtml(source: CompetitionStandingsSource): Promise<string> {
    const response = await fetch(source.zerozeroUrl, {
      headers: {
        "User-Agent": ZEROZERO_USER_AGENT,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "pt-PT,pt;q=0.9,en-US;q=0.8,en;q=0.7",
        Referer: "https://www.zerozero.pt/",
      },
    });

    if (!response.ok) {
      throw new Error(`Zerozero standings page unavailable (${response.status})`);
    }

    const html = await response.text();
    if (isBlockedHtml(html)) {
      throw new Error("Zerozero standings page unavailable (blocked_html)");
    }

    return html;
  }

  private async fetchCompetitionHtmlWithBrowser(
    page: Page,
    source: CompetitionStandingsSource,
  ): Promise<string> {
    const response = await page.goto(source.zerozeroUrl, {
      waitUntil: "domcontentloaded",
      timeout: this.config.timeoutMs,
    });

    await page.waitForLoadState("networkidle", { timeout: 8_000 }).catch(() => {
      // Zerozero can keep background requests alive; the DOM is enough for parser-based extraction.
    });

    await this.acceptConsentIfPresent(page);
    await page.waitForSelector("table.zz-datatable", { timeout: 6_000 }).catch(() => {
      // Some competition pages render slightly slower or with extra wrappers.
    });
    await page.waitForTimeout(600);

    if (response && !response.ok()) {
      throw new Error(`Zerozero standings page unavailable (${response.status()})`);
    }

    const html = await page.content();
    if (isBlockedHtml(html)) {
      throw new Error("Zerozero standings page unavailable (blocked_browser)");
    }

    return html;
  }

  private buildSnapshot(source: CompetitionStandingsSource, html: string): CompetitionStandingsSnapshot {
    return extractCompetitionStandingsFromHtml({
      html,
      competitionId: source.competitionId,
      competitionName: source.competitionName,
      countryName: source.countryName,
      zerozeroUrl: source.zerozeroUrl,
      mode: source.mode,
      status: source.status,
      scrapedAtUtc: new Date().toISOString(),
      defaultPhaseNotes: source.defaultPhaseNotes,
      defaultRuleProfileId: source.defaultRuleProfileId,
      phaseRules: source.phaseRules,
    });
  }

  private async acceptConsentIfPresent(page: Page): Promise<void> {
    const labels = [
      "Aceitar",
      "Aceitar tudo",
      "Concordo",
      "Accept",
      "Accept all",
      "Consent",
      "Consentir",
    ];

    for (const label of labels) {
      const button = page.getByRole("button", { name: label });
      if ((await button.count()) === 0) {
        continue;
      }

      await button.first().click().catch(() => {
        // Ignore if the banner disappears before the click resolves.
      });
      await page.waitForTimeout(400);
      return;
    }
  }
}

function shouldFallbackToBrowser(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /Zerozero standings page unavailable \((403|429|503)\)/.test(message) || message.includes("blocked_");
}

function isBlockedHtml(html: string): boolean {
  const normalized = html.toLowerCase();

  return (
    normalized.includes("403 forbidden") ||
    normalized.includes('"code": 403') ||
    normalized.includes("access denied") ||
    normalized.includes("temporarily unavailable")
  );
}
