/**
 * semantic-release, run by the maintainer on `main`: the Conventional Commits since the
 * last tag decide the next version (fix → patch, feat → minor, `!`/BREAKING CHANGE → major).
 * It publishes to npm, creates the GitHub release and tag, and commits the CHANGELOG and
 * package.json back. The tools are not repo dependencies (they need a newer Node than
 * local development), so run it with `npx -p semantic-release -p @semantic-release/changelog
 * -p @semantic-release/git -p conventional-changelog-conventionalcommits semantic-release --no-ci`.
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
