const DEFAULT_ADMIN_TIME_ZONE = "America/New_York";

function getDateParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  if (!year || !month || !day) {
    return null;
  }

  return {
    year,
    month,
    day,
  };
}

export function getAdminTimeZone() {
  return process.env.ADMIN_TIME_ZONE || DEFAULT_ADMIN_TIME_ZONE;
}

export function getAdminDateKey(
  value: string | Date,
  timeZone = getAdminTimeZone(),
) {
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "unknown";
  }

  const parts = getDateParts(date, timeZone);

  if (!parts) {
    return "unknown";
  }

  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function getLastAdminDateKeys(
  days: number,
  timeZone = getAdminTimeZone(),
) {
  return Array.from({ length: days }, (_value, index) => {
    const date = new Date(Date.now() - (days - index - 1) * 24 * 60 * 60 * 1000);
    return getAdminDateKey(date, timeZone);
  });
}

export function formatAdminDateTime(
  value: string | null,
  fallback: string,
  timeZone = getAdminTimeZone(),
) {
  if (!value) {
    return fallback;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone,
    timeZoneName: "short",
  }).format(date);
}

export function formatAdminDateLabel(
  value: string,
  timeZone = getAdminTimeZone(),
) {
  const [year, month, day] = value.split("-").map(Number);

  if (!year || !month || !day) {
    return value;
  }

  // Use noon UTC so date-only labels do not shift to the previous day in
  // America/New_York while still rendering through the configured admin timezone.
  const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone,
  }).format(date);
}
