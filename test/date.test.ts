import test from "node:test";
import assert from "node:assert/strict";

import { buildDateRange, kickoffUtcFromDateAndTime } from "../src/lib/date.js";

test("buildDateRange includes today when requested", () => {
  assert.deepEqual(buildDateRange("2026-07-21", 3, true), [
    "2026-07-21",
    "2026-07-22",
    "2026-07-23",
    "2026-07-24",
  ]);
});

test("buildDateRange skips today when requested", () => {
  assert.deepEqual(buildDateRange("2026-07-21", 2, false), [
    "2026-07-22",
    "2026-07-23",
  ]);
});

test("kickoffUtcFromDateAndTime normalizes to ISO UTC", () => {
  assert.equal(
    kickoffUtcFromDateAndTime("2026-07-21", "17:00"),
    "2026-07-21T17:00:00.000Z",
  );
});
