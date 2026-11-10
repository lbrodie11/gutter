/**
 * The gutter.json contract (schemaVersion 1).
 *
 * This is the product. Renderers (compact Markdown, comic HTML), the GitHub
 * Action, future IDE/agent surfaces and analytics all consume this one shape.
 * Rule: no renderer may say anything that is not in here, and every checklist
 * item must cite evidence ids that exist in here.
 *
 * Versioning mirrors Repo Archaeology: additive fields and new enum values keep
 * schemaVersion 1; removing/renaming/retyping a field bumps it. Consumers must
 * ignore unknown properties and tolerate unknown enum values (e.g. new
 * `checklist.kind` values).
 */
export const SCHEMA_VERSION = 1;
