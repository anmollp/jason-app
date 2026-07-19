import assert from "node:assert/strict";
import test from "node:test";

import { json } from "@codemirror/lang-json";
import { EditorState } from "@codemirror/state";

import {
  jsonPointerAtPosition,
  selectionPointerPosition,
} from "./json-selection.ts";

function editorState(document, selection) {
  return EditorState.create({
    doc: document,
    extensions: [json()],
    selection,
  });
}

test("builds a pointer for a nested object property", () => {
  const document = `{
  "user": {
    "role": "viewer"
  }
}`;
  const state = editorState(document);

  assert.equal(
    jsonPointerAtPosition(state, document.indexOf('"viewer"') + 1),
    "/user/role",
  );
});

test("includes array indexes in the pointer", () => {
  const document = `{
  "users": [
    { "role": "viewer" },
    { "role": "admin" }
  ]
}`;
  const state = editorState(document);

  assert.equal(
    jsonPointerAtPosition(state, document.indexOf('"admin"') + 1),
    "/users/1/role",
  );
});

test("escapes JSON Pointer path segments", () => {
  const document = `{ "feature/flags~beta": true }`;
  const state = editorState(document);

  assert.equal(
    jsonPointerAtPosition(state, document.indexOf("true") + 1),
    "/feature~1flags~0beta",
  );
});

test("uses the first content character for a whole-line selection", () => {
  const document = `{
    "status": "ready",
    "count": 2
}`;
  const lineStart = document.indexOf('    "status"');
  const lineEnd = document.indexOf("\n", lineStart);
  const state = editorState(document, { anchor: lineStart, head: lineEnd });
  const position = selectionPointerPosition(state);

  assert.equal(document[position], '"');
  assert.equal(jsonPointerAtPosition(state, position), "/status");
});
