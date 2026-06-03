import { X } from "lucide-react";
import {
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  useEffect,
  useRef,
} from "react";

export function ThoughtCatcher({
  onClose,
  onSubmit,
  presentation,
  setThoughtText,
  thoughtText,
}: {
  onClose: () => void;
  onSubmit: (event?: FormEvent<HTMLFormElement>) => void;
  presentation: "modal" | "standalone";
  setThoughtText: (value: string) => void;
  thoughtText: string;
}) {
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const focusInput = () => {
      inputRef.current?.focus({ preventScroll: true });
    };

    focusInput();
    window.requestAnimationFrame(focusInput);
    const timeoutId = window.setTimeout(focusInput, 60);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, []);

  function handleKeyDown(event: ReactKeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      return;
    }

    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      onSubmit();
    }
  }

  const wrapperClass =
    presentation === "modal"
      ? "fixed inset-0 z-10 grid place-items-center bg-stone-950/35 p-4"
      : "grid w-full place-items-center";

  return (
    <div className={wrapperClass}>
      <form
        aria-modal="true"
        className="w-full max-w-sm rounded-lg border border-stone-200 bg-white p-4 shadow-xl"
        onSubmit={onSubmit}
        role="dialog"
      >
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold">Thought catcher</h2>
            <p className="text-xs text-stone-500">Enter saves, Shift+Enter adds a line.</p>
          </div>
          <button
            aria-label="Close thought catcher"
            className="grid h-8 w-8 place-items-center rounded-md border border-stone-200 text-stone-500"
            onClick={onClose}
            type="button"
          >
            <X size={16} />
          </button>
        </div>

        <label className="sr-only" htmlFor="thought-catcher">
          Distraction thought
        </label>
        <textarea
          className="h-28 w-full resize-none rounded-md border border-stone-300 px-3 py-2 text-sm outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100"
          id="thought-catcher"
          onChange={(event) => setThoughtText(event.currentTarget.value)}
          onKeyDown={handleKeyDown}
          placeholder="Drop the distraction here..."
          ref={inputRef}
          value={thoughtText}
        />

        <div className="mt-3 flex justify-end gap-2">
          <button
            className="rounded-md border border-stone-300 px-3 py-2 text-sm font-medium"
            onClick={onClose}
            type="button"
          >
            Cancel
          </button>
          <button className="rounded-md bg-stone-950 px-3 py-2 text-sm font-medium text-white" type="submit">
            Save
          </button>
        </div>
      </form>
    </div>
  );
}
