#!/usr/bin/env node

import { performance } from "node:perf_hooks";

const DEFAULT_FRONTEND_BASE_URL = "http://localhost:3001";
const DEFAULT_BACKEND_BASE_URL = "http://localhost:3000";
const DEFAULT_LARGE_PAYLOAD_MB = 4;
const DEFAULT_RUNS = 3;

const config = parseArgs(process.argv.slice(2));

if (config.help) {
  printHelp();
  process.exit(0);
}

const frontendBaseUrl = normalizeBaseUrl(
  config.frontend ?? process.env.FRONTEND_BASE_URL ?? DEFAULT_FRONTEND_BASE_URL,
);
const backendBaseUrl = normalizeBaseUrl(
  config.backend ??
    process.env.BACKEND_BASE_URL ??
    process.env.JASON_API_BASE_URL ??
    DEFAULT_BACKEND_BASE_URL,
);
const largePayloadMb = Number(
  config.largeMb ?? process.env.LARGE_PAYLOAD_MB ?? DEFAULT_LARGE_PAYLOAD_MB,
);
const runs = Number(config.runs ?? process.env.RUNS ?? DEFAULT_RUNS);

if (!Number.isFinite(largePayloadMb) || largePayloadMb <= 0) {
  fail("large payload size must be a positive number.");
}

if (!Number.isInteger(runs) || runs < 1) {
  fail("runs must be a positive integer.");
}

const smallJson = JSON.stringify({
  active: true,
  name: "Jason",
  nested: {
    features: ["format", "diff", "patch", "pointer"],
    timeoutMs: 3000,
  },
});
const largeJson = buildLargeJsonPayload(largePayloadMb);
const checks = [
  {
    expectedStatus: 200,
    method: "GET",
    name: "frontend health",
    url: `${frontendBaseUrl}/api/health`,
  },
  {
    expectedStatus: 200,
    method: "GET",
    name: "backend health",
    url: `${backendBaseUrl}/health`,
  },
  {
    body: JSON.stringify({ input: smallJson }),
    expectedStatus: 200,
    method: "POST",
    name: "formatter small",
    url: `${frontendBaseUrl}/api/format`,
  },
  {
    body: JSON.stringify({ input: largeJson }),
    expectedStatus: 200,
    method: "POST",
    name: `formatter large (${formatBytes(byteLength(largeJson))})`,
    url: `${frontendBaseUrl}/api/format`,
  },
];

console.log("Jason performance smoke");
console.log(`frontend: ${frontendBaseUrl}`);
console.log(`backend:  ${backendBaseUrl}`);
console.log(`runs:     ${runs}`);
console.log("");

const results = [];

for (const check of checks) {
  const samples = [];
  let lastStatus = "";
  let ok = true;
  let responseBytes = 0;

  for (let index = 0; index < runs; index += 1) {
    const sample = await measure(check);
    samples.push(sample.durationMs);
    lastStatus = sample.status;
    ok = ok && sample.ok;
    responseBytes = sample.responseBytes;
  }

  results.push({
    name: check.name,
    ok,
    status: lastStatus,
    requestBytes: byteLength(check.body ?? ""),
    responseBytes,
    ...summarize(samples),
  });
}

printResults(results);

const failures = results.filter((result) => !result.ok);

if (failures.length > 0) {
  process.exitCode = 1;
}

async function measure(check) {
  const startedAt = performance.now();

  try {
    const response = await fetch(check.url, {
      body: check.body,
      headers: check.body ? { "Content-Type": "application/json" } : undefined,
      method: check.method,
    });
    const text = await response.text();
    const durationMs = performance.now() - startedAt;

    return {
      durationMs,
      ok: response.status === check.expectedStatus,
      responseBytes: byteLength(text),
      status: String(response.status),
    };
  } catch {
    return {
      durationMs: performance.now() - startedAt,
      ok: false,
      responseBytes: 0,
      status: "ERR",
    };
  }
}

