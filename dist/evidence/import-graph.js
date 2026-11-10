import { resolveRelative } from "./imports.js";
/**
 * GU-05: "What it touches" from Repo Archaeology's import graph (aliases, workspaces, `exports`, Go, Python).
 * The interim relative-import scanner in `imports.ts` remains the fallback when the library is unavailable.
 *
 * - Importers of each changed file come from reverse edges (`to` = the changed file), split into changed
 *   and untouched importers.
 * - Deleted and renamed-away paths are not in the head graph. Their importers are the repo-wide `unresolved`
 *   entries whose relative specifier points at that path (`target-missing`): those become broken-import
 *   candidates, as with the fallback scanner.
 * - `coverage` is `partial` when any other import in the repository is unresolved: such a file could be an
 *   importer Gutter cannot see. Imports mapped to a removed path are reported as broken imports instead.
 */
const NON_CODE = new Set(['markdown', 'json', 'yaml', 'toml']);
const MAX_UNRESOLVED_SAMPLES = 5;
const MAX_SAMPLE_LEN = 200;
export function dependentsFromImportGraph(changes, graph, repoGraph = graph) {
    const changedPaths = new Set(changes.files.map((f) => f.path));
    const removed = new Set();
    for (const f of changes.files) {
        if (f.status === 'deleted')
            removed.add(f.path);
        if (f.oldPath)
            removed.add(f.oldPath);
    }
    const headFiles = new Set([...graph.files, ...repoGraph.files, ...graph.edges.map((e) => e.to), ...repoGraph.edges.map((e) => e.to)]);
    const importersOf = new Map();
    for (const f of changes.files)
        if (f.status !== 'deleted')
            importersOf.set(f.path, new Set());
    for (const p of removed)
        importersOf.set(p, new Set());
    const vias = new Set();
    for (const e of graph.edges) {
        if (e.from === e.to)
            continue;
        const set = importersOf.get(e.to);
        if (!set || removed.has(e.to))
            continue;
        set.add(e.from);
        vias.add(e.via ?? 'unknown');
    }
    let unresolvedCount = 0;
    const byReason = {};
    const samples = new Set();
    for (const u of repoGraph.unresolved) {
        const target = u.specifier.startsWith('.') ? resolveRelative(u.from, u.specifier, headFiles, removed) : undefined;
        if (target && removed.has(target)) {
            if (u.from !== target)
                importersOf.get(target)?.add(u.from);
            continue;
        }
        unresolvedCount++;
        const reason = u.reasonCode ?? 'unknown';
        byReason[reason] = (byReason[reason] ?? 0) + 1;
        const sample = `${u.from} → ${u.specifier}`;
        samples.add(sample.length > MAX_SAMPLE_LEN ? `${sample.slice(0, MAX_SAMPLE_LEN - 1)}…` : sample);
    }
    const entries = [];
    for (const [file, importers] of importersOf) {
        const list = [...importers].sort();
        if (!list.length)
            continue;
        entries.push({
            id: `deps:${file}`,
            file,
            deleted: removed.has(file),
            changedImporters: list.filter((p) => changedPaths.has(p)),
            untouchedImporters: list.filter((p) => !changedPaths.has(p)),
        });
    }
    entries.sort((a, b) => Number(b.deleted) - Number(a.deleted) || b.untouchedImporters.length - a.untouchedImporters.length);
    const languages = new Set([...graph.languages, ...repoGraph.languages]);
    const unchecked = changes.files
        .filter((f) => f.language !== null && !NON_CODE.has(f.language) && !languages.has(f.language))
        .map((f) => f.path);
    const imports = repoGraph.meta.imports;
    return {
        analyzers: ['ra-import-graph', ...[...vias].sort()],
        entries,
        unchecked,
        coverage: unresolvedCount > 0 ? 'partial' : 'full',
        unresolved: {
            count: unresolvedCount,
            samples: [...samples].sort().slice(0, MAX_UNRESOLVED_SAMPLES),
            byReason,
        },
        scannedFiles: typeof imports?.filesScanned === 'number' ? imports.filesScanned : repoGraph.files.length,
    };
}
