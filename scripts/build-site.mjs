import { mkdir, readFile, rm, writeFile, copyFile } from "node:fs/promises";
import path from "node:path";

const repoRoot = process.cwd();
const distDir = path.join(repoRoot, "dist");
const assetsDir = path.join(distDir, "assets");
const docsDir = path.join(distDir, "docs");
const fixturesDir = path.join(distDir, "fixtures");

const markdownPages = [
  {
    sourcePath: path.join(repoRoot, "README.md"),
    outputPath: path.join(docsDir, "readme.html"),
    title: "Project Overview",
    description: "Scope, setup, and operational notes for Futestat.",
  },
  {
    sourcePath: path.join(repoRoot, "docs", "architecture.md"),
    outputPath: path.join(docsDir, "architecture.html"),
    title: "Architecture",
    description: "System structure, design decisions, and risk controls.",
  },
  {
    sourcePath: path.join(repoRoot, "docs", "roadmap.md"),
    outputPath: path.join(docsDir, "roadmap.html"),
    title: "Roadmap",
    description: "Planned phases after the initial fixtures-only draft.",
  },
];

await buildSite();

async function buildSite() {
  await rm(distDir, { recursive: true, force: true });
  await mkdir(assetsDir, { recursive: true });
  await mkdir(docsDir, { recursive: true });
  await mkdir(fixturesDir, { recursive: true });

  const packageJson = JSON.parse(await readFile(path.join(repoRoot, "package.json"), "utf8"));
  const snapshot = await loadFixtureSnapshot();

  await Promise.all([
    copyFile(path.join(repoRoot, "site", "styles.css"), path.join(assetsDir, "styles.css")),
    copyFile(path.join(repoRoot, "site", "app.js"), path.join(assetsDir, "app.js")),
    writeFile(path.join(distDir, ".nojekyll"), "", "utf8"),
    writeFile(path.join(fixturesDir, "latest.json"), JSON.stringify(snapshot, null, 2), "utf8"),
  ]);

  await writeFile(
    path.join(distDir, "index.html"),
    renderHomePage({ projectName: packageJson.name, snapshot }),
    "utf8",
  );

  await writeFile(path.join(docsDir, "index.html"), renderDocsIndex(markdownPages), "utf8");

  for (const page of markdownPages) {
    const markdown = await readFile(page.sourcePath, "utf8");
    const html = renderDocPage({
      title: page.title,
      description: page.description,
      content: renderMarkdown(markdown, page),
    });
    await writeFile(page.outputPath, html, "utf8");
  }
}

async function loadFixtureSnapshot() {
  const fixturePath = path.join(repoRoot, "data", "fixtures", "latest.json");

  try {
    const raw = await readFile(fixturePath, "utf8");
    return JSON.parse(raw);
  } catch {
    return {
      source: "sofascore",
      status: "upcoming",
      scrapedAtUtc: null,
      datesScraped: [],
      fixtureCount: 0,
      fixtures: [],
      metadata: {
        browserTimezone: "UTC",
        scraperVersion: 1,
      },
    };
  }
}

