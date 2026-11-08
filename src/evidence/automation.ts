/**
 * Flag commits authored by bots and automation. Sweeping automated commits
 * (dependency bumps, formatters, agent-generated mass edits) can manufacture
 * co-change that means nothing, so a warning backed mostly by them is
 * labelled as such instead of silently trusted.
 *
 * Author names only, for now. Agent attribution via commit trailers
 * (Co-authored-by: ...) belongs upstream in Repo Archaeology's history reader.
 */
const AUTOMATION = [
  /\[bot\]$/i,
  /^dependabot/i,
  /^renovate/i,
  /^github-actions/i,
  /^greenkeeper/i,
  /^snyk-bot/i,
  /^semantic-release-bot/i,
  /^allcontributors/i,
  /^copilot(-swe-agent)?$/i,
  /^devin-ai-integration/i,
];

export function isAutomatedAuthor(author: string): boolean {
  const a = author.trim();
  return AUTOMATION.some((re) => re.test(a));
}
