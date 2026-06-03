# FocusPal Desktop

Tauri 2 + React desktop app for FocusPal.

## Structure
- `src/app`: React UI, app shell, styles, and app tests.
- `src/domain`: classifier, focus timing, rewards, debriefs, and action extraction.
- `src/lib/storage`: SQLite repository, schema, migrations, and browser fallback.
- `src-tauri`: native shell, global shortcut, SQL permissions, window behavior, and Rust tests.

## Commands
From the repository root:
```sh
npm run dev
npm run tauri -- dev
npm test
npm run lint
npm run build
npm run demo:reset
```

Rust/Tauri checks:
```sh
cd apps/desktop/src-tauri
cargo test
```

## Notes
- Demo reward unlock: 1 completed focus minute.
- Desktop storage: SQLite.
- Preview/test storage: `localStorage` fallback.
- Shortcut: `CmdOrCtrl+Shift+Space`.
- Default privacy mode: local-only.
- Optional API mode: OpenRouter with validated fallback behavior.