function renderHomePage({ projectName, snapshot }) {
  const generatedAt = new Date().toISOString();

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Futestat Pages</title>
    <meta name="description" content="Static GitHub Pages view for Futestat upcoming fixtures and project documentation.">
    <link rel="stylesheet" href="./assets/styles.css">
  </head>
  <body>
    <div class="site-shell page-enter">
      <header class="topbar">
        <a class="brand" href="./index.html">
          <span class="brand__mark">F</span>
          <span class="brand__copy">
            <strong>${escapeHtml(projectName)}</strong>
            <span>Upcoming fixtures and static project docs</span>
          </span>
        </a>
        <nav class="nav" aria-label="Primary">
          <a href="./docs/index.html">Documentation</a>
          <a href="./docs/architecture.html">Architecture</a>
          <a href="./docs/roadmap.html">Roadmap</a>
          <a href="./fixtures/latest.json">Fixtures JSON</a>
        </nav>
      </header>

      <section class="hero">
        <p class="hero__eyebrow">GitHub Pages</p>
        <h1>Futestat public snapshot.</h1>
        <p class="hero__lede">
          This static site publishes the latest committed snapshot of upcoming Sofascore football fixtures,
          plus the current architecture and roadmap for the project. It is intentionally small, inspectable,
          and easy to deploy from the default branch.
        </p>
        <div class="hero__meta">
          <span class="hero__pill">Source: ${escapeHtml(snapshot.source ?? "unknown")}</span>
          <span class="hero__pill">Status: ${escapeHtml(snapshot.status ?? "n/a")}</span>
          <span class="hero__pill">Generated: ${escapeHtml(formatDateTime(generatedAt))}</span>
        </div>
      </section>

      <div class="content-grid">
        <main class="panel">
          <h2>Upcoming fixtures</h2>
          <p class="panel__intro">
            The cards below are rendered from the committed <code>data/fixtures/latest.json</code> snapshot.
            To update them on Pages, regenerate the fixtures locally, commit the new snapshot, and push to <code>main</code>.
          </p>
          <section class="metric-grid" data-fixture-summary></section>
          <div class="fixtures-toolbar">
            <div class="fixtures-toolbar__dates" data-date-filters></div>
            <p class="state-copy" data-fixture-state>
              ${snapshot.fixtureCount > 0 ? "Loading fixtures..." : "No published snapshot yet."}
            </p>
          </div>
          <div class="competition-stack" data-fixture-groups></div>
        </main>

        <aside class="panel">
          <h2>Documentation</h2>
          <p class="panel__intro">
            The Pages build converts the repository docs into static HTML so the project can be reviewed without opening the codebase.
          </p>
          <div class="docs-stack">
            <a class="docs-card" href="./docs/readme.html">
              <p>Project</p>
              <h3>Overview and setup</h3>
              <span>Scope of the scraper, execution commands, local output, and Pages notes.</span>
            </a>
            <a class="docs-card" href="./docs/architecture.html">
              <p>Design</p>
              <h3>Architecture and safeguards</h3>
              <span>Current structure, source choices, and operational risks already identified.</span>
            </a>
            <a class="docs-card" href="./docs/roadmap.html">
              <p>Planning</p>
              <h3>Roadmap by phase</h3>
              <span>What comes after the fixtures MVP: hardening, finished matches, and team stats.</span>
            </a>
          </div>
        </aside>
      </div>

      <footer class="footer">
        <span>Committed snapshot: ${escapeHtml(formatDateTime(snapshot.scrapedAtUtc))}</span>
        <span>Static docs build for GitHub Pages.</span>
      </footer>
    </div>
    <script type="module" src="./assets/app.js"></script>
  </body>
</html>`;
}

function renderDocsIndex(pages) {
  const cards = pages
    .map(
      (page) => `
        <a class="docs-card" href="./${path.basename(page.outputPath)}">
          <p>Doc</p>
          <h3>${escapeHtml(page.title)}</h3>
          <span>${escapeHtml(page.description)}</span>
        </a>
      `,
    )
    .join("");

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Futestat Docs</title>
    <meta name="description" content="Static documentation index for Futestat.">
    <link rel="stylesheet" href="../assets/styles.css">
  </head>
  <body>
    <div class="doc-shell page-enter">
      <nav class="doc-nav">
        <a href="../index.html">Home</a>
        <a href="./readme.html">Overview</a>
        <a href="./architecture.html">Architecture</a>
        <a href="./roadmap.html">Roadmap</a>
      </nav>
      <section class="panel">
        <h1>Documentation</h1>
        <p class="panel__intro">
          Static HTML generated from the markdown files committed in this repository.
        </p>
        <div class="docs-stack">
          ${cards}
        </div>
      </section>
    </div>
  </body>
</html>`;
}

