"use client";

import type { ReviewStatus } from "@/lib/review/types";

export function humanize(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function stableTimestamp(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Unknown time";
  }
  return `${date.toISOString().slice(0, 16).replace("T", " ")} UTC`;
}

export function statusClasses(status: ReviewStatus) {
  if (status === "approved") {
    return "border-emerald-400/30 bg-emerald-400/10 text-emerald-200";
  }
  if (status === "rejected") {
    return "border-rose-400/30 bg-rose-400/10 text-rose-200";
  }
  return "border-amber-400/30 bg-amber-400/10 text-amber-200";
}

export function FilterSelect({ label, onChange, options, value }: { label: string; onChange: (value: string) => void; options: string[]; value: string }) {
  return (
    <label className="text-sm font-medium text-slate-200">
      {label}
      <select
        className="mt-2 w-full rounded-xl border border-white/15 bg-slate-950 px-3 py-2.5 text-sm outline-none transition focus:border-cyan-300 focus:ring-2 focus:ring-cyan-300/20"
        onChange={(event) => onChange(event.target.value)}
        value={value}
      >
        <option value="all">All</option>
        {options.map((option) => <option key={option} value={option}>{humanize(option)}</option>)}
      </select>
    </label>
  );
}
