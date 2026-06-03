import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import { createBrowserStorageRepository, createDefaultSettings } from "../lib/storage/repository";

const OPEN_MAIN_PAGE_EVENT = "focuspal://open-main-page";
const OPEN_THOUGHT_CATCHER_EVENT = "focuspal://open-thought-catcher";

const tauriMocks = vi.hoisted(() => {
  const eventHandlers: Record<string, Array<(event: { payload: unknown }) => void>> = {};
  const window = {
    center: vi.fn(async () => undefined),
    hide: vi.fn(async () => undefined),
    isVisible: vi.fn(async () => true),
    outerPosition: vi.fn(async () => ({ x: 48, y: 72 })),
    outerSize: vi.fn(async () => ({ height: 640, width: 420 })),
    setBackgroundColor: vi.fn(async () => undefined),
    setAlwaysOnTop: vi.fn(async () => undefined),
    setDecorations: vi.fn(async () => undefined),
    setFocus: vi.fn(async () => undefined),
    setMinSize: vi.fn(async () => undefined),
    setPosition: vi.fn(async () => undefined),
    setShadow: vi.fn(async () => undefined),
    setSize: vi.fn(async () => undefined),
    scaleFactor: vi.fn(async () => 1),
    show: vi.fn(async () => undefined),
    startDragging: vi.fn(async () => undefined),
    unminimize: vi.fn(async () => undefined),
  };

  return {
    appShow: vi.fn(async () => undefined),
    eventHandlers,
    invoke: vi.fn(async (command: string) => {
      if (command === "get_global_idle_ms") {
        return 0;
      }
      throw new Error(`Unhandled Tauri command: ${command}`);
    }),
    listen: vi.fn(async (event: string, handler: (event: { payload: unknown }) => void) => {
      eventHandlers[event] = [...(eventHandlers[event] ?? []), handler];
      return vi.fn();
    }),
    registerShortcut: vi.fn(async () => undefined),
    unregisterAllShortcuts: vi.fn(async () => undefined),
    window,
  };
});

vi.mock("@tauri-apps/api/app", () => ({
  show: tauriMocks.appShow,
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: tauriMocks.invoke,
}));

vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: () => tauriMocks.window,
  LogicalSize: class LogicalSize {
    height: number;
    width: number;

    constructor(width: number, height: number) {
      this.width = width;
      this.height = height;
    }
  },
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: tauriMocks.listen,
}));

vi.mock("@tauri-apps/plugin-global-shortcut", () => ({
  register: tauriMocks.registerShortcut,
  unregisterAll: tauriMocks.unregisterAllShortcuts,
}));