function renderDocPage({ title, description, content }) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(title)} · Futestat</title>
    <meta name="description" content="${escapeHtml(description)}">
    <link rel="stylesheet" href="../assets/styles.css">
  </head>
  <body>
    <div class="doc-shell page-enter">
      <nav class="doc-nav">
        <a href="../index.html">Home</a>
        <a href="./index.html">Docs</a>
        <a href="./readme.html">Overview</a>
        <a href="./architecture.html">Architecture</a>
        <a href="./roadmap.html">Roadmap</a>
      </nav>
      <section class="doc-card">
        <article>
          ${content}
        </article>
      </section>
    </div>
  </body>
</html>`;
}

function renderMarkdown(markdown, page) {
  const lines = markdown.replaceAll("\r\n", "\n").split("\n");
  const html = [];
  let paragraph = [];
  let listType = null;
  let listItems = [];
  let inCode = false;
  let codeLines = [];

  const flushParagraph = () => {
    if (paragraph.length === 0) {
      return;
    }

    html.push(`<p>${renderInline(paragraph.join(" "), page)}</p>`);
    paragraph = [];
  };

  const flushList = () => {
    if (!listType || listItems.length === 0) {
      return;
    }

    const items = listItems.map((item) => `<li>${renderInline(item, page)}</li>`).join("");
    html.push(`<${listType}>${items}</${listType}>`);
    listType = null;
    listItems = [];
  };

  for (const line of lines) {
    if (line.startsWith("```")) {
      flushParagraph();
      flushList();

      if (inCode) {
        html.push(`<pre><code>${escapeHtml(codeLines.join("\n"))}</code></pre>`);
        inCode = false;
        codeLines = [];
      } else {
        inCode = true;
      }

      continue;
    }

    if (inCode) {
      codeLines.push(line);
      continue;
    }

    if (line.trim() === "") {
      flushParagraph();
      flushList();
      continue;
    }

    const headingMatch = /^(#{1,6})\s+(.*)$/.exec(line);
    if (headingMatch) {
      flushParagraph();
      flushList();
      const level = headingMatch[1].length;
      html.push(`<h${level}>${renderInline(headingMatch[2], page)}</h${level}>`);
      continue;
    }

    const bulletMatch = /^-\s+(.*)$/.exec(line);
    if (bulletMatch) {
      flushParagraph();
      if (listType && listType !== "ul") {
        flushList();
      }
      listType = "ul";
      listItems.push(bulletMatch[1]);
      continue;
    }

    const orderedMatch = /^\d+\.\s+(.*)$/.exec(line);
    if (orderedMatch) {
      flushParagraph();
      if (listType && listType !== "ol") {
        flushList();
      }
      listType = "ol";
      listItems.push(orderedMatch[1]);
      continue;
    }

    flushList();
    paragraph.push(line.trim());
  }

  flushParagraph();
  flushList();

  return html.join("\n");
}

function renderInline(text, page) {
  let rendered = escapeHtml(text);

  rendered = rendered.replace(/`([^`]+)`/g, "<code>$1</code>");
  rendered = rendered.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  rendered = rendered.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, label, href) => {
    const normalizedHref = rewriteHref(href, page);
    return `<a href="${escapeAttribute(normalizedHref)}">${escapeHtml(label)}</a>`;
  });

  return rendered;
}

function rewriteHref(href, page) {
  if (!href.endsWith(".md") || !page) {
    return href;
  }

  const absoluteSourceTarget = path.resolve(path.dirname(page.sourcePath), href);
  const targetPage = markdownPages.find((candidate) => candidate.sourcePath === absoluteSourceTarget);

  if (!targetPage) {
    return href;
  }

  const relativeTarget = path.relative(path.dirname(page.outputPath), targetPage.outputPath);
  return relativeTarget.replaceAll(path.sep, "/");
}

function formatDateTime(value) {
  if (!value) {
    return "Not available";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
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

function escapeAttribute(value) {
  return escapeHtml(value);
}
