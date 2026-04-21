// CSMP Assessment Report — shared print-safe styles.
// 1:1 port of design_handoff_csmp_report/designs/styles.css.
// Source Serif 4 import stripped — only the Executive variant uses it.

export const REPORT_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap');

:root {
  --n-50:#fafafa; --n-75:#f6f6f5; --n-100:#f0f0ef; --n-150:#e6e6e4;
  --n-200:#dcdcd9; --n-300:#c4c4c0; --n-400:#9a9a96; --n-500:#72726e;
  --n-600:#525250; --n-700:#373735; --n-800:#242423; --n-900:#161615; --n-950:#0c0c0b;
  --a-500:#4f56e5; --a-600:#3e41c9; --a-700:#3436a4;
  --ok:#2f7a3d; --ok-bg:#e7f3e9; --warn:#9a6209; --warn-bg:#fcf1d9;
  --bad:#b02a1a; --bad-bg:#fbe5e0; --info:#1e4fb0; --info-bg:#e4ecfb;

  --font-sans:'Inter',-apple-system,BlinkMacSystemFont,system-ui,sans-serif;
  --font-mono:'JetBrains Mono',ui-monospace,Menlo,monospace;
}

body { margin: 0; }

/* ── Cluster grouping for asset register ───────────────── */
.rep-cluster { margin: 8pt 0 10pt; break-inside: avoid; border: 0.5pt solid var(--n-200); border-radius: 3pt; overflow: hidden; }
.rep-cluster__hd {
  display: flex; align-items: baseline; justify-content: space-between;
  padding: 5pt 10pt; background: var(--n-75); border-bottom: 0.5pt solid var(--n-200);
}
.rep-cluster__name { font-family: var(--font-sans); font-weight: 700; font-size: 10pt; color: var(--n-900); letter-spacing: -0.1pt; }
.rep-cluster__meta { font-family: var(--font-mono); font-size: 8.5pt; color: var(--n-600); letter-spacing: 0.2pt; }
.rep-cluster__sep { color: var(--n-400); margin: 0 4pt; }
.rep-cluster .rep-tbl td { border-bottom: 0.5pt solid var(--n-100); padding: 4pt 10pt; }
.rep-cluster .rep-tbl tr:last-child td { border-bottom: none; }

/* ── Compliance exec summary block (compact, cover-friendly) ── */
.rep-cmpx {
  display: grid; grid-template-columns: 1fr 1fr; gap: 8pt 14pt;
  border: 0.5pt solid var(--n-300); background: #fbfaf7;
  padding: 10pt 12pt; border-radius: 3pt; margin: 6pt 0;
}
.rep-cmpx__ti { grid-column: 1 / -1; display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 2pt; }
.rep-cmpx__ti h3 { margin: 0; font-size: 10pt; font-weight: 700; color: var(--n-900); }
.rep-cmpx__ti .rep-kicker { color: var(--n-600); }
.rep-cmpx__row { display: grid; grid-template-columns: 1fr 28pt 60pt; gap: 8pt; align-items: center; }
.rep-cmpx__name { font-size: 9.5pt; font-weight: 500; color: var(--n-800); }
.rep-cmpx__num { font-family: var(--font-mono); font-size: 9pt; color: var(--n-700); text-align: right; }
.rep-cmpx__bar { height: 6pt; background: var(--n-150); border-radius: 1pt; overflow: hidden; position: relative; }
.rep-cmpx__bar > span { display: block; height: 100%; background: var(--n-700); }

/* ── Condensed threat-register table — fits on page ─── */
.rep-tbl--dense { font-size: 8.5pt; }
.rep-tbl--dense th, .rep-tbl--dense td { padding: 3pt 5pt; }
.rep-tbl--dense td { line-height: 1.25; }
.rep-tbl--dense .rep-pill { font-size: 7pt; padding: 1pt 3pt; }
.rep-tbl--dense .rep-pill--labelled { padding: 0; }
.rep-tbl--dense .rep-pill--labelled .rep-pill__lbl { padding: 1pt 4pt; font-size: 6.5pt; }
.rep-tbl--dense .rep-pill--labelled .rep-pill__val { padding: 1pt 4pt; font-size: 7pt; }
.rep-tbl--dense col.c-ref { width: 6%; }
.rep-tbl--dense col.c-3a { width: 10%; }
.rep-tbl--dense col.c-sc { width: 4%; }
.rep-tbl--dense col.c-badge { width: 10%; }

