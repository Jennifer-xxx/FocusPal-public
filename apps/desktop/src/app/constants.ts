import type { FocusCompanionMode } from "../lib/storage/repository";

export const SHORTCUT = "CmdOrCtrl+Shift+Space" as const;
export const SHORTCUT_OPTIONS = [
  "CmdOrCtrl+Shift+Space",
  "CmdOrCtrl+Alt+Space",
  "CmdOrCtrl+Shift+C",
  "Alt+Space",
] as const;
export const FOCUS_COMPANION_MODE_OPTIONS: FocusCompanionMode[] = ["widget", "character"];

export const OPEN_MAIN_PAGE_EVENT = "focuspal://open-main-page";
export const OPEN_THOUGHT_CATCHER_EVENT = "focuspal://open-thought-catcher";
export const MAIN_WINDOW_WIDTH = 420;
export const MAIN_WINDOW_HEIGHT = 640;
export const MAIN_WINDOW_MIN_WIDTH = 380;
export const MAIN_WINDOW_MIN_HEIGHT = 320;
export const WIDGET_WINDOW_WIDTH = 212;
export const WIDGET_WINDOW_HEIGHT = 155;
export const CHARACTER_WINDOW_WIDTH = 236;
export const CHARACTER_WINDOW_HEIGHT = 236;
export const CHARACTER_INACTIVE_WINDOW_WIDTH = 400;
export const CHARACTER_INACTIVE_WINDOW_HEIGHT = 400;
export const CHARACTER_MOUSE_INACTIVE_MS = 30_000;
export const CHARACTER_INACTIVE_AUTO_PAUSE_MS = 30_000;
export const CHARACTER_REWARD_READY_MS = 3_000;

export type ShortcutOption = (typeof SHORTCUT_OPTIONS)[number];
