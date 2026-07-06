"use client";

type TimeSelect24Props = {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  required?: boolean;
  "aria-label"?: string;
};

const HOUR_OPTIONS = Array.from({ length: 24 }, (_, index) => String(index).padStart(2, "0"));
const MINUTE_OPTIONS = Array.from({ length: 60 }, (_, index) => String(index).padStart(2, "0"));

export function formatTime24OnBlur(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";

  const colonMatch = /^(\d{1,2}):(\d{1,2})$/.exec(trimmed);
  if (colonMatch) {
    const hours = Math.min(23, Math.max(0, Number.parseInt(colonMatch[1] ?? "0", 10)));
    const minutes = Math.min(59, Math.max(0, Number.parseInt(colonMatch[2] ?? "0", 10)));
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  }

  const digits = trimmed.replace(/\D/g, "");
  if (digits.length === 3) {
    const hours = Math.min(23, Number.parseInt(digits[0] ?? "0", 10));
    const minutes = Math.min(59, Number.parseInt(digits.slice(1), 10));
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  }
  if (digits.length >= 4) {
    const hours = Math.min(23, Number.parseInt(digits.slice(0, 2), 10));
    const minutes = Math.min(59, Number.parseInt(digits.slice(2, 4), 10));
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  }

  return trimmed;
}

export function isValidTime24(value: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value.trim());
}

function parseTime24(value: string): { hour: string; minute: string } {
  const trimmed = value.trim();
  if (!trimmed) return { hour: "", minute: "" };

  const match = /^(\d{1,2}):(\d{2})/.exec(trimmed);
  if (!match) return { hour: "", minute: "" };

  const hours = Math.min(23, Math.max(0, Number.parseInt(match[1] ?? "0", 10)));
  const minutes = Math.min(59, Math.max(0, Number.parseInt(match[2] ?? "0", 10)));
  return {
    hour: String(hours).padStart(2, "0"),
    minute: String(minutes).padStart(2, "0"),
  };
}

function combineTime24(hour: string, minute: string): string {
  if (!hour || !minute) return "";
  return `${hour}:${minute}`;
}

export function TimeSelect24({
  value,
  onChange,
  className,
  required,
  "aria-label": ariaLabel,
}: TimeSelect24Props) {
  const { hour, minute } = parseTime24(value);

  return (
    <div className={`flex gap-2 ${className ?? ""}`}>
      <select
        className="field-input min-w-0 flex-1"
        value={hour}
        onChange={(event) => onChange(combineTime24(event.target.value, minute))}
        required={required}
        aria-label={ariaLabel ? `${ariaLabel} hour` : "Hour (24-hour)"}
      >
        <option value="">{required ? "Hour" : "—"}</option>
        {HOUR_OPTIONS.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
      <select
        className="field-input min-w-0 flex-1"
        value={minute}
        onChange={(event) => onChange(combineTime24(hour, event.target.value))}
        required={required}
        aria-label={ariaLabel ? `${ariaLabel} minute` : "Minute"}
      >
        <option value="">{required ? "Min" : "—"}</option>
        {MINUTE_OPTIONS.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  );
}
