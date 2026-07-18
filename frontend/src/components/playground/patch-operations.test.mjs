import assert from "node:assert/strict";
import test from "node:test";

import {
  buildPatchOperation,
  validatePatchOperation,
} from "./patch-operations.ts";

const document = JSON.stringify({
  items: ["first", "second"],
  user: { role: "viewer" },
});

test("builds value operations from the selected document path", () => {
  assert.deepEqual(buildPatchOperation(document, "/user/role", "add"), {
    op: "add",
    path: "/user/role",
    value: "viewer",
  });

  assert.deepEqual(buildPatchOperation(document, "/user/role", "replace"), {
    op: "replace",
    path: "/user/role",
    value: "viewer",
  });

  assert.deepEqual(buildPatchOperation(document, "/items/1", "test"), {
    op: "test",
    path: "/items/1",
    value: "second",
  });

  assert.deepEqual(buildPatchOperation(document, "/items/0", "remove"), {
    op: "remove",
    path: "/items/0",
  });
});

test("builds copy and move destinations beside the selected value", () => {
  assert.deepEqual(buildPatchOperation(document, "/user/role", "copy"), {
    from: "/user/role",
    op: "copy",
    path: "/user/roleCopy",
  });

  assert.deepEqual(buildPatchOperation(document, "/items/0", "move"), {
    from: "/items/0",
    op: "move",
    path: "/items/-",
  });
});

test("rejects missing sources and invalid move destinations", () => {
  assert.deepEqual(
    validatePatchOperation(document, {
      from: "/missing",
      op: "copy",
      path: "/user/copiedRole",
    }),
    {
      field: "from",
      message: "Source path was not found in the document.",
    },
  );

  assert.deepEqual(
    validatePatchOperation(document, {
      from: "/user",
      op: "move",
      path: "/user/role",
    }),
    {
      field: "path",
      message: "Move destination cannot be the source or its child.",
    },
  );
});

test("accepts a valid replacement", () => {
  assert.equal(
    validatePatchOperation(document, {
      op: "replace",
      path: "/user/role",
      value: "admin",
    }),
    undefined,
  );

  assert.equal(
    validatePatchOperation(document, {
      from: "",
      op: "copy",
      path: "/documentCopy",
    }),
    undefined,
  );
});
