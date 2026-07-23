import { mkdir, readFile, rm, writeFile, copyFile, cp } from "node:fs/promises";
import path from "node:path";

const repoRoot = process.cwd();
const distDir = path.join(repoRoot, "dist");
const assetsDir = path.join(distDir, "assets");
const docsDir = path.join(distDir, "docs");
const fixturesDir = path.join(distDir, "fixtures");
const displayTimeZone = "Europe/Lisbon";
const fixtureSnapshotPath = resolveFixtureSnapshotPath();
const fixtureDetailsPath = resolveFixtureDetailsPath();

const markdownPages = [
  {
    sourcePath: path.join(repoRoot, "README.md"),
    outputPath: path.join(docsDir, "readme.html"),
    title: "Visão geral do projeto",
    description: "Âmbito, configuração e notas operacionais do Futestat.",
  },
  {
    sourcePath: path.join(repoRoot, "docs", "architecture.md"),
    outputPath: path.join(docsDir, "architecture.html"),
    title: "Arquitetura",
    description: "Estrutura do sistema, decisões de desenho e controlos de risco.",
  },
  {
    sourcePath: path.join(repoRoot, "docs", "roadmap.md"),
    outputPath: path.join(docsDir, "roadmap.html"),
    title: "Roadmap",
    description: "Fases planeadas após o draft inicial focado apenas em fixtures.",
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
  await copyFixtureDetails();

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
  try {
    const raw = await readFile(fixtureSnapshotPath, "utf8");
    return JSON.parse(raw);
  } catch {
    return {
      source: "sofascore",
      status: "window",
      scrapedAtUtc: null,
      referenceDate: null,
      datesIncluded: [],
      fixtureCount: 0,
      visibleFixtureCount: 0,
      fixtures: [],
      metadata: {
        browserTimezone: "UTC",
        scraperVersion: 2,
        pastDays: 7,
        futureDays: 7,
        excludedStatuses: ["live"],
      },
    };
  }
}

function renderHomePage({ projectName, snapshot }) {
  return `<!doctype html>
<html lang="pt-PT">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Futestat Pages</title>
    <meta name="description" content="Vista estática do Futestat com próximos jogos e documentação do projeto.">
    <link rel="stylesheet" href="./assets/styles.css">
  </head>
  <body>
    <div class="site-shell page-enter">
      <header class="topbar">
        <a class="brand" href="./index.html">
          <span class="brand__mark">F</span>
          <span class="brand__copy">
            <strong>${escapeHtml(projectName)}</strong>
            <span>Janela de jogos e resultados</span>
          </span>
        </a>
        <nav class="nav" aria-label="Principal">
          <a href="./fixtures/latest.json">JSON dos jogos</a>
        </nav>
      </header>

      <main class="panel panel--full">
        <div class="workspace">
          <section class="fixtures-pane">
            <h1>Janela de jogos</h1>
            <p class="panel__intro">
              A lista abaixo é gerada a partir do snapshot público de fixtures, com uma janela deslizante de resultados passados e jogos futuros.
            </p>
            <section class="metric-grid" data-fixture-summary></section>
            <div class="fixtures-toolbar">
              <div class="fixtures-toolbar__dates" data-date-filters></div>
              <p class="state-copy" data-fixture-state>
                ${snapshot.fixtureCount > 0 ? "A carregar jogos..." : "Ainda não existe snapshot publicado."}
              </p>
            </div>
            <div class="competition-stack" data-fixture-groups></div>
          </section>

          <aside class="fixture-detail" data-fixture-detail>
            <p class="fixture-detail__eyebrow">Painel do jogo</p>
            <h2>Detalhes do jogo</h2>
            <p class="fixture-detail__empty">
              Seleciona um jogo na coluna da esquerda. Esta área fica reservada para informação mais detalhada em futuras iterações.
            </p>
          </aside>
        </div>
      </main>

      <footer class="footer">
        <span>Snapshot gravado: ${escapeHtml(formatDateTime(snapshot.scrapedAtUtc))}</span>
        <span>Fonte: ${escapeHtml(snapshot.source ?? "desconhecida")}</span>
      </footer>
    </div>
    <script type="module" src="./assets/app.js"></script>
  </body>
</html>`;
}

function resolveFixtureSnapshotPath() {
  const customPath = process.env.FUTESTAT_SITE_SNAPSHOT_PATH;

  if (!customPath) {
    return path.join(repoRoot, "data", "fixtures", "latest.json");
  }

  return path.isAbsolute(customPath)
    ? customPath
    : path.resolve(repoRoot, customPath);
}

function resolveFixtureDetailsPath() {
  const customPath = process.env.FUTESTAT_SITE_DETAILS_PATH;

  if (!customPath) {
    return path.join(repoRoot, "data", "fixtures", "details");
  }

  return path.isAbsolute(customPath)
    ? customPath
    : path.resolve(repoRoot, customPath);
}

async function copyFixtureDetails() {
  try {
    await rm(path.join(fixturesDir, "details"), { recursive: true, force: true });
    await cp(fixtureDetailsPath, path.join(fixturesDir, "details"), { recursive: true });
  } catch {
    // Details are optional; the site falls back to the public snapshot when absent.
  }
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
<html lang="pt-PT">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Documentação Futestat</title>
    <meta name="description" content="Índice estático de documentação do Futestat.">
    <link rel="stylesheet" href="../assets/styles.css">
  </head>
  <body>
    <div class="doc-shell page-enter">
      <nav class="doc-nav">
        <a href="../index.html">Início</a>
        <a href="./readme.html">Visão geral</a>
        <a href="./architecture.html">Arquitetura</a>
        <a href="./roadmap.html">Roadmap</a>
      </nav>
      <section class="panel">
        <h1>Documentação</h1>
        <p class="panel__intro">
          HTML estático gerado a partir dos ficheiros markdown commitados neste repositório.
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
<html lang="pt-PT">
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
        <a href="../index.html">Início</a>
        <a href="./index.html">Documentação</a>
        <a href="./readme.html">Visão geral</a>
        <a href="./architecture.html">Arquitetura</a>
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
    return "Indisponível";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return new Intl.DateTimeFormat("pt-PT", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: displayTimeZone,
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
