/**
 * Everything that comes from a PR — titles, bodies, file names, commit
 * subjects, author names — is hostile input. These helpers are the only way
 * renderers put such text on the page.
 */
export function html(s) {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
/** Inline Markdown text: escape syntax, defuse @mentions, flatten newlines. */
export function mdText(s) {
    return s
        .replace(/[\r\n]+/g, ' ')
        .replace(/[\\`*_{}[\]()#+\-.!|~>]/g, (c) => `\\${c}`)
        .replace(/</g, '&lt;')
        .replace(/@(?=\w)/g, '@​');
}
/** A Markdown code span that cannot be broken out of by backticks in `s`. */
export function mdCode(s) {
    const flat = s.replace(/[\r\n]+/g, ' ');
    const longest = Math.max(0, ...[...flat.matchAll(/`+/g)].map((m) => m[0].length));
    const fence = '`'.repeat(longest + 1);
    const pad = flat.startsWith('`') || flat.endsWith('`') ? ' ' : '';
    return `${fence}${pad}${flat}${pad}${fence}`;
}
/** Table cells additionally cannot contain a raw pipe, even inside code spans. */
export function mdCell(rendered) {
    return rendered.replace(/\|/g, '\\|');
}
/** Only ever emit http(s) links built from a trusted base. */
export function safeBase(url) {
    if (!url)
        return undefined;
    try {
        const u = new URL(url);
        return u.protocol === 'https:' || u.protocol === 'http:' ? u.toString().replace(/\/$/, '') : undefined;
    }
    catch {
        return undefined;
    }
}
export function commitUrl(repoUrl, sha) {
    const base = safeBase(repoUrl);
    return base && /^[0-9a-f]{7,64}$/i.test(sha) ? `${base}/commit/${sha}` : undefined;
}
export function fileUrl(repoUrl, ref, path) {
    const base = safeBase(repoUrl);
    if (!base || !ref || !/^[0-9a-f]{7,64}$/i.test(ref))
        return undefined;
    return `${base}/blob/${ref}/${path.split('/').map(encodeURIComponent).join('/')}`;
}
export const short = (sha) => sha.slice(0, 7);
