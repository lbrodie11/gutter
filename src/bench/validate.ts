import { readFileSync } from 'node:fs';
import type { BenchResultsModel } from './model.ts';

interface JsonSchemaNode {
  type?: string | string[];
  const?: unknown;
  enum?: unknown[];
  required?: string[];
  properties?: Record<string, JsonSchemaNode>;
  items?: JsonSchemaNode;
  maxItems?: number;
  minimum?: number;
  maximum?: number;
  oneOf?: JsonSchemaNode[];
  $ref?: string;
}

interface RootJsonSchema extends JsonSchemaNode {
  $defs?: Record<string, JsonSchemaNode>;
}

let cachedSchema: RootJsonSchema | null = null;

function getBenchSchema(): RootJsonSchema {
  if (cachedSchema) return cachedSchema;
  const raw = readFileSync(new URL('../../schema/bench.schema.json', import.meta.url), 'utf8');
  cachedSchema = JSON.parse(raw) as RootJsonSchema;
  return cachedSchema;
}

function deref(root: RootJsonSchema, node: JsonSchemaNode): JsonSchemaNode {
  if (!node.$ref) return node;
  const key = node.$ref.replace('#/$defs/', '');
  const resolved = root.$defs?.[key];
  if (!resolved) throw new Error(`Unresolved $ref in bench.schema.json: ${node.$ref}`);
  return resolved;
}

function matchesType(value: unknown, expectedType: string): boolean {
  switch (expectedType) {
    case 'null':
      return value === null;
    case 'boolean':
      return typeof value === 'boolean';
    case 'string':
      return typeof value === 'string';
    case 'number':
      return typeof value === 'number' && Number.isFinite(value);
    case 'integer':
      return typeof value === 'number' && Number.isInteger(value);
    case 'array':
      return Array.isArray(value);
    case 'object':
      return value !== null && typeof value === 'object' && !Array.isArray(value);
    default:
      return true;
  }
}

function validateNode(
  root: RootJsonSchema,
  schema: JsonSchemaNode,
  value: unknown,
  path: string,
  problems: string[],
): void {
  const s = deref(root, schema);

  if (s.oneOf) {
    const matched = s.oneOf.some((branch) => {
      const subProblems: string[] = [];
      validateNode(root, branch, value, path, subProblems);
      return subProblems.length === 0;
    });
    if (!matched) {
      problems.push(`${path} did not match any oneOf branch`);
    }
    return;
  }

  if (s.const !== undefined && value !== s.const) {
    problems.push(`${path} expected const ${JSON.stringify(s.const)}, got ${JSON.stringify(value)}`);
  }

  if (s.enum && !s.enum.includes(value)) {
    problems.push(`${path} value ${JSON.stringify(value)} not in enum ${JSON.stringify(s.enum)}`);
  }

  if (s.type !== undefined) {
    const types = Array.isArray(s.type) ? s.type : [s.type];
    if (!types.some((t) => matchesType(value, t))) {
      problems.push(`${path} expected type ${JSON.stringify(s.type)}, got ${value === null ? 'null' : typeof value}`);
      return;
    }
  }

  if (typeof value === 'number') {
    if (s.minimum !== undefined && value < s.minimum) {
      problems.push(`${path} value ${value} < minimum ${s.minimum}`);
    }
    if (s.maximum !== undefined && value > s.maximum) {
      problems.push(`${path} value ${value} > maximum ${s.maximum}`);
    }
  }

  if (Array.isArray(value)) {
    if (s.maxItems !== undefined && value.length > s.maxItems) {
      problems.push(`${path} length ${value.length} exceeds maxItems ${s.maxItems}`);
    }
    if (s.items) {
      value.forEach((item, idx) => validateNode(root, s.items!, item, `${path}[${idx}]`, problems));
    }
    return;
  }

  if (value !== null && typeof value === 'object') {
    const rec = value as Record<string, unknown>;
    for (const reqKey of s.required ?? []) {
      if (!(reqKey in rec) || rec[reqKey] === undefined) {
        problems.push(`${path}.${reqKey} missing`);
      }
    }
    for (const [propKey, propSchema] of Object.entries(s.properties ?? {})) {
      if (propKey in rec && rec[propKey] !== undefined) {
        validateNode(root, propSchema, rec[propKey], `${path}.${propKey}`, problems);
      }
    }
  }
}

/**
 * Validate a `BenchResultsModel` against `schema/bench.schema.json`.
 * Returns an array of validation problem strings (empty when valid).
 */
export function validateBenchResults(model: unknown): string[] {
  const root = getBenchSchema();
  const problems: string[] = [];
  validateNode(root, root, model, '$', problems);
  return problems;
}

/**
 * Assert that `model` conforms to `schema/bench.schema.json` before writing
 * `bench.json`, `bench.md`, or `bench.html`.
 */
export function assertValidBenchResults(model: BenchResultsModel): void {
  const problems = validateBenchResults(model);
  if (problems.length > 0) {
    throw new Error(`bench.json failed schema validation (${problems.length} issue(s)):\n  ${problems.slice(0, 10).join('\n  ')}`);
  }
}
