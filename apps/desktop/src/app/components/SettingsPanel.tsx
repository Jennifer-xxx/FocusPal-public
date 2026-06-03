import { ChevronDown } from "lucide-react";
import { useEffect, useState } from "react";
import type { AppSettings } from "../../lib/storage/repository";
import { FOCUS_COMPANION_MODE_OPTIONS, SHORTCUT } from "../constants";
import {
  formatClassifierStatus,
  formatDurationChoice,
  formatFocusCompanionModeLabel,
  formatShortcutLabel,
  formatShortcutStatus,
  getDurationModeForMinutes,
} from "../helpers";
import type { DurationMode, ShortcutStatus } from "../types";
import { Setting } from "./SharedUi";

export function SettingsPanel({
  onSaveSettings,
  settings,
  shortcutStatus,
}: {
  onSaveSettings: (settings: AppSettings) => void;
  settings: AppSettings;
  shortcutStatus: ShortcutStatus;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(settings);
  const [draftDurationMode, setDraftDurationMode] = useState<DurationMode>(() =>
    getDurationModeForMinutes(settings.defaultFocusMinutes),
  );
  const [isDurationMenuOpen, setIsDurationMenuOpen] = useState(false);

  useEffect(() => {
    if (!isEditing) {
      setDraft(settings);
      setDraftDurationMode(getDurationModeForMinutes(settings.defaultFocusMinutes));
      setIsDurationMenuOpen(false);
    }
  }, [isEditing, settings]);

  function updateDraftDuration(mode: DurationMode) {
    setDraftDurationMode(mode);
    setIsDurationMenuOpen(false);

    if (mode === "custom") {
      return;
    }

    setDraft((current) => ({
      ...current,
      defaultFocusMinutes: Number(mode),
    }));
  }

  function saveDraft() {
    onSaveSettings(draft);
    setIsEditing(false);
  }

  return (
    <div className="settings-panel grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-3 rounded-lg border border-stone-200 bg-white p-3 shadow-sm">
      <div className="settings-heading flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Settings</h2>
        <div className="flex shrink-0 gap-2">
          {isEditing ? (
            <>
              <button
                className="rounded-md border border-stone-300 px-3 py-2 text-sm font-medium"
                onClick={() => {
                  setDraft(settings);
                  setIsEditing(false);
                }}
                type="button"
              >
                Cancel
              </button>
              <button
                className="rounded-md bg-stone-950 px-3 py-2 text-sm font-medium text-white"
                onClick={saveDraft}
                type="button"
              >
                Save settings
              </button>
            </>
          ) : (
            <button
              className="rounded-md bg-stone-950 px-3 py-2 text-sm font-medium text-white"
              onClick={() => setIsEditing(true)}
              type="button"
            >
              Edit settings
            </button>
          )}
        </div>
      </div>

      <div aria-label="Settings options" className="grid min-h-0 content-start gap-2 overflow-y-auto pr-1 text-sm">
        {isEditing ? (
          <>
            <div className="rounded-md border border-stone-200 px-3 py-2">
              <div className="text-xs uppercase tracking-wide text-stone-500">
                Default focus duration
              </div>
              <div className="relative mt-1">
                <button
                  aria-expanded={isDurationMenuOpen}
                  aria-label="Default focus duration"
                  className="inline-flex w-full items-center justify-between rounded-md border border-stone-200 bg-[#fbfaf5] px-2 py-2 text-left text-sm font-medium"
                  onClick={() => setIsDurationMenuOpen((isOpen) => !isOpen)}
                  type="button"
                >
                  <span>{formatDurationChoice(draftDurationMode, draft.defaultFocusMinutes)}</span>
                  <ChevronDown size={15} />
                </button>
                {isDurationMenuOpen ? (
                  <div className="absolute left-0 right-0 z-20 mt-1 grid gap-1 rounded-lg border border-stone-300 bg-[#fffdf8] p-1.5 shadow-lg">
                    {(["1", "15", "30", "60", "120", "custom"] as const).map((mode) => (
                      <button
                        className={[
                          "rounded px-2 py-1.5 text-left text-sm",
                          draftDurationMode === mode
                            ? "bg-stone-950 text-white"
                            : "text-stone-700 hover:bg-stone-100",
                        ].join(" ")}
                        key={mode}
                        onClick={() => updateDraftDuration(mode)}
                        type="button"
                      >
                        {formatDurationChoice(mode, draft.defaultFocusMinutes)}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
              {draftDurationMode === "custom" ? (
                <input
                  aria-label="Custom minutes"
                  className="mt-2 w-full rounded-md border border-stone-300 px-2 py-2 text-sm font-medium"
                  inputMode="numeric"
                  max={240}
                  min={1}
                  onChange={(event) => {
                    const defaultFocusMinutes = Number(event.currentTarget.value);
                    setDraft((current) => ({
                      ...current,
                      defaultFocusMinutes,
                    }));
                  }}
                  type="number"
                  value={draft.defaultFocusMinutes}
                />
              ) : null}
            </div>
            <div className="rounded-md border border-stone-200 px-3 py-2">
              <div className="text-xs uppercase tracking-wide text-stone-500">Shortcut</div>
              <div className="mt-1 rounded-md border border-stone-200 bg-[#fbfaf5] px-2 py-2 text-sm font-medium">
                {formatShortcutLabel(SHORTCUT)}
              </div>
            </div>
            <div className="rounded-md border border-stone-200 px-3 py-2">
              <div className="text-xs uppercase tracking-wide text-stone-500">
                Focus companion
              </div>
              <div className="mt-2 grid grid-cols-2 gap-1 rounded-md border border-stone-200 bg-[#fbfaf5] p-1">
                {FOCUS_COMPANION_MODE_OPTIONS.map((mode) => (
                  <button
                    aria-pressed={draft.focusCompanionMode === mode}
                    className={[
                      "rounded px-2 py-1.5 text-sm font-medium",
                      draft.focusCompanionMode === mode
                        ? "bg-stone-950 text-white"
                        : "text-stone-700 hover:bg-stone-100",
                    ].join(" ")}
                    key={mode}
                    onClick={() =>
                      setDraft((current) => ({
                        ...current,
                        focusCompanionMode: mode,
                        characterEnabled: mode === "character",
                      }))
                    }
                    type="button"
                  >
                    {formatFocusCompanionModeLabel(mode)}
                  </button>
                ))}
              </div>
            </div>
            <label className="flex items-center justify-between gap-3 rounded-md border border-stone-200 px-3 py-2">
              <span>
                <span className="block text-xs uppercase tracking-wide text-stone-500">
                  Local-only mode
                </span>
                <span className="block text-sm font-medium">
                  {draft.localOnly ? "Enabled" : "Disabled"}
                </span>
              </span>
              <input
                aria-label="Local-only mode"
                checked={draft.localOnly}
                className="h-5 w-5 accent-emerald-700"
                onChange={(event) => {
                  const localOnly = event.currentTarget.checked;
                  setDraft((current) => ({
                    ...current,
                    localOnly,
                  }));
                }}
                type="checkbox"
              />
            </label>
            <label className="grid gap-1 rounded-md border border-stone-200 px-3 py-2">
              <span className="text-xs uppercase tracking-wide text-stone-500">
                OpenRouter API key
              </span>
              <input
                aria-label="API key"
                className="rounded-md border border-stone-300 px-2 py-2 text-sm font-medium"
                onChange={(event) => {
                  const apiKey = event.currentTarget.value;
                  setDraft((current) => ({
                    ...current,
                    apiKey,
                  }));
                }}
                placeholder="Optional OpenRouter key"
                type="password"
                value={draft.apiKey}
              />
            </label>
          </>
        ) : (
          <>
            <Setting label="Default duration" value={`${settings.defaultFocusMinutes} min`} />
            <Setting
              label="Focus companion"
              value={formatFocusCompanionModeLabel(settings.focusCompanionMode)}
            />
            <Setting label="Local-only mode" value={settings.localOnly ? "Enabled" : "Disabled"} />
            <Setting label="OpenRouter key" value={settings.apiKey ? "Saved locally" : "Not set"} />
            <Setting label="Shortcut" value={formatShortcutLabel(SHORTCUT)} />
            <Setting label="Shortcut status" value={formatShortcutStatus(shortcutStatus)} />
            <Setting label="Classifier" value={formatClassifierStatus(settings)} />
            <Setting label="Storage" value="SQLite schema prepared" />
          </>
        )}
      </div>
    </div>
  );
}
