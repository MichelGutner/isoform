#!/usr/bin/env bash
# Publishes a release from this machine with semantic-release: the Conventional Commits since
# the last tag decide the version; it publishes to npm, tags, creates the GitHub release and
# commits CHANGELOG.md and package.json back.
#
#   yarn release              publish (on main, or next for prereleases)
#   yarn release --dry-run    show the version and the notes, change nothing
#
# Needs: `npm login` and `gh auth login` done, a clean tree up to date with origin, and the
# local checks green (they run first).
set -euo pipefail
cd "$(dirname "$0")/.."

# yarn exports its own registry to scripts; npm login and publishing use the npm one
export npm_config_registry=https://registry.npmjs.org/

fail() { echo "release: $1" >&2; exit 1; }

DRY=false
[ "${1:-}" = "--dry-run" ] && DRY=true

# the tools are not repo dependencies: they are fetched at these pinned versions
TOOLS=(
  -p semantic-release@25.0.9
  -p @semantic-release/changelog@7.0.0
  -p @semantic-release/git@11.0.1
  -p conventional-changelog-conventionalcommits@9.3.1
)

command -v gh >/dev/null || fail "the GitHub CLI (gh) is not installed"
gh auth status >/dev/null 2>&1 || fail "not logged in to GitHub: run gh auth login"
npm whoami >/dev/null 2>&1 || fail "not logged in to npm: run npm login"

if [ "$DRY" = false ]; then
  branch=$(git rev-parse --abbrev-ref HEAD)
  case "$branch" in main | next) ;; *) fail "releases come from main or next, you are on $branch" ;; esac
  [ -z "$(git status --porcelain --untracked-files=no)" ] || fail "the working tree has uncommitted changes"
  git fetch -q origin "$branch"
  [ "$(git rev-parse HEAD)" = "$(git rev-parse "origin/$branch")" ] || fail "$branch is not in sync with origin/$branch"
  yarn verify
fi

export GITHUB_TOKEN="${GITHUB_TOKEN:-$(gh auth token)}"
if [ "$DRY" = true ]; then
  npx --yes "${TOOLS[@]}" semantic-release --no-ci --dry-run
else
  npx --yes "${TOOLS[@]}" semantic-release --no-ci
fi
