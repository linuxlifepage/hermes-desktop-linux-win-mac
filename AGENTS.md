# Repository Guidelines

## Project Structure & Module Organization

- `src/` contains frontend TypeScript, UI rendering, i18n, update checks, and global styles.
- `src/styles.css` holds shared layout/component CSS; `src/themes.css` holds theme variables and overrides.
- `src/locales/` contains `.strings` localization files; keep locale keys in sync.
- `src-tauri/src/` contains Rust backend modules for SSH, storage, terminal, files, workflows, cron, kanban, and skills.
- `assets/` contains images used by docs/UI; `scripts/` contains local checks, release prep, and smoke scripts.
- `.github/workflows/tauri-ci.yml` builds Linux, macOS, and Windows bundles.

## Build, Test, and Development Commands

- `npm run dev` starts the Vite frontend dev server.
- `npm run tauri dev` starts the full Tauri app with Rust backend.
- `npm run build` runs TypeScript checks and creates a Vite production build.
- `npm run test:i18n` verifies localization parity and frontend translation keys.
- `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check` checks Rust formatting.
- `cargo check --manifest-path src-tauri/Cargo.toml` checks Rust compilation.
- `cargo test --manifest-path src-tauri/Cargo.toml` runs Rust unit tests.
- `npm run test:smoke:ui` checks theme/view/mobile UI invariants, using Chromium when available.

## Coding Style & Naming Conventions

Use TypeScript `strict` conventions and keep UI edits close to existing patterns in `src/main.ts`. Prefer small helpers when behavior is reused. CSS uses variables for themeable colors; add new themes in `src/themes.css`. Rust code should pass `rustfmt`; module and function names use snake_case.

## Testing Guidelines

Run `npm run test:i18n`, `npm run test:smoke:ui`, `npm run build`, `cargo fmt --check`, `cargo check`, and `cargo test` before release-oriented changes. Rust tests live alongside modules under `src-tauri/src/`. SSH smoke tests are ignored by default; configure `HERMES_SMOKE_*` before running them.

## Commit & Pull Request Guidelines

History uses concise imperative commit messages, for example `Fix macOS PTY open call` or `Add separate outline theme`. Keep commits focused. PRs should describe behavior changes, list verification commands, link issues when relevant, and include screenshots for visible UI/theme changes.

## Release & Configuration Notes

Do not create GitHub Releases manually before CI artifacts exist. For release prep, run `npm run release:prepare -- 0.10.4`; it only bumps versions and runs checks. Normal flow after review: `git commit -m "Release v0.10.4"`, `git tag -a v0.10.4 -m "Release v0.10.4"`, then `git push origin main v0.10.4`. GitHub Actions builds bundles and creates or updates the release.
