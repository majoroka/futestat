import test from "node:test";
import assert from "node:assert/strict";

import {
  classifyEmptyDiagnostic,
  shouldRetryAttempt,
} from "../src/infrastructure/sofascore/sofascore-scrape-policy.js";

test("classifyEmptyDiagnostic detects blocked 403 pages", () => {
  assert.equal(
    classifyEmptyDiagnostic({
      title: "",
      bodyPreview: '{"error":{"code":403,"reason":"Forbidden"}}',
    }),
    "blocked",
  );
});

test("classifyEmptyDiagnostic keeps non-blocked empty pages as empty", () => {
  assert.equal(
    classifyEmptyDiagnostic({
      title: "Sofascore",
      bodyPreview: "No scheduled events for this date.",
    }),
    "empty",
  );
});

test("shouldRetryAttempt retries until the configured max attempts", () => {
  assert.equal(
    shouldRetryAttempt({
      attempt: 1,
      maxAttemptsPerDate: 3,
      reason: "error",
    }),
    true,
  );
  assert.equal(
    shouldRetryAttempt({
      attempt: 3,
      maxAttemptsPerDate: 3,
      reason: "blocked",
    }),
    false,
  );
});
