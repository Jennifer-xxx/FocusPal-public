import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { logAiUsage } from "./aiUsageLog";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(async () => undefined),
  isTauri: vi.fn(() => false),
}));

const mockedInvoke = vi.mocked(invoke);
const mockedIsTauri = vi.mocked(isTauri);

describe("logAiUsage", () => {
  beforeEach(() => {
    vi.spyOn(console, "info").mockImplementation(() => undefined);
  });

  afterEach(() => {
    delete (window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;
    vi.restoreAllMocks();
  });

  it("logs to the browser console without invoking Tauri outside the desktop runtime", async () => {
    logAiUsage("debrief", "request", "model=test-model");

    await vi.waitFor(() => {
      expect(console.info).toHaveBeenCalledWith(
        "[FocusPal AI] debrief: request - model=test-model",
      );
    });
    expect(mockedInvoke).not.toHaveBeenCalled();
  });

  it("bridges AI usage logs to the Tauri terminal when desktop internals exist", async () => {
    Object.defineProperty(window, "__TAURI_INTERNALS__", {
      configurable: true,
      value: {},
    });

    logAiUsage("classifier", "success", "category=media");

    await vi.waitFor(() => {
      expect(mockedInvoke).toHaveBeenCalledWith("log_ai_event", {
        detail: "category=media",
        event: "success",
        feature: "classifier",
      });
    });
  });

  it("reports bridge failures to the browser console", async () => {
    Object.defineProperty(window, "__TAURI_INTERNALS__", {
      configurable: true,
      value: {},
    });
    mockedInvoke.mockRejectedValueOnce(new Error("permission denied"));

    logAiUsage("debrief", "unavailable", "OpenRouter returned HTTP 401");

    await vi.waitFor(() => {
      expect(console.info).toHaveBeenCalledWith(
        "[FocusPal AI] terminal log unavailable - permission denied",
      );
    });
  });

  it("uses Tauri's runtime detector when internals are not directly visible", async () => {
    mockedIsTauri.mockReturnValueOnce(true);

    logAiUsage("debrief", "request", "thoughts=1");

    await vi.waitFor(() => {
      expect(mockedInvoke).toHaveBeenCalledWith("log_ai_event", {
        detail: "thoughts=1",
        event: "request",
        feature: "debrief",
      });
    });
  });
});
