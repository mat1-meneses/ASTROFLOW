export interface ParseResult {
  headers: string[];
  rows: Record<string, string>[];
  metadata: string[];            // raw "#" / "!" comment lines
  headerSource: "file" | "generated";
  sentinelColumns: Set<string>;  // columns that contain at least one sentinel value
}

// Values treated as "missing data" — excluded from analysis, flagged in preview
const SENTINEL_PATTERNS = new Set([
  "-99", "-99.0", "-99.00", "-99.000",
  "-999", "-999.0", "-999.00", "-999.000",
  "99.999", "9999", "9999.0",
  "nan", "na", "null", "none", "--", "",
]);

export function isSentinel(value: string): boolean {
  return SENTINEL_PATTERNS.has(value.toLowerCase().trim());
}

// ─── Delimiter detection ───────────────────────────────────────────────────────

function detectDelimiter(sampleLines: string[]): RegExp | string {
  if (sampleLines.length === 0) return ",";

  const candidates: Array<{ delim: RegExp | string; cols: number[] }> = [
    { delim: ",", cols: [] },
    { delim: "\t", cols: [] },
    { delim: ";", cols: [] },
    { delim: /\s+/, cols: [] },   // whitespace (space, multiple spaces, mixed)
  ];

  for (const line of sampleLines) {
    for (const c of candidates) {
      const parts =
        typeof c.delim === "string"
          ? line.split(c.delim)
          : line.trim().split(c.delim).filter(Boolean);
      c.cols.push(parts.length);
    }
  }

  // Score: prefer delimiter that gives the MOST consistent column count >= 2
  let best = candidates[0];
  let bestScore = -Infinity;

  for (const c of candidates) {
    if (c.cols.length === 0) continue;
    const mode = mostCommon(c.cols);
    if (mode < 2) continue;
    // Fraction of lines that agree with the mode — higher = more consistent
    const consistency =
      c.cols.filter((n) => n === mode).length / c.cols.length;
    const score = consistency * 100 + mode;
    if (score > bestScore) {
      bestScore = score;
      best = c;
    }
  }

  return best.delim;
}

function mostCommon(arr: number[]): number {
  const freq: Record<number, number> = {};
  for (const v of arr) freq[v] = (freq[v] ?? 0) + 1;
  return Number(Object.entries(freq).sort((a, b) => b[1] - a[1])[0][0]);
}

// ─── Header extraction from comment lines ─────────────────────────────────────

/**
 * In formats like MACHO, the last "#" line before data is the column header:
 *   # HJD-2.449e+06    r    err_r    b    err_b  obsid  tran
 * Strip the leading "#" and use those tokens as column names.
 */
function extractHeaderFromMetadata(
  metaLines: string[],
  delimiter: RegExp | string,
  expectedCols?: number
): string[] | null {
  const candidates: string[][] = [];

  // Walk from last to first, collecting ALL plausible header lines
  for (let i = metaLines.length - 1; i >= 0; i--) {
    const raw = metaLines[i].replace(/^[#!]\s*/, "").trim();
    if (!raw) continue;
    const tokens = splitLine(raw, delimiter).filter(Boolean);
    const allNumeric = tokens.every((t) => !isNaN(Number(t)));
    // Reject lines that are purely units, e.g. "(days) (mag) (mag)"
    const looksLikeUnits = tokens.every((t) => /^\(.+\)$/.test(t));
    if (tokens.length >= 2 && !allNumeric && !looksLikeUnits) {
      candidates.push(tokens);
    }
  }

  if (candidates.length === 0) return null;

  // Prefer the candidate whose column count matches the data's real column count
  if (expectedCols) {
    const exact = candidates.find((c) => c.length === expectedCols);
    if (exact) return exact;
  }

  // Fallback: the candidate closest to the data (first one found walking upward)
  return candidates[0];
}

// ─── Line splitter ────────────────────────────────────────────────────────────

function splitLine(line: string, delimiter: RegExp | string): string[] {
  if (typeof delimiter === "string") {
    return line.split(delimiter).map((s) => s.trim());
  }
  // Regex (whitespace): trim first to avoid empty leading token
  return line.trim().split(delimiter).map((s) => s.trim());
}

// ─── Main parser ──────────────────────────────────────────────────────────────

export function parseFile(content: string): ParseResult {
  const rawLines = content.split("\n");

  // Separate comment lines from data lines (preserve order for metadata display)
  const metaLines: string[] = [];
  const dataLines: string[] = [];

  for (const line of rawLines) {
    const trimmed = line.trim();
    if (trimmed === "") continue;
    if (trimmed.startsWith("#") || trimmed.startsWith("!")) {
      metaLines.push(trimmed);
    } else {
      dataLines.push(trimmed);
    }
  }

  if (dataLines.length === 0) {
    return { headers: [], rows: [], metadata: metaLines, headerSource: "generated", sentinelColumns: new Set() };
  }

  // Detect delimiter using data lines (not comment lines)
  const sampleData = dataLines.slice(0, Math.min(10, dataLines.length));
  const delimiter = detectDelimiter(sampleData);

  // Determine if first data line looks like a header (contains non-numeric tokens)
  const firstDataTokens = splitLine(dataLines[0], delimiter).filter(Boolean);
  const firstLineIsHeader = firstDataTokens.some((t) => isNaN(Number(t)));

  let headers: string[];
  let bodyLines: string[];
  let headerSource: ParseResult["headerSource"];

  if (firstLineIsHeader) {
    // First data line is a text header
    headers = firstDataTokens;
    bodyLines = dataLines.slice(1);
    headerSource = "file";
  } else {
    // Try to extract header from the last metadata line
    const expectedColsFromData = mostCommon(
      sampleData.map((l) => splitLine(l, delimiter).filter(Boolean).length)
    );
    const metaHeader = extractHeaderFromMetadata(metaLines, delimiter, expectedColsFromData);
    if (metaHeader) {
      headers = metaHeader;
      headerSource = "file";
    } else {
      // No header — generate Col1, Col2, …
      const colCount = mostCommon(
        sampleData.map((l) => splitLine(l, delimiter).filter(Boolean).length)
      );
      headers = Array.from({ length: colCount }, (_, i) => `Col${i + 1}`);
      headerSource = "generated";
    }
    bodyLines = dataLines;
  }

  // Parse rows — skip lines whose column count diverges from expected
  const expectedCols = headers.length;
  const rows: Record<string, string>[] = [];
  const sentinelColumns = new Set<string>();

  // Deduplicate header names in case a real catalog does repeat column names
  const seen = new Map<string, number>();
  headers = headers.map((h) => {
    const count = seen.get(h) ?? 0;
    seen.set(h, count + 1);
    return count === 0 ? h : `${h}_${count + 1}`;
  });
  
  for (const line of bodyLines) {
    const values = splitLine(line, delimiter).filter(Boolean);
    if (values.length < 2) continue;

    const row: Record<string, string> = {};
    headers.forEach((h, i) => {
      const val = values[i] ?? "";
      row[h] = val;
      if (isSentinel(val)) sentinelColumns.add(h);
    });

    // Allow rows slightly shorter than header (trailing missing cols)
    if (values.length < Math.floor(expectedCols * 0.5)) continue;
    rows.push(row);
  }

  return { headers, rows, metadata: metaLines, headerSource, sentinelColumns };
}
