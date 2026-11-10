// GU-30: validate bench/corpus.json against bench/corpus.schema.json (dependency-free subset of JSON Schema:
// type, required, additionalProperties: false, enum, const, pattern, minLength, minItems, minimum, maximum).
import { readFileSync } from 'node:fs';

const SCHEMA = JSON.parse(readFileSync(new URL('./corpus.schema.json', import.meta.url), 'utf8'));

function check(schema, value, path, problems) {
  if ('const' in schema && value !== schema.const) problems.push(`${path}: must be ${JSON.stringify(schema.const)}`);
  if (schema.enum && !schema.enum.includes(value)) problems.push(`${path}: ${JSON.stringify(value)} not in ${JSON.stringify(schema.enum)}`);
  const type = schema.type;
  if (type === 'object') {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return problems.push(`${path}: must be an object`);
    for (const k of schema.required ?? []) if (!(k in value)) problems.push(`${path}.${k}: missing`);
    if (schema.additionalProperties === false) for (const k of Object.keys(value)) if (!(k in (schema.properties ?? {}))) problems.push(`${path}.${k}: unknown property`);
    for (const [k, sub] of Object.entries(schema.properties ?? {})) if (k in value) check(sub, value[k], `${path}.${k}`, problems);
  } else if (type === 'array') {
    if (!Array.isArray(value)) return problems.push(`${path}: must be an array`);
    if (schema.minItems !== undefined && value.length < schema.minItems) problems.push(`${path}: needs at least ${schema.minItems} items`);
    value.forEach((v, i) => check(schema.items, v, `${path}[${i}]`, problems));
  } else if (type === 'string') {
    if (typeof value !== 'string') return problems.push(`${path}: must be a string`);
    if (schema.minLength !== undefined && value.length < schema.minLength) problems.push(`${path}: too short`);
    if (schema.pattern && !new RegExp(schema.pattern).test(value)) problems.push(`${path}: does not match ${schema.pattern}`);
  } else if (type === 'number') {
    if (typeof value !== 'number' || !Number.isFinite(value)) return problems.push(`${path}: must be a number`);
    if (schema.minimum !== undefined && value < schema.minimum) problems.push(`${path}: below ${schema.minimum}`);
    if (schema.maximum !== undefined && value > schema.maximum) problems.push(`${path}: above ${schema.maximum}`);
  }
}

/** Problems with a corpus document (empty when valid), including duplicate repositories. */
export function validateCorpus(doc) {
  const problems = [];
  check(SCHEMA, doc, '$', problems);
  const seen = new Set();
  for (const r of Array.isArray(doc?.repos) ? doc.repos : []) {
    if (seen.has(r.url)) problems.push(`$.repos: duplicate ${r.url}`);
    seen.add(r.url);
  }
  return problems;
}

export const repoSlug = (url) => url.replace(/^https:\/\/github\.com\//, '').replace('/', '__');
export const repoName = (url) => url.replace(/^https:\/\/github\.com\//, '');
