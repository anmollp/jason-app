import assert from "node:assert/strict";
import test from "node:test";

import {
  isJsonContentType,
  isSameOriginRequest,
  selectTrustedClientIp,
} from "./agent-proxy-policy.ts";

test("accepts JSON content types and rejects non-JSON requests", () => {
  assert.equal(isJsonContentType("application/json"), true);
  assert.equal(isJsonContentType("application/json; charset=utf-8"), true);
  assert.equal(isJsonContentType("text/plain"), false);
  assert.equal(isJsonContentType(null), false);
});

test("requires the browser origin to match the externally forwarded origin", () => {
  assert.equal(
    isSameOriginRequest("https://askjason.dev", "https", "askjason.dev"),
    true,
  );
  assert.equal(
    isSameOriginRequest("https://evil.example", "https", "askjason.dev"),
    false,
  );
  assert.equal(isSameOriginRequest(null, "https", "askjason.dev"), false);
});

test("uses the proxy-appended client address instead of a spoofed leftmost value", () => {
  assert.equal(
    selectTrustedClientIp("198.51.100.99, 203.0.113.7, 35.191.0.1"),
    "203.0.113.7",
  );
  assert.equal(selectTrustedClientIp("203.0.113.7"), "203.0.113.7");
  assert.equal(selectTrustedClientIp(null), "0.0.0.0");
});
