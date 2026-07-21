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

export function todayUtcIsoDate(reference = new Date()): string {
  return reference.toISOString().slice(0, 10);
}

export function buildDateRange(
  fromDate: string,
  daysAhead: number,
  includeToday: boolean,
): string[] {
  assertIsoDate(fromDate, "fromDate");

  if (!Number.isInteger(daysAhead) || daysAhead < 0) {
    throw new Error(`Invalid daysAhead: "${daysAhead}". Expected integer >= 0.`);
  }

  const startOffset = includeToday ? 0 : 1;
  const dates: string[] = [];

  for (let offset = startOffset; offset <= daysAhead; offset += 1) {
    const value = new Date(`${fromDate}T00:00:00Z`);
    value.setUTCDate(value.getUTCDate() + offset);
    dates.push(value.toISOString().slice(0, 10));
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
