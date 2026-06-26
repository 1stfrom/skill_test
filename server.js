const http = require('http');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '127.0.0.1';
const ROOT = __dirname;
const SITE_DIR = path.join(ROOT, 'site');
const DOC_DIR = path.join(ROOT, 'doc');

const pages = [
  { slug: '', title: 'Dashboard', file: null },
  { slug: 'readme', title: 'Project Guide', file: 'README.md' },
  { slug: 'memory', title: 'Template Memory', file: 'MEMORY.md' },
  { slug: 'new-project', title: 'New Project Checklist', file: path.join('doc', 'NEW_PROJECT_CHECKLIST.md') },
  { slug: 'status', title: 'Project Status', file: path.join('doc', 'PROJECT_STATUS.md') },
  { slug: 'decisions', title: 'Decisions', file: path.join('doc', 'DECISIONS.md') },
  { slug: 'daily-log', title: 'Daily Log', file: path.join('doc', 'DAILY_LOG.md') },
  { slug: 'worklog', title: 'Work Log', file: path.join('doc', 'WORKLOG.md') },
  { slug: 'environment', title: 'Environment', file: path.join('doc', 'ENVIRONMENT.md') },
  { slug: 'agent-rules', title: 'Agent Rules', file: 'AGENTS.md' }
];

const navItems = pages.map((page) => ({
  href: page.slug ? `/${page.slug}` : '/',
  title: page.title
}));

// Slide decks served from reports/<directory>/. Each entry shows up in the
// sidebar as a separate link, grouped to reflect project progress.
// Setting `dynamic: true` makes the dashboard generate the deck at request
// time from cache/ and graphs/ on disk, so the deck always reflects the
// latest re-render of the upstream Rmds.
const slideDecks = [
  {
    slug: 'research-plan',
    directory: 'research-plan-slides',
    title: 'Research Plan',
    phase: 'Plan',
    summary: 'Six-phase plan for the 2023 BGEM UAV-VI genomic prediction study.'
  },
  {
    slug: 'vi-results',
    directory: 'vi-results-slides',
    title: 'VI Results · Phase 1',
    phase: 'Phase 1 → 2',
    summary: 'VI interpretation, temporal features, and open decisions before Phase 2 modeling.',
    dynamic: true,
    figureRoots: ['graphs'],
    render: () => renderViResultsDeck()
  },
  {
    slug: 'agronomic-trait-qc',
    directory: 'vi-results-slides',
    title: 'Agronomic Trait QC',
    phase: 'Phenotype QC',
    summary: 'Manual agronomic traits - six ear/kernel/cob traits, block-level N distributions, and heterosis.',
    dynamic: true,
    figureRoots: ['graphs'],
    render: () => renderAgronomicQcDeck()
  },
  {
    slug: 'baseline-gblup',
    directory: 'baseline-gblup-slides',
    title: 'Baseline GBLUP',
    phase: 'Genomic Selection',
    summary: 'Completed HCC genotype-only GBLUP baseline with marker inventory, accuracy summary, and next decisions.'
  },
  {
    slug: 'fst-scan',
    directory: 'fst-scan-slides',
    title: 'Fst Scan · Temporal vs Tropical',
    phase: 'Selection Scan',
    summary: 'Focused chromosome 10 Weir-Cockerham Fst scan with top windows and review gates.'
  },
  {
    slug: 'vi-qc-round2',
    directory: 'vi-results-slides',
    title: 'VI Trait QC - Round 2',
    phase: 'Phenotype QC',
    summary: 'Checks (B73 / Mo17 / B73 x Mo17) greenness sanity + BGEM Inbred/Hybrid x SS/NSS stratified QC.',
    dynamic: true,
    figureRoots: ['graphs'],
    render: () => renderViQc2Deck()
  },
  {
    slug: 'vi-agronomic-qc',
    directory: 'vi-results-slides',
    title: 'VI x Agronomic Correlation',
    phase: 'Phenotype QC',
    summary: 'Within-N genotype-level cor.test of VI temporal features against agronomic traits. Does RGB keep within-N signal?',
    dynamic: true,
    figureRoots: ['graphs'],
    render: () => renderViAgronomicQcDeck()
  }
];

function readText(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

function escapeHtml(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderInline(text) {
  const escaped = escapeHtml(text);
  return escaped
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
}

function renderMarkdown(markdown) {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const html = [];
  let inCode = false;
  let codeFence = '';
  let inUl = false;
  let inOl = false;
  let inBlockquote = false;
  let inTable = false;
  let paragraph = [];

  function closeParagraph() {
    if (paragraph.length) {
      html.push(`<p>${renderInline(paragraph.join(' '))}</p>`);
      paragraph = [];
    }
  }

  function closeLists() {
    if (inUl) {
      html.push('</ul>');
      inUl = false;
    }
    if (inOl) {
      html.push('</ol>');
      inOl = false;
    }
  }

  function closeTable() {
    if (inTable) {
      html.push('</tbody></table>');
      inTable = false;
    }
  }

  function closeBlockquote() {
    if (inBlockquote) {
      closeParagraph();
      closeLists();
      closeTable();
      html.push('</blockquote>');
      inBlockquote = false;
    }
  }

  function splitTableRow(row) {
    return row
      .trim()
      .replace(/^\|/, '')
      .replace(/\|$/, '')
      .split('|')
      .map((cell) => cell.trim());
  }

  function isTableSeparator(row) {
    return /^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?$/.test(row.trim());
  }

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const trimmed = line.trim();

    if (trimmed.startsWith('```')) {
      closeParagraph();
      closeLists();
      closeTable();
      closeBlockquote();
      if (!inCode) {
        codeFence = trimmed.slice(3).trim();
        html.push(`<pre><code class="language-${escapeHtml(codeFence || 'text')}">`);
        inCode = true;
      } else {
        html.push('</code></pre>');
        inCode = false;
        codeFence = '';
      }
      continue;
    }

    if (inCode) {
      html.push(`${escapeHtml(line)}\n`);
      continue;
    }

    if (!trimmed) {
      closeParagraph();
      closeLists();
      closeTable();
      closeBlockquote();
      continue;
    }

    const heading = trimmed.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      closeParagraph();
      closeLists();
      closeTable();
      closeBlockquote();
      const level = heading[1].length;
      html.push(`<h${level}>${renderInline(heading[2])}</h${level}>`);
      continue;
    }

    const blockquote = trimmed.match(/^>\s?(.*)$/);
    if (blockquote) {
      closeParagraph();
      closeLists();
      if (!inBlockquote) {
        html.push('<blockquote>');
        inBlockquote = true;
      }
      paragraph.push(blockquote[1]);
      continue;
    }

    const unordered = trimmed.match(/^[-*]\s+(.*)$/);
    if (unordered) {
      closeParagraph();
      closeTable();
      if (inOl) {
        html.push('</ol>');
        inOl = false;
      }
      if (!inUl) {
        html.push('<ul>');
        inUl = true;
      }
      html.push(`<li>${renderInline(unordered[1])}</li>`);
      continue;
    }

    const ordered = trimmed.match(/^\d+\.\s+(.*)$/);
    if (ordered) {
      closeParagraph();
      closeTable();
      if (inUl) {
        html.push('</ul>');
        inUl = false;
      }
      if (!inOl) {
        html.push('<ol>');
        inOl = true;
      }
      html.push(`<li>${renderInline(ordered[1])}</li>`);
      continue;
    }

    if (trimmed.includes('|')) {
      const nextLine = lines[index + 1] || '';
      if (!inTable && isTableSeparator(nextLine)) {
        closeParagraph();
        closeLists();
        closeBlockquote();
        const headers = splitTableRow(trimmed);
        html.push('<table><thead><tr>');
        headers.forEach((header) => {
          html.push(`<th>${renderInline(header)}</th>`);
        });
        html.push('</tr></thead><tbody>');
        inTable = true;
        index += 1;
        continue;
      }

      if (inTable) {
        const cells = splitTableRow(trimmed);
        html.push('<tr>');
        cells.forEach((cell) => {
          html.push(`<td>${renderInline(cell)}</td>`);
        });
        html.push('</tr>');
        continue;
      }
    } else {
      closeTable();
    }

    paragraph.push(trimmed);
  }

  closeParagraph();
  closeLists();
  closeTable();
  closeBlockquote();

  if (inCode) {
    html.push('</code></pre>');
  }

  return html.join('\n');
}

function readMarkdown(relativePath) {
  return renderMarkdown(readText(relativePath));
}

function safeGitLog() {
  try {
    const output = execSync('git log --date=short --pretty=format:%h%x09%ad%x09%s%x09%an -20', {
      cwd: ROOT,
      stdio: ['ignore', 'pipe', 'ignore']
    }).toString('utf8');

    return output
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        const [hash, date, subject, author] = line.split('\t');
        return { hash, date, subject, author };
      });
  } catch (error) {
    return null;
  }
}

