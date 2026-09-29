import { generateMessages } from '@cucumber/gherkin';
import { IdGenerator, SourceMediaType } from '@cucumber/messages';
import { readdir, readFile, mkdir, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';

async function files(dir) {
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    return (await Promise.all(entries.map(e => e.isDirectory() ? files(path.join(dir, e.name)) : e.name === 'spec.md' ? [path.join(dir, e.name)] : []))).flat().sort();
  } catch (e) { if (e.code === 'ENOENT') return []; throw e; }
}
const key = s => s.trim().replace(/\s+/g, ' ');
export function parseSpec(text, delta = false) {
  const records = []; const renames = []; let operation = delta ? null : 'Requirements';
  let renameFrom; let sectionRenames = 0;
  const finishSection = () => {
    if (operation === 'RENAMED' && (renameFrom !== undefined || !sectionRenames)) throw Error('Malformed RENAMED Requirements');
  };
  let current;
  let fenced = false;
  for (const line of text.split(/\r?\n/)) {
    if (/^```/.test(line)) fenced = !fenced;
    const section = !fenced && /^## (.+) Requirements\s*$/.exec(line);
    if (section) {
      finishSection();
      if (delta && !['ADDED', 'MODIFIED', 'REMOVED', 'RENAMED'].includes(section[1])) throw Error(`Unsupported operation section: ${section[1]}`);
      operation = section[1]; current = null; sectionRenames = 0; continue;
    }
    if (!fenced && /^##\s/.test(line)) { finishSection(); operation = delta ? null : 'Requirements'; current = null; }
    if (!fenced && !/^```/.test(line) && operation === 'RENAMED' && line.trim()) {
      const entry = /^- (FROM|TO): `### Requirement: ([^`]+)`\s*$/.exec(line);
      if (!entry || !key(entry[2])) throw Error('Malformed RENAMED Requirements');
      if (entry[1] === 'FROM' && renameFrom === undefined) renameFrom = key(entry[2]);
      else if (entry[1] === 'TO' && renameFrom !== undefined) {
        renames.push([renameFrom, key(entry[2])]); renameFrom = undefined; sectionRenames++;
      } else throw Error('Malformed RENAMED Requirements');
      continue;
    }
    const heading = !fenced && /^### Requirement:\s*(.+)$/.exec(line);
    if (heading) {
      if (!['Requirements', 'ADDED', 'MODIFIED', 'REMOVED'].includes(operation)) throw Error('Requirement outside supported section');
      current = { name: key(heading[1]), operation, body: '' }; records.push(current);
    } else if (current) current.body += line + '\n';
  }
  finishSection();
  return { records, renames };
}
export function compose(base, delta) {
  const result = new Map();
  for (const r of parseSpec(base).records) {
    if (result.has(r.name)) throw Error(`Duplicate requirement: ${r.name}`);
    result.set(r.name, r.body);
  }
  const changes = parseSpec(delta, true);
  for (const [from, to] of changes.renames) {
    if (!result.has(from) || result.has(to)) throw Error(`Invalid rename: ${from} -> ${to}`);
    result.set(to, result.get(from)); result.delete(from);
  }
  const seen = new Set();
  for (const r of changes.records) {
    if (seen.has(r.name)) throw Error(`Duplicate delta: ${r.name}`); seen.add(r.name);
    if (r.operation === 'ADDED' && result.has(r.name)) throw Error(`Already exists: ${r.name}`);
    if (r.operation !== 'ADDED' && !result.has(r.name)) throw Error(`Unknown requirement: ${r.name}`);
    if (r.operation === 'REMOVED') result.delete(r.name);
    else result.set(r.name, r.body);
  }
  return result;
}
export function feature(capability, requirements) {
  let output = `Feature: ${capability}\n`; let count = 0;
  for (const [name, body] of requirements) {
    const scenarios = [...body.matchAll(/^#### Scenario(?: Outline)?:\s*(.+)\n([\s\S]*?)(?=^#### |$(?![\s\S]))/gm)];
    if (!scenarios.length) throw Error(`No scenarios: ${capability}/${name}`);
    for (const s of scenarios) {
      const blocks = [...s[2].matchAll(/^```gherkin\s*\n([\s\S]*?)^```\s*$/gm)];
      if (blocks.length !== 1) throw Error(`Exactly one Gherkin block required: ${s[1]}`);
      const steps = blocks[0][1];
      if (/^\s*(Feature|Scenario|Background|Rule|@)[ :]/m.test(steps)) throw Error('Only steps and Examples belong in scenario fences');
      const outline = /^\s*Examples:/m.test(steps);
      output += `\n  ${outline ? 'Scenario Outline' : 'Scenario'}: ${name} — ${s[1].trim()}\n` + steps.split('\n').map(l => '    ' + l).join('\n') + '\n';
      count++;
    }
  }
  const messages = generateMessages(output, `${capability}/spec.feature`, SourceMediaType.TEXT_X_CUCUMBER_GHERKIN_PLAIN, {
    includeGherkinDocument: true, includePickles: true, newId: IdGenerator.incrementing()
  });
  const errors = messages.filter(m => m.parseError);
  if (errors.length) throw Error(`Invalid Gherkin: ${errors.map(m => m.parseError.message).join('; ')}`);
  const pickles = messages.filter(m => m.pickle).map(m => m.pickle);
  const document = messages.find(m => m.gherkinDocument)?.gherkinDocument;
  for (const child of document?.feature?.children || []) {
    if (!child.scenario || !child.scenario.steps.length || !pickles.some(p => p.astNodeIds.includes(child.scenario.id))) {
      throw Error(`Incomplete scenario (empty steps or Examples): ${child.scenario?.name || capability}`);
    }
    const scenario = child.scenario;
    const inputs = scenario.steps.flatMap(step => [step.text, step.docString?.content || '',
      ...(step.dataTable?.rows || []).flatMap(row => row.cells.map(cell => cell.value))]);
    const required = new Set(inputs.flatMap(input => [...input.matchAll(/<([^<>]+)>/g)].map(match => match[1])));
    for (const examples of scenario.examples) {
      const columns = new Set(examples.tableHeader?.cells.map(cell => cell.value) || []);
      const missing = [...required].filter(name => !columns.has(name));
      if (missing.length) throw Error(`Missing Examples columns in ${scenario.name}: ${missing.join(', ')}`);
      if (!examples.tableBody.length) throw Error(`Incomplete scenario (empty Examples): ${scenario.name}`);
    }
  }
  return { output, count, executions: pickles.length };
}
export async function generate(root, change, out) {
  if (change && (!/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(change) || change === 'archive')) throw Error('Select one active change name, not a path/archive');
  const canonical = path.join(root, 'openspec/specs');
  const deltaRoot = change && path.join(root, 'openspec/changes', change, 'specs');
  const baseFiles = await files(canonical); const deltaFiles = deltaRoot ? await files(deltaRoot) : [];
  if (change && !deltaFiles.length) throw Error(`No delta specs for active change ${change}`);
  const bases = new Map(await Promise.all(baseFiles.map(async f => [path.relative(canonical, f), await readFile(f, 'utf8')])));
  const deltas = new Map(await Promise.all(deltaFiles.map(async f => [path.relative(deltaRoot, f), await readFile(f, 'utf8')])));
  await rm(out, { recursive: true, force: true }); await mkdir(out, { recursive: true });
  let count = 0;
  for (const file of [...new Set([...bases.keys(), ...deltas.keys()])].sort()) {
    const capability = path.dirname(file);
    const generated = feature(capability, compose(bases.get(file) || '', deltas.get(file) || ''));
    if (generated.count) {
      const dest = path.join(out, capability, 'spec.feature');
      await mkdir(path.dirname(dest), { recursive: true }); await writeFile(dest, generated.output); count += generated.executions;
    }
  }
  if (!count) throw Error('Acceptance suite is empty. Author spec.md scenarios for a feature first.');
  return count;
}
