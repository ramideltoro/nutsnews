import {
  DEFAULT_LANGUAGE_CODE,
  isSupportedLanguageCode,
  type LanguageCode,
} from "@/lib/languages";

export type TranslationQualitySeverity = "warning" | "critical";

export type TranslationQualityWarning = {
  code: string;
  severity: TranslationQualitySeverity;
  message: string;
  field?: "title" | "summary" | "language_code";
};

export type TranslationQualityCandidate = {
  language_code?: string | null;
  title?: string | null;
  summary?: string | null;
  sourceTitle?: string | null;
  sourceSummary?: string | null;
};

export type TranslationQualityResult = {
  languageCode: LanguageCode;
  usable: boolean;
  warnings: TranslationQualityWarning[];
};

export const TRANSLATION_TITLE_MIN_CHARS = 6;
export const TRANSLATION_TITLE_MAX_CHARS = 220;
export const TRANSLATION_SUMMARY_MIN_CHARS = 80;
export const TRANSLATION_SUMMARY_CRITICAL_MIN_CHARS = 40;
export const TRANSLATION_SUMMARY_MAX_CHARS = 420;

const JAPANESE_SCRIPT_RE = /[\u3040-\u30ff\u3400-\u9fff]/;
const GREEK_SCRIPT_RE = /[\u0370-\u03ff]/;
const TARGET_MARKERS: Record<string, Set<string>> = {
  fr: new Set([
    "au",
    "aux",
    "avec",
    "ce",
    "ces",
    "dans",
    "de",
    "des",
    "du",
    "elle",
    "en",
    "est",
    "et",
    "la",
    "le",
    "les",
    "leur",
    "leurs",
    "mais",
    "par",
    "pour",
    "que",
    "qui",
    "sur",
    "une",
  ]),
  de: new Set([
    "auf",
    "aus",
    "das",
    "dem",
    "den",
    "der",
    "des",
    "die",
    "ein",
    "eine",
    "einen",
    "einer",
    "für",
    "im",
    "ist",
    "mit",
    "und",
    "von",
    "zu",
    "über",
  ]),
  "de-CH": new Set([
    "auf",
    "aus",
    "das",
    "dem",
    "den",
    "der",
    "des",
    "die",
    "ein",
    "eine",
    "einen",
    "einer",
    "für",
    "im",
    "ist",
    "mit",
    "und",
    "von",
    "zu",
    "über",
  ]),
};

const ENGLISH_MARKERS = new Set([
  "a",
  "about",
  "after",
  "and",
  "are",
  "as",
  "at",
  "be",
  "by",
  "community",
  "for",
  "from",
  "good",
  "has",
  "have",
  "help",
  "in",
  "is",
  "it",
  "new",
  "news",
  "of",
  "on",
  "people",
  "story",
  "that",
  "the",
  "their",
  "this",
  "to",
  "with",
]);

