import test from "node:test";
import assert from "node:assert/strict";

import {
  buildSlidingWindowDates,
  kickoffUtcFromDateAndTime,
  shiftIsoDate,
  todayIsoDateInTimeZone,
} from "../src/lib/date.js";

test("buildSlidingWindowDates creates the expected inclusive window", () => {
  assert.deepEqual(buildSlidingWindowDates("2026-07-21", 2, 3), [
    "2026-07-19",
    "2026-07-20",
    "2026-07-21",
    "2026-07-22",
    "2026-07-23",
    "2026-07-24",
  ]);
});

test("shiftIsoDate moves an ISO day in UTC space", () => {
  assert.equal(shiftIsoDate("2026-07-21", -7), "2026-07-14");
  assert.equal(shiftIsoDate("2026-07-21", 7), "2026-07-28");
});

test("todayIsoDateInTimeZone derives the local calendar day", () => {
  assert.equal(
    todayIsoDateInTimeZone("Europe/Lisbon", new Date("2026-07-21T22:30:00.000Z")),
    "2026-07-21",
  );
  assert.equal(
    todayIsoDateInTimeZone("Europe/Lisbon", new Date("2026-07-21T23:30:00.000Z")),
    "2026-07-22",
  );
});

test("kickoffUtcFromDateAndTime normalizes to ISO UTC", () => {
  assert.equal(
    kickoffUtcFromDateAndTime("2026-07-21", "17:00"),
    "2026-07-21T17:00:00.000Z",
  );
});