function buildLargeJsonPayload(targetMb) {
  const targetBytes = Math.floor(targetMb * 1024 * 1024);
  const rows = [];
  let size = 2;
  let index = 0;

  while (size < targetBytes) {
    const row = {
      active: index % 2 === 0,
      bio:
        "Jason is measuring formatter latency with a deliberately repeatable payload.",
      id: `item-${String(index).padStart(6, "0")}`,
      metadata: {
        region: "us-central1",
        source: "perf-smoke",
        version: 1,
      },
      name: `Large JSON row ${index}`,
      score: index % 100,
    };

    rows.push(row);
    size += byteLength(JSON.stringify(row)) + 1;
    index += 1;
  }

  return JSON.stringify(rows);
}

function summarize(samples) {
  const sorted = [...samples].sort((a, b) => a - b);
  const total = samples.reduce((sum, value) => sum + value, 0);

  return {
    avgMs: total / samples.length,
    maxMs: sorted.at(-1) ?? 0,
    minMs: sorted[0] ?? 0,
  };
}

function printResults(results) {
  const rows = [
    ["check", "status", "req", "res", "min", "avg", "max"],
    ...results.map((result) => [
      result.name,
      String(result.status),
      formatBytes(result.requestBytes),
      formatBytes(result.responseBytes),
      formatMs(result.minMs),
      formatMs(result.avgMs),
      formatMs(result.maxMs),
    ]),
  ];
  const widths = rows[0].map((_, column) =>
    Math.max(...rows.map((row) => row[column].length)),
  );

  for (const [index, row] of rows.entries()) {
    console.log(
      row
        .map((cell, column) => cell.padEnd(widths[column]))
        .join("  ")
        .trimEnd(),
    );

    if (index === 0) {
      console.log(widths.map((width) => "-".repeat(width)).join("  "));
    }
  }
}

function printHelp() {
  console.log(`Jason performance smoke

Usage:
  node scripts/perf-smoke.mjs [options]

Options:
  --frontend <url>  Frontend base URL. Default: ${DEFAULT_FRONTEND_BASE_URL}
  --backend <url>   Backend base URL. Default: ${DEFAULT_BACKEND_BASE_URL}
  --large-mb <n>    Large JSON payload size in MB. Default: ${DEFAULT_LARGE_PAYLOAD_MB}
  --runs <n>        Number of samples per check. Default: ${DEFAULT_RUNS}
  --help            Show this help text.

Environment variables:
  FRONTEND_BASE_URL, BACKEND_BASE_URL, JASON_API_BASE_URL, LARGE_PAYLOAD_MB, RUNS
`);
}

function parseArgs(args) {
  const parsed = {};

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--help" || arg === "-h") {
      parsed.help = true;
      continue;
    }

    if (arg === "--frontend") {
      parsed.frontend = readArgValue(args, index, arg);
      index += 1;
      continue;
    }

    if (arg === "--backend") {
      parsed.backend = readArgValue(args, index, arg);
      index += 1;
      continue;
    }

    if (arg === "--large-mb") {
      parsed.largeMb = readArgValue(args, index, arg);
      index += 1;
      continue;
    }

    if (arg === "--runs") {
      parsed.runs = readArgValue(args, index, arg);
      index += 1;
      continue;
    }

    fail(`unknown option: ${arg}`);
  }

  return parsed;
}

function readArgValue(args, index, name) {
  const value = args[index + 1];

  if (!value || value.startsWith("--")) {
    fail(`${name} requires a value.`);
  }

  return value;
}

function normalizeBaseUrl(value) {
  return value.replace(/\/$/, "");
}

function byteLength(value) {
  return Buffer.byteLength(value, "utf8");
}

function formatBytes(bytes) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatMs(value) {
  return `${Math.round(value)} ms`;
}

function fail(message) {
  console.error(`perf-smoke: ${message}`);
  process.exit(1);
}