/* ── Paper sheet ───────────────────────────────────────── */
.sheet {
  background: #fff;
  width: 210mm;
  min-height: 297mm;
  margin: 0 auto 18mm;
  box-shadow: 0 2px 4px rgba(0,0,0,.06), 0 12px 32px rgba(0,0,0,.08);
  padding: 18mm 16mm;
  box-sizing: border-box;
  color: var(--n-900);
  font-family: var(--font-sans);
  font-feature-settings: 'cv11','ss01','ss03';
  font-size: 10.5pt;
  line-height: 1.5;
  position: relative;
}
.sheet--letter { width: 216mm; min-height: 279mm; }
.sheet--cover { padding: 0; overflow: hidden; }
.sheet + .sheet { page-break-before: always; }

.rep-mono { font-family: var(--font-mono); font-variant-numeric: tabular-nums; }
.rep-num { font-family: var(--font-mono); font-variant-numeric: tabular-nums; text-align: right; }

.rep-kicker {
  font-family: var(--font-mono);
  font-size: 8.5pt;
  font-weight: 500;
  letter-spacing: 0.5pt;
  text-transform: uppercase;
  color: var(--n-500);
}

.rep-h1 { font-size: 22pt; font-weight: 700; letter-spacing: -0.4pt; margin: 0 0 4pt; color: var(--n-900); line-height: 1.1; }
.rep-h2 { font-size: 13.5pt; font-weight: 700; letter-spacing: -0.2pt; margin: 18pt 0 8pt; color: var(--n-900); padding-bottom: 4pt; border-bottom: 0.5pt solid var(--n-200); }
.rep-h3 { font-size: 11pt; font-weight: 600; margin: 10pt 0 4pt; color: var(--n-900); }
.rep-muted { color: var(--n-500); }

/* ── Page header band ──────────────────────────────────── */
.rep-hdr {
  display: flex; align-items: center; justify-content: space-between;
  padding-bottom: 8pt; margin-bottom: 12pt;
  border-bottom: 0.5pt solid var(--n-200);
  font-size: 8.5pt; color: var(--n-500);
}
.rep-hdr__left { display: flex; align-items: center; gap: 8pt; }
.rep-hdr__right { font-family: var(--font-mono); }
.rep-logo__wm { font-weight: 600; color: var(--n-900); font-size: 9.5pt; letter-spacing: -0.2px; }
.rep-logo__sub { color: var(--n-500); font-weight: 400; margin-left: 4px; }

.rep-ftr {
  position: absolute; left: 16mm; right: 16mm; bottom: 10mm;
  display: flex; justify-content: space-between;
  font-size: 7.5pt; color: var(--n-400); font-family: var(--font-mono);
  padding-top: 4pt; border-top: 0.5pt solid var(--n-200);
}