function setTauriRuntime(enabled: boolean) {
  if (enabled) {
    Object.defineProperty(window, "__TAURI_INTERNALS__", {
      configurable: true,
      value: {},
    });
    return;
  }

  delete (window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;
}

function emitTauriEvent(event: string, payload: unknown = {}) {
  for (const handler of tauriMocks.eventHandlers[event] ?? []) {
    handler({ payload });
  }
}

describe("App companion shell", () => {
  beforeEach(() => {
    vi.useRealTimers();
    setTauriRuntime(false);
    tauriMocks.appShow.mockClear();
    tauriMocks.invoke.mockClear();
    tauriMocks.invoke.mockImplementation(async (command: string) => {
      if (command === "get_global_idle_ms") {
        return 0;
      }
      throw new Error(`Unhandled Tauri command: ${command}`);
    });
    tauriMocks.listen.mockClear();
    for (const event of Object.keys(tauriMocks.eventHandlers)) {
      delete tauriMocks.eventHandlers[event];
    }
    tauriMocks.window.setAlwaysOnTop.mockClear();
    tauriMocks.window.setBackgroundColor.mockClear();
    tauriMocks.window.center.mockClear();
    tauriMocks.window.setDecorations.mockClear();
    tauriMocks.window.setFocus.mockClear();
    tauriMocks.window.hide.mockClear();
    tauriMocks.window.isVisible.mockClear();
    tauriMocks.window.isVisible.mockResolvedValue(true);
    tauriMocks.window.outerPosition.mockClear();
    tauriMocks.window.outerPosition.mockResolvedValue({ x: 48, y: 72 });
    tauriMocks.window.outerSize.mockClear();
    tauriMocks.window.outerSize.mockResolvedValue({ height: 640, width: 420 });
    tauriMocks.window.setMinSize.mockClear();
    tauriMocks.window.setPosition.mockClear();
    tauriMocks.window.setShadow.mockClear();
    tauriMocks.window.setSize.mockClear();
    tauriMocks.window.scaleFactor.mockClear();
    tauriMocks.window.scaleFactor.mockResolvedValue(1);
    tauriMocks.window.show.mockClear();
    tauriMocks.window.startDragging.mockClear();
    tauriMocks.window.unminimize.mockClear();
    tauriMocks.registerShortcut.mockClear();
    tauriMocks.unregisterAllShortcuts.mockClear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("prioritizes the compact companion surface over dashboard sections", () => {
    render(<App />);

    expect(screen.getByRole("heading", { name: "FocusPal" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /capture thought/i })).toBeInTheDocument();
    expect(screen.getByText("Ready")).toBeInTheDocument();
    expect(screen.queryByText("Settings scaffold")).not.toBeInTheDocument();
  });

  it("opens a focused thought catcher overlay and closes it with Escape", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: /capture thought/i }));

    const input = screen.getByLabelText("Distraction thought");
    expect(input).toHaveFocus();

    await user.keyboard("{Escape}");

    await waitFor(() => {
      expect(screen.queryByLabelText("Distraction thought")).not.toBeInTheDocument();
    });
    expect(screen.getByRole("heading", { name: "FocusPal" })).toBeInTheDocument();
    expect(tauriMocks.window.hide).not.toHaveBeenCalled();
  });

  it("switches to the widget-only focus surface when focus starts", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Start" }));

    expect(screen.getByRole("region", { name: "Focus companion widget" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "FocusPal" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "⌘⇧Space" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pause focus" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel focus" })).toBeInTheDocument();
  });

  it("switches to a character-only focus surface when character mode is saved", async () => {
    const user = userEvent.setup();
    const repository = createBrowserStorageRepository();
    await repository.updateSettings({
      ...createDefaultSettings(),
      focusCompanionMode: "character",
      characterEnabled: true,
    });

    render(<App />);
    await user.click(screen.getByRole("button", { name: "Start" }));

    const character = screen.getByRole("region", { name: "Focus character companion" });
    expect(character).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Focus companion widget" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "⌘⇧Space" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Pause focus" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cancel focus" })).not.toBeInTheDocument();
    expect(screen.queryByText("60:00")).not.toBeInTheDocument();
    const progress = screen.getByRole("progressbar", { name: "Focus progress" });
    expect(progress).toHaveAttribute("aria-valuenow", "0");
    expect(progress).toHaveStyle({ "--character-progress-scale": "0" });
  });

  it("restores the main page on character double-click", async () => {
    const user = userEvent.setup();
    const repository = createBrowserStorageRepository();
    await repository.updateSettings({
      ...createDefaultSettings(),
      focusCompanionMode: "character",
      characterEnabled: true,
    });

    render(<App />);
    await user.click(screen.getByRole("button", { name: "Start" }));
    await user.dblClick(screen.getByRole("region", { name: "Focus character companion" }));

    expect(screen.getByRole("heading", { name: "FocusPal" })).toBeInTheDocument();
  });

  it("opens capture by shortcut in character mode and returns to the character after saving", async () => {
    const user = userEvent.setup();
    const repository = createBrowserStorageRepository();
    await repository.updateSettings({
      ...createDefaultSettings(),
      focusCompanionMode: "character",
      characterEnabled: true,
    });

    render(<App />);
    await user.click(screen.getByRole("button", { name: "Start" }));

    fireEvent.keyDown(window, {
      code: "Space",
      key: " ",
      metaKey: true,
      shiftKey: true,
    });

    await user.type(screen.getByLabelText("Distraction thought"), "save this reward idea");
    await user.keyboard("{Enter}");

    await waitFor(() => {
      expect(screen.queryByLabelText("Distraction thought")).not.toBeInTheDocument();
    });
    expect(screen.getByRole("region", { name: "Focus character companion" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "FocusPal" })).not.toBeInTheDocument();
  });

  it("shows a larger annoyed character after long mouse inactivity", async () => {
    const repository = createBrowserStorageRepository();
    await repository.updateSettings({
      ...createDefaultSettings(),
      focusCompanionMode: "character",
      characterEnabled: true,
    });

    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    await waitFor(() => {
      expect(screen.getByText("Pixel character")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: "Companion" }));

    vi.useFakeTimers();
    fireEvent.click(screen.getByRole("button", { name: "Start" }));

    const character = screen.getByRole("region", { name: "Focus character companion" });
    expect(character).not.toHaveClass("character-companion--inactive");

    act(() => {
      vi.advanceTimersByTime(30_000);
    });

    expect(character).toHaveClass("character-companion--inactive");
    expect(document.querySelector(".character-image")).toHaveAttribute(
      "src",
      expect.stringContaining("companion_annoyed"),
    );

    fireEvent.mouseMove(window);

    expect(character).not.toHaveClass("character-companion--inactive");
  });

  it("toggles pause and resume from a single character click", async () => {
    const repository = createBrowserStorageRepository();
    await repository.updateSettings({
      ...createDefaultSettings(),
      focusCompanionMode: "character",
      characterEnabled: true,
    });

    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    await waitFor(() => {
      expect(screen.getByText("Pixel character")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: "Companion" }));

    vi.useFakeTimers();
    fireEvent.click(screen.getByRole("button", { name: "Start" }));

    const character = screen.getByRole("region", { name: "Focus character companion" });
    fireEvent.click(character, { detail: 1 });
    act(() => {
      vi.advanceTimersByTime(260);
    });

    expect(character).toHaveClass("character-companion--paused");

    fireEvent.click(character, { detail: 1 });
    act(() => {
      vi.advanceTimersByTime(260);
    });

    expect(character).toHaveClass("character-companion--focused");
  });

  it("keeps a character drag from toggling pause", async () => {
    const repository = createBrowserStorageRepository();
    await repository.updateSettings({
      ...createDefaultSettings(),
      focusCompanionMode: "character",
      characterEnabled: true,
    });

    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    await waitFor(() => {
      expect(screen.getByText("Pixel character")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: "Companion" }));

    vi.useFakeTimers();
    fireEvent.click(screen.getByRole("button", { name: "Start" }));

    const character = screen.getByRole("region", { name: "Focus character companion" });
    fireEvent.pointerDown(character, { button: 0, clientX: 10, clientY: 10 });
    fireEvent.pointerMove(character, { clientX: 24, clientY: 10 });
    fireEvent.pointerUp(character);
    fireEvent.click(character, { detail: 1 });
    act(() => {
      vi.advanceTimersByTime(260);
    });

    expect(character).toHaveClass("character-companion--focused");
  });

  it("auto-pauses after the character remains annoyed for another inactivity window", async () => {
    const repository = createBrowserStorageRepository();
    await repository.updateSettings({
      ...createDefaultSettings(),
      focusCompanionMode: "character",
      characterEnabled: true,
    });

    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    await waitFor(() => {
      expect(screen.getByText("Pixel character")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: "Companion" }));

    vi.useFakeTimers();
    fireEvent.click(screen.getByRole("button", { name: "Start" }));

    const character = screen.getByRole("region", { name: "Focus character companion" });
    act(() => {
      vi.advanceTimersByTime(30_000);
    });

    expect(character).toHaveClass("character-companion--inactive");

    act(() => {
      vi.advanceTimersByTime(30_000);
    });

    expect(character).toHaveClass("character-companion--inactive");
    expect(character).toHaveClass("character-companion--auto-paused");
    expect(document.querySelector(".character-image")).toHaveAttribute(
      "src",
      expect.stringContaining("companion_annoyed_paused"),
    );

    fireEvent.mouseMove(window);
    expect(character).toHaveClass("character-companion--inactive");

    fireEvent.click(character, { detail: 1 });
    act(() => {
      vi.advanceTimersByTime(260);
    });

    expect(character).toHaveClass("character-companion--focused");
    expect(character).not.toHaveClass("character-companion--inactive");
    expect(character).not.toHaveClass("character-companion--auto-paused");
  });

  it("does not switch to the annoyed character while paused", async () => {
    const repository = createBrowserStorageRepository();
    await repository.updateSettings({
      ...createDefaultSettings(),
      focusCompanionMode: "character",
      characterEnabled: true,
    });

    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    await waitFor(() => {
      expect(screen.getByText("Pixel character")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: "Companion" }));

    vi.useFakeTimers();
    fireEvent.click(screen.getByRole("button", { name: "Start" }));
    fireEvent.doubleClick(screen.getByRole("region", { name: "Focus character companion" }));
    fireEvent.click(screen.getByRole("button", { name: "Pause" }));
    fireEvent.doubleClick(screen.getByLabelText("Main companion panel"));

    const character = screen.getByRole("region", { name: "Focus character companion" });
    expect(character).toHaveClass("character-companion--paused");

    act(() => {
      vi.advanceTimersByTime(30_000);
    });

    expect(character).toHaveClass("character-companion--paused");
    expect(character).not.toHaveClass("character-companion--inactive");
    expect(document.querySelector(".character-image")).toHaveAttribute(
      "src",
      expect.stringContaining("companion_paused"),
    );
  });

  it("uses global desktop idle time for the inactive character state when available", async () => {
    const repository = createBrowserStorageRepository();
    await repository.updateSettings({
      ...createDefaultSettings(),
      focusCompanionMode: "character",
      characterEnabled: true,
    });
    let globalIdleMs = 31_000;
    tauriMocks.invoke.mockImplementation(async (command: string) => {
      if (command === "get_global_idle_ms") {
        return globalIdleMs;
      }
      throw new Error(`Unhandled Tauri command: ${command}`);
    });
    setTauriRuntime(true);

    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    await waitFor(() => {
      expect(screen.getByText("Pixel character")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: "Companion" }));
    fireEvent.click(screen.getByRole("button", { name: "Start" }));

    const character = screen.getByRole("region", { name: "Focus character companion" });
    await waitFor(() => {
      expect(character).toHaveClass("character-companion--inactive");
    });
    expect(document.querySelector(".character-image")).toHaveAttribute(
      "src",
      expect.stringContaining("companion_annoyed"),
    );
    await waitFor(() => {
      expect(tauriMocks.window.setSize).toHaveBeenCalledWith(
        expect.objectContaining({ height: 400, width: 400 }),
      );
    });
    expect(tauriMocks.window.outerPosition).toHaveBeenCalled();
    expect(tauriMocks.window.center).toHaveBeenCalled();

    globalIdleMs = 0;
    await waitFor(() => {
      expect(character).not.toHaveClass("character-companion--inactive");
    });
    await waitFor(() => {
      expect(tauriMocks.window.setSize).toHaveBeenCalledWith(
        expect.objectContaining({ height: 236, width: 236 }),
      );
    });
    expect(tauriMocks.window.setPosition).toHaveBeenCalledWith({ x: 48, y: 72 });
  });

  it("shows reward-ready character briefly when character focus completes", async () => {
    const repository = createBrowserStorageRepository();
    await repository.updateSettings({
      ...createDefaultSettings(),
      defaultFocusMinutes: 1,
      focusCompanionMode: "character",
      characterEnabled: true,
    });

    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    await waitFor(() => {
      expect(screen.getByText("Pixel character")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: "Companion" }));

    vi.useFakeTimers();
    fireEvent.click(screen.getByRole("button", { name: "Start" }));

    act(() => {
      vi.advanceTimersByTime(60_000);
    });

    const character = screen.getByRole("region", { name: "Focus character companion" });
    expect(character).toHaveClass("character-companion--reward-ready");
    expect(screen.getByRole("progressbar", { name: "Focus progress" })).toHaveAttribute(
      "aria-valuenow",
      "100",
    );
    expect(document.querySelector(".character-image")).toHaveAttribute(
      "src",
      expect.stringContaining("companion_reward_ready"),
    );

    act(() => {
      vi.advanceTimersByTime(3_000);
    });

    expect(screen.getByRole("heading", { name: "Focus complete" })).toBeInTheDocument();
  });

  it("restores the main page on widget double-click and returns to widget mode from the main page", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Start" }));
    await user.dblClick(screen.getByRole("region", { name: "Focus companion widget" }));

    expect(screen.getByRole("heading", { name: "FocusPal" })).toBeInTheDocument();

    await user.dblClick(screen.getByLabelText("Main companion panel"));

    expect(screen.getByRole("region", { name: "Focus companion widget" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "FocusPal" })).not.toBeInTheDocument();
  });

  it("keeps single widget clicks from restoring the main page", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Start" }));
    await user.click(screen.getByRole("region", { name: "Focus companion widget" }));

    expect(screen.getByRole("region", { name: "Focus companion widget" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "FocusPal" })).not.toBeInTheDocument();
  });

  it("opens widget capture from the shortcut button and returns to the widget after saving", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Start" }));
    await user.click(screen.getByRole("button", { name: "⌘⇧Space" }));
    await user.type(screen.getByLabelText("Distraction thought"), "watch a saved lecture clip");
    await user.keyboard("{Enter}");

    await waitFor(() => {
      expect(screen.queryByLabelText("Distraction thought")).not.toBeInTheDocument();
    });
    expect(screen.getByRole("region", { name: "Focus companion widget" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "FocusPal" })).not.toBeInTheDocument();
  });

  it("keeps the Tauri window tight and always on top in widget focus mode", async () => {
    const user = userEvent.setup();
    setTauriRuntime(true);
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Start" }));

    await waitFor(() => {
      expect(tauriMocks.window.setAlwaysOnTop).toHaveBeenCalledWith(true);
    });
    expect(tauriMocks.window.setMinSize).toHaveBeenCalledWith(
      expect.objectContaining({ height: 155, width: 212 }),
    );
    expect(tauriMocks.window.setSize).toHaveBeenCalledWith(
      expect.objectContaining({ height: 155, width: 212 }),
    );
    expect(tauriMocks.window.setDecorations).toHaveBeenCalledWith(false);
    expect(tauriMocks.window.setShadow).toHaveBeenCalledWith(false);
  });

  it("uses character window dimensions when character mode is active in Tauri", async () => {
    const user = userEvent.setup();
    const repository = createBrowserStorageRepository();
    await repository.updateSettings({
      ...createDefaultSettings(),
      focusCompanionMode: "character",
      characterEnabled: true,
    });
    setTauriRuntime(true);
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Settings" }));
    await waitFor(() => {
      expect(screen.getByText("Pixel character")).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: "Companion" }));
    await user.click(screen.getByRole("button", { name: "Start" }));

    await waitFor(() => {
      expect(tauriMocks.window.setAlwaysOnTop).toHaveBeenCalledWith(true);
    });
    expect(tauriMocks.window.setMinSize).toHaveBeenCalledWith(
      expect.objectContaining({ height: 236, width: 236 }),
    );
    expect(tauriMocks.window.setSize).toHaveBeenCalledWith(
      expect.objectContaining({ height: 236, width: 236 }),
    );
    expect(tauriMocks.window.setDecorations).toHaveBeenCalledWith(false);
    expect(tauriMocks.window.setShadow).toHaveBeenCalledWith(false);
  });

  it("resizes back to the tight widget window after widget capture closes", async () => {
    const user = userEvent.setup();
    setTauriRuntime(true);
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Start" }));

    await waitFor(() => {
      expect(tauriMocks.window.setSize).toHaveBeenCalledWith(
        expect.objectContaining({ height: 155, width: 212 }),
      );
    });

    await user.click(screen.getByRole("button", { name: "⌘⇧Space" }));

    await waitFor(() => {
      expect(screen.getByLabelText("Distraction thought")).toHaveFocus();
    });
    await waitFor(() => {
      expect(tauriMocks.window.setSize).toHaveBeenCalledWith(
        expect.objectContaining({ height: 320, width: 420 }),
      );
    });

    await user.keyboard("{Escape}");

    await waitFor(() => {
      expect(screen.getByRole("region", { name: "Focus companion widget" })).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(tauriMocks.window.setSize).toHaveBeenLastCalledWith(
        expect.objectContaining({ height: 155, width: 212 }),
      );
    });
  });

  it("restores the pre-focus desktop window size when returning from the widget", async () => {
    const user = userEvent.setup();
    tauriMocks.window.outerSize.mockResolvedValue({ height: 720, width: 900 });
    setTauriRuntime(true);
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Start" }));

    await waitFor(() => {
      expect(tauriMocks.window.setSize).toHaveBeenCalledWith(
        expect.objectContaining({ height: 155, width: 212 }),
      );
    });

    await user.dblClick(screen.getByRole("region", { name: "Focus companion widget" }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "FocusPal" })).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(tauriMocks.window.setSize).toHaveBeenLastCalledWith(
        expect.objectContaining({ height: 720, width: 900 }),
      );
    });
  });

  it("restores the pre-capture desktop window size after closing the main-page catcher", async () => {
    const user = userEvent.setup();
    tauriMocks.window.outerSize.mockResolvedValue({ height: 760, width: 880 });
    setTauriRuntime(true);
    render(<App />);

    await waitFor(() => {
      expect(tauriMocks.window.setAlwaysOnTop).toHaveBeenCalled();
    });
    tauriMocks.window.setSize.mockClear();

    await user.click(screen.getByRole("button", { name: /capture thought/i }));

    await waitFor(() => {
      expect(tauriMocks.window.setSize).toHaveBeenCalledWith(
        expect.objectContaining({ height: 320, width: 420 }),
      );
    });

    await user.keyboard("{Escape}");

    await waitFor(() => {
      expect(screen.queryByLabelText("Distraction thought")).not.toBeInTheDocument();
    });
    await waitFor(() => {
      expect(tauriMocks.window.setSize).toHaveBeenLastCalledWith(
        expect.objectContaining({ height: 760, width: 880 }),
      );
    });
  });

  it("opens the thought catcher from the focused app shortcut", async () => {
    render(<App />);

    fireEvent.keyDown(window, {
      code: "Space",
      key: " ",
      metaKey: true,
      shiftKey: true,
    });

    expect(screen.getByLabelText("Distraction thought")).toHaveFocus();
    expect(screen.getByRole("heading", { name: "FocusPal" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Companion" })).toBeInTheDocument();

    fireEvent.keyDown(screen.getByLabelText("Distraction thought"), { key: "Escape" });

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "FocusPal" })).toBeInTheDocument();
    });
    expect(tauriMocks.window.hide).not.toHaveBeenCalled();
  });

  it("uses the main page modal when the global shortcut is emitted while the main page is visible", async () => {
    const user = userEvent.setup();
    setTauriRuntime(true);
    render(<App />);

    await waitFor(() => {
      expect(tauriMocks.listen).toHaveBeenCalledWith(
        OPEN_THOUGHT_CATCHER_EVENT,
        expect.any(Function),
      );
    });

    emitTauriEvent(OPEN_THOUGHT_CATCHER_EVENT, { restoreMainPage: true });

    await waitFor(() => {
      expect(screen.getByLabelText("Distraction thought")).toHaveFocus();
    });
    expect(screen.getByRole("heading", { name: "FocusPal" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Companion" })).toBeInTheDocument();

    await user.keyboard("{Escape}");

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "FocusPal" })).toBeInTheDocument();
    });
    expect(tauriMocks.window.hide).not.toHaveBeenCalled();
  });

  it("hides the desktop window instead of restoring the main page when a hidden/global catcher is cancelled", async () => {
    const user = userEvent.setup();
    setTauriRuntime(true);
    render(<App />);

    await waitFor(() => {
      expect(tauriMocks.listen).toHaveBeenCalledWith(
        OPEN_THOUGHT_CATCHER_EVENT,
        expect.any(Function),
      );
    });

    emitTauriEvent(OPEN_THOUGHT_CATCHER_EVENT, { restoreMainPage: false });

    await waitFor(() => {
      expect(screen.getByLabelText("Distraction thought")).toHaveFocus();
    });

    await user.keyboard("{Escape}");

    await waitFor(() => {
      expect(tauriMocks.window.hide).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(screen.queryByRole("heading", { name: "FocusPal" })).not.toBeInTheDocument();
    });
    expect(screen.getByRole("main", { name: "FocusPal hidden" })).toBeInTheDocument();

    emitTauriEvent(OPEN_THOUGHT_CATCHER_EVENT, { restoreMainPage: false });

    await waitFor(() => {
      expect(screen.getByLabelText("Distraction thought")).toHaveFocus();
    });
    expect(screen.queryByRole("heading", { name: "FocusPal" })).not.toBeInTheDocument();
  });

  it("hides the desktop window after saving from the global catcher", async () => {
    const user = userEvent.setup();
    setTauriRuntime(true);
    render(<App />);

    await waitFor(() => {
      expect(tauriMocks.listen).toHaveBeenCalledWith(
        OPEN_THOUGHT_CATCHER_EVENT,
        expect.any(Function),
      );
    });

    emitTauriEvent(OPEN_THOUGHT_CATCHER_EVENT, { restoreMainPage: false });

    await waitFor(() => {
      expect(screen.getByLabelText("Distraction thought")).toHaveFocus();
    });

    await user.type(screen.getByLabelText("Distraction thought"), "reply to project message");
    await user.keyboard("{Enter}");

    await waitFor(() => {
      expect(tauriMocks.window.hide).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(screen.queryByRole("heading", { name: "FocusPal" })).not.toBeInTheDocument();
    });
    expect(screen.getByRole("main", { name: "FocusPal hidden" })).toBeInTheDocument();
  });

  it("reopens the main page when the Tauri shell emits the app reopen event", async () => {
    const user = userEvent.setup();
    setTauriRuntime(true);
    render(<App />);

    await waitFor(() => {
      expect(tauriMocks.listen).toHaveBeenCalledWith(OPEN_MAIN_PAGE_EVENT, expect.any(Function));
    });

    emitTauriEvent(OPEN_THOUGHT_CATCHER_EVENT, { restoreMainPage: false });

    await waitFor(() => {
      expect(screen.getByLabelText("Distraction thought")).toHaveFocus();
    });

    await user.keyboard("{Escape}");

    await waitFor(() => {
      expect(screen.getByRole("main", { name: "FocusPal hidden" })).toBeInTheDocument();
    });

    emitTauriEvent(OPEN_MAIN_PAGE_EVENT);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "FocusPal" })).toBeInTheDocument();
    });
    expect(screen.queryByRole("main", { name: "FocusPal hidden" })).not.toBeInTheDocument();
  });

  it("does not open the thought catcher for unrelated shortcuts", () => {
    render(<App />);

    fireEvent.keyDown(window, {
      code: "Space",
      key: " ",
      metaKey: true,
      shiftKey: false,
    });

    expect(screen.queryByLabelText("Distraction thought")).not.toBeInTheDocument();
  });

  it("opens only the standalone thought catcher when the Tauri shell emits an external shortcut event", async () => {
    setTauriRuntime(true);
    render(<App />);

    await waitFor(() => {
      expect(tauriMocks.listen).toHaveBeenCalledWith(
        OPEN_THOUGHT_CATCHER_EVENT,
        expect.any(Function),
      );
    });

    emitTauriEvent(OPEN_THOUGHT_CATCHER_EVENT, { restoreMainPage: false });

    await waitFor(() => {
      expect(screen.getByLabelText("Distraction thought")).toHaveFocus();
    });
    expect(screen.queryByRole("heading", { name: "FocusPal" })).not.toBeInTheDocument();
  });

  it("captures a thought with Enter and shows it in the history panel", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: /capture thought/i }));
    await user.type(screen.getByLabelText("Distraction thought"), "look up ramen near campus");
    await user.keyboard("{Enter}");

    await waitFor(() => {
      expect(screen.queryByLabelText("Distraction thought")).not.toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "History" }));

    expect(screen.getByText("look up ramen near campus")).toBeInTheDocument();
    expect(screen.getByText("food")).toBeInTheDocument();
  });

  it("loads persisted thoughts into the history panel on startup", async () => {
    const user = userEvent.setup();
    const repository = createBrowserStorageRepository();
    await repository.createThought({
      id: "stored-thought",
      rawText: "watch a graph theory video",
      title: "watch a graph theory video",
      category: "media",
      rewardEligible: true,
      confidence: 0.88,
      status: "captured",
      createdAt: "2026-05-01T10:00:00.000Z",
      updatedAt: "2026-05-01T10:00:00.000Z",
    });

    render(<App />);
    await user.click(screen.getByRole("button", { name: "History" }));

    await waitFor(() => {
      expect(screen.getByText("watch a graph theory video")).toBeInTheDocument();
    });
    expect(screen.getByText("media")).toBeInTheDocument();
  });

  it("keeps section navigation visible while long history scrolls internally", async () => {
    const user = userEvent.setup();
    const repository = createBrowserStorageRepository();
    const now = new Date("2026-05-01T10:00:00.000Z");

    for (let index = 0; index < 30; index += 1) {
      const timestamp = new Date(now.getTime() + index).toISOString();
      await repository.createThought({
        id: `stored-thought-${index}`,
        rawText: `history thought ${index}`,
        title: `history thought ${index}`,
        category: "idea",
        rewardEligible: true,
        confidence: 0.8,
        status: "captured",
        createdAt: timestamp,
        updatedAt: timestamp,
      });
    }

    render(<App />);
    await user.click(screen.getByRole("button", { name: "History" }));

    const historyEntries = screen.getByLabelText("History entries");
    expect(historyEntries).toHaveClass("overflow-y-auto");
    expect(screen.getByRole("button", { name: "Companion" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "History" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Settings" })).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText("history thought 29")).toBeInTheDocument();
    });
  });

  it("filters history by thought status", async () => {
    const user = userEvent.setup();
    const repository = createBrowserStorageRepository();
    const statuses = [
      { status: "captured", title: "captured thought" },
      { status: "used", title: "used thought" },
      { status: "snoozed", title: "snoozed thought" },
      { status: "dismissed", title: "dismissed thought" },
    ] as const;

    for (const [index, { status, title }] of statuses.entries()) {
      const timestamp = new Date(Date.UTC(2026, 4, 1, 10, 0, index)).toISOString();
      await repository.createThought({
        id: `status-thought-${status}`,
        rawText: title,
        title,
        category: "idea",
        rewardEligible: true,
        confidence: 0.8,
        status,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
    }

    render(<App />);
    await user.click(screen.getByRole("button", { name: "History" }));

    await waitFor(() => {
      expect(screen.getByText("captured thought")).toBeInTheDocument();
    });
    expect(screen.getByText("used thought")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "History filters" }));
    await user.click(screen.getByRole("button", { name: "Used" }));

    expect(screen.getByText("used thought")).toBeInTheDocument();
    expect(screen.queryByText("captured thought")).not.toBeInTheDocument();
    expect(screen.queryByText("snoozed thought")).not.toBeInTheDocument();
    expect(screen.queryByText("dismissed thought")).not.toBeInTheDocument();
  });

  it("auto-saves category edits from the rounded history control", async () => {
    const user = userEvent.setup();
    const repository = createBrowserStorageRepository();
    await repository.createThought({
      id: "stored-thought",
      rawText: "look up ramen near campus",
      title: "look up ramen near campus",
      category: "food",
      rewardEligible: true,
      confidence: 0.86,
      status: "captured",
      createdAt: "2026-05-01T08:00:00.000Z",
      updatedAt: "2026-05-01T08:00:00.000Z",
    });

    render(<App />);
    await user.click(screen.getByRole("button", { name: "History" }));

    await user.click(await screen.findByRole("button", { name: "Change category for look up ramen near campus" }));
    await user.click(screen.getByRole("button", { name: "Set category to task" }));

    expect(screen.getByRole("button", { name: "Change category for look up ramen near campus" })).toHaveTextContent("task");
    await expect(repository.listThoughts()).resolves.toMatchObject([
      {
        id: "stored-thought",
        category: "task",
        rewardEligible: true,
      },
    ]);
  });

  it("auto-saves reward eligibility edits from history", async () => {
    const user = userEvent.setup();
    const repository = createBrowserStorageRepository();
    await repository.createThought({
      id: "stored-thought",
      rawText: "submit project writeup",
      title: "submit project writeup",
      category: "task",
      rewardEligible: false,
      confidence: 0.82,
      status: "captured",
      createdAt: "2026-05-01T08:00:00.000Z",
      updatedAt: "2026-05-01T08:00:00.000Z",
    });

    render(<App />);
    await user.click(screen.getByRole("button", { name: "History" }));

    await user.click(await screen.findByRole("button", { name: "Mark as reward eligible" }));

    await expect(repository.listThoughts()).resolves.toMatchObject([
      {
        id: "stored-thought",
        rewardEligible: true,
      },
    ]);
    expect(screen.getByRole("button", { name: "Mark as not reward eligible" })).toBeInTheDocument();
  });

  it("deletes thoughts from visible history by marking them deleted", async () => {
    const user = userEvent.setup();
    const repository = createBrowserStorageRepository();
    await repository.createThought({
      id: "stored-thought",
      rawText: "watch a saved video",
      title: "watch a saved video",
      category: "media",
      rewardEligible: true,
      confidence: 0.88,
      status: "captured",
      createdAt: "2026-05-01T08:00:00.000Z",
      updatedAt: "2026-05-01T08:00:00.000Z",
    });

    render(<App />);
    await user.click(screen.getByRole("button", { name: "History" }));

    await user.click(await screen.findByRole("button", { name: "Delete watch a saved video" }));

    await waitFor(() => {
      expect(screen.queryByText("watch a saved video")).not.toBeInTheDocument();
    });
    await expect(repository.listThoughts()).resolves.toEqual([]);
  });

  it("filters history by reward eligibility and restores terminal thoughts to captured", async () => {
    const user = userEvent.setup();
    const repository = createBrowserStorageRepository();
    await repository.createThought({
      id: "reward-thought",
      rawText: "watch a saved video",
      title: "watch a saved video",
      category: "media",
      rewardEligible: true,
      confidence: 0.88,
      status: "used",
      createdAt: "2026-05-01T08:00:00.000Z",
      updatedAt: "2026-05-01T08:00:00.000Z",
    });
    await repository.createThought({
      id: "no-reward-thought",
      rawText: "submit the form",
      title: "submit the form",
      category: "task",
      rewardEligible: false,
      confidence: 0.82,
      status: "captured",
      createdAt: "2026-05-01T08:01:00.000Z",
      updatedAt: "2026-05-01T08:01:00.000Z",
    });

    render(<App />);
    await user.click(screen.getByRole("button", { name: "History" }));
    await user.click(screen.getByRole("button", { name: "History filters" }));
    await user.click(screen.getByRole("button", { name: "Non-reward" }));

    expect(screen.getByText("submit the form")).toBeInTheDocument();
    expect(screen.queryByText("watch a saved video")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "History filters" }));
    const allFilterButtons = screen.getAllByRole("button", { name: "All" });
    await user.click(allFilterButtons[allFilterButtons.length - 1]);
    await user.click(await screen.findByRole("button", { name: "Move watch a saved video back to captured" }));

    await expect(repository.listThoughts()).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "reward-thought",
          status: "captured",
        }),
      ]),
    );
  });

  it("saves settings edits and uses the saved default duration after remount", async () => {
    const user = userEvent.setup();
    const repository = createBrowserStorageRepository();
    const { unmount } = render(<App />);

    await user.click(screen.getByRole("button", { name: "Settings" }));
    expect(screen.getByText("Focus companion")).toBeInTheDocument();
    expect(screen.getByText("Compact widget")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Edit settings" }));
    await user.click(screen.getByLabelText("Default focus duration"));
    await user.click(screen.getByRole("button", { name: "15 min" }));
    await user.click(screen.getByRole("button", { name: "Pixel character" }));
    await user.click(screen.getByLabelText("Local-only mode"));
    await user.type(screen.getByLabelText("API key"), "sk-demo");
    await user.click(screen.getByRole("button", { name: "Save settings" }));

    await expect(repository.getSettings()).resolves.toMatchObject({
      defaultFocusMinutes: 15,
      localOnly: false,
      apiKey: "sk-demo",
      focusCompanionMode: "character",
      characterEnabled: true,
    });

    unmount();
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("15:00")).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: "Settings" }));
    expect(screen.getByText("Pixel character")).toBeInTheDocument();
  });

  it("does not resize the desktop main window after saving settings", async () => {
    const user = userEvent.setup();
    const repository = createBrowserStorageRepository();
    setTauriRuntime(true);
    render(<App />);

    await waitFor(() => {
      expect(tauriMocks.window.setAlwaysOnTop).toHaveBeenCalled();
    });
    tauriMocks.window.setMinSize.mockClear();
    tauriMocks.window.setSize.mockClear();

    await user.click(screen.getByRole("button", { name: "Settings" }));
    await user.click(screen.getByRole("button", { name: "Edit settings" }));
    await user.click(screen.getByRole("button", { name: "Pixel character" }));
    await user.click(screen.getByRole("button", { name: "Save settings" }));

    await expect(repository.getSettings()).resolves.toMatchObject({
      focusCompanionMode: "character",
      characterEnabled: true,
    });
    expect(tauriMocks.window.setMinSize).not.toHaveBeenCalled();
    expect(tauriMocks.window.setSize).not.toHaveBeenCalled();
  });

  it("saves a custom default focus duration from the menu control", async () => {
    const user = userEvent.setup();
    const repository = createBrowserStorageRepository();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Settings" }));
    await user.click(screen.getByRole("button", { name: "Edit settings" }));
    await user.click(screen.getByLabelText("Default focus duration"));
    await user.click(screen.getByRole("button", { name: /custom/i }));
    await user.clear(screen.getByLabelText("Custom minutes"));
    await user.type(screen.getByLabelText("Custom minutes"), "42");
    await user.click(screen.getByRole("button", { name: "Save settings" }));

    await expect(repository.getSettings()).resolves.toMatchObject({
      defaultFocusMinutes: 42,
    });
  });

  it("shows the current classifier mode in settings", async () => {
    const user = userEvent.setup();
    const repository = createBrowserStorageRepository();
    await repository.updateSettings({
      ...createDefaultSettings(),
      localOnly: false,
      apiKey: "or-demo",
    });

    render(<App />);
    await user.click(screen.getByRole("button", { name: "Settings" }));

    await waitFor(() => {
      expect(screen.getByText("OpenRouter ready")).toBeInTheDocument();
    });
  });

  it("uses the fixed shortcut for focused browser capture", () => {
    render(<App />);

    fireEvent.keyDown(window, {
      altKey: true,
      code: "Space",
      key: " ",
      metaKey: true,
    });

    expect(screen.queryByLabelText("Distraction thought")).not.toBeInTheDocument();

    fireEvent.keyDown(window, {
      code: "Space",
      key: " ",
      metaKey: true,
      shiftKey: true,
    });

    expect(screen.getByLabelText("Distraction thought")).toHaveFocus();
  });

  it("persists a captured thought across app remounts", async () => {
    const user = userEvent.setup();
    const { unmount } = render(<App />);

    await user.click(screen.getByRole("button", { name: /capture thought/i }));
    await user.type(screen.getByLabelText("Distraction thought"), "buy a replacement charger");
    await user.keyboard("{Enter}");

    await waitFor(() => {
      expect(screen.queryByLabelText("Distraction thought")).not.toBeInTheDocument();
    });

    unmount();
    render(<App />);
    await user.click(screen.getByRole("button", { name: "History" }));

    await waitFor(() => {
      expect(screen.getByText("buy a replacement charger")).toBeInTheDocument();
    });
    expect(screen.getByText("shop")).toBeInTheDocument();
  });

  it("uses the saved OpenRouter classifier settings when local-only mode is disabled", async () => {
    const user = userEvent.setup();
    const repository = createBrowserStorageRepository();
    await repository.updateSettings({
      ...createDefaultSettings(),
      localOnly: false,
      apiKey: "or-demo",
    });
    const fetcher = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => ({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                category: "idea",
                confidence: 0.92,
                rewardEligible: true,
                title: "sketch a tiny app idea",
              }),
            },
          },
        ],
      }),
    }));
    vi.stubGlobal("fetch", fetcher);

    render(<App />);

    await user.click(screen.getByRole("button", { name: /capture thought/i }));
    await user.type(screen.getByLabelText("Distraction thought"), "vague phrase with no local keyword");
    await user.keyboard("{Enter}");
    await user.click(screen.getByRole("button", { name: "History" }));

    await waitFor(() => {
      expect(screen.getByText("sketch a tiny app idea")).toBeInTheDocument();
    });
    expect(screen.getByText("idea")).toBeInTheDocument();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("shows a responsive post-focus review with an AI debrief after focus completion", async () => {
    vi.useFakeTimers({ now: new Date("2026-05-01T09:00:00.000Z") });
    const repository = createBrowserStorageRepository();
    await repository.updateSettings({
      ...createDefaultSettings(),
      localOnly: false,
      apiKey: "or-demo",
    });
    await repository.createThought({
      id: "thought-1",
      rawText: "watch the saved lecture clip after this",
      title: "watch the saved lecture clip",
      category: "media",
      rewardEligible: true,
      confidence: 0.92,
      status: "captured",
      createdAt: "2026-05-01T09:20:00.000Z",
      updatedAt: "2026-05-01T09:20:00.000Z",
    });
    const fetcher = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => ({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                nextIntention: "Keep the next block centered on the CS153 milestone.",
                pattern: "Media rewards showed up during the middle of the block.",
                rewardSuggestion: "Use the lecture clip after one more stopping point.",
                summary: "You finished the block and parked one media distraction.",
              }),
            },
          },
        ],
      }),
    }));
    vi.stubGlobal("fetch", fetcher);

    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "Start" }));
    vi.setSystemTime(new Date("2026-05-01T10:00:00.000Z"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
      await Promise.resolve();
    });
    vi.useRealTimers();

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Focus complete" })).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(screen.getByText("You finished the block and parked one media distraction.")).toBeInTheDocument();
    });
    expect(screen.getByText("Media rewards showed up during the middle of the block.")).toBeInTheDocument();
    expect(screen.getByText("Keep the next block centered on the CS153 milestone.")).toBeInTheDocument();
    expect(screen.getByText("Use the lecture clip after one more stopping point.")).toBeInTheDocument();
    const requestInit = fetcher.mock.calls[0]?.[1] as RequestInit | undefined;
    expect(JSON.parse(String(requestInit?.body))).toMatchObject({
      response_format: {
        json_schema: {
          name: "focuspal_focus_debrief",
        },
      },
    });

    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByRole("heading", { name: "FocusPal" })).toBeInTheDocument();
  });

  it("shows a local post-focus action plan from non-reward thoughts", async () => {
    vi.useFakeTimers({ now: new Date("2026-05-01T09:00:00.000Z") });
    const repository = createBrowserStorageRepository();
    await repository.createThought({
      id: "thought-task",
      rawText: "submit the CS153 project video plan",
      title: "submit the CS153 project video plan",
      category: "task",
      rewardEligible: false,
      confidence: 0.82,
      status: "captured",
      createdAt: "2026-05-01T09:10:00.000Z",
      updatedAt: "2026-05-01T09:10:00.000Z",
    });
    await repository.createThought({
      id: "thought-message",
      rawText: "email the TA about project video timing",
      title: "email the TA about project video timing",
      category: "message",
      rewardEligible: false,
      confidence: 0.82,
      status: "captured",
      createdAt: "2026-05-01T09:15:00.000Z",
      updatedAt: "2026-05-01T09:15:00.000Z",
    });

    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "Start" }));
    vi.setSystemTime(new Date("2026-05-01T10:00:00.000Z"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
      await Promise.resolve();
    });
    vi.useRealTimers();

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Focus complete" })).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(screen.getByText("submit the CS153 project video plan")).toBeInTheDocument();
    });
    expect(screen.getByText("Handle: submit the CS153 project video plan.")).toBeInTheDocument();
    expect(screen.getByText("Respond: email the TA about project video timing.")).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole("button", { name: "Done" })[0]);
    expect(screen.getAllByText("Done").length).toBeGreaterThan(0);
    fireEvent.click(screen.getAllByRole("button", { name: "Defer" })[1]);
    expect(screen.getByText("Deferred")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    fireEvent.click(screen.getByRole("button", { name: "History" }));
    fireEvent.click(screen.getByRole("button", { name: "Actions" }));

    expect(screen.getByText("2 action items")).toBeInTheDocument();
    expect(screen.getByText("submit the CS153 project video plan")).toBeInTheDocument();
    expect(screen.getByText("email the TA about project video timing")).toBeInTheDocument();
    expect(screen.getByText("Source: submit the CS153 project video plan")).toBeInTheDocument();
    expect(screen.getByText("Source: email the TA about project video timing")).toBeInTheDocument();
    expect(screen.getByText("Done")).toBeInTheDocument();
    expect(screen.getByText("Deferred")).toBeInTheDocument();
  });

  it("surfaces persisted action items in companion and history actions", async () => {
    const repository = createBrowserStorageRepository();
    await repository.createThought({
      id: "thought-task",
      rawText: "submit the CS153 project video plan",
      title: "submit the CS153 project video plan",
      category: "task",
      rewardEligible: false,
      confidence: 0.82,
      status: "captured",
      createdAt: "2026-05-01T09:10:00.000Z",
      updatedAt: "2026-05-01T09:10:00.000Z",
    });
    await repository.createTaskItem({
      id: "task-item-1",
      sessionId: "session-1",
      sourceThoughtId: "thought-task",
      title: "Submit CS153 video plan",
      nextAction: "Submit the CS153 video plan before recording.",
      status: "open",
      createdAt: "2026-05-01T10:00:00.000Z",
      updatedAt: "2026-05-01T10:00:00.000Z",
    });
    await repository.createTaskItem({
      id: "task-item-2",
      sessionId: "session-1",
      sourceThoughtId: "missing-thought",
      title: "Review project rubric",
      nextAction: "Review the CS153 video rubric before recording.",
      status: "deferred",
      createdAt: "2026-05-01T10:05:00.000Z",
      updatedAt: "2026-05-01T10:05:00.000Z",
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("Actions: 1 open")).toBeInTheDocument();
    });
    expect(screen.getByText("Next after focus")).toBeInTheDocument();
    expect(screen.getByText("Submit the CS153 video plan before recording.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "History" }));
    fireEvent.click(screen.getByRole("button", { name: "Actions" }));

    expect(screen.getByText("2 action items")).toBeInTheDocument();
    expect(screen.getByText("Submit CS153 video plan")).toBeInTheDocument();
    expect(screen.getByText("Review project rubric")).toBeInTheDocument();
    expect(screen.getByText("Source: submit the CS153 project video plan")).toBeInTheDocument();
    expect(screen.getByText("task")).toBeInTheDocument();
  });

  it("updates, reopens, and deletes action items from history actions", async () => {
    const repository = createBrowserStorageRepository();
    await repository.createTaskItem({
      id: "task-item-1",
      sessionId: "session-1",
      sourceThoughtId: "thought-task",
      title: "Submit CS153 video plan",
      nextAction: "Submit the CS153 video plan before recording.",
      status: "open",
      createdAt: "2026-05-01T10:00:00.000Z",
      updatedAt: "2026-05-01T10:00:00.000Z",
    });

    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "History" }));
    fireEvent.click(screen.getByRole("button", { name: "Actions" }));

    expect(await screen.findByText("Submit CS153 video plan")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Mark Submit CS153 video plan done" }));
    expect(screen.getByText("Done")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Reopen Submit CS153 video plan" }));
    expect(screen.getByText("Open")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Defer Submit CS153 video plan" }));
    expect(screen.getByText("Deferred")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Delete Submit CS153 video plan" }));
    expect(screen.queryByText("Submit CS153 video plan")).not.toBeInTheDocument();
    expect(screen.getByText("No action items yet.")).toBeInTheDocument();
  });

  it("shows a clean empty state for history actions", () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "History" }));
    fireEvent.click(screen.getByRole("button", { name: "Actions" }));

    expect(screen.getByText("No action items yet.")).toBeInTheDocument();
  });

  it("does not call OpenRouter for the post-focus review in local-only mode", async () => {
    vi.useFakeTimers({ now: new Date("2026-05-01T09:00:00.000Z") });
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);

    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "Start" }));
    vi.setSystemTime(new Date("2026-05-01T10:00:00.000Z"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
      await Promise.resolve();
    });
    vi.useRealTimers();

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Focus complete" })).toBeInTheDocument();
    });
    expect(screen.getByText("Debrief unavailable")).toBeInTheDocument();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("persists earned boxes when there are no eligible thoughts yet", async () => {
    vi.useFakeTimers({ now: new Date("2026-05-01T09:00:00.000Z") });
    const { unmount } = render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "Start" }));
    vi.setSystemTime(new Date("2026-05-01T10:00:00.000Z"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    expect(screen.getByRole("heading", { name: "Focus complete" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByText("Box waiting")).toBeInTheDocument();

    unmount();
    render(<App />);
    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByText("Box waiting")).toBeInTheDocument();
  });

  it("reveals a reward as soon as an available box and eligible thought both exist", async () => {
    const user = userEvent.setup();
    const repository = createBrowserStorageRepository();
    await repository.createFocusSession({
      id: "stored-session",
      plannedMinutes: 60,
      startedAt: "2026-05-01T09:00:00.000Z",
      endedAt: "2026-05-01T10:00:00.000Z",
      pausedSeconds: 0,
      updatedAt: "2026-05-01T10:00:00.000Z",
      status: "completed",
    });
    await repository.createRewardCredit({
      id: "stored-credit",
      sourceSessionId: "stored-session",
      earnedAt: "2026-05-01T10:00:00.000Z",
      updatedAt: "2026-05-01T10:00:00.000Z",
      status: "available",
    });
    render(<App />);

    await user.click(screen.getByRole("button", { name: /capture thought/i }));
    await user.type(screen.getByLabelText("Distraction thought"), "play video games");
    await user.keyboard("{Enter}");

    await waitFor(() => {
      expect(screen.getByText("play video games")).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: "Use" })).toBeInTheDocument();
  });

  it("spends the current box on snooze and only shows the thought again after another box is earned", async () => {
    const user = userEvent.setup();
    const repository = createBrowserStorageRepository();
    await repository.createThought({
      id: "stored-thought",
      rawText: "play one Wordle round",
      title: "play one Wordle round",
      category: "game",
      rewardEligible: true,
      confidence: 0.9,
      status: "captured",
      createdAt: "2026-05-01T08:00:00.000Z",
      updatedAt: "2026-05-01T08:00:00.000Z",
    });
    await repository.createFocusSession({
      id: "stored-session",
      plannedMinutes: 60,
      startedAt: "2026-05-01T09:00:00.000Z",
      endedAt: "2026-05-01T10:00:00.000Z",
      pausedSeconds: 0,
      updatedAt: "2026-05-01T10:00:00.000Z",
      status: "completed",
    });
    await repository.createRewardCredit({
      id: "stored-credit",
      sourceSessionId: "stored-session",
      earnedAt: "2026-05-01T10:00:00.000Z",
      updatedAt: "2026-05-01T10:00:00.000Z",
      status: "available",
    });
    const { unmount } = render(<App />);

    await waitFor(() => {
      expect(screen.getByText("play one Wordle round")).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: "Snooze" }));

    await waitFor(() => {
      expect(screen.queryByText("play one Wordle round")).not.toBeInTheDocument();
    });

    await repository.createFocusSession({
      id: "stored-session-2",
      plannedMinutes: 60,
      startedAt: "2026-05-01T11:00:00.000Z",
      endedAt: "2026-05-01T12:00:00.000Z",
      pausedSeconds: 0,
      updatedAt: "2026-05-01T12:00:00.000Z",
      status: "completed",
    });
    await repository.createRewardCredit({
      id: "stored-credit-2",
      sourceSessionId: "stored-session-2",
      earnedAt: "2026-05-01T12:00:00.000Z",
      updatedAt: "2026-05-01T12:00:00.000Z",
      status: "available",
    });
    unmount();
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("play one Wordle round")).toBeInTheDocument();
    });
  });

  it("keeps history available while a focus session is paused", async () => {
    const user = userEvent.setup();
    const repository = createBrowserStorageRepository();
    await repository.createThought({
      id: "stored-thought",
      rawText: "review saved lecture link",
      title: "review saved lecture link",
      category: "search",
      rewardEligible: true,
      confidence: 0.78,
      status: "captured",
      createdAt: "2026-05-01T08:00:00.000Z",
      updatedAt: "2026-05-01T08:00:00.000Z",
    });
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Start" }));
    await user.click(screen.getByRole("button", { name: "Pause focus" }));
    await user.click(screen.getByRole("button", { name: "Open main page" }));
    await user.click(screen.getByRole("button", { name: "History" }));

    await waitFor(() => {
      expect(screen.getByText("review saved lecture link")).toBeInTheDocument();
    });
    expect(screen.queryByText("Locked while a focus block is running.")).not.toBeInTheDocument();
  });

  it("resets the displayed time after cancelling an unfinished focus session", async () => {
    vi.useFakeTimers({ now: new Date("2026-05-01T09:00:00.000Z") });
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "Start" }));
    vi.setSystemTime(new Date("2026-05-01T09:10:00.000Z"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    expect(screen.getByText("49:59")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Cancel focus" }));

    expect(screen.getByText("60:00")).toBeInTheDocument();
  });
});
