# Releasing Quilt

All five packages share a stable version. Release creation is explicit; ordinary merges never publish.

1. Create a branch and run `npm run release:version -- 0.11.0` (substitute the next version).
2. Add a `## 0.11.0` entry to `CHANGELOG.md`. Review the version and internal dependency changes, then merge a pull request after CI passes.
3. Open GitHub Actions → Release → Run workflow on `main`. Enter the committed version and leave **publish** unchecked to rehearse the complete release.
4. Run again with **publish** checked. Approve the `npm` environment deployment after verification succeeds.

Dry runs are also allowed on development branches and validate archives without contacting npm publication endpoints. Actual publication is restricted to `main`.

The workflow tests and packs once, then publishes those exact archives in core → vanilla → React → Three → Three React order. It checks the shared version, changelog, clean source commit, and artifact hashes. A retry accepts already-published packages only if their integrity matches, allowing recovery from a partially completed release. Never change an already-published version; bump again if contents differ. The original manually published 0.1.0 archives cannot be republished by this workflow.

Publishing uses npm trusted publishing with GitHub OIDC and automatic provenance. Each package trusts `niko-dellic/quilt`, workflow `release.yml`, environment `npm`, with direct publishing allowed. No npm token secret is needed. The environment is restricted to `main` and requires maintainer approval; the maintainer may approve their own manually triggered release.

On success the workflow creates a `v<version>` GitHub release with changelog notes and tarballs. If publication succeeds but GitHub release creation fails, rerun the same workflow run using its original commit. Release jobs are serialized to avoid concurrent publishing.

CI runs `npm run check` on pull requests and pushes under Node 24. The required `verify` check protects `main`; dependency updates arrive through weekly Dependabot pull requests.

## Three.js package split

The next coordinated release contains five packages. Published 0.10.0 archives
cannot be replaced; choose a new coordinated version with `release:version` before
publication. This release removes `quilt-three/react`: consumers install and import
`quilt-three-react` instead. The shared renderer remains in `quilt-three`.

Verify npm name availability and trusted publishing for the new
`quilt-three-react` package before its first publication. Local tests and rehearsals
do not verify registry permissions. Packed consumer checks install each integration
alone, verify automatic peer/type resolution, and ensure vanilla installs exclude
React/R3F. Existing `quilt-react` React 18 coverage remains separate from the
React 19/R3F 9 integration checks.

Review the [graphics validation record](three-validation.md) alongside the general
release gate for the supported WebGL and WebGPU renderer scope.

## Local rehearsal with uncommitted release work

After `npm run check`, run `npm run release:rehearse`. It copies the current
nonignored source into a temporary repository, creates a temporary snapshot
commit there, installs dependencies, and runs packing plus the normal release
validation and archive dry run. It leaves this checkout's Git history untouched
and writes `artifacts/release-rehearsal.json`.

This preserves the clean-tree and archive-provenance requirements. It does not
publish, push, tag, dispatch GitHub Actions, or verify npm trusted-publishing
permissions. The real release must still run from the reviewed, clean commit via
the existing workflow. All five package versions and starter dependencies
advance together through `release:version`.

`npm run check` includes packed starter tests and starts Electron. Linux CI runs
under Xvfb. If local npm configuration disables dependency lifecycle scripts,
install Electron's development binary explicitly with
`node node_modules/electron/install.js` before the tests.

## Desktop demo releases

Desktop binaries use a separate `desktop-v<version>` GitHub release. The
[Desktop demo workflow](https://github.com/niko-dellic/quilt/blob/main/.github/workflows/desktop.yml) packages and tests
macOS arm64/x64, Windows x64, and Ubuntu x64 applications on matching runners.
Run it on `main` with **publish** enabled to upload the binaries and SHA-256
checksums. This does not publish npm packages. Existing release tags are not
overwritten. See [desktop development](https://github.com/niko-dellic/quilt/blob/main/desktop/README.md) for local commands
and [desktop release notes](https://github.com/niko-dellic/quilt/blob/main/docs/desktop-release.md) for installation details.