/* ── Pills ─────────────────────────────────────────────── */
.rep-pill {
  display: inline-flex; align-items: center;
  padding: 1.5pt 6pt; border-radius: 3pt;
  font-size: 8.5pt; font-weight: 600; font-family: var(--font-mono);
  letter-spacing: 0.2pt;
  background: var(--n-100); color: var(--n-700);
  border: 0.5pt solid var(--n-200);
}
.rep-pill--mono { background: var(--n-900); color: #fff; border-color: var(--n-900); }
.rep-pill--info { background: var(--info-bg); color: var(--info); border-color: #c9d6f2; }
.rep-pill--ok { background: var(--ok-bg); color: var(--ok); border-color: #c5e2c9; }
.rep-pill--warn { background: var(--warn-bg); color: var(--warn); border-color: #eed59b; }
.rep-pill--bad { background: var(--bad-bg); color: var(--bad); border-color: #efc1b6; }
.rep-pill--irv { border: none; font-weight: 700; }

/* Labelled pill variant — covers its half edge-to-edge */
.rep-pill--labelled {
  border: none;
  padding: 0;
  overflow: hidden;
  gap: 0;
  letter-spacing: 0.2pt;
  display: inline-grid;
  grid-template-columns: auto 1fr;
  align-items: stretch;
}
.rep-pill--labelled .rep-pill__lbl {
  display: flex; align-items: center; justify-content: center;
  padding: 1.5pt 4pt;
  background: var(--n-900);
  font-weight: 700;
  font-size: 7pt;
  letter-spacing: 0.4pt;
  color: #fff;
  white-space: nowrap;
}
.rep-pill--labelled .rep-pill__val {
  display: flex; align-items: center; justify-content: center;
  padding: 1.5pt 4pt;
  font-weight: 700;
  font-size: 8pt;
  letter-spacing: 0.3pt;
  white-space: nowrap;
}
.rep-pill--decision { background: var(--n-900); color: #fff; }
.rep-pill--decision .rep-pill__lbl { background: rgba(255,255,255,0.2); color: rgba(255,255,255,0.95); }
.rep-pill--labelled:not(.rep-pill--decision) .rep-pill__lbl { background: var(--n-900); color: #fff; }

/* Criticality badge — C1..C5 */
.rep-crit {
  display: inline-flex; align-items: center;
  font-family: var(--font-mono);
  font-size: 8.5pt;
  border-radius: 3pt;
  overflow: hidden;
  background: var(--crit-fill, var(--n-100));
  color: var(--crit-ink, var(--n-700));
  font-weight: 700;
  letter-spacing: 0.3pt;
}
.rep-crit__tier {
  padding: 2pt 6pt;
  background: rgba(0,0,0,0.2);
  color: rgba(255,255,255,0.95);
  font-weight: 700;
  letter-spacing: 0.4pt;
}
.rep-crit__name {
  padding: 2pt 6pt;
  text-transform: uppercase;
}

/* ── Heatmap ───────────────────────────────────────────── */
.rep-heat { margin: 6pt 0 10pt; }
.rep-heat__title { font-weight: 600; font-size: 10.5pt; margin-bottom: 6pt; }

.rep-heat2 {
  display: grid;
  grid-template-columns: 12pt auto auto;
  grid-template-rows: auto auto auto;
  gap: 4pt 6pt;
  align-items: stretch;
  justify-content: center;
  width: fit-content;
  margin: 0 auto;
}
.rep-heat2__yaxis {
  grid-column: 1; grid-row: 1;
  writing-mode: vertical-rl; transform: rotate(180deg);
  font-family: var(--font-mono); font-size: 8pt; color: var(--n-500);
  letter-spacing: 0.6pt; text-transform: uppercase;
  align-self: center; justify-self: center;
}
.rep-heat2__yticks {
  grid-column: 2; grid-row: 1;
  display: grid; grid-template-rows: repeat(5, var(--cell));
}
.rep-heat2__ytick {
  display: flex; flex-direction: column; align-items: flex-end; justify-content: center;
  padding-right: 4pt;
  height: var(--cell);
}
.rep-heat2__ytick .rep-heat2__num {
  font-family: var(--font-mono); font-weight: 600; font-size: 9.5pt; color: var(--n-800);
  line-height: 1;
}
.rep-heat2__ytick .rep-heat2__lbl {
  font-family: var(--font-mono); font-size: 7pt; color: var(--n-500);
  letter-spacing: 0.3pt; text-transform: uppercase; margin-top: 2pt;
}
.rep-heat2__matrix {
  grid-column: 3; grid-row: 1;
  display: grid; grid-template-rows: repeat(5, var(--cell));
  gap: 2pt;
}
.rep-heat2__row {
  display: grid; grid-template-columns: repeat(5, var(--cell)); gap: 2pt;
}
.rep-heat2__cell {
  width: var(--cell); height: var(--cell);
  display: flex; align-items: center; justify-content: center;
  font-family: var(--font-mono); font-weight: 700; font-size: 14pt;
  border-radius: 2pt;
}
.rep-heat2__count { font-variant-numeric: tabular-nums; }
.rep-heat2__xticks {
  grid-column: 3; grid-row: 2;
  display: grid; grid-template-columns: repeat(5, var(--cell)); gap: 2pt;
  margin-top: 2pt;
}
.rep-heat2__xtick {
  display: flex; flex-direction: column; align-items: center; justify-content: flex-start;
  width: var(--cell);
}
.rep-heat2__xtick .rep-heat2__num {
  font-family: var(--font-mono); font-weight: 600; font-size: 9.5pt; color: var(--n-800);
}
.rep-heat2__xtick .rep-heat2__lbl {
  font-family: var(--font-mono); font-size: 7pt; color: var(--n-500);
  letter-spacing: 0.3pt; text-transform: uppercase; margin-top: 1pt;
  text-align: center; white-space: nowrap;
}
.rep-heat2__xaxis {
  grid-column: 3; grid-row: 3;
  justify-self: center; margin-top: 2pt;
  font-family: var(--font-mono); font-size: 8pt; color: var(--n-500);
  letter-spacing: 0.6pt; text-transform: uppercase;
}
.rep-heat__legend { display: flex; gap: 10pt; margin-top: 6pt; flex-wrap: wrap; }
.rep-heat__key { display: inline-flex; align-items: center; gap: 4pt; font-size: 8.5pt; color: var(--n-600); font-family: var(--font-mono); letter-spacing: 0.3pt; }
.rep-heat__kdot { width: 10pt; height: 10pt; border-radius: 2pt; }

/* ── Residual bars ─────────────────────────────────────── */
.rep-resid { margin: 6pt 0 10pt; }
.rep-resid__legend { display: flex; gap: 14pt; font-size: 8.5pt; color: var(--n-600); margin: 4pt 0 8pt; font-family: var(--font-mono); letter-spacing: 0.3pt; }
.rep-resid__sw { display: inline-block; width: 10pt; height: 10pt; border-radius: 2pt; margin-right: 4pt; vertical-align: middle; }
.rep-resid__sw--before { background: var(--n-700); }
.rep-resid__sw--after { background: var(--n-700); opacity: 0.45; }
.rep-resid__row { display: grid; grid-template-columns: 80pt 1fr; gap: 8pt; align-items: center; margin-bottom: 4pt; }
.rep-resid__lbl { font-family: var(--font-mono); font-size: 9pt; color: var(--n-700); letter-spacing: 0.3pt; }
.rep-resid__tracks { display: flex; flex-direction: column; gap: 3pt; }
.rep-resid__track { height: 12pt; background: var(--n-75); position: relative; border-radius: 2pt; overflow: hidden; }
.rep-resid__bar { height: 100%; min-width: 1pt; }
.rep-resid__num { position: absolute; right: 6pt; top: 50%; transform: translateY(-50%); font-family: var(--font-mono); font-size: 9pt; font-weight: 600; color: var(--n-800); }

/* ── Threat card ───────────────────────────────────────── */
.rep-threat {
  margin: 8pt 0 10pt;
  padding: 10pt 12pt 12pt;
  border: 0.5pt solid var(--n-200);
  border-radius: 4pt;
  page-break-inside: avoid;
  background: #fff;
}
.rep-threat__hd {
  display: grid;
  grid-template-columns: 28pt 1fr auto;
  gap: 10pt;
  align-items: start;
  padding-bottom: 8pt;
  border-bottom: 0.5pt dashed var(--n-200);
  margin-bottom: 8pt;
}
.rep-threat__no {
  background: var(--n-900); color: #fff; font-family: var(--font-mono);
  font-weight: 700; font-size: 9pt; letter-spacing: 0.3pt;
  text-align: center; padding: 4pt 0; border-radius: 3pt;
}
.rep-threat__ti { font-size: 12pt; font-weight: 600; letter-spacing: -0.2px; }
.rep-threat__sep { color: var(--n-400); margin: 0 2px; }
.rep-threat__sub { font-size: 9pt; color: var(--n-500); margin-top: 2pt; }
.rep-threat__badges {
  display: grid;
  grid-template-columns: 85pt 85pt;
  gap: 3pt;
  flex: none;
  justify-self: end;
}
.rep-threat__badges--solo {
  grid-template-columns: 85pt;
}
.rep-threat__badges > * { justify-content: center; width: 100%; }
.rep-threat__badges > *:nth-child(3) { grid-column: 1 / -1; }

.rep-threat__metrics {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10pt;
  padding: 6pt 0;
  margin-bottom: 6pt;
  border-bottom: 0.5pt dashed var(--n-200);
}
.rep-threat__metric .rep-kicker { margin-bottom: 2pt; }
.rep-metric__v { font-family: var(--font-sans); font-weight: 600; font-size: 16pt; line-height: 1; color: var(--n-900); letter-spacing: -0.4px; }
.rep-metric__v--sm { font-size: 11pt; font-weight: 600; letter-spacing: 0; text-transform: capitalize; }
.rep-metric__d { font-size: 10pt; font-weight: 400; color: var(--n-400); margin-left: 2px; }

.rep-impact { margin: 6pt 0; }
.rep-impact__bits { margin-top: 3pt; }
.rep-impact__kv { display: inline-block; margin-right: 12pt; font-size: 9.5pt; color: var(--n-700); }
.rep-impact__kv b { font-weight: 500; color: var(--n-500); text-transform: capitalize; margin-right: 2px; }

.rep-rats { margin-top: 6pt; display: flex; flex-direction: column; gap: 4pt; }
.rep-rat { font-size: 9.5pt; color: var(--n-700); line-height: 1.45; padding-left: 66pt; text-indent: -66pt; }
.rep-rat__lbl { display: inline-block; width: 60pt; font-family: var(--font-mono); font-size: 8pt; font-weight: 500; color: var(--n-500); letter-spacing: 0.3pt; text-transform: uppercase; margin-right: 6pt; text-indent: 0; }
.rep-rat--alarp { background: #fbf4dd; border-left: 2pt solid #b59418; padding: 6pt 8pt 6pt 8pt; border-radius: 2pt; text-indent: 0; padding-left: 8pt; }
.rep-rat--alarp .rep-rat__lbl { display: inline-block; width: auto; margin-right: 8pt; color: #7a5a0e; }

.rep-threat__tags { margin-top: 8pt; display: flex; gap: 6pt; align-items: center; flex-wrap: wrap; }
.rep-threat__tags .rep-kicker { margin-right: 4pt; }

.rep-plans { margin-top: 8pt; padding-top: 6pt; border-top: 0.5pt dashed var(--n-200); }
.rep-plans .rep-kicker { margin-bottom: 4pt; }

/* ── Tables ────────────────────────────────────────────── */
.rep-tbl { width: 100%; border-collapse: collapse; font-size: 9.5pt; }
.rep-tbl th { font-family: var(--font-mono); font-size: 8pt; font-weight: 500; letter-spacing: 0.4pt; text-transform: uppercase; color: var(--n-500); text-align: left; padding: 5pt 8pt; border-bottom: 0.5pt solid var(--n-300); background: var(--n-75); }
.rep-tbl th.rep-num { text-align: right; }
.rep-tbl td { padding: 5pt 8pt; border-bottom: 0.5pt solid var(--n-150); vertical-align: top; }
.rep-tbl--plans th, .rep-tbl--plans td { font-size: 9pt; padding: 4pt 6pt; }

/* ── Compliance coverage bar ──────────────────────────── */
.rep-cov { display: inline-flex; align-items: center; gap: 6pt; width: 100%; }
.rep-cov__bar { height: 6pt; background: var(--n-700); border-radius: 1pt; min-width: 1pt; flex: none; }
.rep-cov__val { font-family: var(--font-mono); font-size: 9pt; color: var(--n-800); flex: none; margin-left: auto; }

/* ── Sign-off ──────────────────────────────────────────── */
.rep-signoff { display: grid; grid-template-columns: 1fr; gap: 18pt; margin-top: 14pt; }
.rep-signoff__row { display: grid; grid-template-columns: 180pt 1fr 140pt; gap: 16pt; align-items: end; padding-bottom: 4pt; }
.rep-signoff__row .rep-kicker { grid-column: 1; }
.rep-signoff__name { grid-column: 1; font-weight: 600; font-size: 11pt; }
.rep-signoff__meta { grid-column: 1; color: var(--n-500); font-size: 9pt; }
.rep-signoff__line { grid-column: 2; border-bottom: 1pt solid var(--n-400); height: 28pt; }
.rep-signoff__date { grid-column: 3; display: flex; flex-direction: column; gap: 4pt; border-bottom: 1pt solid var(--n-400); padding-bottom: 2pt; }

/* ── Methodology / Glossary ─────────────────────────────── */
.rep-meth { display: grid; grid-template-columns: 1fr 1fr; gap: 14pt 20pt; margin-top: 6pt; }
.rep-meth__block { break-inside: avoid; }
.rep-meth p, .rep-ul li { font-size: 10pt; line-height: 1.5; color: var(--n-700); }
.rep-ul { margin: 4pt 0 0; padding-left: 14pt; }
.rep-ul li { margin-bottom: 2pt; }

.rep-glossary { display: grid; grid-template-columns: 80pt 1fr; gap: 4pt 16pt; }
.rep-glossary dt { font-weight: 600; color: var(--n-800); letter-spacing: 0.3pt; }
.rep-glossary dd { margin: 0 0 6pt 0; font-size: 9.5pt; color: var(--n-700); }

/* ── Mono summary bars ─────────────────────────────────── */
.rep-mbar { display: grid; gap: 3pt; }
.rep-mbar > .rep-kicker { margin-bottom: 4pt; }
.rep-mbar__row { display: grid; grid-template-columns: 90pt 1fr 30pt 36pt; gap: 8pt; align-items: center; }
.rep-mbar__lbl { font-family: var(--font-mono); font-size: 9pt; color: var(--n-700); letter-spacing: 0.3pt; }
.rep-mbar__track { background: var(--n-100); height: 8pt; border-radius: 1pt; overflow: hidden; position: relative; }
.rep-mbar__fill { display: block; height: 100%; background: var(--n-800); min-width: 1pt; }
.rep-mbar__num { font-size: 9.5pt; font-weight: 600; color: var(--n-900); text-align: right; }
.rep-mbar__pct { font-size: 8.5pt; color: var(--n-500); text-align: right; }

/* ── Analyst cover ─────────────────────────────────────── */
.an-cover {
  padding: 18mm 16mm;
  display: grid;
  grid-template-rows: auto auto 1fr auto;
  gap: 12pt;
  height: 297mm;
  box-sizing: border-box;
}
.an-cover__dataline {
  font-family: var(--font-mono); font-size: 8.5pt; color: var(--n-500);
  letter-spacing: 0.5pt; text-transform: uppercase;
  display: flex; gap: 14pt; padding-bottom: 4pt; border-bottom: 0.5pt solid var(--n-300);
}
.an-cover__title-block { margin-top: 4pt; }
.an-cover__kicker { font-family: var(--font-mono); font-size: 9pt; color: var(--n-500); letter-spacing: 1.2pt; text-transform: uppercase; margin-bottom: 6pt; }
.an-cover__title { font-family: var(--font-sans); font-size: 32pt; font-weight: 700; line-height: 1.05; letter-spacing: -0.8pt; margin: 0 0 4pt; }
.an-cover__org { color: var(--n-500); font-size: 12pt; font-weight: 500; }
.an-cover__statline { margin-top: 10pt; display: flex; gap: 6pt; }
.an-cover__grid { display: grid; grid-template-columns: 1fr 1fr; gap: 18pt; align-content: start; }
.an-cover__hero { border: 0.5pt solid var(--n-300); padding: 14pt; background: #fff; }
.an-cover__herolabel { font-family: var(--font-mono); font-size: 8.5pt; color: var(--n-500); letter-spacing: 0.6pt; text-transform: uppercase; }
.an-cover__heronum { font-family: var(--font-sans); font-size: 56pt; font-weight: 700; line-height: 0.95; letter-spacing: -2pt; margin: 6pt 0 6pt; color: var(--n-900); }
.an-cover__herosub { font-size: 10pt; color: var(--n-600); line-height: 1.4; }
.an-cover__meta { display: grid; grid-template-columns: 90pt 1fr; gap: 4pt 10pt; font-size: 9.5pt; }
.an-cover__meta b { font-family: var(--font-mono); font-size: 8.5pt; color: var(--n-500); letter-spacing: 0.4pt; text-transform: uppercase; font-weight: 500; }

/* ── TOC ───────────────────────────────────────────────── */
.rep-toc { columns: 2; column-gap: 16pt; font-size: 10pt; }
.rep-toc__item { display: flex; justify-content: space-between; padding: 3pt 0; border-bottom: 0.5pt dotted var(--n-200); break-inside: avoid; }
.rep-toc__item b { font-weight: 500; }
.rep-toc__pg { font-family: var(--font-mono); color: var(--n-500); }

/* ── Exec summary cards ────────────────────────────────── */
.rep-cards { display: grid; grid-template-columns: repeat(5, 1fr); gap: 6pt; margin: 4pt 0 6pt; }
.rep-cards--4 { grid-template-columns: repeat(4, 1fr); }
.rep-card { border: 0.5pt solid var(--n-200); padding: 8pt 10pt; border-radius: 3pt; position: relative; }
.rep-card__strip { position: absolute; top: 0; left: 0; right: 0; height: 3pt; border-radius: 3pt 3pt 0 0; }
.rep-card__n { font-size: 20pt; font-weight: 700; letter-spacing: -0.6pt; color: var(--n-900); line-height: 1.05; font-family: var(--font-sans); }
.rep-card__l { font-family: var(--font-mono); font-size: 8pt; color: var(--n-500); letter-spacing: 0.4pt; text-transform: uppercase; margin-top: 2pt; }

/* ── Print ─────────────────────────────────────────────── */
@media print {
  @page { size: A4; margin: 0; }
  body { background: #fff; }
  .sheet { box-shadow: none; margin: 0; page-break-after: always; }
  .tweaks, .rep-top { display: none !important; }
}
`;
