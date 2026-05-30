export function currency(value: number, digits = 2) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: digits,
    minimumFractionDigits: digits
  }).format(Number.isFinite(value) ? value : 0);
}

export function compact(value: number, digits = 2) {
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: digits
  }).format(Number.isFinite(value) ? value : 0);
}

export function percent(value: number, digits = 2) {
  return `${(Number.isFinite(value) ? value : 0).toFixed(digits)}%`;
}

export function ms(value: number) {
  return `${Math.max(0, Math.round(Number.isFinite(value) ? value : 0))}ms`;
}

export function timeAgo(iso?: string) {
  if (!iso) return "never";
  const seconds = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  return `${minutes}m ago`;
}

/** Converts any time value (ISO string or "HH:MM" / "HH:MM:SS") to "HH:MM:SS" for chart axes. */
export function chartTime(value: string): string {
  if (!value) return "";
  // Already short format like "10:00" or "14:32:08"
  if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(value)) {
    if (value.split(":").length === 2) return `${value}:00`;
    return value;
  }
  // ISO 8601 / epoch timestamp
  const date = new Date(value);
  if (!Number.isNaN(date.getTime())) {
    return date.toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
  }
  return value;
}