function normalizeWhitespace(value: string | null | undefined) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function normalizeComparable(value: string | null | undefined) {
  return normalizeWhitespace(value)
    .toLocaleLowerCase("en-US")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function wordTokens(value: string) {
  return normalizeComparable(value).split(/\s+/).filter(Boolean);
}

function ratioForMarkers(tokens: string[], markers: Set<string>) {
  if (tokens.length === 0) {
    return 0;
  }

  const matches = tokens.filter((token) => markers.has(token)).length;
  return matches / tokens.length;
}

function looksLikeEnglish(value: string, languageCode: LanguageCode) {
  if (languageCode === DEFAULT_LANGUAGE_CODE || languageCode === "ja" || languageCode === "el") {
    return false;
  }

  const tokens = wordTokens(value);

  if (tokens.length < 6) {
    return false;
  }

  const englishRatio = ratioForMarkers(tokens, ENGLISH_MARKERS);
  const targetRatio = ratioForMarkers(tokens, TARGET_MARKERS[languageCode] ?? new Set());

  return englishRatio >= 0.18 && targetRatio <= 0.05;
}

function isSameText(left: string | null | undefined, right: string | null | undefined) {
  const normalizedLeft = normalizeComparable(left);
  const normalizedRight = normalizeComparable(right);

  return Boolean(normalizedLeft && normalizedRight && normalizedLeft === normalizedRight);
}

function pushWarning(
  warnings: TranslationQualityWarning[],
  warning: TranslationQualityWarning,
) {
  warnings.push(warning);
}

export function validateTranslatedSummary(
  candidate: TranslationQualityCandidate,
  requestedLanguageCode: LanguageCode,
): TranslationQualityResult {
  const warnings: TranslationQualityWarning[] = [];
  const title = normalizeWhitespace(candidate.title);
  const summary = normalizeWhitespace(candidate.summary);
  const rowLanguageCode = normalizeWhitespace(candidate.language_code);
  const languageCode = isSupportedLanguageCode(rowLanguageCode)
    ? rowLanguageCode
    : requestedLanguageCode;

  if (requestedLanguageCode === DEFAULT_LANGUAGE_CODE) {
    return {
      languageCode: DEFAULT_LANGUAGE_CODE,
      usable: true,
      warnings,
    };
  }

  if (!rowLanguageCode) {
    pushWarning(warnings, {
      code: "missing_language_code",
      severity: "critical",
      field: "language_code",
      message: "Translation row is missing language_code.",
    });
  } else if (rowLanguageCode !== requestedLanguageCode) {
    pushWarning(warnings, {
      code: "language_code_mismatch",
      severity: "critical",
      field: "language_code",
      message: `Translation row language_code is ${rowLanguageCode}, expected ${requestedLanguageCode}.`,
    });
  }

  if (!title) {
    pushWarning(warnings, {
      code: "missing_title",
      severity: "critical",
      field: "title",
      message: "Translated title is missing.",
    });
  } else if (title.length < TRANSLATION_TITLE_MIN_CHARS) {
    pushWarning(warnings, {
      code: "short_title",
      severity: "warning",
      field: "title",
      message: `Translated title is short (${title.length} chars).`,
    });
  } else if (title.length > TRANSLATION_TITLE_MAX_CHARS) {
    pushWarning(warnings, {
      code: "long_title",
      severity: "warning",
      field: "title",
      message: `Translated title is long (${title.length} chars).`,
    });
  }

  if (!summary) {
    pushWarning(warnings, {
      code: "missing_summary",
      severity: "critical",
      field: "summary",
      message: "Translated summary is missing.",
    });
  } else if (summary.length < TRANSLATION_SUMMARY_CRITICAL_MIN_CHARS) {
    pushWarning(warnings, {
      code: "summary_too_short",
      severity: "critical",
      field: "summary",
      message: `Translated summary is too short (${summary.length} chars).`,
    });
  } else if (summary.length < TRANSLATION_SUMMARY_MIN_CHARS) {
    pushWarning(warnings, {
      code: "short_summary",
      severity: "warning",
      field: "summary",
      message: `Translated summary is shorter than the preferred range (${summary.length} chars).`,
    });
  } else if (summary.length > TRANSLATION_SUMMARY_MAX_CHARS) {
    pushWarning(warnings, {
      code: "long_summary",
      severity: "warning",
      field: "summary",
      message: `Translated summary is longer than the preferred range (${summary.length} chars).`,
    });
  }

  if (title && isSameText(title, candidate.sourceTitle)) {
    pushWarning(warnings, {
      code: "title_matches_english_source",
      severity: "critical",
      field: "title",
      message: "Translated title matches the English source title.",
    });
  }

  if (summary && isSameText(summary, candidate.sourceSummary)) {
    pushWarning(warnings, {
      code: "summary_matches_english_source",
      severity: "critical",
      field: "summary",
      message: "Translated summary matches the English source summary.",
    });
  }

  if (summary && languageCode === "ja" && !JAPANESE_SCRIPT_RE.test(`${title} ${summary}`)) {
    pushWarning(warnings, {
      code: "missing_japanese_script",
      severity: "critical",
      field: "summary",
      message: "Japanese translation does not contain Japanese script.",
    });
  }

  if (summary && languageCode === "el" && !GREEK_SCRIPT_RE.test(`${title} ${summary}`)) {
    pushWarning(warnings, {
      code: "missing_greek_script",
      severity: "critical",
      field: "summary",
      message: "Greek translation does not contain Greek script.",
    });
  }

  if (summary && looksLikeEnglish(`${title} ${summary}`, languageCode)) {
    pushWarning(warnings, {
      code: "looks_like_english",
      severity: "warning",
      field: "summary",
      message: `Translation looks like English text stored under ${requestedLanguageCode}.`,
    });
  }

  return {
    languageCode,
    usable: !warnings.some((warning) => warning.severity === "critical"),
    warnings,
  };
}

export function hasCriticalTranslationQualityIssue(
  candidate: TranslationQualityCandidate,
  requestedLanguageCode: LanguageCode,
) {
  return !validateTranslatedSummary(candidate, requestedLanguageCode).usable;
}
