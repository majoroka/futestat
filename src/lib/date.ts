const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;

export function assertIsoDate(value: string, label = "date"): string {
  if (!ISO_DATE_RE.test(value)) {
    throw new Error(`Invalid ${label}: "${value}". Expected YYYY-MM-DD.`);
  }

  const candidate = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(candidate.getTime()) || candidate.toISOString().slice(0, 10) !== value) {
    throw new Error(`Invalid ${label}: "${value}".`);
  }

  return value;
}

export function todayIsoDateInTimeZone(
  timeZone: string,
  reference = new Date(),
): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(reference);

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  if (!year || !month || !day) {
    throw new Error(`Unable to derive date for timezone "${timeZone}".`);
  }

  return `${year}-${month}-${day}`;
}

export function shiftIsoDate(date: string, offsetDays: number): string {
  assertIsoDate(date, "date");

  if (!Number.isInteger(offsetDays)) {
    throw new Error(`Invalid offsetDays: "${offsetDays}". Expected integer.`);
  }

  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + offsetDays);
  return value.toISOString().slice(0, 10);
}

export function buildSlidingWindowDates(
  referenceDate: string,
  pastDays: number,
  futureDays: number,
): string[] {
  assertIsoDate(referenceDate, "referenceDate");

  if (!Number.isInteger(pastDays) || pastDays < 0) {
    throw new Error(`Invalid pastDays: "${pastDays}". Expected integer >= 0.`);
  }

  if (!Number.isInteger(futureDays) || futureDays < 0) {
    throw new Error(`Invalid futureDays: "${futureDays}". Expected integer >= 0.`);
  }

  const dates: string[] = [];

  for (let offset = -pastDays; offset <= futureDays; offset += 1) {
    dates.push(shiftIsoDate(referenceDate, offset));
  }

  return dates;
}

export function kickoffUtcFromDateAndTime(date: string, time: string): string {
  assertIsoDate(date, "fixture date");

  if (!TIME_RE.test(time)) {
    throw new Error(`Invalid kickoff time: "${time}". Expected HH:MM in UTC.`);
  }

  const iso = `${date}T${time}:00Z`;
  const parsed = new Date(iso);

  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid kickoff combination: "${date}" + "${time}".`);
  }

  return parsed.toISOString();
}
