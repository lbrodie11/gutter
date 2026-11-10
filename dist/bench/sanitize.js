/**
 * Sanitization helpers for untrusted git-derived strings (commit subjects,
 * file paths, branch names, author names, and config strings).
 *
 * Strips ASCII control characters and Unicode bidirectional override/isolate
 * characters, redacts emails, tokens, and absolute local filesystem paths, and
 * bounds string lengths.
 */
// ASCII C0/C1 control chars (excluding standard space) and DEL
const CONTROL_CHARS_RE = /[\u0000-\u001F\u007F-\u009F]/g;
// Unicode bidirectional formatting / override / isolate characters (Trojan Source)
const BIDI_CHARS_RE = /[\u061C\u200E\u200F\u202A-\u202E\u2066-\u2069]/g;
// Email addresses
const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
// Common credential tokens, AWS access keys, API keys, Bearer tokens, and URL userinfo
const TOKEN_RE = /\b(?:gh[pousr]_[A-Za-z0-9_]{8,}|github_pat_[A-Za-z0-9_]{8,}|glpat-[A-Za-z0-9_-]{8,}|xox[baprs]-[A-Za-z0-9-]{8,}|npm_[A-Za-z0-9]{8,}|(?:AKIA|ASIA)[0-9A-Z]{16}|sk-(?:proj-|ant-)?[A-Za-z0-9_-]{12,}|Bearer\s+[A-Za-z0-9._~+/=-]{8,})\b/g;
const URL_CREDENTIALS_RE = /((?:https?|git|ssh):\/\/)([^/\s@]+@)/gi;
// Absolute local filesystem paths on macOS/Linux/Windows
const ABS_LOCAL_PATH_RE = /(?:^|(?<=[\s"'`(]))(?:\/(?:Users|home|private\/var\/folders|var\/folders|tmp|private\/tmp)\/[^\s"'`)]+|[A-Za-z]:\\(?:Users|Temp|Windows)\\[^\s"'`)]+)/g;
export function stripControlAndBidi(input) {
    return input.replace(BIDI_CHARS_RE, '').replace(CONTROL_CHARS_RE, ' ');
}
export function sanitizeText(input, maxLen = 300) {
    const cleaned = stripControlAndBidi(input)
        .replace(URL_CREDENTIALS_RE, '$1')
        .replace(TOKEN_RE, '[redacted-token]')
        .replace(EMAIL_RE, '[redacted-email]')
        .replace(ABS_LOCAL_PATH_RE, '[local-path]')
        .replace(/\s+/g, ' ')
        .trim();
    if (cleaned.length <= maxLen)
        return cleaned;
    return `${cleaned.slice(0, Math.max(0, maxLen - 1))}…`;
}
export function sanitizePath(input, maxLen = 240) {
    const cleaned = stripControlAndBidi(input)
        .replace(TOKEN_RE, '[redacted-token]')
        .replace(EMAIL_RE, '[redacted-email]')
        .replace(/^[A-Za-z]:[\\/]+/, '')
        .replace(/^\/+(?:Users|home|private\/var\/folders|var\/folders|tmp|private\/tmp)\/[^/]+\//, '')
        .replace(/^\/+/, '')
        .trim();
    if (cleaned.length <= maxLen)
        return cleaned;
    return `${cleaned.slice(0, Math.max(0, maxLen - 1))}…`;
}
export function sanitizeAuthorName(input, maxLen = 80) {
    const withoutAngleEmail = stripControlAndBidi(input).replace(/<[^>]*>/g, '');
    const cleaned = withoutAngleEmail
        .replace(EMAIL_RE, '[redacted]')
        .replace(TOKEN_RE, '[redacted]')
        .replace(ABS_LOCAL_PATH_RE, '[redacted]')
        .replace(/\s+/g, ' ')
        .trim();
    if (!cleaned)
        return 'unknown';
    if (cleaned.length <= maxLen)
        return cleaned;
    return `${cleaned.slice(0, Math.max(0, maxLen - 1))}…`;
}