function pageTemplate({ title, content, activePath = '/' }) {
  const nav = navItems
    .map((item) => {
      const active = item.href === activePath ? 'active' : '';
      return `<a class="nav-link ${active}" href="${item.href}">${item.title}</a>`;
    })
    .join('');

  const decksByPhase = slideDecks.reduce((groups, deck) => {
    if (!groups.has(deck.phase)) {
      groups.set(deck.phase, []);
    }
    groups.get(deck.phase).push(deck);
    return groups;
  }, new Map());

  const slideNav = Array.from(decksByPhase.entries())
    .map(([phase, decks], index) => `
      <details class="deck-group" ${index === 0 ? 'open' : ''}>
        <summary>
          <span>${escapeHtml(phase)}</span>
          <small>${decks.length}</small>
        </summary>
        <div class="deck-group-list">
          ${decks
            .map((deck) => `
              <a class="deck-link" href="/slides/${deck.slug}/" target="_blank" rel="noopener">
                <span class="deck-title">${escapeHtml(deck.title)}</span>
                <span class="deck-summary">${escapeHtml(deck.summary)}</span>
              </a>`)
            .join('')}
        </div>
      </details>`)
    .join('');

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <link rel="stylesheet" href="/site/styles.css">
</head>
<body>
  <div class="layout">
    <aside class="sidebar">
      <div class="brand">Research Hub</div>
      <div class="tagline">Track progress, make decisions, stay in control</div>
      <nav class="nav">${nav}</nav>
      <div class="slide-rail">
        <div class="slide-rail-heading">
          <span>Slide Decks</span>
          <span>${slideDecks.length}</span>
        </div>
        <details class="deck-guide">
          <summary>Guide</summary>
          <p>Decks open in a new tab. Dynamic decks refresh from <code>cache/</code> and <code>graphs/</code> on each request.</p>
        </details>
        <div class="slide-rail-list">${slideNav}</div>
      </div>
    </aside>
    <main class="main">
      ${content}
    </main>
  </div>
</body>
</html>`;
}

function overviewPage() {
  const cards = [
    {
      title: 'Project Status',
      text: 'What is done, what is active, and what should happen next. Start here to get oriented.',
      href: '/status'
    },
    {
      title: 'Decisions',
      text: 'Key research decisions with reasoning. The auditable trail of human judgment.',
      href: '/decisions'
    },
    {
      title: 'Daily Log',
      text: 'One entry per commit. Track what changed, why it matters, and what comes next.',
      href: '/daily-log'
    },
    ...slideDecks.map((deck) => ({
      title: `Slides · ${deck.title}`,
      text: deck.summary,
      href: `/slides/${deck.slug}/`,
      external: true
    })),
    {
      title: 'New Project Checklist',
      text: 'Startup metadata, human review gates, environment setup, and handoff checks.',
      href: '/new-project'
    },
    {
      title: 'Project Guide',
      text: 'The lightweight, human-facing README for the current project.',
      href: '/readme'
    }
  ];

  const commits = safeGitLog();
  const commitHtml = commits
    ? `<div class="panel"><h2>Recent Git Commits</h2><ul class="commit-list">${commits
        .slice(0, 8)
        .map(
          (commit) => `<li><code>${escapeHtml(commit.hash)}</code><span>${escapeHtml(commit.date)}</span><strong>${escapeHtml(commit.subject)}</strong><em>${escapeHtml(commit.author)}</em></li>`
        )
        .join('')}</ul></div>`
    : `<div class="panel notice"><h2>Recent Git Commits</h2><p>Git commit history is not available from this repository state yet. The site will still render the daily log from <code>doc/DAILY_LOG.md</code>.</p></div>`;

  return pageTemplate({
    title: 'Research Project Dashboard',
    activePath: '/',
    content: `
      <section class="hero">
        <p class="eyebrow">Research Project Dashboard</p>
        <h1>Human-in-the-loop research tracking</h1>
        <p class="lede">Review project status, track decisions, and browse the daily log. AI assistants help execute, but you stay in control of research direction.</p>
      </section>
      <section class="card-grid">
        ${cards
          .map((card) => {
            const targetAttr = card.external ? ' target="_blank" rel="noopener"' : '';
            return `<a class="card" href="${card.href}"${targetAttr}><h2>${card.title}</h2><p>${card.text}</p></a>`;
          })
          .join('')}
      </section>
      <section class="panel">
        <h2>Workflow</h2>
        <p><strong>Plan</strong> in <code>doc/PROJECT_STATUS.md</code> &rarr; <strong>Decide</strong> in <code>doc/DECISIONS.md</code> &rarr; <strong>Execute</strong> with code and AI &rarr; <strong>Log</strong> in <code>doc/DAILY_LOG.md</code></p>
      </section>
      ${commitHtml}
    `
  });
}

function markdownPage(title, relativePath, activePath) {
  const content = readMarkdown(relativePath);
  return pageTemplate({
    title,
    activePath,
    content: `<article class="panel markdown-body">${content}</article>`
  });
}

function dailyLogPage() {
  const content = readMarkdown(path.join('doc', 'DAILY_LOG.md'));
  const commits = safeGitLog();
  const commitBlock = commits
    ? `<section class="panel"><h2>Recent Git Commits</h2><ul class="commit-list">${commits
        .map(
          (commit) => `<li><code>${escapeHtml(commit.hash)}</code><span>${escapeHtml(commit.date)}</span><strong>${escapeHtml(commit.subject)}</strong><em>${escapeHtml(commit.author)}</em></li>`
        )
        .join('')}</ul></section>`
    : `<section class="panel notice"><h2>Recent Git Commits</h2><p>Git history is currently unavailable. Keep using <code>doc/DAILY_LOG.md</code> as the authoritative daily journal.</p></section>`;

  return pageTemplate({
    title: 'Daily Log',
    activePath: '/daily-log',
    content: `<article class="panel markdown-body">${content}</article>${commitBlock}`
  });
}

function serveStatic(req, res) {
  const target = path.join(ROOT, req.url);
  if (!target.startsWith(SITE_DIR)) {
    res.writeHead(403);
    res.end('Forbidden');
    return true;
  }
  if (!fs.existsSync(target)) {
    return false;
  }

  const ext = path.extname(target);
  const type = ext === '.css' ? 'text/css; charset=utf-8' : 'text/plain; charset=utf-8';
  res.writeHead(200, { 'Content-Type': type });
  res.end(fs.readFileSync(target));
  return true;
}

// --- CSV / cache helpers for dynamic deck rendering ---

function parseCsv(text) {
  const lines = text.replace(/\r\n/g, '\n').split('\n').filter((line) => line.length > 0);
  if (lines.length === 0) {
    return { headers: [], rows: [] };
  }
  const headers = lines[0].split(',');
  const rows = lines.slice(1).map((line) => {
    const cells = line.split(',');
    const row = {};
    headers.forEach((header, index) => {
      row[header] = cells[index];
    });
    return row;
  });
  return { headers, rows };
}

function readCsvSafe(relativePath) {
  const target = path.join(ROOT, relativePath);
  if (!fs.existsSync(target)) {
    return { headers: [], rows: [] };
  }
  return parseCsv(fs.readFileSync(target, 'utf8'));
}

function listGraphPngs(relativeDir) {
  const target = path.join(ROOT, relativeDir);
  if (!fs.existsSync(target)) {
    return [];
  }
  return fs.readdirSync(target).filter((name) => name.endsWith('.png')).sort();
}

function fmtNumber(value, digits = 3) {
  const n = Number(value);
  if (!Number.isFinite(n)) {
    return '—';
  }
  if (Math.abs(n) >= 1e7 || (Math.abs(n) < 1e-3 && n !== 0)) {
    return n.toExponential(2);
  }
  if (Number.isInteger(n)) {
    return n.toString();
  }
  return n.toFixed(digits);
}

function humanizeTrajectoryName(file) {
  // trajectories_<Group>_<Nitrogen>.png
  const m = file.match(/^trajectories_(.+?)_(High_N|Low_N)\.png$/);
  if (!m) return { group: file, nitrogen: '' };
  const labels = {
    RGB_core: 'RGB core',
    Multispectral_core: 'Multispectral core',
    RGB_in_Multispectral: 'Multispectral RGB-style'
  };
  return { group: labels[m[1]] || m[1].replace(/_/g, ' '), nitrogen: m[2].replace('_', ' ') };
}

function humanizeCorrelationName(file) {
  const m = file.match(/^vi_vi_corr_(.+?)_(High_N|Low_N)\.png$/);
  if (!m) return { sensor: file, nitrogen: '' };
  return { sensor: m[1], nitrogen: m[2].replace('_', ' ') };
}

function humanizeDateWiseName(file) {
  // <Sensor>_<group>_<Nitrogen>_by_date.png
  const combined = file.match(/^(Multispectral|RGB)_(.+?)_High_vs_Low_N_by_date\.png$/);
  if (combined) {
    return { sensor: combined[1], group: combined[2].replace(/_/g, ' '), nitrogen: 'High N vs Low N' };
  }
  const m = file.match(/^(Multispectral|RGB)_(.+?)_(High_N|Low_N)_by_date\.png$/);
  if (!m) return { sensor: file, group: '', nitrogen: '' };
  return { sensor: m[1], group: m[2].replace(/_/g, ' '), nitrogen: m[3].replace('_', ' ') };
}

function nitrogenOrder(nitrogen) {
  return nitrogen === 'High N' || nitrogen === 'High_N' ? 0 : 1;
}

function sensorOrder(sensor) {
  return sensor === 'RGB' ? 0 : 1;
}

function trajectoryGroupOrder(group) {
  if (group === 'RGB core') return 0;
  if (group === 'Multispectral core') return 1;
  if (group === 'Multispectral RGB-style') return 2;
  return 3;
}

function compareViFigureFiles(kind) {
  return (a, b) => {
    if (kind === 'date') {
      const aa = humanizeDateWiseName(a);
      const bb = humanizeDateWiseName(b);
      return (
        sensorOrder(aa.sensor) - sensorOrder(bb.sensor) ||
        aa.group.localeCompare(bb.group) ||
        (aa.nitrogen === 'High N vs Low N' ? -1 : nitrogenOrder(aa.nitrogen)) -
          (bb.nitrogen === 'High N vs Low N' ? -1 : nitrogenOrder(bb.nitrogen)) ||
        a.localeCompare(b)
      );
    }
    if (kind === 'trajectory') {
      const aa = humanizeTrajectoryName(a);
      const bb = humanizeTrajectoryName(b);
      return (
        trajectoryGroupOrder(aa.group) - trajectoryGroupOrder(bb.group) ||
        nitrogenOrder(aa.nitrogen) - nitrogenOrder(bb.nitrogen) ||
        a.localeCompare(b)
      );
    }
    if (kind === 'correlation') {
      const aa = humanizeCorrelationName(a);
      const bb = humanizeCorrelationName(b);
      return (
        sensorOrder(aa.sensor) - sensorOrder(bb.sensor) ||
        nitrogenOrder(aa.nitrogen) - nitrogenOrder(bb.nitrogen) ||
        a.localeCompare(b)
      );
    }
    return a.localeCompare(b);
  };
}

function patternFigureInfo(file) {
  const labels = {
    vi_pattern_categories_RGB: {
      title: 'RGB trajectory pattern categories',
      subtitle: 'Pattern diagnostics',
      caption: 'Treatment-paired VI trajectory categories from <code>graphs/vi_patterns/vi_pattern_categories_RGB.png</code>'
    },
    vi_pattern_categories_Multispectral: {
      title: 'Multispectral trajectory pattern categories',
      subtitle: 'Pattern diagnostics',
      caption: 'Treatment-paired VI trajectory categories from <code>graphs/vi_patterns/vi_pattern_categories_Multispectral.png</code>'
    },
    rgb_date_jump_diagnostics: {
      title: 'RGB date-jump diagnostics',
      subtitle: 'RGB non-smoothness',
      caption: 'Largest standardized RGB jumps by date. Candidate dates need flight-time, weather, and processing-log review.'
    },
    rgb_date_trait_step_heatmap: {
      title: 'RGB trait × date jump heatmap',
      subtitle: 'RGB non-smoothness',
      caption: 'Trait-level RGB step changes by date. Use with flight-condition metadata to diagnose non-smooth dates.'
    },
    vi_trajectory_pca_scores: {
      title: 'PCA of VI temporal profiles',
      subtitle: 'Pattern separation',
      caption: 'Each point is one sensor-prefixed VI; PCA uses paired High-N / Low-N standardized temporal profiles.'
    },
    vi_trajectory_pca_biplot: {
      title: 'PCA biplot of VI temporal profiles',
      subtitle: 'Pattern separation',
      caption: 'PCA biplot linking VI scores with temporal-profile loadings.'
    },
    vi_trajectory_pca_scree: {
      title: 'PCA variance explained',
      subtitle: 'Pattern separation',
      caption: 'Per-PC and cumulative variance explained for the sensor-specific VI trajectory PCA.'
    },
    vi_n_discrimination_trajectories: {
      title: 'Nitrogen-discrimination trajectories',
      subtitle: 'Treatment separation',
      caption: 'VI trajectories highlighted for High-N / Low-N separation patterns.'
    },
    vi_n_discrimination_focused: {
      title: 'Focused nitrogen-discrimination VIs',
      subtitle: 'Treatment separation',
      caption: 'Focused view of VIs with stronger High-N / Low-N separation.'
    }
  };

  const key = file.replace(/[.]png$/, '');
  return labels[key] || {
    title: key.replace(/_/g, ' '),
    subtitle: 'VI pattern diagnostics',
    caption: `<code>graphs/vi_patterns/${escapeHtml(file)}</code>`
  };
}

function comparePatternFigureFiles(a, b) {
  const order = [
    'vi_pattern_categories_RGB.png',
    'vi_pattern_categories_Multispectral.png',
    'rgb_date_jump_diagnostics.png',
    'rgb_date_trait_step_heatmap.png',
    'vi_trajectory_pca_scores.png',
    'vi_trajectory_pca_biplot.png',
    'vi_trajectory_pca_scree.png',
    'vi_n_discrimination_trajectories.png',
    'vi_n_discrimination_focused.png'
  ];
  const ai = order.indexOf(a);
  const bi = order.indexOf(b);
  return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi) || a.localeCompare(b);
}

const SLIDE_MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.pdf': 'application/pdf',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8'
};

// ----- Dynamic VI Results deck -----
//
// Generated at request time. Reads cache/vi/*.csv for tables, and lists
// graphs/vi_temporal/ and graphs/vi_by_nitrogen_date/ for figures. Emits a
// research-grade deck (cover, decisions, diagnostics, every figure, every key
// table, open decisions, next analysis). Slides scale to 100vw × 100vh; figure
// slides drop padding so the embedded PNG can use ~85vh of vertical space.

function viDeckCss() {
  return `
  /* --- Global typography overrides ---
     Defensive: cancel any theme that italicizes titles, force a clean
     sans-serif family, and scale every text size up so the deck reads
     from the back of a room. */
  body, .deck, .slide {
    font-family: 'Inter','Helvetica Neue',Helvetica,'Arial',sans-serif;
  }
  .h1, .h2, .h3, .h4, h1, h2, h3, h4, h1.title, h2.title {
    font-style: normal !important;
    font-family: 'Inter','Helvetica Neue',Helvetica,'Arial',sans-serif !important;
    letter-spacing: -0.02em;
  }
  .h1, h1.title { font-size: 96px !important; line-height: 1.05; font-weight: 800; margin-bottom: 24px }
  .h2, h2.title { font-size: 68px !important; line-height: 1.1;  font-weight: 800; margin-bottom: 20px }
  .h3 { font-size: 42px !important; line-height: 1.15; font-weight: 700 }
  .h4 { font-size: 28px !important; line-height: 1.25; font-weight: 700 }
  .lede { font-size: 28px !important; line-height: 1.5; max-width: 70ch }
  .kicker { font-size: 18px !important; letter-spacing: 0.08em; font-weight: 700 }
  .eyebrow { font-size: 17px !important; letter-spacing: 0.14em; font-weight: 700 }
  .pill { font-size: 16px !important; padding: 6px 16px }
  .slide-number, .slide-number::before, .slide-number::after {
    font-size: 20px !important; font-weight: 700;
  }
  .deck-header .eyebrow, .deck-footer .dim2 { font-size: 17px !important }
  code { font-size: 0.92em }

  /* Slide notes overlay - bigger so they're readable in presenter mode */
  .notes { font-size: 20px !important; line-height: 1.55 }

  /* Card text bumps */
  .card { padding: 24px 26px }
  .card h3 { font-size: 28px !important }
  .card h4 { font-size: 22px !important; margin-bottom: 10px }
  .card p, .card .dim { font-size: 19px !important; line-height: 1.55 }
  .card ul li { font-size: 19px; line-height: 1.65 }

  /* Full-bleed figure layout overrides */
  .slide.figure-slide { padding: 28px 48px 48px; }
  .slide.figure-slide .kicker { margin-bottom: 4px }
  .slide.figure-slide h2.h2 { margin-bottom: 6px; font-size: 56px !important }
  .slide.figure-slide .fig-wrap {
    flex: 1 1 auto;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-top: 8px;
    min-height: 0;
  }
  .slide.figure-slide .fig-wrap img {
    max-width: 100%;
    max-height: 80vh;
    border-radius: var(--radius-sm);
    box-shadow: var(--shadow);
  }
  .slide.figure-slide .fig-caption { font-size: 20px; color: var(--text-3); text-align: center; margin-top: 10px }

  /* Research data tables */
  table.research { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 22px }
  table.research th, table.research td { padding: 11px 16px; text-align: center; border-bottom: 1px solid var(--surface-2) }
  table.research th { font-weight: 800; color: var(--text-1); background: var(--surface-2); font-size: 18px; letter-spacing: .06em; text-transform: uppercase }
  table.research td.num { text-align: center; font-family: var(--font-mono, monospace); font-size: 20px }

  /* Stat row (cover-style large numbers) */
  .stat-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin-top: 32px }
  .stat { padding: 22px 26px; background: var(--surface-2); border-radius: var(--radius-sm); border-left: 6px solid var(--accent) }
  .stat .v { font-size: 60px; font-weight: 800; line-height: 1; color: var(--text-1); letter-spacing: -0.02em }
  .stat .l { font-size: 18px; letter-spacing: .12em; text-transform: uppercase; color: var(--text-3); font-weight: 800; margin-top: 10px }
  .stat .n { font-size: 19px; color: var(--text-2); margin-top: 10px; line-height: 1.45 }

  /* Decision rows */
  .decision-row { display: grid; grid-template-columns: 240px 1fr; gap: 20px; padding: 16px 0; border-bottom: 1px solid var(--surface-2) }
  .decision-row:last-child { border-bottom: none }
  .decision-row .k { font-weight: 800; font-size: 22px; color: var(--text-1) }
  .decision-row .k .s { display: block; font-weight: 500; font-size: 16px; color: var(--text-3); margin-top: 4px; letter-spacing: .04em }
  .decision-row .v { font-size: 20px; color: var(--text-2); line-height: 1.55 }

  /* Resolved list */
  .resolved-list { margin-top: 20px; padding: 0 }
  .resolved-list li { padding: 16px 0; border-bottom: 1px solid var(--surface-2); font-size: 22px; line-height: 1.55; color: var(--text-2); list-style: none }
  .resolved-list li b { color: var(--text-1); font-weight: 800 }
  .resolved-list li .tag { display: inline-block; margin-right: 12px; padding: 4px 12px; border-radius: 999px; background: rgba(40,140,90,.14); color: #2a6b50; font-size: 14px; letter-spacing: .1em; text-transform: uppercase; font-weight: 800 }

  /* Feature grid (three-up cards) */
  .feature-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; margin-top: 22px }
  .feat { padding: 22px; background: var(--surface-2); border-radius: var(--radius-sm) }
  .feat .n { font-size: 16px; letter-spacing: .12em; text-transform: uppercase; color: var(--accent); font-weight: 800; margin-bottom: 10px }
  .feat h4 { margin: 0 0 10px; font-size: 26px !important; line-height: 1.25 }
  .feat p { margin: 0; font-size: 19px; color: var(--text-2); line-height: 1.5 }

  /* Status pills */
  .gate { display: inline-block; padding: 6px 16px; border-radius: 999px; background: var(--surface-2); color: var(--text-3); font-size: 17px; letter-spacing: .08em; text-transform: uppercase; font-weight: 800 }
  .gate.warn { background: rgba(220,80,40,.12); color: #b3502a }
  .gate.ok { background: rgba(40,140,90,.14); color: #2a6b50 }

  /* Phase flow */
  .flow { display: grid; grid-template-columns: 1fr auto 1fr auto 1fr; gap: 20px; align-items: center; margin-top: 32px }
  .flow .step { padding: 26px; background: var(--surface-2); border-radius: var(--radius-sm); text-align: center }
  .flow .step h4 { margin: 0 0 10px; font-size: 24px !important }
  .flow .step p { margin: 0; font-size: 18px; color: var(--text-2); line-height: 1.5 }
  .flow .arr { font-size: 42px; color: var(--accent); text-align: center; font-weight: 800 }

  /* Section dividers */
  .section-divider { display: flex; align-items: center; justify-content: center; height: 100% }
  .section-divider .body { text-align: center }
  .section-divider .body .num { font-size: 30px; letter-spacing: .2em; text-transform: uppercase; color: var(--accent); font-weight: 800 }
  .section-divider .body h2 { font-size: 132px !important; margin-top: 18px; line-height: 1 }
  .section-divider .body .lede { font-size: 30px !important; margin-top: 24px }
  `;
}

function viCoverSlide(now, totalSlides) {
  return `
  <section class="slide" data-title="Cover">
    <div class="deck-header"><span class="eyebrow">Results · Live</span><span class="eyebrow">UAV-for-GS · BGEM 2023</span></div>
    <p class="kicker">Phase 1 → Phase 2</p>
    <h1 class="h1 anim-fade-up" data-anim="fade-up">
      UAV vegetation indices<br><span class="gradient-text">data interpretation</span><br>and temporal features
    </h1>
    <p class="lede">A live research deck generated from <code>cache/vi/</code> and <code>graphs/</code>. Every figure and table re-loads from disk on each request.</p>
    <div class="row wrap mt-l">
      <span class="pill pill-accent">2023 BGEM</span>
      <span class="pill">RGB + multispectral</span>
      <span class="pill">CV2 leave-lines-out (proposed)</span>
      <span class="pill">${totalSlides} slides · dynamic</span>
    </div>
    <div class="deck-footer"><span class="dim2">Jinliang Yang lab · ${escapeHtml(now)}</span><span class="slide-number" data-current="1" data-total="${totalSlides}"></span></div>
  </section>`;
}

function viFlowSlide() {
  return `
  <section class="slide" data-title="Where we are">
    <p class="kicker">Project state</p>
    <h2 class="h2">Closing Phase 1 · Opening Phase 2</h2>
    <div class="flow">
      <div class="step" style="background:rgba(40,140,90,.10);border:1px solid rgba(40,140,90,.30)">
        <h4>Phase 1 ✓</h4>
        <p>Data inventory · VI interpretation · diagnostics · temporal features</p>
      </div>
      <div class="arr">→</div>
      <div class="step" style="border:1px solid var(--accent)">
        <h4>Phase 2 (now)</h4>
        <p>Stage-1 within-trial spatial model · G-BLUP under CV2</p>
      </div>
      <div class="arr">→</div>
      <div class="step">
        <h4>Phase 3–6</h4>
        <p>VI features → G+P-BLUP → validation → manuscript</p>
      </div>
    </div>
  </section>`;
}

function viDatasetSlide(coverageSummary) {
  const sum = (sensor, n) => {
    const row = coverageSummary.rows.find((r) => r.Sensor === sensor && r.Nitrogen === n);
    return row ? Number(row.Genotypes) : 0;
  };
  return `
  <section class="slide" data-title="Dataset snapshot">
    <p class="kicker">Inputs</p>
    <h2 class="h2">What's in <code>largedata/phenotype/</code></h2>
    <div class="stat-row">
      <div class="stat"><div class="v">1</div><div class="l">Site-year</div><div class="n">2023 BGEM field trial</div></div>
      <div class="stat"><div class="v">2</div><div class="l">Sensors</div><div class="n">RGB · multispectral</div></div>
      <div class="stat"><div class="v">15 / 8</div><div class="l">Flights</div><div class="n">RGB / multispectral, July–Aug</div></div>
      <div class="stat"><div class="v">${sum('Multispectral', 'High N') || '~544'}</div><div class="l">Lines (MS · HN)</div><div class="n">From <code>vi_post_decision_coverage_summary.csv</code></div></div>
    </div>
    <div class="grid g2 mt-l">
      <div class="card"><h4>VI predictors</h4><p class="dim">Plot-level vegetation indices from RGB (NGRDI, MGRVI, RGBVI, ExG, GLI, VARI, VEG, TGI, IKAW, …) and multispectral (NDVI, GNDVI, EVI, ARVI, SRI, RVI, IPVI, SAVI×4, NDWI, …).</p></div>
      <div class="card"><h4>Phenotypes</h4><p class="dim">Plot-level yield-related traits: ear weight, total kernel weight, 20-kernel weight, derived cob weight, cob length, cob diameter - each with replicate records.</p></div>
    </div>
  </section>`;
}

function viConfoundSlide() {
  return `
  <section class="slide" data-title="Block × Nitrogen confound">
    <p class="kicker"><span class="gate warn">Design finding</span></p>
    <h2 class="h2">Block and Nitrogen are completely confounded</h2>
    <div class="grid g2 mt-l">
      <div class="card card-accent">
        <p class="kicker" style="margin:0">What the file naming says</p>
        <h3 style="margin:8px 0 10px">NW = High N · SW = Low N</h3>
        <p class="dim">Every NW-suffixed file contains only High-N plots; every SW-suffixed file contains only Low-N plots. This holds across all flights and both sensors.</p>
      </div>
      <div class="card">
        <p class="kicker" style="margin:0">Statistical implication</p>
        <p class="dim" style="margin-top:8px">Block and Nitrogen cannot be separated. Any apparent block effect is also a nitrogen effect.</p>
        <p class="dim" style="margin-top:8px"><b>Decision:</b> analyze HN and LN as independent strata.</p>
      </div>
    </div>
  </section>`;
}

function viQualityFlagsSlide() {
  return `
  <section class="slide" data-title="Quality flags">
    <p class="kicker">Two more data-quality facts</p>
    <h2 class="h2">Aug 2 partial flight + Multispectral VARI / ARVI explosion</h2>
    <div class="grid g2 mt-l">
      <div class="card">
        <h4>Aug 2 flight is partial</h4>
        <p class="dim">Only ~10% of typical row count, SW / Low-N plots only. <b>Decision:</b> drop Aug 2 from all downstream analysis.</p>
      </div>
      <div class="card">
        <h4>Multispectral VARI / ARVI exploded</h4>
        <p class="dim">Raw range up to ±2.5×10<sup>11</sup>; ~11.6% of MS VARI values are denominator-instability artifacts on calibrated reflectance bands. <b>Decision:</b> two-step winsorize.</p>
      </div>
    </div>
  </section>`;
}

function viDecisionsResolvedSlide() {
  return `
  <section class="slide" data-title="Decisions resolved">
    <p class="kicker"><span class="gate ok">Resolved</span></p>
    <h2 class="h2">Six review points settled, one open</h2>
    <ul class="resolved-list">
      <li><span class="tag">1 ✓</span><b>Design.</b> Analyze HN and LN separately. Block × Nitrogen confound stated in the manuscript.</li>
      <li><span class="tag">2 ✓</span><b>Aug 2 flight.</b> Dropped.</li>
      <li><span class="tag">3 ✓</span><b>Sensor-prefixed names.</b> <code>RGB_VARI</code> and <code>MS_VARI</code> are different predictors.</li>
      <li><span class="tag">4 ✓</span><b>Multispectral VARI / ARVI.</b> Two-step winsorize: drop <code>|x|&gt;1000</code>, then 1st/99th percentile clip.</li>
      <li><span class="tag">5 …</span><b>Temporal feature form.</b> Pending — this deck delivers the visualizations to inform the choice.</li>
      <li><span class="tag">6 ✓</span><b>Missing genotype × date cells.</b> Case-by-case with documentation; currently most missingness is 0–1 dates.</li>
    </ul>
  </section>`;
}

function viWinsorizationSlide(record) {
  const rows = record.rows.map((r) => `
    <tr>
      <td>${escapeHtml(r.Nitrogen)}</td>
      <td>${escapeHtml(r.Trait)}</td>
      <td class="num">${fmtNumber(r.NRaw, 0)}</td>
      <td class="num">${fmtNumber(r.NDroppedAsFailure, 0)}</td>
      <td class="num">${fmtNumber(r.PctDroppedAsFailure, 2)}%</td>
      <td class="num">${fmtNumber(r.Q01, 4)}</td>
      <td class="num">${fmtNumber(r.Q99, 4)}</td>
    </tr>`).join('');

  return `
  <section class="slide" data-title="Two-step winsorization">
    <p class="kicker">Method · live from <code>vi_winsorization_record.csv</code></p>
    <h2 class="h2">Two-step winsorization for Multispectral VARI / ARVI</h2>
    <p class="lede">Step 1 drops definitive failures (|x| &gt; 1000). Step 2 clips remaining values at the 1st / 99th percentile per (sensor, nitrogen, VI) stratum.</p>
    <table class="research">
      <thead><tr><th>Nitrogen</th><th>Trait</th><th>N raw</th><th>N dropped</th><th>% dropped</th><th>Q01</th><th>Q99</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="7">No record found</td></tr>'}</tbody>
    </table>
  </section>`;
}

function viDiagnosticsSlide(diagnostics) {
  const top = diagnostics.rows.slice(0, 12).map((r) => `
    <tr>
      <td>${escapeHtml(r.Sensor)}</td>
      <td>${escapeHtml(r.Trait)}</td>
      <td class="num">${fmtNumber(r.TotalRecords, 0)}</td>
      <td class="num">${fmtNumber(r.TotalExtremeForPlotting, 0)}</td>
      <td class="num">${fmtNumber(r.PctExtreme, 2)}%</td>
      <td class="num">${fmtNumber(r.StableMin, 3)}</td>
      <td class="num">${fmtNumber(r.StableMax, 3)}</td>
    </tr>`).join('');

  return `
  <section class="slide" data-title="VI diagnostics">
    <p class="kicker">Per-VI diagnostics · live from <code>vi_trait_diagnostics.csv</code></p>
    <h2 class="h2">Top extremes — what still needs attention</h2>
    <table class="research">
      <thead><tr><th>Sensor</th><th>Trait</th><th>Records</th><th>Extreme</th><th>% Extreme</th><th>Stable min</th><th>Stable max</th></tr></thead>
      <tbody>${top || '<tr><td colspan="7">No diagnostic data</td></tr>'}</tbody>
    </table>
    <p class="dim mt-l" style="font-size:13px">Top 12 by extreme count. Multispectral VARI / ARVI are the only VIs with material denominator instability.</p>
  </section>`;
}

function viCoverageSlide(coverageSummary) {
  const rows = coverageSummary.rows.map((r) => `
    <tr>
      <td>${escapeHtml(r.Sensor)}</td>
      <td>${escapeHtml(r.Nitrogen)}</td>
      <td class="num">${fmtNumber(r.Genotypes, 0)}</td>
      <td class="num">${fmtNumber(r.FullCoverageGenotypes, 0)}</td>
      <td class="num">${fmtNumber(r.Missing1, 0)}</td>
      <td class="num">${fmtNumber(r.Missing2OrMore, 0)}</td>
    </tr>`).join('');

  return `
  <section class="slide" data-title="Coverage">
    <p class="kicker">Post-decision coverage · live from <code>vi_post_decision_coverage_summary.csv</code></p>
    <h2 class="h2">Genotype × flight coverage after Aug 2 was dropped</h2>
    <table class="research">
      <thead><tr><th>Sensor</th><th>Nitrogen</th><th>Genotypes</th><th>Full coverage</th><th>Missing 1</th><th>Missing ≥ 2</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="6">No coverage data</td></tr>'}</tbody>
    </table>
  </section>`;
}

function viSectionDivider(num, title, lede) {
  return `
  <section class="slide section-divider" data-title="${escapeHtml(title)}">
    <div class="body">
      <p class="num">Section · ${num}</p>
      <h2 class="h2">${escapeHtml(title)}</h2>
      <p class="lede">${escapeHtml(lede)}</p>
    </div>
  </section>`;
}

function viFigureSlide(title, subtitle, figurePath, caption) {
  return `
  <section class="slide figure-slide" data-title="${escapeHtml(title)}">
    <p class="kicker">${escapeHtml(subtitle)}</p>
    <h2 class="h2" style="margin-bottom:4px">${escapeHtml(title)}</h2>
    <div class="fig-wrap"><img src="figures/${figurePath}" alt="${escapeHtml(title)}"></div>
    <p class="fig-caption">${caption}</p>
  </section>`;
}

function viFeatureCatalogSlide(featureSummary) {
  return `
  <section class="slide" data-title="Candidate temporal features">
    <p class="kicker">Feature options · candidate per (genotype, VI, N)</p>
    <h2 class="h2">Five candidate temporal feature forms</h2>
    <div class="feature-grid">
      <div class="feat"><div class="n">A</div><h4>Per-flight values</h4><p>All flights as separate columns. Maximum information, wide table; works naturally with G+P-BLUP.</p></div>
      <div class="feat"><div class="n">B</div><h4>Season mean</h4><p>One number per VI — average across the season. Compact baseline; loses timing.</p></div>
      <div class="feat"><div class="n">C</div><h4>Season max + day-of-max</h4><p>Captures peak greenness or canopy closure timing. Useful when VIs peak mid-season.</p></div>
      <div class="feat"><div class="n">D</div><h4>Early-to-late slope</h4><p>Linear regression slope of VI on DAF. Captures growth or senescence rate.</p></div>
      <div class="feat"><div class="n">E</div><h4>AUC over DAF</h4><p>Trapezoidal area under the trajectory. Compact and rotation-invariant in time.</p></div>
      <div class="feat" style="background:linear-gradient(135deg,var(--surface-2),var(--surface));border:1px solid var(--accent)"><div class="n">→</div><h4>Combination</h4><p>Mix forms per VI based on trajectory shape (proposed default).</p></div>
    </div>
    <p class="dim mt-l" style="font-size:14px">${featureSummary.rows.length} (Sensor × N × VI) feature rows pre-computed; see <code>cache/vi/vi_temporal_feature_summary.csv</code>.</p>
  </section>`;
}

function viFeatureSummarySlide(featureSummary) {
  const top = featureSummary.rows.slice(0, 14).map((r) => `
    <tr>
      <td>${escapeHtml(r.Sensor)}</td>
      <td>${escapeHtml(r.Nitrogen)}</td>
      <td>${escapeHtml(r.PrefixedTrait)}</td>
      <td class="num">${fmtNumber(r.Genotypes, 0)}</td>
      <td class="num">${fmtNumber(r.AUC_Median, 3)}</td>
      <td class="num">${fmtNumber(r.AUC_SD, 3)}</td>
      <td class="num">${fmtNumber(r.Slope_Median, 5)}</td>
      <td class="num">${fmtNumber(r.Slope_SD, 5)}</td>
    </tr>`).join('');

  return `
  <section class="slide" data-title="Feature summary">
    <p class="kicker">Per-VI feature summary · live from <code>vi_temporal_feature_summary.csv</code></p>
    <h2 class="h2">First 14 rows of the feature-stability table</h2>
    <table class="research">
      <thead><tr><th>Sensor</th><th>N</th><th>VI</th><th>Lines</th><th>AUC median</th><th>AUC SD</th><th>Slope median</th><th>Slope SD</th></tr></thead>
      <tbody>${top || '<tr><td colspan="8">No feature summary</td></tr>'}</tbody>
    </table>
  </section>`;
}

function viPatternCategorySummarySlide(patternCategories) {
  const grouped = new Map();
  for (const r of patternCategories.rows) {
    const key = `${r.Sensor}|||${r.PatternCategory}`;
    const current = grouped.get(key) || {
      Sensor: r.Sensor,
      PatternCategory: r.PatternCategory,
      Count: 0,
      Flagged: 0
    };
    current.Count += 1;
    if (r.ReviewFlag && r.ReviewFlag.trim()) {
      current.Flagged += 1;
    }
    grouped.set(key, current);
  }
  const rows = Array.from(grouped.values())
    .sort((a, b) => (
      sensorOrder(a.Sensor) - sensorOrder(b.Sensor) ||
      b.Count - a.Count ||
      a.PatternCategory.localeCompare(b.PatternCategory)
    ))
    .map((r) => `
      <tr>
        <td>${escapeHtml(r.Sensor)}</td>
        <td>${escapeHtml(r.PatternCategory)}</td>
        <td class="num">${fmtNumber(r.Count, 0)}</td>
        <td class="num">${fmtNumber(r.Flagged, 0)}</td>
      </tr>`)
    .join('');

  return `
  <section class="slide" data-title="VI pattern groups">
    <p class="kicker">Trajectory categories · live from <code>vi_trajectory_pattern_categories.csv</code></p>
    <h2 class="h2">VI trajectories separate into broad shape families</h2>
    <p class="lede">Categories are assigned from paired High-N and Low-N standardized median trajectories, so each VI is grouped by shape rather than raw scale.</p>
    <table class="research">
      <thead><tr><th>Sensor</th><th>Pattern category</th><th>VIs</th><th>Review flags</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="4">No pattern-category table found</td></tr>'}</tbody>
    </table>
  </section>`;
}

function viRgbDateJumpSummarySlide(rgbDateJumps) {
  const candidates = rgbDateJumps.rows
    .filter((r) => r.CandidateOutlierDate === 'TRUE' || r.CandidateOutlierDate === true)
    .sort((a, b) => (
      nitrogenOrder(a.Nitrogen) - nitrogenOrder(b.Nitrogen) ||
      Number(a.DateJumpRank) - Number(b.DateJumpRank)
    ))
    .slice(0, 8);

  const rows = candidates.map((r) => `
    <tr>
      <td>${escapeHtml(r.Nitrogen)}</td>
      <td>${escapeHtml(r.Date)}</td>
      <td class="num">${fmtNumber(r.DAF, 0)}</td>
      <td class="num">${fmtNumber(r.MedianAbsStepZ, 3)}</td>
      <td class="num">${fmtNumber(r.OutlierTraitCount, 0)}</td>
      <td class="num">${fmtNumber(r.OutlierTraitPct, 1)}%</td>
    </tr>`)
    .join('');

  return `
  <section class="slide" data-title="RGB outlier dates">
    <p class="kicker">RGB non-smoothness · live from <code>rgb_date_jump_summary.csv</code></p>
    <h2 class="h2">Candidate RGB dates to check against flight logs</h2>
    <p class="lede">These dates have the largest standardized jumps from the previous RGB flight. The deck flags them statistically; weather, flight time, cloud cover, and processing logs are still needed for cause.</p>
    <table class="research">
      <thead><tr><th>Nitrogen</th><th>Date</th><th>DAF</th><th>Median jump</th><th>Outlier VIs</th><th>Outlier %</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="6">No RGB candidate outlier dates found</td></tr>'}</tbody>
    </table>
  </section>`;
}

function viPcaVarianceSummarySlide(pcaVariance) {
  const rows = pcaVariance.rows
    .filter((r) => ['PC1', 'PC2', 'PC3'].includes(r.PC))
    .sort((a, b) => (
      sensorOrder(a.Sensor) - sensorOrder(b.Sensor) ||
      Number(a.PC.replace('PC', '')) - Number(b.PC.replace('PC', ''))
    ))
    .map((r) => `
      <tr>
        <td>${escapeHtml(r.Sensor)}</td>
        <td>${escapeHtml(r.PC)}</td>
        <td class="num">${fmtNumber(100 * Number(r.VarianceExplained), 1)}%</td>
        <td class="num">${fmtNumber(100 * Number(r.CumulativeVariance), 1)}%</td>
      </tr>`)
    .join('');

  return `
  <section class="slide" data-title="PCA variance">
    <p class="kicker">PCA pattern separation · live from <code>vi_trajectory_pca_variance.csv</code></p>
    <h2 class="h2">PCA captures major VI trajectory-pattern axes</h2>
    <p class="lede">PCA is run separately by sensor using paired High-N / Low-N temporal profiles for each VI.</p>
    <table class="research">
      <thead><tr><th>Sensor</th><th>PC</th><th>Variance</th><th>Cumulative</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="4">No PCA variance table found</td></tr>'}</tbody>
    </table>
  </section>`;
}

function viOpenDecisionsSlide() {
  return `
  <section class="slide" data-title="Open decisions">
    <p class="kicker"><span class="gate warn">Project-lead review</span></p>
    <h2 class="h2">Four decisions to settle before Phase 2 modeling</h2>
    <div>
      <div class="decision-row"><div class="k">Temporal feature form<span class="s">Phase 4 input</span></div><div class="v">Pick one or a combination of the five candidates. Proposed: AUC for monotone-shape VIs, per-flight values for peak-shape VIs.</div></div>
      <div class="decision-row"><div class="k">VI subset<span class="s">Phase 4 input</span></div><div class="v">Drop redundant VIs (proposed: |r| &gt; 0.95 in the AUC correlation). Confirm retained set per sensor.</div></div>
      <div class="decision-row"><div class="k">Partial-coverage genotypes<span class="s">Phase 4 input</span></div><div class="v">Exclude from AUC/slope features, or impute the one missing flight? Proposed: exclude for AUC/slope, include for SeasonMean.</div></div>
      <div class="decision-row"><div class="k">HN/LN side-by-side reporting<span class="s">Phase 2 + 4</span></div><div class="v">Confirm G-BLUP and G+P-BLUP are fit per nitrogen treatment, with results reported side by side (not pooled).</div></div>
    </div>
  </section>`;
}

function viNextAnalysisSlide() {
  return `
  <section class="slide" data-title="Next analysis">
    <p class="kicker">Coming up</p>
    <h2 class="h2">Phase 2 — stage-1 yield BLUEs + baseline G-BLUP</h2>
    <div class="grid g2 mt-l">
      <div class="card"><h4>Stage-1 spatial model</h4><p class="dim">Within-trial spatial / row-column / AR1×AR1 / augmented-design fit to plot-level yield → genotype BLUEs adjusted for spatial gradients and design effects. Computed per nitrogen treatment.</p></div>
      <div class="card"><h4>Heritability</h4><p class="dim">Narrow-sense h² per trait per N from the genomic relationship matrix on stage-1 inputs. Sets the accuracy ceiling.</p></div>
      <div class="card"><h4>Genomic QC + GRM</h4><p class="dim">Marker call rate, MAF, sample missingness, VanRaden GRM, PCA for BGEM structure, relatedness checks.</p></div>
      <div class="card card-accent"><h4>Baseline G-BLUP under CV2</h4><p class="dim">Lock leave-lines-out folds once; reuse across every later VI-assisted model. Reports accuracy, bias, and uncertainty.</p></div>
    </div>
  </section>`;
}

function viOutputMapSlide() {
  return `
  <section class="slide" data-title="Output map">
    <p class="kicker">Where the Phase-1 outputs live</p>
    <h2 class="h2">Outputs</h2>
    <div class="grid g2 mt-l">
      <div class="card"><h4>Source</h4><p class="dim">
        <code>profiling/1.pheno/01_vi_trait_interpretation.Rmd</code><br>
        <code>profiling/1.pheno/02_vi_temporal_features.Rmd</code><br>
        <code>reports/01_vi_trait_interpretation.html</code><br>
        <code>reports/02_vi_temporal_features.html</code><br>
        <code>/slides/vi-results/</code> (this deck, live)
      </p></div>
      <div class="card"><h4>Cache + graphs</h4><p class="dim">
        <code>cache/vi/*.csv</code> — diagnostics, manifests, features, correlations<br>
        <code>graphs/vi_by_nitrogen_date/*.png</code> — per-N date-wise plots<br>
        <code>graphs/vi_temporal/*.png</code> — trajectories + heatmaps
      </p></div>
    </div>
    <p class="dim mt-l" style="font-size:14px;text-align:center">Press <b>T</b> to cycle themes · <b>← →</b> navigate · <b>O</b> overview · <b>S</b> presenter</p>
  </section>`;
}

function renderViResultsDeck() {
  const winsorization = readCsvSafe('cache/vi/vi_winsorization_record.csv');
  const diagnostics = readCsvSafe('cache/vi/vi_trait_diagnostics.csv');
  const coverageSummary = readCsvSafe('cache/vi/vi_post_decision_coverage_summary.csv');
  const featureSummary = readCsvSafe('cache/vi/vi_temporal_feature_summary.csv');
  const plotManifest = readCsvSafe('cache/vi/vi_plot_manifest.csv');
  const patternCategories = readCsvSafe('cache/vi_patterns/vi_trajectory_pattern_categories.csv');
  const rgbDateJumps = readCsvSafe('cache/vi_patterns/rgb_date_jump_summary.csv');
  const pcaVariance = readCsvSafe('cache/vi_patterns/vi_trajectory_pca_variance.csv');

  const trajectories = listGraphPngs('graphs/vi_temporal')
    .filter((f) => f.startsWith('trajectories_'))
    .sort(compareViFigureFiles('trajectory'));
  const correlations = listGraphPngs('graphs/vi_temporal')
    .filter((f) => f.startsWith('vi_vi_corr_'))
    .sort(compareViFigureFiles('correlation'));
  const manifestDateWise = plotManifest.rows
    .map((r) => r.PNG)
    .filter(Boolean);
  const dateWise = (manifestDateWise.length > 0
    ? manifestDateWise
    : listGraphPngs('graphs/vi_by_nitrogen_date'))
    .sort(compareViFigureFiles('date'));
  const patternFigures = listGraphPngs('graphs/vi_patterns')
    .sort(comparePatternFigureFiles);

  const slides = [];

  // Static introduction (placeholder for count first)
  const intro = [
    viFlowSlide(),
    viDatasetSlide(coverageSummary),
    viConfoundSlide(),
    viQualityFlagsSlide(),
    viDecisionsResolvedSlide(),
    viWinsorizationSlide(winsorization),
    viDiagnosticsSlide(diagnostics),
    viCoverageSlide(coverageSummary)
  ];

  const dateSlides = [viSectionDivider('A', 'Date-wise distributions',
    'Date-wise VI distributions comparing High N and Low N side by side before temporal summaries.')];
  for (const f of dateWise) {
    const { sensor, group, nitrogen } = humanizeDateWiseName(f);
    dateSlides.push(viFigureSlide(
      `${sensor} · ${group}`,
      `Date-wise High-N / Low-N distributions`,
      `vi_by_nitrogen_date/${f}`,
      `High N and Low N boxplots are shown side by side for each flight date; black dots mark treatment-specific means. ${escapeHtml(nitrogen)}. <code>graphs/vi_by_nitrogen_date/${f}</code>`
    ));
  }

  const trajectorySlides = [viSectionDivider('B', 'Temporal trajectories',
    'Per-genotype trajectories with IQR ribbons across all VI groups and treatments. Live from graphs/vi_temporal/.')];
  for (const f of trajectories) {
    const { group, nitrogen } = humanizeTrajectoryName(f);
    trajectorySlides.push(viFigureSlide(
      `${group} · ${nitrogen}`,
      `Genotype trajectories`,
      `vi_temporal/${f}`,
      `Thin grey = per-genotype trajectory · ribbon = IQR · solid line = median. <code>graphs/vi_temporal/${f}</code>`
    ));
  }

  const corrSlides = [viSectionDivider('C', 'VI–VI redundancy',
    'AUC-based VI–VI Pearson correlation heatmaps. Use to pick the retained VI subset per sensor × nitrogen.')];
  for (const f of correlations) {
    const { sensor, nitrogen } = humanizeCorrelationName(f);
    corrSlides.push(viFigureSlide(
      `${sensor} · ${nitrogen}`,
      `AUC-based VI–VI correlation`,
      `vi_temporal/${f}`,
      `Genotype-level Pearson correlation across VIs computed on AUC over DAF. <code>graphs/vi_temporal/${f}</code>`
    ));
  }

  const patternSlides = [viSectionDivider('D', 'VI pattern diagnostics',
    'Treatment-paired trajectory categories, RGB outlier-date diagnostics, and PCA-style VI pattern separation.')];
  patternSlides.push(viPatternCategorySummarySlide(patternCategories));
  patternSlides.push(viRgbDateJumpSummarySlide(rgbDateJumps));
  patternSlides.push(viPcaVarianceSummarySlide(pcaVariance));
  for (const f of patternFigures) {
    const info = patternFigureInfo(f);
    patternSlides.push(viFigureSlide(
      info.title,
      info.subtitle,
      `vi_patterns/${f}`,
      info.caption
    ));
  }

  const closing = [
    viFeatureCatalogSlide(featureSummary),
    viFeatureSummarySlide(featureSummary),
    viOpenDecisionsSlide(),
    viNextAnalysisSlide(),
    viOutputMapSlide()
  ];

  const total = 1 + intro.length + trajectorySlides.length + corrSlides.length + dateSlides.length + patternSlides.length + closing.length;
  const now = new Date().toISOString().split('T')[0];

  slides.push(viCoverSlide(now, total));
  slides.push(...intro, ...dateSlides, ...trajectorySlides, ...corrSlides, ...patternSlides, ...closing);

  return `<!DOCTYPE html>
<html lang="en" data-theme="swiss-grid">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>UAV-for-GS · VI Results · Live</title>
<link rel="stylesheet" href="assets/fonts.css">
<link rel="stylesheet" href="assets/base.css">
<link rel="stylesheet" id="theme-link" href="assets/themes/swiss-grid.css">
<link rel="stylesheet" href="assets/animations/animations.css">
<style>${viDeckCss()}</style>
</head>
<body data-themes="swiss-grid,minimal-white,academic-paper,blueprint,corporate-clean" data-theme-base="assets/themes/">
<div class="deck">
${slides.join('\n')}
</div>
<script src="assets/runtime.js"></script>
</body></html>`;
}

// ----- Dynamic Agronomic Trait QC deck -----
//
// Reads cache/agronomic_traits/*.csv and graphs/agronomic_traits/*.png at
// request time so the deck always reflects the latest re-render of
// profiling/1.pheno/04_agronomic_trait_qc.Rmd.

function renderAgronomicQcDeck() {
  const inventory = readCsvSafe('cache/agronomic_traits/manual_trait_file_inventory.csv');
  const strataCounts = readCsvSafe('cache/agronomic_traits/manual_trait_strata_record_counts.csv');
  const missingness = readCsvSafe('cache/agronomic_traits/manual_trait_missingness_summary.csv');
  const traitSummary = readCsvSafe('cache/agronomic_traits/manual_trait_summary.csv');
  const outliers = readCsvSafe('cache/agronomic_traits/manual_trait_outlier_summary.csv');
  const extremeOutliers = readCsvSafe('cache/agronomic_traits/manual_trait_extreme_outlier_summary.csv');
  const blockByExperiment = readCsvSafe('cache/agronomic_traits/manual_trait_block_by_experiment.csv');
  const derivedCwQc = readCsvSafe('cache/agronomic_traits/manual_trait_derived_cw_qc.csv');
  const strataNDiff = readCsvSafe('cache/agronomic_traits/manual_trait_strata_nitrogen_difference.csv');

  const fmt = (v, d = 2) => fmtNumber(v, d);
  const totalRecords = inventory.rows.reduce((sum, r) => sum + Number(r.Rows || 0), 0);

  const slides = [];
  const now = new Date().toISOString().split('T')[0];

  // 1. Cover (placeholder total set below)
  const coverPlaceholder = '__TOTAL_SLIDES__';
  slides.push(`
  <section class="slide" data-title="Cover">
    <div class="deck-header"><span class="eyebrow">Phenotype QC · Live</span><span class="eyebrow">UAV-for-GS · BGEM 2023</span></div>
    <p class="kicker">Phase 1 · Manual agronomic trait QC</p>
    <h1 class="h1 anim-fade-up" data-anim="fade-up">
      Agronomic trait <span class="gradient-text">quality control</span><br>
      and heterosis by subpopulation
    </h1>
    <p class="lede">Manual plot-level measurements of yield-related traits in 2023 BGEM. Stratified by inbred / hybrid x SS / NSS x N treatment. Live from <code>cache/agronomic_traits/</code>.</p>
    <div class="row wrap mt-l">
      <span class="pill pill-accent">${totalRecords} plot records</span>
      <span class="pill">6 traits</span>
      <span class="pill">SS x Mo17 / NSS x B73</span>
      <span class="pill">BK1/BK3 = HN · BK2/BK4 = LN</span>
    </div>
    <div class="deck-footer"><span class="dim2">Jinliang Yang lab · ${escapeHtml(now)}</span><span class="slide-number" data-current="1" data-total="${coverPlaceholder}"></span></div>
  </section>`);

  // 2. Design block
  slides.push(`
  <section class="slide" data-title="Field design">
    <p class="kicker"><span class="gate warn">Design constraints</span></p>
    <h2 class="h2">BK1/BK3 = High N · BK2/BK4 = Low N · Subpop encoded in genotype name</h2>
    <div class="grid g2 mt-l">
      <div class="card">
        <h4>Population structure</h4>
        <p class="dim"><b>pop = inb</b>: inbred lines, incomplete randomized block design with <code>sublock</code>.<br>
        <b>pop = hyb</b>: hybrid lines, completely randomized design.<br>
        Inbred and hybrid sections are in different parts of the field.</p>
      </div>
      <div class="card">
        <h4>Subpopulation rules</h4>
        <p class="dim"><b>Inbred suffix</b>: <code>BGEM-####-S</code> = SS · <code>BGEM-####-N</code> = NSS.<br>
        <b>Hybrid crosses</b>: <code>SS x Mo17</code> and <code>NSS x B73</code>.<br>
        Each inbred therefore has exactly one matched hybrid.</p>
      </div>
      <div class="card card-accent" style="grid-column:span 2">
        <h4>Trait construction</h4>
        <p class="dim">The Excel workbook measures ear weight, total kernel weight, 20-kernel weight, cob length, and cob diameter. The analysis keeps six traits by deriving <code>CW = Ear Weight - Total Kernel Weight</code>.</p>
      </div>
    </div>
  </section>`);

  // 3. Dataset snapshot
  slides.push(`
  <section class="slide" data-title="Dataset snapshot">
    <p class="kicker">Inputs</p>
    <h2 class="h2">2023 BGEM agronomic trait file</h2>
    <div class="stat-row">
      <div class="stat"><div class="v">${fmt(totalRecords, 0)}</div><div class="l">Plot records</div><div class="n">Combined HN + LN, inbred + hybrid</div></div>
      <div class="stat"><div class="v">${fmt(traitSummary.rows.length || 6, 0)}</div><div class="l">Traits</div><div class="n">ear weight, TKW, 20KW, CW, cob length, cob diameter</div></div>
      <div class="stat"><div class="v">${fmt(blockByExperiment.rows.length || 4, 0)}</div><div class="l">Blocks</div><div class="n">BK1/BK3 (HN), BK2/BK4 (LN)</div></div>
      <div class="stat"><div class="v">2 x 2</div><div class="l">Strata</div><div class="n">Inbred / Hybrid x SS / NSS</div></div>
    </div>
    <p class="dim mt-l" style="font-size:14px">Live counts from <code>cache/agronomic_traits/manual_trait_strata_record_counts.csv</code>.</p>
  </section>`);

  // 4. Strata counts table
  slides.push(`
  <section class="slide" data-title="Strata counts">
    <p class="kicker">Records per (pop x Subpop x N)</p>
    <h2 class="h2">Stratified record counts</h2>
    <table class="research">
      <thead><tr><th>Population</th><th>Subpop</th><th>High N</th><th>Low N</th></tr></thead>
      <tbody>${strataCounts.rows.map((r) => `
        <tr><td>${escapeHtml(r.pop)}</td><td>${escapeHtml(r.Subpop)}</td>
        <td class="num">${fmt(r['High N'], 0)}</td><td class="num">${fmt(r['Low N'], 0)}</td></tr>`).join('')}</tbody>
    </table>
    <p class="dim mt-l" style="font-size:14px">Inbred and hybrid plot counts are roughly balanced within each N treatment; SS has ~50% more lines than NSS in each population.</p>
  </section>`);

  // 5. Missingness
  slides.push(`
  <section class="slide" data-title="Missingness">
    <p class="kicker">Data completeness</p>
    <h2 class="h2">Per-column missing values</h2>
    <table class="research">
      <thead><tr><th>Column</th><th>Missing</th><th>% Missing</th></tr></thead>
      <tbody>${missingness.rows.filter((r) => Number(r.Missing) > 0).slice(0, 15).map((r) => `
        <tr><td>${escapeHtml(r.Column)}</td><td class="num">${fmt(r.Missing, 0)}</td><td class="num">${fmt(r.PctMissing, 2)}%</td></tr>`).join('') || '<tr><td colspan="3">No missing values in any column.</td></tr>'}</tbody>
    </table>
  </section>`);

  // 6. Trait summary
  slides.push(`
  <section class="slide" data-title="Trait summary">
    <p class="kicker">Distribution stats per trait</p>
    <h2 class="h2">Manual trait summary</h2>
    <table class="research">
      <thead><tr><th>Trait</th><th>N</th><th>Mean</th><th>SD</th><th>Median</th><th>Min</th><th>Max</th></tr></thead>
      <tbody>${traitSummary.rows.map((r) => `
        <tr><td>${escapeHtml(r.TraitLabel)}</td><td class="num">${fmt(r.N, 0)}</td>
        <td class="num">${fmt(r.Mean, 2)}</td><td class="num">${fmt(r.SD, 2)}</td>
        <td class="num">${fmt(r.Median, 2)}</td><td class="num">${fmt(r.Min, 2)}</td><td class="num">${fmt(r.Max, 2)}</td></tr>`).join('')}</tbody>
    </table>
    <p class="dim mt-l" style="font-size:14px">From <code>cache/agronomic_traits/manual_trait_summary.csv</code>.</p>
  </section>`);

  // 7. Outliers
  slides.push(`
  <section class="slide" data-title="Outliers">
    <p class="kicker"><span class="gate warn">For review</span></p>
    <h2 class="h2">Extreme outliers set to NA</h2>
    <table class="research">
      <thead><tr><th>Trait</th><th>Group</th><th>Reason</th><th>Records set NA</th></tr></thead>
      <tbody>${extremeOutliers.rows.map((r) => `
        <tr><td>${escapeHtml(r.TraitLabel)}</td><td>${escapeHtml(r.TraitGroup)}</td><td>${escapeHtml(r.ExtremeOutlierReason)}</td><td class="num">${fmt(r.RecordsSetToNA, 0)}</td></tr>`).join('') || '<tr><td colspan="4">No extreme outliers were set to NA.</td></tr>'}</tbody>
    </table>
    <p class="dim mt-l" style="font-size:14px">Extreme values beyond the 3 x IQR outer fence are set to NA and written to <code>manual_trait_extreme_outlier_records.csv</code>. Derived CW is <code>Ear Weight - Total Kernel Weight</code>; negative derived CW records are written to <code>manual_trait_derived_cw_qc.csv</code> (${fmt(derivedCwQc.rows.length, 0)} record). Milder 1.5 x IQR flags remain in <code>manual_trait_outlier_records.csv</code>.</p>
  </section>`);

  // 8. Trait distribution figure
  slides.push(`
  <section class="slide figure-slide" data-title="Distributions by block and N">
    <p class="kicker">Block-level distributions</p>
    <h2 class="h2">Trait values by block within N treatment</h2>
    <div class="fig-wrap"><img src="figures/agronomic_traits/manual_trait_distributions_by_block_nitrogen.png" alt="Trait distributions by block and N"></div>
    <p class="fig-caption">Boxplots with plot-level dots for each block. Lowercase letters are Tukey HSD compact groups across blocks within each trait. <code>graphs/agronomic_traits/manual_trait_distributions_by_block_nitrogen.png</code></p>
  </section>`);

  // 9. Stratified distributions
  slides.push(`
  <section class="slide figure-slide" data-title="Stratified distributions">
    <p class="kicker">Inbred / Hybrid x SS / NSS x N</p>
    <h2 class="h2">Stratified trait distributions</h2>
    <div class="fig-wrap"><img src="figures/agronomic_traits/manual_trait_distributions_by_strata.png" alt="Stratified distributions"></div>
    <p class="fig-caption">Trait values split by population x subpopulation x N treatment. <code>graphs/agronomic_traits/manual_trait_distributions_by_strata.png</code></p>
  </section>`);

  // 10. Stratified HN-LN difference
  slides.push(`
  <section class="slide" data-title="Stratified HN-LN difference">
    <p class="kicker">HN-vs-LN Cohen's d per stratum</p>
    <h2 class="h2">Where the N gap is biggest</h2>
    <table class="research">
      <thead><tr><th>Trait</th><th>Pop</th><th>Subpop</th><th>Mean HN</th><th>Mean LN</th><th>Diff (H-L)</th><th>Cohen's d</th></tr></thead>
      <tbody>${strataNDiff.rows.slice(0, 14).map((r) => `
        <tr><td>${escapeHtml(r.TraitLabel)}</td><td>${escapeHtml(r.pop)}</td><td>${escapeHtml(r.Subpop)}</td>
        <td class="num">${fmt(r.MeanHN, 2)}</td><td class="num">${fmt(r.MeanLN, 2)}</td>
        <td class="num">${fmt(r.MeanDiff_HighMinusLow, 2)}</td><td class="num">${fmt(r.CohensD, 3)}</td></tr>`).join('')}</tbody>
    </table>
    <p class="dim mt-l" style="font-size:14px">Top 14 rows sorted by |Cohen's d|. Full table at <code>cache/agronomic_traits/manual_trait_strata_nitrogen_difference.csv</code>.</p>
  </section>`);

  // 11. Heterosis section divider
  slides.push(`
  <section class="slide section-divider" data-title="Heterosis">
    <div class="body">
      <p class="num">Section · Heterosis</p>
      <h2 class="h2">Hybrid vs.<br>matched inbred</h2>
      <p class="lede">(Hybrid_mean - Inbred_mean) / Inbred_mean, matched on the BGEM parent and computed per subpopulation x N treatment.</p>
    </div>
  </section>`);

  // 13. Heterosis boxplot
  slides.push(`
  <section class="slide figure-slide" data-title="Heterosis distributions">
    <p class="kicker">% heterosis distributions</p>
    <h2 class="h2">Percent heterosis by subpop x N</h2>
    <div class="fig-wrap"><img src="figures/agronomic_traits/manual_trait_percent_heterosis_boxplot.png" alt="% heterosis"></div>
    <p class="fig-caption">Per-trait distribution of (Hybrid - Inbred) / Inbred across paired genotypes. <code>graphs/agronomic_traits/manual_trait_percent_heterosis_boxplot.png</code></p>
  </section>`);

  // 14. Heterosis scatter
  slides.push(`
  <section class="slide figure-slide" data-title="Hybrid vs inbred">
    <p class="kicker">Paired genotype scatter</p>
    <h2 class="h2">Hybrid mean vs. matched-inbred mean</h2>
    <div class="fig-wrap"><img src="figures/agronomic_traits/manual_trait_heterosis_scatter.png" alt="Hybrid vs inbred scatter"></div>
    <p class="fig-caption">Each point is one inbred-hybrid pair. Points above the 1:1 line have positive heterosis. <code>graphs/agronomic_traits/manual_trait_heterosis_scatter.png</code></p>
  </section>`);

  // 15. Correlation heatmap
  slides.push(`
  <section class="slide figure-slide" data-title="Trait correlations">
    <p class="kicker">Genotype x treatment mean correlations</p>
    <h2 class="h2">Correlations among manual traits</h2>
    <div class="fig-wrap"><img src="figures/agronomic_traits/manual_trait_correlation_heatmap.png" alt="Trait correlations"></div>
    <p class="fig-caption">Pearson r on genotype x treatment means, Overall + HN + LN panels. <code>graphs/agronomic_traits/manual_trait_correlation_heatmap.png</code></p>
  </section>`);

  // 16. Key findings + open decisions
  slides.push(`
  <section class="slide" data-title="Key findings">
    <p class="kicker"><span class="gate ok">Findings</span></p>
    <h2 class="h2">What the QC shows</h2>
    <ul class="resolved-list">
      <li><span class="tag">Design ✓</span><b>BK1/BK3 = HN, BK2/BK4 = LN.</b> Stratification by (pop x Subpop) makes the section confound explicit.</li>
      <li><span class="tag">Traits ✓</span><b>Six traits are analyzed.</b> Kernel / ear traits: ear weight, TKW, 20KW. Cob traits: CW, cob length, cob diameter.</li>
      <li><span class="tag">Heterosis ✓</span><b>Matched hybrid vs. inbred contrasts are recomputed</b> for every retained trait, subpopulation, and N treatment after extreme-outlier masking.</li>
      <li><span class="tag">Outliers</span><b>Extreme records are set to NA</b> using a 3 x IQR outer fence; impossible derived CW values are also masked and exported for field-sheet review.</li>
    </ul>
  </section>`);

  // 17. Output map
  slides.push(`
  <section class="slide" data-title="Output map">
    <p class="kicker">Where the outputs live</p>
    <h2 class="h2">Outputs</h2>
    <div class="grid g2 mt-l">
      <div class="card"><h4>Source</h4><p class="dim">
        <code>profiling/1.pheno/04_agronomic_trait_qc.Rmd</code><br>
        <code>data/2023_BGEM_pheno_transformed_raw.xlsx</code><br>
        <code>reports/04_agronomic_trait_qc.html</code><br>
        <code>/slides/agronomic-trait-qc/</code> (this deck, live)
      </p></div>
      <div class="card"><h4>Cache + graphs</h4><p class="dim">
        <code>cache/agronomic_traits/</code> — CSV diagnostics (inventory, summary, strata, heterosis, correlations, t-tests, outlier exclusions)<br>
        <code>graphs/agronomic_traits/</code> — distributions, stratified distributions, heterosis boxplot, heterosis scatter, correlation heatmap
      </p></div>
    </div>
    <p class="dim mt-l" style="font-size:14px;text-align:center">Press <b>T</b> to cycle themes · <b>← →</b> navigate · <b>O</b> overview · <b>S</b> presenter</p>
  </section>`);

  const total = slides.length;
  const numberedSlides = slides.map((slide, index) => {
    const current = index + 1;
    const withTotal = slide.replace(coverPlaceholder, String(total));
    if (withTotal.includes('slide-number')) {
      return withTotal
        .replace(/data-current="[^"]+"/, `data-current="${current}"`)
        .replace(/data-total="[^"]+"/, `data-total="${total}"`);
    }
    return withTotal.replace(
      '</section>',
      `\n    <div class="deck-footer"><span class="dim2"></span><span class="slide-number" data-current="${current}" data-total="${total}"></span></div>\n  </section>`
    );
  });
  const html = numberedSlides.join('\n');

  return `<!DOCTYPE html>
<html lang="en" data-theme="swiss-grid">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>UAV-for-GS · Agronomic Trait QC · Live</title>
<link rel="stylesheet" href="assets/fonts.css">
<link rel="stylesheet" href="assets/base.css">
<link rel="stylesheet" id="theme-link" href="assets/themes/swiss-grid.css">
<link rel="stylesheet" href="assets/animations/animations.css">
<style>${viDeckCss()}</style>
</head>
<body data-themes="swiss-grid,minimal-white,academic-paper,blueprint,corporate-clean" data-theme-base="assets/themes/">
<div class="deck">
${html}
</div>
<script src="assets/runtime.js"></script>
</body></html>`;
}

function renderViQc2Deck() {
  const groupInv = readCsvSafe('cache/vi_qc2/vi_qc2_group_inventory.csv');
  const genoInv = readCsvSafe('cache/vi_qc2/vi_qc2_genotype_inventory.csv');
  const checkRep = readCsvSafe('cache/vi_qc2/vi_qc2_check_plot_replication.csv');
  const outlierSummary = readCsvSafe('cache/vi_qc2/vi_qc2_extreme_outlier_summary.csv');
  const checkViolations = readCsvSafe('cache/vi_qc2/vi_qc2_check_greenness_violation_rollup.csv');
  const bgemStrata = readCsvSafe('cache/vi_qc2/vi_qc2_bgem_strata_counts.csv');
  const bgemStrataRows = readCsvSafe('cache/vi_qc2/vi_qc2_bgem_strata_rows.csv');
  const bgemGreenness = readCsvSafe('cache/vi_qc2/vi_qc2_bgem_greenness_rollup.csv');
  const heterosisCompare = readCsvSafe('cache/vi_qc2/vi_qc2_bgem_heterosis_greenness_compare.csv');
  const nonBgemHybrid = readCsvSafe('cache/vi_qc2/vi_qc2_non_bgem_hybrid_greenness.csv');

  const fmt = (v, d = 2) => fmtNumber(v, d);
  const totalPlotRecords = groupInv.rows.reduce((s, r) => s + Number(r.Rows || 0), 0);
  const totalGenotypes = genoInv.rows.reduce((s, r) => s + Number(r.Genotypes || 0), 0);

  const violatingRows = checkViolations.rows.filter((r) => Number(r.DatesViolating) > 0);
  const rgbViolations = violatingRows.filter((r) => r.Sensor === 'RGB');
  const msViolations = violatingRows.filter((r) => r.Sensor === 'Multispectral');

  const slides = [];
  const now = new Date().toISOString().split('T')[0];
  const coverPlaceholder = '__TOTAL_SLIDES__';

  // 1. Cover
  slides.push(`
  <section class="slide" data-title="Cover">
    <div class="deck-header"><span class="eyebrow">Phenotype QC · Live</span><span class="eyebrow">UAV-for-GS · BGEM 2023</span></div>
    <p class="kicker">Phase 1 · VI trait QC, round 2</p>
    <h1 class="h1 anim-fade-up" data-anim="fade-up">
      VI trait <span class="gradient-text">quality control</span><br>
      checks first, then BGEM strata
    </h1>
    <p class="lede">Mirror the agronomic QC strategy on VI data. Sanity-check the canonical greenness indices on B73 / Mo17 / B73 x Mo17, then stratify BGEM lines into Inbred / Hybrid x SS / NSS for each N treatment. Live from <code>cache/vi_qc2/</code>.</p>
    <div class="row wrap mt-l">
      <span class="pill pill-accent">${fmt(totalPlotRecords, 0)} plot x date records</span>
      <span class="pill">${fmt(totalGenotypes, 0)} genotypes</span>
      <span class="pill">RGB + Multispectral</span>
      <span class="pill">NW = HN · SW = LN (1 block / N)</span>
    </div>
    <div class="deck-footer"><span class="dim2">Jinliang Yang lab · ${escapeHtml(now)}</span><span class="slide-number" data-current="1" data-total="${coverPlaceholder}"></span></div>
  </section>`);

  // 2. Design constraint
  slides.push(`
  <section class="slide" data-title="Design constraint">
    <p class="kicker"><span class="gate warn">Design difference vs. agronomic</span></p>
    <h2 class="h2">One block per N treatment, not two</h2>
    <div class="grid g2 mt-l">
      <div class="card">
        <h4>Agronomic</h4>
        <p class="dim">Two blocks per N treatment (<b>BK1/BK3 = HN</b>, <b>BK2/BK4 = LN</b>). Block-level replication exists, so plot-level variance can be estimated within treatment.</p>
      </div>
      <div class="card">
        <h4>VI</h4>
        <p class="dim">One block per N treatment: every <code>_NW</code> file is HN, every <code>_SW</code> file is LN. No within-treatment block replication for BGEM lines - they get one plot per date per N. Replication is purely <b>temporal</b> across flight dates.</p>
      </div>
      <div class="card card-accent" style="grid-column:span 2">
        <h4>Why this changes the QC strategy</h4>
        <p class="dim">For BGEM lines we cannot estimate within-treatment plot variance from VI alone. The named checks (B73, Mo17, B73 x Mo17) are the only genotypes with plot-level replication (22-33 plots per date x N file), so they carry the within-treatment sanity check. BGEM strata are then compared HN vs. LN using genotype-as-replicate.</p>
      </div>
    </div>
  </section>`);

  // 3. Genotype groups + record counts
  slides.push(`
  <section class="slide" data-title="Group inventory">
    <p class="kicker">Records and genotypes per group</p>
    <h2 class="h2">Group structure used by this QC</h2>
    <table class="research">
      <thead><tr><th>pop</th><th>Group</th><th>Subpop</th><th>Genotypes</th><th>Plot x date records</th></tr></thead>
      <tbody>${genoInv.rows.map((r) => {
        const rowsMatch = groupInv.rows
          .filter((g) => g.Group === r.Group)
          .reduce((s, g) => s + Number(g.Rows || 0), 0);
        return `<tr><td>${escapeHtml(r.pop)}</td><td><code>${escapeHtml(r.Group)}</code></td><td>${escapeHtml(r.Subpop || '—')}</td><td class="num">${fmt(r.Genotypes, 0)}</td><td class="num">${fmt(rowsMatch, 0)}</td></tr>`;
      }).join('')}</tbody>
    </table>
    <p class="dim mt-l" style="font-size:14px"><code>check</code> = B73, Mo17, B73 x Mo17. <code>non-BGEM_hybrid</code> = 18 public diversity hybrids (low replication, side-panel only). BGEM Inbred and BGEM Hybrid lines split by Subpop for Section B.</p>
  </section>`);

  // 4. Check replication snapshot
  const checkRepSnapshot = checkRep.rows
    .filter((r) => r.Sensor === 'RGB')
    .slice(0, 12);
  slides.push(`
  <section class="slide" data-title="Check replication">
    <p class="kicker">Why checks carry the sanity load</p>
    <h2 class="h2">Plot-level replication on the named checks</h2>
    <table class="research">
      <thead><tr><th>Sensor</th><th>Check</th><th>Date</th><th>N</th><th>Plot records</th></tr></thead>
      <tbody>${checkRepSnapshot.map((r) => `<tr><td>${escapeHtml(r.Sensor)}</td><td>${escapeHtml(r.Genotype)}</td><td>${escapeHtml(r.Date)}</td><td>${escapeHtml(r.Nitrogen)}</td><td class="num">${fmt(r.PlotRecords, 0)}</td></tr>`).join('')}</tbody>
    </table>
    <p class="dim mt-l" style="font-size:14px">Snapshot: first 12 RGB rows from <code>vi_qc2_check_plot_replication.csv</code>. Each check is seeded across 20-30+ row positions within a single date x N file, which is what makes the in-treatment Cohen's d in Section A meaningful.</p>
  </section>`);

  // 5. Outlier handling
  slides.push(`
  <section class="slide" data-title="Outlier handling">
    <p class="kicker">Two-step rule</p>
    <h2 class="h2">Extreme VI values set to NA</h2>
    <div class="grid g2 mt-l">
      <div class="card">
        <h4>Step 1 - sentinel cutoff</h4>
        <p class="dim">Drop non-finite values and <code>|x| &gt; 1000</code>. This catches the MS_VARI / MS_ARVI denominator-instability spikes that explode to ~1e11.</p>
      </div>
      <div class="card">
        <h4>Step 2 - 3 x IQR outer fence</h4>
        <p class="dim">Per <code>(Sensor, Trait)</code> globally, set values outside the 3 x IQR outer fence to NA. Applied globally per VI (not per date) so legitimate seasonal swings are preserved.</p>
      </div>
    </div>
    <table class="research mt-l">
      <thead><tr><th>Sensor</th><th>Trait</th><th>Reason</th><th>Records set NA</th></tr></thead>
      <tbody>${outlierSummary.rows.slice(0, 10).map((r) => `<tr><td>${escapeHtml(r.Sensor)}</td><td>${escapeHtml(r.Trait)}</td><td>${escapeHtml(r.OutlierReason)}</td><td class="num">${fmt(r.RecordsSetToNA, 0)}</td></tr>`).join('') || '<tr><td colspan="4">No outliers set to NA.</td></tr>'}</tbody>
    </table>
    <p class="dim mt-l" style="font-size:14px">Top-10 by count. Full table at <code>cache/vi_qc2/vi_qc2_extreme_outlier_summary.csv</code>.</p>
  </section>`);

  // 6. Section A divider
  slides.push(`
  <section class="slide section-divider" data-title="Section A">
    <div class="body">
      <p class="num">Section A · Checks</p>
      <h2 class="h2">B73, Mo17, and<br>B73 x Mo17</h2>
      <p class="lede">Greenness indices should be HIGHER under High N because they anchor on chlorophyll / green-band signal. Any greenness VI where the checks reverse this direction is flagged.</p>
    </div>
  </section>`);

  // 7. Greenness set definition
  slides.push(`
  <section class="slide" data-title="Greenness set">
    <p class="kicker">Canonical greenness expectation</p>
    <h2 class="h2">VIs expected to be HIGHER under High N</h2>
    <div class="grid g2 mt-l">
      <div class="card">
        <h4>RGB (byte-scaled bands)</h4>
        <p class="dim"><code>NGRDI · MGRVI · RGBVI · GLI · ExG1 · ExG2 · VEG</code></p>
      </div>
      <div class="card">
        <h4>Multispectral (reflectance-calibrated)</h4>
        <p class="dim"><code>NDVI · GNDVI · EVI · NDRE · GRVI · IPVI · SAVI</code></p>
      </div>
    </div>
    <p class="dim mt-l" style="font-size:14px">Cohen's d is computed on plot-level replicates within each (Check, Sensor, VI, Date, N) cell. <b>d &lt; 0</b> on a greenness VI is a violation.</p>
  </section>`);

  // 8. Headline finding: RGB greenness reversal on checks
  slides.push(`
  <section class="slide" data-title="Headline - RGB reversal on checks">
    <p class="kicker"><span class="gate warn">Headline finding</span></p>
    <h2 class="h2">RGB greenness reverses HN &gt; LN on the checks; multispectral does not</h2>
    <div class="stat-row">
      <div class="stat"><div class="v">${rgbViolations.length}</div><div class="l">RGB greenness rows flagged</div><div class="n">DatesViolating &gt; 0, mean Cohen's d typically -0.5 to -1.2</div></div>
      <div class="stat"><div class="v">${msViolations.length}</div><div class="l">MS greenness rows flagged</div><div class="n">Mostly on B73 x Mo17, small effect sizes</div></div>
      <div class="stat"><div class="v">${rgbViolations.length > 0 ? '✗' : '✓'}</div><div class="l">RGB direction reliable?</div><div class="n">Across all 3 checks, all 7 greenness indices</div></div>
      <div class="stat"><div class="v">${msViolations.length < rgbViolations.length / 2 ? '✓' : '?'}</div><div class="l">MS direction reliable?</div><div class="n">NDVI/GNDVI/GRVI/IPVI/EVI on B73 + Mo17 confirm HN &gt; LN</div></div>
    </div>
    <p class="dim mt-l" style="font-size:14px">Multispectral confirms NW = HN, SW = LN is correctly labeled. The RGB reversal is therefore an RGB pipeline / illumination / segmentation issue, not a treatment-labeling issue.</p>
  </section>`);

  // 9. RGB check violation summary
  const rgbCheckSummary = [...new Set(rgbViolations.map((r) => r.Genotype))].map((genotype) => {
    const rows = rgbViolations.filter((r) => r.Genotype === genotype);
    const uniqueTraits = [...new Set(rows.map((r) => r.Trait))];
    const meanD = rows.reduce((s, r) => s + Number(r.MeanCohensD || 0), 0) / Math.max(rows.length, 1);
    const minD = Math.min(...rows.map((r) => Number(r.MinCohensD)).filter(Number.isFinite));
    const totalViolatingDates = rows.reduce((s, r) => s + Number(r.DatesViolating || 0), 0);
    const totalDates = rows.reduce((s, r) => s + Number(r.Dates || 0), 0);
    return { genotype, traits: uniqueTraits.length, meanD, minD, totalViolatingDates, totalDates };
  });
  const rgbTraitList = [...new Set(rgbViolations.map((r) => r.Trait))];
  slides.push(`
  <section class="slide" data-title="Check violations - RGB">
    <p class="kicker">Section A · Detail</p>
    <h2 class="h2">RGB greenness fails the check-genotype direction test</h2>
    <div class="grid g3 mt-l">
      ${rgbCheckSummary.map((r) => `
      <div class="card">
        <h4>${escapeHtml(r.genotype)}</h4>
        <p class="dim"><b>${fmt(r.traits, 0)} of ${fmt(rgbTraitList.length, 0)} RGB greenness VIs</b> show at least one HN &lt; LN violation.</p>
        <p class="dim">Violating dates: <b>${fmt(r.totalViolatingDates, 0)} / ${fmt(r.totalDates, 0)}</b><br>Mean d: <b>${fmt(r.meanD, 2)}</b> · Min d: <b>${fmt(r.minD, 2)}</b></p>
      </div>`).join('')}
    </div>
    <div class="card card-accent mt-l">
      <h4>Decision-relevant interpretation</h4>
      <p class="dim">This is a systematic direction failure, not one noisy VI row. The full row-level table stays in <code>cache/vi_qc2/vi_qc2_check_greenness_violation_rollup.csv</code>; for presentation, the important boundary is that RGB greenness should not be used as a headline screening signal without re-extraction or exposure normalization review.</p>
    </div>
  </section>`);

  // 10. MS check rollup (positive control)
  const msAll = checkViolations.rows.filter((r) => r.Sensor === 'Multispectral');
  slides.push(`
  <section class="slide" data-title="Check rollup - MS">
    <p class="kicker">Positive control</p>
    <h2 class="h2">Multispectral greenness on checks - mostly expected direction</h2>
    <table class="research">
      <thead><tr><th>Check</th><th>VI</th><th>Dates</th><th>Violating</th><th>Mean Cohen's d</th></tr></thead>
      <tbody>${msAll.map((r) => `<tr><td>${escapeHtml(r.Genotype)}</td><td><code>${escapeHtml(r.Trait)}</code></td><td class="num">${fmt(r.Dates, 0)}</td><td class="num">${fmt(r.DatesViolating, 0)}</td><td class="num">${fmt(r.MeanCohensD, 2)}</td></tr>`).join('') || '<tr><td colspan="5">No multispectral greenness rows in the rollup.</td></tr>'}</tbody>
    </table>
    <p class="dim mt-l" style="font-size:14px">B73 and Mo17 show positive Cohen's d for every multispectral greenness VI (HN &gt; LN as expected). B73 x Mo17 is mixed but mostly positive on NDVI / GNDVI / GRVI / IPVI.</p>
  </section>`);

  // 11. RGB trajectory figure
  slides.push(`
  <section class="slide figure-slide" data-title="Check greenness - RGB">
    <p class="kicker">Section A · Figure</p>
    <h2 class="h2">RGB greenness trajectories on B73 / Mo17 / B73 x Mo17</h2>
    <div class="fig-wrap"><img src="figures/vi_qc2/vi_qc2_check_greenness_trajectory_rgb.png" alt="RGB greenness trajectories on checks"></div>
    <p class="fig-caption">Plot-level mean +/- SE by date and N. Rows = check, columns = greenness VI. Orange (LN) lines sit above blue (HN) on every panel - the reversal is visible by eye. <code>graphs/vi_qc2/vi_qc2_check_greenness_trajectory_rgb.png</code></p>
  </section>`);

  // 12. MS trajectory figure
  slides.push(`
  <section class="slide figure-slide" data-title="Check greenness - MS">
    <p class="kicker">Section A · Figure</p>
    <h2 class="h2">Multispectral greenness trajectories on the checks</h2>
    <div class="fig-wrap"><img src="figures/vi_qc2/vi_qc2_check_greenness_trajectory_ms.png" alt="MS greenness trajectories on checks"></div>
    <p class="fig-caption">Same axes as the RGB panel above. NDVI / GNDVI / GRVI / IPVI / EVI on B73 and Mo17 show blue (HN) above orange (LN), confirming the expected direction. <code>graphs/vi_qc2/vi_qc2_check_greenness_trajectory_ms.png</code></p>
  </section>`);

  // 13. Cohen's d heatmap
  slides.push(`
  <section class="slide figure-slide" data-title="Check Cohen's d heatmap">
    <p class="kicker">Section A · Figure</p>
    <h2 class="h2">HN-vs-LN effect size on checks, per date and VI</h2>
    <div class="fig-wrap"><img src="figures/vi_qc2/vi_qc2_check_greenness_cohensd_heatmap.png" alt="Greenness Cohen's d heatmap on checks"></div>
    <p class="fig-caption">Blue = HN higher (expected). Orange = HN lower (violation). RGB panels are dominantly orange; multispectral panels are dominantly blue. <code>graphs/vi_qc2/vi_qc2_check_greenness_cohensd_heatmap.png</code></p>
  </section>`);

  // 14. Non-BGEM hybrid side panel
  const nonBgemRgb = nonBgemHybrid.rows.filter((r) => r.Sensor === 'RGB');
  const nonBgemMs = nonBgemHybrid.rows.filter((r) => r.Sensor === 'Multispectral');
  const summarizeNonBgemDirection = (rows) => {
    const traits = [...new Set(rows.map((r) => r.Trait))];
    const paired = traits.map((trait) => {
      const hn = rows.find((r) => r.Trait === trait && r.Nitrogen === 'High N');
      const ln = rows.find((r) => r.Trait === trait && r.Nitrogen === 'Low N');
      return {
        trait,
        hnMean: hn ? Number(hn.Mean) : NaN,
        lnMean: ln ? Number(ln.Mean) : NaN,
        plots: Number(hn?.N || 0) + Number(ln?.N || 0)
      };
    }).filter((r) => Number.isFinite(r.hnMean) && Number.isFinite(r.lnMean));
    return {
      traits: paired.length,
      hnHigher: paired.filter((r) => r.hnMean > r.lnMean).length,
      lnHigher: paired.filter((r) => r.lnMean > r.hnMean).length,
      plots: paired.reduce((s, r) => s + r.plots, 0),
      strongestLn: paired
        .map((r) => ({ ...r, diff: r.lnMean - r.hnMean }))
        .sort((a, b) => b.diff - a.diff)
        .slice(0, 3)
    };
  };
  const nonBgemRgbSummary = summarizeNonBgemDirection(nonBgemRgb);
  const nonBgemMsSummary = summarizeNonBgemDirection(nonBgemMs);

  slides.push(`
  <section class="slide" data-title="Non-BGEM hybrids - side panel">
    <p class="kicker">Section A.5 · For the record</p>
    <h2 class="h2">18 public diversity hybrids stay as a side panel</h2>
    <div class="grid g2 mt-l">
      <div class="card">
        <h4>RGB greenness</h4>
        <p class="dim"><b>${fmt(nonBgemRgbSummary.traits, 0)} VIs summarized</b> across ${fmt(nonBgemRgbSummary.plots, 0)} plot records. HN mean is higher for ${fmt(nonBgemRgbSummary.hnHigher, 0)} VIs; LN mean is higher for ${fmt(nonBgemRgbSummary.lnHigher, 0)} VIs.</p>
        <p class="dim">Largest LN-HN means: ${nonBgemRgbSummary.strongestLn.map((r) => `<code>${escapeHtml(r.trait)}</code> ${fmt(r.diff, 3)}`).join(' · ') || 'none'}.</p>
      </div>
      <div class="card">
        <h4>Multispectral greenness</h4>
        <p class="dim"><b>${fmt(nonBgemMsSummary.traits, 0)} VIs summarized</b> across ${fmt(nonBgemMsSummary.plots, 0)} plot records. HN mean is higher for ${fmt(nonBgemMsSummary.hnHigher, 0)} VIs; LN mean is higher for ${fmt(nonBgemMsSummary.lnHigher, 0)} VIs.</p>
        <p class="dim">Largest LN-HN means: ${nonBgemMsSummary.strongestLn.map((r) => `<code>${escapeHtml(r.trait)}</code> ${fmt(r.diff, 3)}`).join(' · ') || 'none'}.</p>
      </div>
      <div class="card card-accent" style="grid-column:span 2">
        <h4>Boundary for this round</h4>
        <p class="dim">These hybrids are kept in the QC record but excluded from BGEM stratum and heterosis claims because replication is only 1-2 plots per date x N and subpopulation is unknown. Full means remain in <code>vi_qc2_non_bgem_hybrid_summary.csv</code> and <code>vi_qc2_non_bgem_hybrid_greenness.csv</code>.</p>
      </div>
    </div>
  </section>`);

  // 15. Section B divider
  slides.push(`
  <section class="slide section-divider" data-title="Section B">
    <div class="body">
      <p class="num">Section B · BGEM panel</p>
      <h2 class="h2">BGEM strata</h2>
      <p class="lede">Inbred / Hybrid x SS / NSS, analyzed separately by N treatment. Checks and non-BGEM hybrids stay outside this boundary.</p>
    </div>
  </section>`);

  // 16. BGEM strata counts
  slides.push(`
  <section class="slide" data-title="BGEM strata">
    <p class="kicker">Stratification design</p>
    <h2 class="h2">Records per stratum x N treatment</h2>
    <table class="research">
      <thead><tr><th>Stratum</th><th>Genotypes</th><th>HN plot x date records</th><th>LN plot x date records</th></tr></thead>
      <tbody>${bgemStrata.rows.map((r) => {
        const hn = bgemStrataRows.rows.find((x) => x.Stratum === r.Stratum && x.Nitrogen === 'High N');
        const ln = bgemStrataRows.rows.find((x) => x.Stratum === r.Stratum && x.Nitrogen === 'Low N');
        return `<tr><td>${escapeHtml(r.Stratum)}</td><td class="num">${fmt(r.Genotypes, 0)}</td><td class="num">${fmt(hn ? hn.PlotDateRecords : 0, 0)}</td><td class="num">${fmt(ln ? ln.PlotDateRecords : 0, 0)}</td></tr>`;
      }).join('')}</tbody>
    </table>
    <p class="dim mt-l" style="font-size:14px">Per-stratum record counts (single sensor, pre-outlier filtering). <code>cache/vi_qc2/vi_qc2_bgem_strata_counts.csv</code> + <code>vi_qc2_bgem_strata_rows.csv</code>.</p>
  </section>`);

  // 17. BGEM panel greenness rollup table
  const bgemRgbRollup = bgemGreenness.rows.filter((r) => r.Sensor === 'RGB');
  slides.push(`
  <section class="slide" data-title="BGEM RGB greenness">
    <p class="kicker">Stratum x VI HN-vs-LN summary</p>
    <h2 class="h2">RGB greenness reversal also holds across BGEM strata</h2>
    <table class="research">
      <thead><tr><th>VI</th><th>Stratum</th><th>Dates</th><th>HN &gt; LN dates</th><th>Mean Cohen's d</th></tr></thead>
      <tbody>${bgemRgbRollup.slice(0, 16).map((r) => `<tr><td><code>${escapeHtml(r.Trait)}</code></td><td>${escapeHtml(r.Stratum)}</td><td class="num">${fmt(r.Dates, 0)}</td><td class="num">${fmt(r.DatesHNgtLN, 0)}</td><td class="num">${fmt(r.MeanCohensD, 2)}</td></tr>`).join('')}</tbody>
    </table>
    <p class="dim mt-l" style="font-size:14px">Top 16 rows. Every BGEM stratum shows HN &gt; LN at only 1-2 of 14-15 dates on each RGB greenness VI - matching the check-level reversal. <code>cache/vi_qc2/vi_qc2_bgem_greenness_rollup.csv</code></p>
  </section>`);

  // 18. BGEM MS rollup table
  const bgemMsRollup = bgemGreenness.rows.filter((r) => r.Sensor === 'Multispectral');
  slides.push(`
  <section class="slide" data-title="BGEM MS greenness">
    <p class="kicker">Stratum x VI HN-vs-LN summary</p>
    <h2 class="h2">Multispectral greenness across BGEM strata - mostly expected direction</h2>
    <table class="research">
      <thead><tr><th>VI</th><th>Stratum</th><th>Dates</th><th>HN &gt; LN dates</th><th>Mean Cohen's d</th></tr></thead>
      <tbody>${bgemMsRollup.slice(0, 16).map((r) => `<tr><td><code>${escapeHtml(r.Trait)}</code></td><td>${escapeHtml(r.Stratum)}</td><td class="num">${fmt(r.Dates, 0)}</td><td class="num">${fmt(r.DatesHNgtLN, 0)}</td><td class="num">${fmt(r.MeanCohensD, 2)}</td></tr>`).join('')}</tbody>
    </table>
    <p class="dim mt-l" style="font-size:14px">Top 16 rows. Multispectral indices flip back toward positive d in most strata.</p>
  </section>`);

  // 19. BGEM RGB distribution figure
  slides.push(`
  <section class="slide figure-slide" data-title="BGEM RGB distributions">
    <p class="kicker">Section B · Figure</p>
    <h2 class="h2">BGEM greenness distributions by stratum and N - RGB (DAF 18-25)</h2>
    <div class="fig-wrap"><img src="figures/vi_qc2/vi_qc2_bgem_greenness_distribution_rgb.png" alt="BGEM RGB greenness distributions"></div>
    <p class="fig-caption">Peak vegetative-growth window. Each point is one (Genotype, Date) record inside the window. <code>graphs/vi_qc2/vi_qc2_bgem_greenness_distribution_rgb.png</code></p>
  </section>`);

  // 20. BGEM MS distribution figure
  slides.push(`
  <section class="slide figure-slide" data-title="BGEM MS distributions">
    <p class="kicker">Section B · Figure</p>
    <h2 class="h2">BGEM greenness distributions by stratum and N - Multispectral (DAF 18-25)</h2>
    <div class="fig-wrap"><img src="figures/vi_qc2/vi_qc2_bgem_greenness_distribution_ms.png" alt="BGEM MS greenness distributions"></div>
    <p class="fig-caption">Same window, multispectral sensor. <code>graphs/vi_qc2/vi_qc2_bgem_greenness_distribution_ms.png</code></p>
  </section>`);

  // 21. Heterosis comparison table (HN vs LN heterosis on greenness)
  slides.push(`
  <section class="slide" data-title="VI heterosis HN vs LN">
    <p class="kicker">Section B.5 · Does the agronomic pattern replicate?</p>
    <h2 class="h2">Greenness VI heterosis: LN minus HN by Subpop</h2>
    <table class="research">
      <thead><tr><th>Sensor</th><th>VI</th><th>Subpop</th><th>HN het %</th><th>LN het %</th><th>LN - HN</th></tr></thead>
      <tbody>${heterosisCompare.rows.slice(0, 16).map((r) => `<tr><td>${escapeHtml(r.Sensor)}</td><td><code>${escapeHtml(r.Trait)}</code></td><td>${escapeHtml(r.Subpop)}</td><td class="num">${fmt(r['MeanPctHeterosis_High N'], 2)}</td><td class="num">${fmt(r['MeanPctHeterosis_Low N'], 2)}</td><td class="num">${fmt(r.LN_minus_HN, 2)}</td></tr>`).join('') || '<tr><td colspan="6">No heterosis comparison rows.</td></tr>'}</tbody>
    </table>
    <p class="dim mt-l" style="font-size:14px">Top 16 by LN - HN. Agronomic QC found stronger heterosis under Low N for kernel weight and ear weight. Compare here to see whether greenness VIs replicate that pattern. <code>cache/vi_qc2/vi_qc2_bgem_heterosis_greenness_compare.csv</code></p>
  </section>`);

  // 22. Heterosis RGB figure
  slides.push(`
  <section class="slide figure-slide" data-title="VI heterosis - RGB">
    <p class="kicker">Section B.5 · Figure</p>
    <h2 class="h2">RGB greenness heterosis by Subpop x N</h2>
    <div class="fig-wrap"><img src="figures/vi_qc2/vi_qc2_bgem_heterosis_greenness_rgb.png" alt="RGB heterosis greenness"></div>
    <p class="fig-caption">% heterosis on temporal-mean RGB VI per matched inbred-hybrid pair, faceted by VI, x = Subpop, fill = N. <code>graphs/vi_qc2/vi_qc2_bgem_heterosis_greenness_rgb.png</code></p>
  </section>`);

  // 23. Heterosis MS figure
  slides.push(`
  <section class="slide figure-slide" data-title="VI heterosis - MS">
    <p class="kicker">Section B.5 · Figure</p>
    <h2 class="h2">Multispectral greenness heterosis by Subpop x N</h2>
    <div class="fig-wrap"><img src="figures/vi_qc2/vi_qc2_bgem_heterosis_greenness_ms.png" alt="MS heterosis greenness"></div>
    <p class="fig-caption">Same plot for multispectral indices. <code>graphs/vi_qc2/vi_qc2_bgem_heterosis_greenness_ms.png</code></p>
  </section>`);

  // 24. Open decisions
  slides.push(`
  <section class="slide" data-title="Open decisions">
    <p class="kicker"><span class="gate warn">For project-lead review</span></p>
    <h2 class="h2">What this round adds to the open-decision list</h2>
    <ul class="resolved-list">
      <li><span class="tag">RGB direction</span><b>RGB greenness indices systematically reverse HN vs LN</b> on checks AND BGEM strata. Multispectral confirms the treatment labeling is correct, so this is an RGB pipeline / illumination / segmentation issue. Decide: drop RGB greenness as headline screening predictors, or re-extract with consistent exposure normalization across NW/SW.</li>
      <li><span class="tag">MS greenness</span><b>Multispectral NDVI / GNDVI / GRVI / IPVI / EVI</b> are the safer headline greenness indicators based on this round.</li>
      <li><span class="tag">Heterosis</span><b>Does the agronomic heterosis-by-N pattern</b> (stronger heterosis under LN) replicate on greenness VIs? Review the LN-minus-HN sorted table and figures.</li>
      <li><span class="tag">Stratum modeling</span><b>Stratum-specific HN-vs-LN Cohen's d</b> per (pop x Subpop) is now in <code>vi_qc2_bgem_n_difference.csv</code>; parallel input to the agronomic stage-1 modeling decision.</li>
      <li><span class="tag">Non-BGEM</span><b>Confirm 18 public diversity hybrids stay excluded</b> from Section B, or re-tag any of them as additional checks.</li>
    </ul>
  </section>`);

  // 25. Outputs map
  slides.push(`
  <section class="slide" data-title="Output map">
    <p class="kicker">Where the outputs live</p>
    <h2 class="h2">Outputs</h2>
    <div class="grid g2 mt-l">
      <div class="card"><h4>Source</h4><p class="dim">
        <code>profiling/1.pheno/05_vi_trait_qc_round2.Rmd</code><br>
        <code>largedata/phenotype/RGB/*.csv</code><br>
        <code>largedata/phenotype/Multispectral/*.csv</code><br>
        <code>reports/05_vi_trait_qc_round2.html</code><br>
        <code>/slides/vi-qc-round2/</code> (this deck, live)
      </p></div>
      <div class="card"><h4>Cache + graphs</h4><p class="dim">
        <code>cache/vi_qc2/</code> — 20 CSV diagnostics (inventory, outliers, check summary, check Cohen's d per date, greenness violations, BGEM strata, BGEM HN-LN per date, heterosis date pairs, heterosis HN/LN compare)<br>
        <code>graphs/vi_qc2/</code> — check trajectories (RGB + MS), Cohen's d heatmap, BGEM stratum distributions (RGB + MS), heterosis boxplots (RGB + MS)
      </p></div>
    </div>
    <p class="dim mt-l" style="font-size:14px;text-align:center">Press <b>T</b> to cycle themes · <b>← →</b> navigate · <b>O</b> overview · <b>S</b> presenter</p>
  </section>`);

  const total = slides.length;
  const numberedSlides = slides.map((slide, index) => {
    const current = index + 1;
    const withTotal = slide.replace(coverPlaceholder, String(total));
    if (withTotal.includes('slide-number')) {
      return withTotal
        .replace(/data-current="[^"]+"/, `data-current="${current}"`)
        .replace(/data-total="[^"]+"/, `data-total="${total}"`);
    }
    return withTotal.replace(
      '</section>',
      `\n    <div class="deck-footer"><span class="dim2"></span><span class="slide-number" data-current="${current}" data-total="${total}"></span></div>\n  </section>`
    );
  });
  const html = numberedSlides.join('\n');

  return `<!DOCTYPE html>
<html lang="en" data-theme="swiss-grid">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>UAV-for-GS · VI Trait QC Round 2 · Live</title>
<link rel="stylesheet" href="assets/fonts.css">
<link rel="stylesheet" href="assets/base.css">
<link rel="stylesheet" id="theme-link" href="assets/themes/swiss-grid.css">
<link rel="stylesheet" href="assets/animations/animations.css">
<style>${viDeckCss()}</style>
</head>
<body data-themes="swiss-grid,minimal-white,academic-paper,blueprint,corporate-clean" data-theme-base="assets/themes/">
<div class="deck">
${html}
</div>
<script src="assets/runtime.js"></script>
</body></html>`;
}

function renderViAgronomicQcDeck() {
  const inventory = readCsvSafe('cache/vi_agronomic_qc/vi_agronomic_input_inventory.csv');
  const signal = readCsvSafe('cache/vi_agronomic_qc/vi_agronomic_signal_summary.csv');
  const greenness = readCsvSafe('cache/vi_agronomic_qc/vi_agronomic_greenness_signal_summary.csv');
  const top = readCsvSafe('cache/vi_agronomic_qc/vi_agronomic_top_associations.csv');
  const rgbGreenness = readCsvSafe('cache/vi_agronomic_qc/vi_agronomic_rgb_greenness_focus.csv');
  const sensorReview = readCsvSafe('cache/vi_agronomic_qc/vi_agronomic_sensor_review_summary.csv');
  const popObserved = readCsvSafe('cache/vi_agronomic_qc/vi_agronomic_pop_observed_correlations.csv');
  const allTests = readCsvSafe('cache/vi_agronomic_qc/vi_agronomic_correlation_tests.csv');

  const fmt = (v, d = 2) => fmtNumber(v, d);
  const fmtP = (v) => {
    const n = Number(v);
    if (!Number.isFinite(n)) return '—';
    if (n === 0) return '< 1e-300';
    if (n < 1e-4 || n > 1e4) return n.toExponential(1);
    return n.toFixed(4);
  };
  const totalTests = allTests.rows.length;
  const totalSigQ10 = allTests.rows.filter((r) => String(r.SignificantQ10) === 'TRUE').length;
  const totalStrong = allTests.rows.filter(
    (r) => String(r.SignificantQ10) === 'TRUE' && Number(r.AbsSpearmanR) >= 0.20
  ).length;

  const slides = [];
  const now = new Date().toISOString().split('T')[0];
  const coverPlaceholder = '__TOTAL_SLIDES__';

  // 1. Cover
  slides.push(`
  <section class="slide" data-title="Cover">
    <div class="deck-header"><span class="eyebrow">Phenotype QC · Live</span><span class="eyebrow">UAV-for-GS · BGEM 2023</span></div>
    <p class="kicker">Phase 1 · VI x agronomic correlation QC</p>
    <h1 class="h1 anim-fade-up" data-anim="fade-up">
      Does VI carry <span class="gradient-text">within-N</span><br>
      genotype-ranking signal?
    </h1>
    <p class="lede">Round 2 flagged RGB greenness as direction-unreliable between treatments. This round asks a different question: <b>within a single N treatment</b>, do genotype-level VI temporal features correlate with manually measured agronomic traits? <code>cor.test</code> Spearman + Pearson, BH-adjusted within (Sensor x N x Feature).</p>
    <div class="row wrap mt-l">
      <span class="pill pill-accent">${fmt(totalTests, 0)} tests</span>
      <span class="pill">${fmt(totalSigQ10, 0)} sig (q ≤ 0.10)</span>
      <span class="pill">${fmt(totalStrong, 0)} strong (|ρ| ≥ 0.20 + sig)</span>
      <span class="pill">N ≈ 525 BGEM genotypes / test</span>
    </div>
    <div class="deck-footer"><span class="dim2">Jinliang Yang lab · ${escapeHtml(now)}</span><span class="slide-number" data-current="1" data-total="${coverPlaceholder}"></span></div>
  </section>`);

  // 2. Why this QC
  slides.push(`
  <section class="slide" data-title="Why this QC">
    <p class="kicker">Question being asked</p>
    <h2 class="h2">A VI that fails the between-N direction can still rank genotypes within N</h2>
    <div class="grid g2 mt-l">
      <div class="card">
        <h4>Round 2 finding</h4>
        <p class="dim">RGB greenness systematically reverses HN &gt; LN on checks and BGEM strata. So RGB greenness is direction-unreliable as a <b>between-treatment</b> contrast.</p>
      </div>
      <div class="card">
        <h4>What this round adds</h4>
        <p class="dim"><b>Within</b> each N treatment, correlate genotype-mean VI temporal features against genotype-mean agronomic traits. If the within-N genotype ranking still tracks yield-related traits, the VI is salvageable as a within-treatment predictor.</p>
      </div>
      <div class="card card-accent" style="grid-column:span 2">
        <h4>Test choice</h4>
        <p class="dim">Original draft used a 99-permutation null. With N ≈ 525 the empirical p floors at 0.01, which wastes resolution. This revision uses <code>cor.test(method = "spearman")</code> + <code>cor.test(method = "pearson")</code> directly. Render time dropped from ~2 min to ~1 min; the strongest associations now resolve to p ~ 1e-55.</p>
      </div>
    </div>
  </section>`);

  // 3. Inputs + test grid
  slides.push(`
  <section class="slide" data-title="Inputs and test grid">
    <p class="kicker">Inputs joined</p>
    <h2 class="h2">Test grid</h2>
    <div class="grid g2 mt-l">
      <div class="card">
        <h4>VI features</h4>
        <p class="dim"><code>cache/vi/vi_genotype_temporal_features.csv</code> — one row per (Genotype, N, Sensor, VI). 5 temporal features: <code>SeasonMean · SeasonMax · SeasonMin · SlopeEarlyLate · AUC_DAF</code>.</p>
      </div>
      <div class="card">
        <h4>Agronomic means</h4>
        <p class="dim"><code>cache/agronomic_traits/manual_trait_genotype_treatment_means.csv</code> — one row per (Genotype, N, Trait). 6 traits: ear weight, TKW, 20KW, CW, cob length, cob diameter.</p>
      </div>
    </div>
    <table class="research mt-l">
      <thead><tr><th>Analysis set</th><th>Nitrogen</th><th>Sensor</th><th>Genotypes joined</th></tr></thead>
      <tbody>${inventory.rows.map((r) => `<tr><td>${escapeHtml(r.AnalysisSet)}</td><td>${escapeHtml(r.Nitrogen)}</td><td>${escapeHtml(r.Sensor)}</td><td class="num">${fmt(r.GenotypesInJoinedSet, 0)}</td></tr>`).join('')}</tbody>
    </table>
    <p class="dim mt-l" style="font-size:14px">BGEM genotypes only (checks and non-BGEM hybrids excluded). Minimum 30 genotypes per test cell.</p>
  </section>`);

  // 4. Headline finding
  slides.push(`
  <section class="slide" data-title="Headline">
    <p class="kicker"><span class="gate ok">Headline</span></p>
    <h2 class="h2">RGB DOES carry within-N genotype signal, even where between-N direction reversed</h2>
    <div class="stat-row">
      <div class="stat"><div class="v">${fmt(totalSigQ10, 0)}</div><div class="l">Significant tests (q ≤ 0.10)</div><div class="n">Out of ${fmt(totalTests, 0)} tests</div></div>
      <div class="stat"><div class="v">${fmt(totalStrong, 0)}</div><div class="l">Strong + significant</div><div class="n">|ρ| ≥ 0.20 AND q ≤ 0.10</div></div>
      <div class="stat"><div class="v">0.61</div><div class="l">Max |Spearman ρ|</div><div class="n">RGB_VARI SlopeEarlyLate vs TKW, HN</div></div>
      <div class="stat"><div class="v">SlopeEarlyLate</div><div class="l">Dominant feature</div><div class="n">Wins both N treatments, both sensors</div></div>
    </div>
    <p class="dim mt-l" style="font-size:14px">The peak-vegetative-to-senescence VI <b>slope</b> is the most informative temporal feature for predicting kernel/ear weight — far ahead of SeasonMean / SeasonMax / SeasonMin / AUC. This holds even where the absolute VI direction (HN vs LN) is unreliable.</p>
  </section>`);

  // 5. Sensor review
  slides.push(`
  <section class="slide" data-title="Sensor review">
    <p class="kicker">Per-sensor signal rollup</p>
    <h2 class="h2">Within-N signal by sensor x N</h2>
    <table class="research">
      <thead><tr><th>N treatment</th><th>Sensor</th><th>Strong q ≤ 0.10 hits</th><th>Best feature</th><th>Best feature strong hits</th><th>Max |ρ|</th></tr></thead>
      <tbody>${sensorReview.rows.map((r) => `<tr><td>${escapeHtml(r.Nitrogen)}</td><td>${escapeHtml(r.Sensor)}</td><td class="num">${fmt(r.TotalStrongQ10Hits, 0)}</td><td><code>${escapeHtml(r.BestFeature)}</code></td><td class="num">${fmt(r.MaxFeatureStrongQ10Hits, 0)}</td><td class="num">${fmt(r.MaxAbsR, 2)}</td></tr>`).join('')}</tbody>
    </table>
    <p class="dim mt-l" style="font-size:14px">Both sensors carry strong within-N signal. Under Low N, RGB SlopeEarlyLate dominates with the highest total strong-hit count. Under High N, the same RGB-Slope combination still wins. <code>cache/vi_agronomic_qc/vi_agronomic_sensor_review_summary.csv</code></p>
  </section>`);

  // 6. Signal-summary figure
  slides.push(`
  <section class="slide figure-slide" data-title="Significant counts">
    <p class="kicker">Figure · Significant counts</p>
    <h2 class="h2">Strong significant correlations by sensor x VI feature</h2>
    <div class="fig-wrap"><img src="figures/vi_agronomic_qc/vi_agronomic_significant_correlation_counts.png" alt="Significant correlation counts"></div>
    <p class="fig-caption">Bars count tests with BH q ≤ 0.10 AND |Spearman ρ| ≥ 0.20, faceted by N. SlopeEarlyLate dominates everywhere. <code>graphs/vi_agronomic_qc/vi_agronomic_significant_correlation_counts.png</code></p>
  </section>`);

  // 7. Full signal summary table
  slides.push(`
  <section class="slide" data-title="Signal summary - all">
    <p class="kicker">Per (Sensor x N x VI feature)</p>
    <h2 class="h2">Full signal summary, all feature x sensor x N cells</h2>
    <table class="research">
      <thead><tr><th>N</th><th>Sensor</th><th>VI feature</th><th>Tests</th><th>q ≤ 0.10</th><th>q ≤ 0.05</th><th>Strong q ≤ 0.10</th><th>Median |ρ|</th><th>Max |ρ|</th></tr></thead>
      <tbody>${signal.rows.map((r) => `<tr><td>${escapeHtml(r.Nitrogen)}</td><td>${escapeHtml(r.Sensor)}</td><td><code>${escapeHtml(r.VIFeature)}</code></td><td class="num">${fmt(r.Tests, 0)}</td><td class="num">${fmt(r.Q10Hits, 0)}</td><td class="num">${fmt(r.Q05Hits, 0)}</td><td class="num">${fmt(r.StrongQ10Hits, 0)}</td><td class="num">${fmt(r.MedianAbsR, 2)}</td><td class="num">${fmt(r.MaxAbsR, 2)}</td></tr>`).join('')}</tbody>
    </table>
  </section>`);

  // 8. Top associations - HN
  const topHN = top.rows.filter((r) => r.Nitrogen === 'High N').slice(0, 16);
  slides.push(`
  <section class="slide" data-title="Top associations HN">
    <p class="kicker">Top 16 sorted by p-value</p>
    <h2 class="h2">High N — strongest within-treatment VI-agronomic correlations</h2>
    <table class="research" style="font-size:15px">
      <thead><tr><th>Sensor</th><th>VI</th><th>Feature</th><th>Agronomic trait</th><th>N</th><th>Spearman ρ</th><th>Spearman p</th><th>Spearman q</th></tr></thead>
      <tbody>${topHN.map((r) => `<tr><td>${escapeHtml(r.Sensor)}</td><td><code>${escapeHtml(r.PrefixedTrait)}</code></td><td><code>${escapeHtml(r.VIFeature)}</code></td><td>${escapeHtml(r.AgronomicTraitLabel)}</td><td class="num">${fmt(r.NGenotypes, 0)}</td><td class="num">${fmt(r.SpearmanR, 2)}</td><td class="num">${fmtP(r.SpearmanP)}</td><td class="num">${fmtP(r.SpearmanQ)}</td></tr>`).join('')}</tbody>
    </table>
  </section>`);

  // 9. Top associations - LN
  const topLN = top.rows.filter((r) => r.Nitrogen === 'Low N').slice(0, 16);
  slides.push(`
  <section class="slide" data-title="Top associations LN">
    <p class="kicker">Top 16 sorted by p-value</p>
    <h2 class="h2">Low N — strongest within-treatment VI-agronomic correlations</h2>
    <table class="research" style="font-size:15px">
      <thead><tr><th>Sensor</th><th>VI</th><th>Feature</th><th>Agronomic trait</th><th>N</th><th>Spearman ρ</th><th>Spearman p</th><th>Spearman q</th></tr></thead>
      <tbody>${topLN.map((r) => `<tr><td>${escapeHtml(r.Sensor)}</td><td><code>${escapeHtml(r.PrefixedTrait)}</code></td><td><code>${escapeHtml(r.VIFeature)}</code></td><td>${escapeHtml(r.AgronomicTraitLabel)}</td><td class="num">${fmt(r.NGenotypes, 0)}</td><td class="num">${fmt(r.SpearmanR, 2)}</td><td class="num">${fmtP(r.SpearmanP)}</td><td class="num">${fmtP(r.SpearmanQ)}</td></tr>`).join('')}</tbody>
    </table>
  </section>`);

  // 10. Top heatmap figure
  slides.push(`
  <section class="slide figure-slide" data-title="Top correlation heatmap">
    <p class="kicker">Figure · Heatmap</p>
    <h2 class="h2">Top within-N VI-agronomic associations</h2>
    <div class="fig-wrap"><img src="figures/vi_agronomic_qc/vi_agronomic_top_correlation_heatmap.png" alt="Top correlation heatmap"></div>
    <p class="fig-caption">Top-12 VIs per (Sensor, N). Asterisks mark Spearman BH q ≤ 0.10. Two feature columns: SeasonMean and AUC_DAF. <code>graphs/vi_agronomic_qc/vi_agronomic_top_correlation_heatmap.png</code></p>
  </section>`);

  // 11. Top scatter figure
  slides.push(`
  <section class="slide figure-slide" data-title="Top scatter examples">
    <p class="kicker">Figure · Scatter</p>
    <h2 class="h2">Top within-N VI-agronomic scatter examples</h2>
    <div class="fig-wrap"><img src="figures/vi_agronomic_qc/vi_agronomic_top_scatter_examples.png" alt="Top scatter examples"></div>
    <p class="fig-caption">Per-(Sensor, N) top-2 examples. Each point is one genotype; colour = Inbred (blue) vs Hybrid (orange). <code>graphs/vi_agronomic_qc/vi_agronomic_top_scatter_examples.png</code></p>
  </section>`);

  // 12. RGB greenness focus table
  const rgbHN = rgbGreenness.rows.filter((r) => r.Nitrogen === 'High N').slice(0, 16);
  const rgbLN = rgbGreenness.rows.filter((r) => r.Nitrogen === 'Low N').slice(0, 16);
  slides.push(`
  <section class="slide" data-title="RGB greenness focus">
    <p class="kicker">Section · RGB greenness</p>
    <h2 class="h2">RGB greenness — does the within-N signal survive the round-2 reversal?</h2>
    <div class="grid g2 mt-l">
      <div class="card">
        <h4>High N — top 16 by strong q ≤ 0.10 hits</h4>
        <table class="research" style="font-size:14px">
          <thead><tr><th>VI</th><th>Feature</th><th>Strong hits</th><th>Best |ρ|</th><th>Best trait</th></tr></thead>
          <tbody>${rgbHN.map((r) => `<tr><td><code>${escapeHtml(r.PrefixedTrait)}</code></td><td><code>${escapeHtml(r.VIFeature)}</code></td><td class="num">${fmt(r.StrongQ10Hits, 0)}</td><td class="num">${fmt(r.BestAbsSpearmanR, 2)}</td><td>${escapeHtml(r.BestTrait)}</td></tr>`).join('')}</tbody>
        </table>
      </div>
      <div class="card">
        <h4>Low N — top 16 by strong q ≤ 0.10 hits</h4>
        <table class="research" style="font-size:14px">
          <thead><tr><th>VI</th><th>Feature</th><th>Strong hits</th><th>Best |ρ|</th><th>Best trait</th></tr></thead>
          <tbody>${rgbLN.map((r) => `<tr><td><code>${escapeHtml(r.PrefixedTrait)}</code></td><td><code>${escapeHtml(r.VIFeature)}</code></td><td class="num">${fmt(r.StrongQ10Hits, 0)}</td><td class="num">${fmt(r.BestAbsSpearmanR, 2)}</td><td>${escapeHtml(r.BestTrait)}</td></tr>`).join('')}</tbody>
        </table>
      </div>
    </div>
    <p class="dim mt-l" style="font-size:14px"><b>Answer: yes.</b> RGB greenness retains strong within-N genotype-ranking signal even though its between-N direction was unreliable. Source: <code>cache/vi_agronomic_qc/vi_agronomic_rgb_greenness_focus.csv</code></p>
  </section>`);

  // 13. Greenness signal summary
  slides.push(`
  <section class="slide" data-title="Greenness signal summary">
    <p class="kicker">Greenness-only signal rollup</p>
    <h2 class="h2">Canonical greenness VIs — signal counts</h2>
    <table class="research" style="font-size:15px">
      <thead><tr><th>N</th><th>Sensor</th><th>VI feature</th><th>Tests</th><th>q ≤ 0.10</th><th>Strong q ≤ 0.10</th><th>Median |ρ|</th><th>Max |ρ|</th></tr></thead>
      <tbody>${greenness.rows.map((r) => `<tr><td>${escapeHtml(r.Nitrogen)}</td><td>${escapeHtml(r.Sensor)}</td><td><code>${escapeHtml(r.VIFeature)}</code></td><td class="num">${fmt(r.GreennessTests, 0)}</td><td class="num">${fmt(r.GreennessQ10Hits, 0)}</td><td class="num">${fmt(r.GreennessStrongQ10Hits, 0)}</td><td class="num">${fmt(r.GreennessMedianAbsR, 2)}</td><td class="num">${fmt(r.GreennessMaxAbsR, 2)}</td></tr>`).join('')}</tbody>
    </table>
    <p class="dim mt-l" style="font-size:14px">Restricted to canonical greenness VIs from <code>05_vi_trait_qc_round2.Rmd</code>. RGB SlopeEarlyLate hits 42/42 under both N treatments. MS SeasonMean / SlopeEarlyLate / AUC_DAF / SeasonMin all hit 30/30 under Low N.</p>
  </section>`);

  // 14. Pop diagnostic - confounding check
  const popHN = popObserved.rows.filter((r) => r.Nitrogen === 'High N').slice(0, 12);
  const popLN = popObserved.rows.filter((r) => r.Nitrogen === 'Low N').slice(0, 12);
  slides.push(`
  <section class="slide" data-title="Pop split diagnostic">
    <p class="kicker">Inbred-only vs Hybrid-only observed correlations</p>
    <h2 class="h2">Does the signal hold inside each population?</h2>
    <div class="grid g2 mt-l">
      <div class="card">
        <h4>High N — top 12 by |ρ|, per (pop, sensor, VI, feature, trait)</h4>
        <table class="research" style="font-size:13px">
          <thead><tr><th>Pop</th><th>Sensor</th><th>VI</th><th>Feature</th><th>Trait</th><th>N</th><th>ρ</th></tr></thead>
          <tbody>${popHN.map((r) => `<tr><td>${escapeHtml(r.AnalysisSet)}</td><td>${escapeHtml(r.Sensor)}</td><td><code>${escapeHtml(r.PrefixedTrait)}</code></td><td><code>${escapeHtml(r.VIFeature)}</code></td><td>${escapeHtml(r.AgronomicTraitLabel)}</td><td class="num">${fmt(r.NGenotypes, 0)}</td><td class="num">${fmt(r.SpearmanR, 2)}</td></tr>`).join('')}</tbody>
        </table>
      </div>
      <div class="card">
        <h4>Low N — top 12 by |ρ|, per (pop, sensor, VI, feature, trait)</h4>
        <table class="research" style="font-size:13px">
          <thead><tr><th>Pop</th><th>Sensor</th><th>VI</th><th>Feature</th><th>Trait</th><th>N</th><th>ρ</th></tr></thead>
          <tbody>${popLN.map((r) => `<tr><td>${escapeHtml(r.AnalysisSet)}</td><td>${escapeHtml(r.Sensor)}</td><td><code>${escapeHtml(r.PrefixedTrait)}</code></td><td><code>${escapeHtml(r.VIFeature)}</code></td><td>${escapeHtml(r.AgronomicTraitLabel)}</td><td class="num">${fmt(r.NGenotypes, 0)}</td><td class="num">${fmt(r.SpearmanR, 2)}</td></tr>`).join('')}</tbody>
        </table>
      </div>
    </div>
    <p class="dim mt-l" style="font-size:14px">If the All-BGEM correlations were driven by Inbred-vs-Hybrid mean differences, pop-only correlations would collapse. They don't, which supports the within-pop genotype-ranking interpretation. Full table: <code>vi_agronomic_pop_observed_correlations.csv</code></p>
  </section>`);

  // 15. Open decisions
  slides.push(`
  <section class="slide" data-title="Open decisions">
    <p class="kicker"><span class="gate warn">For project-lead review</span></p>
    <h2 class="h2">What this round adds to the open-decision list</h2>
    <ul class="resolved-list">
      <li><span class="tag">Feature form</span><b>SlopeEarlyLate dominates</b> for predicting kernel / ear / cob weight under both N treatments. Strong candidate for the headline temporal feature in the G+P-BLUP model.</li>
      <li><span class="tag">RGB rehabilitation</span><b>RGB greenness retains strong within-N genotype signal</b> despite the round-2 between-N direction reversal. Reasonable to keep selected RGB features as within-treatment predictors with an explicit "direction-unreliable across N" caveat.</li>
      <li><span class="tag">MS coverage</span><b>Multispectral SeasonMean / AUC_DAF / SlopeEarlyLate</b> all hit 30/30 greenness tests under Low N. MS remains the safer headline greenness source.</li>
      <li><span class="tag">Pop check</span><b>Within-pop correlations hold</b>, so the All-BGEM signal is not purely driven by Inbred-vs-Hybrid mean differences. Final modeling should still report Inbred and Hybrid subset diagnostics.</li>
      <li><span class="tag">Sample size</span><b>N ≈ 525 per test</b>; cor.test p-values are asymptotic. Strongest correlations resolve to p ~ 1e-55. No need for permutation null at this sample size.</li>
    </ul>
  </section>`);

  // 16. Outputs map
  slides.push(`
  <section class="slide" data-title="Output map">
    <p class="kicker">Where the outputs live</p>
    <h2 class="h2">Outputs</h2>
    <div class="grid g2 mt-l">
      <div class="card"><h4>Source</h4><p class="dim">
        <code>profiling/1.pheno/06_vi_agronomic_correlation_qc.Rmd</code><br>
        <code>cache/vi/vi_genotype_temporal_features.csv</code><br>
        <code>cache/agronomic_traits/manual_trait_genotype_treatment_means.csv</code><br>
        <code>reports/06_vi_agronomic_correlation_qc.html</code><br>
        <code>/slides/vi-agronomic-qc/</code> (this deck, live)
      </p></div>
      <div class="card"><h4>Cache + graphs</h4><p class="dim">
        <code>cache/vi_agronomic_qc/</code> — 9 CSV diagnostics (inventory, correlation tests, signal summary, greenness summary, top associations, RGB greenness focus, sensor review, pop-split observed)<br>
        <code>graphs/vi_agronomic_qc/</code> — significant-counts barplot, top-correlation heatmap, top-scatter examples
      </p></div>
    </div>
    <p class="dim mt-l" style="font-size:14px;text-align:center">Press <b>T</b> to cycle themes · <b>← →</b> navigate · <b>O</b> overview · <b>S</b> presenter</p>
  </section>`);

  const total = slides.length;
  const numberedSlides = slides.map((slide, index) => {
    const current = index + 1;
    const withTotal = slide.replace(coverPlaceholder, String(total));
    if (withTotal.includes('slide-number')) {
      return withTotal
        .replace(/data-current="[^"]+"/, `data-current="${current}"`)
        .replace(/data-total="[^"]+"/, `data-total="${total}"`);
    }
    return withTotal.replace(
      '</section>',
      `\n    <div class="deck-footer"><span class="dim2"></span><span class="slide-number" data-current="${current}" data-total="${total}"></span></div>\n  </section>`
    );
  });
  const html = numberedSlides.join('\n');

  return `<!DOCTYPE html>
<html lang="en" data-theme="swiss-grid">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>UAV-for-GS · VI x Agronomic Correlation QC · Live</title>
<link rel="stylesheet" href="assets/fonts.css">
<link rel="stylesheet" href="assets/base.css">
<link rel="stylesheet" id="theme-link" href="assets/themes/swiss-grid.css">
<link rel="stylesheet" href="assets/animations/animations.css">
<style>${viDeckCss()}</style>
</head>
<body data-themes="swiss-grid,minimal-white,academic-paper,blueprint,corporate-clean" data-theme-base="assets/themes/">
<div class="deck">
${html}
</div>
<script src="assets/runtime.js"></script>
</body></html>`;
}

function serveSlideDeck(req, res, pathname) {
  // Expect /slides/<slug>/<rest...>
  const match = pathname.match(/^\/slides\/([^/]+)(\/(.*))?$/);
  if (!match) {
    res.writeHead(404);
    res.end('Not found');
    return;
  }
  const [, slug, , rest = ''] = match;
  const deck = slideDecks.find((d) => d.slug === slug);
  if (!deck) {
    res.writeHead(404);
    res.end('Unknown deck');
    return;
  }

  // Dynamic decks generate index.html from cache/ and graphs/ at request time.
  if (deck.dynamic && (rest === '' || rest === 'index.html')) {
    try {
      const html = deck.render();
      res.writeHead(200, { 'Content-Type': SLIDE_MIME['.html'] });
      res.end(html);
    } catch (error) {
      res.writeHead(500, { 'Content-Type': SLIDE_MIME['.html'] });
      res.end(`<pre>Slide render error\n${escapeHtml(error.stack || error.message)}</pre>`);
    }
    return;
  }

  // The VI deck serves figures live from graphs/ so the deck always reflects
  // the latest re-render of the Rmds, no copy step.
  if (deck.dynamic && rest.startsWith('figures/')) {
    const rel = rest.slice('figures/'.length);
    const candidates = (deck.figureRoots || ['graphs']).map((root) => path.join(ROOT, root, rel));
    for (const candidate of candidates) {
      const normalized = path.normalize(candidate);
      const allowed = (deck.figureRoots || ['graphs']).some((root) =>
        normalized.startsWith(path.join(ROOT, root))
      );
      if (allowed && fs.existsSync(normalized) && !fs.statSync(normalized).isDirectory()) {
        const ext = path.extname(normalized).toLowerCase();
        const type = SLIDE_MIME[ext] || 'application/octet-stream';
        res.writeHead(200, { 'Content-Type': type });
        res.end(fs.readFileSync(normalized));
        return;
      }
    }
    res.writeHead(404);
    res.end('Figure not found');
    return;
  }

  const deckRoot = path.join(ROOT, 'reports', deck.directory);
  // If the URL is /slides/<slug>/ (no trailing path), serve index.html.
  const relative = rest && rest.length > 0 ? rest : 'index.html';
  const target = path.normalize(path.join(deckRoot, relative));

  if (!target.startsWith(deckRoot)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }
  if (!fs.existsSync(target) || fs.statSync(target).isDirectory()) {
    const fallback = path.join(target, 'index.html');
    if (fs.existsSync(fallback)) {
      const html = fs.readFileSync(fallback);
      res.writeHead(200, { 'Content-Type': SLIDE_MIME['.html'] });
      res.end(html);
      return;
    }
    res.writeHead(404);
    res.end('Slide asset not found');
    return;
  }

  const ext = path.extname(target).toLowerCase();
  const type = SLIDE_MIME[ext] || 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': type });
  res.end(fs.readFileSync(target));
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;

  if (pathname.startsWith('/site/')) {
    if (!serveStatic(req, res)) {
      res.writeHead(404);
      res.end('Not found');
    }
    return;
  }

  if (pathname.startsWith('/slides/')) {
    serveSlideDeck(req, res, pathname);
    return;
  }

  const routes = {
    '/': () => overviewPage(),
    '/readme': () => markdownPage('Project Guide', 'README.md', '/readme'),
    '/memory': () => markdownPage('Template Memory', 'MEMORY.md', '/memory'),
    '/new-project': () => markdownPage('New Project Checklist', path.join('doc', 'NEW_PROJECT_CHECKLIST.md'), '/new-project'),
    '/status': () => markdownPage('Project Status', path.join('doc', 'PROJECT_STATUS.md'), '/status'),
    '/decisions': () => markdownPage('Decisions', path.join('doc', 'DECISIONS.md'), '/decisions'),
    '/daily-log': () => dailyLogPage(),
    '/worklog': () => markdownPage('Work Log', path.join('doc', 'WORKLOG.md'), '/worklog'),
    '/environment': () => markdownPage('Environment', path.join('doc', 'ENVIRONMENT.md'), '/environment'),
    '/agent-rules': () => markdownPage('Agent Rules', 'AGENTS.md', '/agent-rules')
  };

  const route = routes[pathname];
  if (!route) {
    res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(pageTemplate({
      title: 'Not Found',
      activePath: '',
      content: '<section class="panel"><h1>Not Found</h1><p>The requested page does not exist.</p></section>'
    }));
    return;
  }

  try {
    const html = route();
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
  } catch (error) {
    res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(pageTemplate({
      title: 'Server Error',
      activePath: '',
      content: `<section class="panel"><h1>Server Error</h1><p>${escapeHtml(error.message)}</p></section>`
    }));
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Memory site running at http://${HOST}:${PORT}`);
});
