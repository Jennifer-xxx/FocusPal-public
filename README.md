# FocusPal

FocusPal is a local-first macOS desktop focus companion for students and knowledge workers. It lets users capture distracting thoughts without leaving their work, finish a focus block, then reveal one saved leisure thought as a blind-box reward.

Project track: **Application / Product** with optional API-backed AI features.

## Why I Built It
Small distractions often become context switches: a search, a message, a song, or an errand can pull someone out of deep work. FocusPal turns those interruptions into a quick capture loop:

1. Catch the thought.
2. Return to focus.
3. Complete the timer.
4. Review a reward and any follow-up actions.

The goal is not to punish distractions. It stores them safely and makes delayed gratification easier.

## What It Does
- Tauri 2 desktop app with React, TypeScript, Vite, Tailwind CSS, and SQLite.
- Global `Cmd+Shift+Space` thought catcher in the desktop app.
- Compact always-on-top focus widget and optional pixel character companion.
- Focus timer with start, pause, resume, complete, and cancel.
- Local deterministic classifier by default.
- Optional OpenRouter classifier, focus debrief, and action extraction when local-only mode is disabled and an API key is saved.
- Blind-box reward reveal after completed focus time.
- Post-focus action plan extraction from task, study, and message thoughts.
- History for thoughts and actions, including category edits, reward toggles, restore, defer, done, and delete.
- Local settings for default duration, companion mode, local-only mode, API key, and shortcut status.

For demo speed, one completed focus minute earns one reward credit.

## How To Run
Prerequisites:
- macOS for the full desktop demo and global shortcut behavior.
- Node.js and npm.
- Rust/Cargo and the Tauri 2 prerequisites for local desktop development.

Install dependencies:
```sh
npm install
```

Run the browser preview:
```sh
npm run dev
```

Run the desktop app:
```sh
npm run tauri -- dev
```

Reset local demo data:
```sh
npm run demo:reset
```

Run checks:
```sh
npm test
npm run lint
npm run build
cd apps/desktop/src-tauri && cargo test
```

## Demo Flow
1. Run `npm run tauri -- dev`.
2. Choose `1 min` for a live demo.
3. Start focus and let the app collapse into the widget or character companion.
4. Press `Cmd+Shift+Space`, enter a few thoughts, and save with Enter.
5. Complete the timer.
6. Review the reward, debrief state, and extracted actions.
7. Open History, Actions, and Settings to show persistence and privacy controls.

Screenshots:
- [Initial view](screenshots/focuspal-demo.png)
- [Post-focus review](screenshots/focuspal-after-focus-demo.png)

## Full Success Path
1. Open FocusPal and confirm Settings show local-only mode enabled by default.
2. Choose Compact widget or Pixel character as the focus companion.
3. Start a focus block. The main window shrinks into the selected companion surface and stays on top.
4. Capture distractions with `Cmd+Shift+Space`:
   - Leisure thoughts such as searches, food, games, shopping, media, and ideas are reward-eligible.
   - Task, study, and message thoughts are kept as work/action items instead of rewards.
5. Pause and resume manually:
   - Compact widget mode has pause/resume controls.
   - Character mode pauses/resumes with a single click.
6. In Pixel character mode, stop moving the mouse or keyboard:
   - After 30 seconds of inactivity, the character enlarges, centers, and switches to an annoyed state.
   - After another 30 seconds of inactivity, the session auto-pauses and the timer freezes.
   - Click the character to resume focus and return it to the focused state.
7. Complete the focus timer:
   - A completed session earns reward credits.
   - Cancelled sessions do not earn rewards.
8. Review the post-focus screen:
   - One eligible thought is revealed as the blind-box reward.
   - Local-only mode shows debrief unavailable instead of calling an API.
   - Task, study, and message thoughts become action items.
9. Triage after focus:
   - Use, snooze, or dismiss the reward.
   - Mark action items done, defer them, reopen them, or delete them.
   - Open History to edit categories, toggle reward eligibility, restore old thoughts, and inspect source thoughts.
10. Return to the main app. The desktop window restores the size it had before focus or capture.

