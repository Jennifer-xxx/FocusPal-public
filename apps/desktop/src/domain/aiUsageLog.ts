export function logAiUsage(feature: string, event: string, detail: string) {
  const message = `[FocusPal AI] ${feature}: ${event} - ${detail}`;

  console.info(message);

  void import("@tauri-apps/api/core")
    .then(async ({ invoke, isTauri }) => {
      if (!isTauri() && !hasTauriInternals()) {
        return;
      }

      await invoke("log_ai_event", { detail, event, feature });
    })
    .catch((error) => {
      console.info(
        `[FocusPal AI] terminal log unavailable - ${getErrorMessage(error)}`,
      );
    });
}

export function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "unknown error";
}

function hasTauriInternals() {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}
