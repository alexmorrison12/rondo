#!/usr/bin/env node
/**
 * Export the launch plan data (src/data/plan.ts) to docs/LAUNCH_PLAN.md so the page and
 * the document never drift. Node ≥ 23 strips TypeScript types natively.
 *   node tools/export-plan.mjs
 */
import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const plan = await import(path.join(root, 'src/data/plan.ts'));
const site = await import(path.join(root, 'src/data/site.ts'));
const money = (n) => (n ? `$${n.toLocaleString('en-US')}` : 'In-house');
const nf = new Intl.NumberFormat('en-US');
const SITE = 'https://alexmorrison12.github.io/rondo';

const lines = [];
const p = (...l) => lines.push(...l);

p('# Rondo launch plan', '');
p('> Generated from `src/data/plan.ts` by `tools/export-plan.mjs`. The live, interactive version (with a phase switcher that previews the whole site in each phase) is at ' + `[${SITE}/launch-plan/](${SITE}/launch-plan/).`, '');
p('## Goal', '', plan.PLAN_SUMMARY.goal, '');
p('**North star:** ' + plan.PLAN_SUMMARY.northStar, '');
p('## Strategy', '', plan.PLAN_SUMMARY.strategy, '');
p('## Positioning', '', plan.PLAN_SUMMARY.positioning, '');
p('## Flight plan', '', '| Target | Value | By |', '|---|---|---|');
plan.TARGETS.forEach((t) => p(`| ${t.metric} | ${t.target} | ${t.by} |`));
p('');

p('## Critical path', '', 'Dated gates. If one slips, the phase after it slips with it.', '', '| Date | Gate | Owner |', '|---|---|---|');
plan.CRITICAL_PATH.forEach((g) => p(`| ${g.date} | ${g.gate} | ${g.owner} |`));
p('');

p('## Phases', '');
for (const ph of plan.PHASE_PLANS) {
  p(`### ${ph.title} · ${ph.dates}`, '', `**Goal:** ${ph.goal}`, '');
  p('**Landing pages:** ' + ph.landing.map((l) => `[${l.name}](${SITE}${l.href})`).join(' · '), '');
  p('**Tactics**', '');
  ph.tactics.forEach((t) => p(`- ${t}`));
  p('', '**KPIs**', '', '| KPI | Target |', '|---|---|');
  ph.kpis.forEach(([k, v]) => p(`| ${k} | ${v} |`));
  p('', `**Exit criteria:** ${ph.exit}`, '');
  p('**What changes on the site in this phase**', '');
  ph.siteChanges.forEach((c) => p(`- ${c}`));
  p(`- Primary CTA: “${site.PHASES[ph.id].cta.label}” → \`${site.PHASES[ph.id].cta.href}\``, '');
}

p('## Funnel (launch-period targets)', '', '| Step | Target | Note |', '|---|---:|---|');
plan.FUNNEL.forEach((f) => p(`| ${f.step} | ${nf.format(f.value)} | ${f.note} |`));
p('');

p('## Viral loops', '');
plan.LOOPS.forEach((l) => p(`- **${l.name}.** ${l.mechanic} _${l.why}_`));
p('');

p('## Channels', '', '| Channel | Phase | Tactic | Budget | KPI |', '|---|---|---|---:|---|');
plan.CHANNELS.forEach((c) => p(`| ${c.channel} | ${c.phase} | ${c.tactic} | ${money(c.budget)} | ${c.kpi} |`));
p('', `_${plan.ATTRIBUTION_NOTE}_`);
const total = plan.BUDGET.reduce((n, b) => n + b.amount, 0);
p('', `## Budget · ${money(total)}`, '', '| Item | Amount |', '|---|---:|');
plan.BUDGET.forEach((b) => p(`| ${b.item} | ${money(b.amount)} |`));
p('');

p('## Experiments', '', '| Test | Hypothesis | Metric |', '|---|---|---|');
plan.EXPERIMENTS.forEach((x) => p(`| ${x.test} | ${x.hypothesis} | ${x.metric} |`));
p('', '**Measured events:** ' + plan.EVENTS.map((e) => `\`${e}\``).join(', '), '');
p('Cookieless analytics by default; marketing pixels only with consent.', '');

p('## Risks', '', '| Risk | Mitigation |', '|---|---|');
plan.RISKS.forEach((r) => p(`| ${r.risk} | ${r.mitigation} |`));
p('');

p('## After launch: operating the core site', '', '### Weekly cadence', '', '| When | What |', '|---|---|');
plan.OPERATIONS.cadence.forEach(([d, t]) => p(`| ${d} | ${t} |`));
p('', '### Deliberately deferred (this build prioritises the experience)', '');
plan.OPERATIONS.deferred.forEach((d, i) => p(`${i + 1}. **${d.title}** (${d.when}): ${d.detail}`));
p('', '### Launch assets', '');
plan.ASSETS.forEach((a) => p(`- ${a}`));
p('');

await mkdir(path.join(root, 'docs'), { recursive: true });
await writeFile(path.join(root, 'docs/LAUNCH_PLAN.md'), lines.join('\n'));
console.log('✓ docs/LAUNCH_PLAN.md');
