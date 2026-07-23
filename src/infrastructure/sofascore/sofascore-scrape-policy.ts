export interface EmptyPageDiagnostic {
  title: string;
  bodyPreview: string;
}

export function classifyEmptyDiagnostic(
  diagnostic: EmptyPageDiagnostic,
): "blocked" | "empty" {
  const haystack = `${diagnostic.title} ${diagnostic.bodyPreview}`.toLowerCase();

  if (
    (haystack.includes("403") && haystack.includes("forbidden")) ||
    haystack.includes("access denied") ||
    haystack.includes("request blocked")
  ) {
    return "blocked";
  }

  return "empty";
}

export function shouldRetryAttempt(params: {
  attempt: number;
  maxAttemptsPerDate: number;
  reason: "blocked" | "error";
}): boolean {
  return params.attempt < params.maxAttemptsPerDate;
}
