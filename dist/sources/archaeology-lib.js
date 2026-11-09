var __rewriteRelativeImportExtension = (this && this.__rewriteRelativeImportExtension) || function (path, preserveJsx) {
    if (typeof path === "string" && /^\.\.?\//.test(path)) {
        return path.replace(/\.(tsx)$|((?:\.d)?)((?:\.[^./]+?)?)\.([cm]?)ts$/i, function (m, tsx, d, ext, cm) {
            return tsx ? preserveJsx ? ".jsx" : ".js" : d && (!ext || !cm) ? m : (d + ext + "." + cm.toLowerCase() + "js");
        });
    }
    return path;
};
import { existsSync, readFileSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
export const MIN_RA_LIB_VERSION = '0.4.0';
export class RaLibUnavailableError extends Error {
    exitCode = 2;
    constructor(detail) {
        const suffix = detail ? ` (${detail})` : '';
        super(`error: gutter bench requires local library repo-archaeology >= ${MIN_RA_LIB_VERSION}${suffix}; install repo-archaeology@^0.4.0 or pass --ra-lib <path>`);
        this.name = 'RaLibUnavailableError';
    }
}
export function isVersionAtLeast(actual, minimum) {
    const parse = (v) => {
        const m = /^v?(\d+)\.(\d+)\.(\d+)/.exec(v.trim());
        if (!m)
            return null;
        return [Number(m[1]), Number(m[2]), Number(m[3])];
    };
    const a = parse(actual);
    const b = parse(minimum);
    if (!a || !b)
        return false;
    if (a[0] !== b[0])
        return a[0] > b[0];
    if (a[1] !== b[1])
        return a[1] > b[1];
    return a[2] >= b[2];
}
function findNearestPackageVersion(startPath) {
    let dir = statSync(startPath, { throwIfNoEntry: false })?.isDirectory() ? startPath : dirname(startPath);
    for (let i = 0; i < 5; i++) {
        const pkgPath = join(dir, 'package.json');
        if (existsSync(pkgPath)) {
            try {
                const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
                if (pkg.name === 'repo-archaeology' && typeof pkg.version === 'string') {
                    return pkg.version;
                }
            }
            catch {
                // continue walking
            }
        }
        const parent = dirname(dir);
        if (parent === dir)
            break;
        dir = parent;
    }
    return undefined;
}
/**
 * Load `repo-archaeology` >= 0.4.0 strictly from a local library (`import()` or `--ra-lib <path>`).
 * Never spawns `npx` or performs any network access.
 */
export async function loadRaLibrary(raLibPath) {
    const spec = raLibPath ?? process.env.GUTTER_RA_LIB;
    let mod;
    let detectedVersion;
    if (spec) {
        const abs = resolve(spec);
        if (!existsSync(abs)) {
            throw new RaLibUnavailableError(`--ra-lib path not found: ${spec}`);
        }
        let entryPath = abs;
        const st = statSync(abs);
        if (st.isDirectory()) {
            const pkgPath = join(abs, 'package.json');
            if (existsSync(pkgPath)) {
                try {
                    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
                    if (typeof pkg.version === 'string')
                        detectedVersion = pkg.version;
                }
                catch {
                    // ignore
                }
            }
            const distApi = join(abs, 'dist', 'api', 'index.js');
            const distIndex = join(abs, 'dist', 'index.js');
            if (existsSync(distApi))
                entryPath = distApi;
            else if (existsSync(distIndex))
                entryPath = distIndex;
            else
                throw new RaLibUnavailableError(`no entry point found in directory ${spec}`);
        }
        else {
            detectedVersion = findNearestPackageVersion(abs);
        }
        try {
            mod = (await import(__rewriteRelativeImportExtension(pathToFileURL(entryPath).href)));
        }
        catch (err) {
            throw new RaLibUnavailableError(`failed to import ${spec}: ${err.message.split('\n')[0]}`);
        }
    }
    else {
        try {
            const req = createRequire(import.meta.url);
            const resolvedEntry = req.resolve('repo-archaeology');
            detectedVersion = findNearestPackageVersion(resolvedEntry);
            mod = (await import(__rewriteRelativeImportExtension(pathToFileURL(resolvedEntry).href)));
        }
        catch {
            throw new RaLibUnavailableError('package repo-archaeology is not installed locally');
        }
    }
    if (typeof mod.version === 'string') {
        detectedVersion = mod.version;
    }
    if (typeof mod.openRepository !== 'function') {
        throw new RaLibUnavailableError(detectedVersion
            ? `found repo-archaeology@${detectedVersion} without openRepository()`
            : 'module does not export openRepository()');
    }
    const finalVersion = detectedVersion ?? MIN_RA_LIB_VERSION;
    if (!isVersionAtLeast(finalVersion, MIN_RA_LIB_VERSION)) {
        throw new RaLibUnavailableError(`found repo-archaeology@${finalVersion}`);
    }
    return {
        openRepository: mod.openRepository,
        version: finalVersion,
    };
}