## Technical Notes
- Product logic lives in `apps/desktop/src/domain`.
- React app UI lives in `apps/desktop/src/app`.
- Storage lives behind repository interfaces in `apps/desktop/src/lib/storage`.
- Tauri/Rust integration lives in `apps/desktop/src-tauri`.
- SQLite is used in the desktop app. Browser preview and tests use an equivalent `localStorage` fallback.
- Local-only mode is enabled by default. Captured thoughts are sent to OpenRouter only if the user disables local-only mode and saves an API key.
- API calls validate structured output and fall back locally or to no API result on missing key, network failure, invalid response, refusal, unsupported category, or low confidence.

## Evaluation And Evidence
Latest checks:
```sh
npm test                                 # 112 tests passed
npm run lint                             # TypeScript check passed
npm run build                            # production build passed
cd apps/desktop/src-tauri && cargo test  # 8 Rust/Tauri tests passed
```

Manual validation:
- Reset demo data with `npm run demo:reset`.
- Launched the desktop app with `npm run tauri -- dev`.
- Ran the 1-minute focus loop.
- Verified capture, reward reveal, action extraction, History, Actions, Settings, local-only mode, and window-size restore after focus/capture.

Evidence of iteration:
- The project progressed from scaffold, storage, classifier, thought catcher, focus/reward loop, companion UI, API-backed AI helpers, and demo polish as separate implementation phases.
- Tests cover classifier behavior, focus timing, reward selection, persistence, shortcut/catcher behavior, widget mode, history, settings, and reward persistence.

## Major Decisions
- Local-first by default: user thoughts stay on device unless the user explicitly enables API-backed features.
- macOS-first demo scope: global shortcuts, transparent companion windows, and idle detection are implemented for the desktop target rather than generalized prematurely.
- Optional AI boundary: API-backed classification, debriefs, and action extraction are useful enhancements, but the core product remains functional offline with local fallback behavior.
- Reward timing: the 1-minute unlock is a demo setting, not the intended long-term productivity setting.
- Product logic placement: most product behavior stays in TypeScript domain/storage modules; Rust is reserved for Tauri desktop integration.

## Limitations
- The 1-minute reward unlock is for demo timing. A real use case would use longer focus blocks.
- Optional AI features require an OpenRouter API key.
- The pixel character companion is functional but actions are simple so far.
- Evaluation so far is based on automated tests and manual demo smoke tests. There is no formal user study.
- The app is currently macOS-first. Browser preview is useful for UI development, but it cannot fully reproduce desktop-only behavior such as global shortcuts and transparent always-on-top companion windows.

## Future Directions
- Add richer local character states and deterministic movement.
- Run a small user study with students during real work sessions.
- Improve the visual design while keeping the app compact and calm.
- Add more privacy-preserving context signals, such as app/window awareness, without collecting page content or browsing history.

## AI Usage Disclosure
AI tools were used during development for implementation help, debugging, test design, character image generation, and documentation cleanup. AI-generated suggestions were reviewed and edited before being included.

Inside the app, there are optional AI inferences. With an OpenRouter API key, FocusPal can call an API-backed thought classifier, focus debrief generator, and action-plan extractor.

## Citations And Acknowledgements
- This project was built for CS 153 as an individual course project. It was not forked from an existing app or starter repository beyond standard framework scaffolding.
- Core desktop framework: [Tauri](https://tauri.app/).
- Frontend stack: [React](https://react.dev/), [TypeScript](https://www.typescriptlang.org/), [Vite](https://vite.dev/), and [Tailwind CSS](https://tailwindcss.com/).
- Desktop/storage stack: [Rust](https://www.rust-lang.org/) for Tauri-side integration and [SQLite](https://www.sqlite.org/) through the Tauri SQL plugin, with a browser `localStorage` fallback for preview and tests.
- Optional API routing/model access: [OpenRouter](https://openrouter.ai/).
- Optional demo model target: [Google Gemini API model family](https://ai.google.dev/gemini-api/docs/models).
- Character images were generated with AI image-generation assistance, then bundled locally as static assets for deterministic runtime behavior.
