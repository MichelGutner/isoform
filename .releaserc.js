/**
 * semantic-release: on every push to `main`, the Conventional Commits since the last tag
 * decide the next version (fix → patch, feat → minor, `!`/BREAKING CHANGE → major).
 * It publishes to npm with provenance, creates the GitHub release and tag, and commits
 * the CHANGELOG and package.json back. The tools are installed by the release workflow,
 * not by the repo (they need a newer Node than local development).
 */
module.exports = {
  branches: ['main', { name: 'next', prerelease: true }],
  plugins: [
    ['@semantic-release/commit-analyzer', { preset: 'conventionalcommits' }],
    ['@semantic-release/release-notes-generator', { preset: 'conventionalcommits' }],
    ['@semantic-release/changelog', { changelogFile: 'CHANGELOG.md' }],
    '@semantic-release/npm',
    '@semantic-release/github',
    [
      '@semantic-release/git',
      {
        assets: ['CHANGELOG.md', 'package.json'],
        message: 'chore(release): ${nextRelease.version} [skip ci]\n\n${nextRelease.notes}',
      },
    ],
  ],
};
