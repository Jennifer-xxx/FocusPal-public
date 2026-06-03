import type { ReactNode } from "react";

export function StatusPill({ activeFocus, status }: { activeFocus: boolean; status: string }) {
  return (
    <span
      className={[
        "rounded-full px-2.5 py-1 text-xs font-medium",
        activeFocus ? "bg-emerald-700 text-white" : "bg-stone-100 text-stone-700",
      ].join(" ")}
    >
      {activeFocus
        ? "Focusing"
        : status === "paused"
          ? "Paused"
          : status === "completed"
            ? "Complete"
            : "Ready"}
    </span>
  );
}

export function TabButton({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className={[
        "inline-flex items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm font-medium",
        active
          ? "border-stone-950 bg-stone-950 text-white"
          : "border-stone-200 bg-white text-stone-600",
      ].join(" ")}
      onClick={onClick}
      type="button"
    >
      {icon}
      {label}
    </button>
  );
}

export function Metric({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-md border border-stone-200 bg-[#fbfaf5] p-2">
      <div className="flex items-center justify-center gap-1.5 text-stone-500">
        {icon}
        <span className="text-xs uppercase tracking-wide">{label}</span>
      </div>
      <div className="mt-1 truncate text-center text-base font-semibold">{value}</div>
    </div>
  );
}

export function Setting({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-stone-200 px-3 py-2">
      <div className="text-xs uppercase tracking-wide text-stone-500">{label}</div>
      <div className="mt-1 font-medium">{value}</div>
    </div>
  );
}
