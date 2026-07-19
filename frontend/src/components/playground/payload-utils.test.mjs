import assert from "node:assert/strict";
import test from "node:test";

import { getJsonRequestByteLength } from "./payload-utils.ts";

test("measures the serialized JSON request body", () => {
  const body = { input: '"quoted"' };

  assert.equal(
    getJsonRequestByteLength(body),
    new TextEncoder().encode(JSON.stringify(body)).length,
  );
});
