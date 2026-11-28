#!/usr/bin/env node
/** Merge per-backend benchmark summaries into one reproducible benchmark.json. */
import fs from 'node:fs/promises';
import path from 'node:path';

const inputs = process.argv.slice(2).filter((x) => !x.startsWith('--output='));
const outputArg = process.argv.find((x) => x.startsWith('--output='));
const output = outputArg ? outputArg.slice('--output='.length) : 'benchmark-results/benchmark.json';
if (!inputs.length) {
  throw new Error('Usage: node scripts/merge-benchmarks.mjs benchmark-results/benchmark-auto.json benchmark-results/benchmark-webgl.json --output=benchmark-results/benchmark.json');
}
const backends = {};
for (const file of inputs) {
  const full = path.resolve(file);
  const content = JSON.parse(await fs.readFile(full, 'utf8'));
  const key = content.summary?.backendRequested || path.basename(file, '.json').replace(/^benchmark-/, '');
  backends[key] = { source: full, summary: content.summary, medianAcrossRuns: content.medianAcrossRuns, runs: content.runs };
}
const shaSet = new Set(Object.values(backends).map((x) => x.summary?.gitSha).filter(Boolean));
const result = {
  schemaVersion: '1.1.0',
  createdAt: new Date().toISOString(),
  comparable: shaSet.size <= 1,
  warning: shaSet.size > 1 ? 'Input summaries have different git SHAs; do not treat them as a controlled A/B comparison.' : null,
  backends,
};
const dest = path.resolve(output);
await fs.mkdir(path.dirname(dest), { recursive: true });
await fs.writeFile(dest, JSON.stringify(result, null, 2) + '\n');
console.log(`Combined benchmark written to ${dest}`);
