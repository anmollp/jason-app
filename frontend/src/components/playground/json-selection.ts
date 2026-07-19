import { syntaxTree } from "@codemirror/language";
import type { EditorState } from "@codemirror/state";

const jsonValueNodeNames = new Set([
  "Array",
  "False",
  "Null",
  "Number",
  "Object",
  "String",
  "True",
]);

function encodePointerSegment(segment: string) {
  return segment.replaceAll("~", "~0").replaceAll("/", "~1");
}

export function jsonPointerAtPosition(state: EditorState, position: number) {
  let node = syntaxTree(state).resolveInner(position, 1);
  const segments: string[] = [];

  while (node.parent) {
    const parent = node.parent;

    if (parent.name === "Property") {
      const propertyName = parent.getChild("PropertyName");

      if (propertyName) {
        try {
          const segment = JSON.parse(
            state.sliceDoc(propertyName.from, propertyName.to),
          ) as unknown;

          if (typeof segment === "string") {
            segments.unshift(segment);
          }
        } catch {
          return "";
        }
      }
    } else if (parent.name === "Array") {
      let element = node;

      while (element.parent && element.parent !== parent) {
        element = element.parent;
      }

      let arrayIndex = 0;

      for (let child = parent.firstChild; child; child = child.nextSibling) {
        if (!jsonValueNodeNames.has(child.name)) {
          continue;
        }

        if (child.from === element.from && child.to === element.to) {
          segments.unshift(String(arrayIndex));
          break;
        }

        arrayIndex += 1;
      }
    }

    node = parent;
  }

  return segments.length
    ? `/${segments.map(encodePointerSegment).join("/")}`
    : "";
}

export function selectionPointerPosition(state: EditorState) {
  const selection = state.selection.main;

  if (selection.empty) {
    return selection.head;
  }

  const selectedText = state.sliceDoc(selection.from, selection.to);
  const firstContentOffset = selectedText.search(/\S/u);

  return firstContentOffset >= 0
    ? selection.from + firstContentOffset
    : selection.head;
}
