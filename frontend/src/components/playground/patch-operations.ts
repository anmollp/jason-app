import type { JsonPatchOperation } from "./types";

function parseJsonDocument(input: string) {
  try {
    return { valid: true as const, value: JSON.parse(input) as unknown };
  } catch {
    return { valid: false as const, value: undefined };
  }
}

function decodePointerSegment(segment: string) {
  return segment.replaceAll("~1", "/").replaceAll("~0", "~");
}

function encodePointerSegment(segment: string) {
  return segment.replaceAll("~", "~0").replaceAll("/", "~1");
}

function pointerSegments(path: string) {
  return path.split("/").slice(1).map(decodePointerSegment);
}

function pointerFromSegments(segments: string[]) {
  return segments.length
    ? `/${segments.map(encodePointerSegment).join("/")}`
    : "";
}

function resolvePointer(value: unknown, path: string) {
  if (!path) {
    return { exists: true, value };
  }

  return pointerSegments(path).reduce(
    (result, segment) => {
      if (!result.exists) {
        return result;
      }

      if (Array.isArray(result.value)) {
        const index = Number(segment);

        if (
          !Number.isInteger(index) ||
          index < 0 ||
          index >= result.value.length
        ) {
          return { exists: false, value: undefined };
        }

        return { exists: true, value: result.value[index] };
      }

      if (result.value && typeof result.value === "object") {
        const objectValue = result.value as Record<string, unknown>;

        if (!Object.prototype.hasOwnProperty.call(objectValue, segment)) {
          return { exists: false, value: undefined };
        }

        return { exists: true, value: objectValue[segment] };
      }

      return { exists: false, value: undefined };
    },
    { exists: true, value },
  );
}

function cloneJsonValue(value: unknown) {
  if (value === undefined) {
    return undefined;
  }

  return JSON.parse(JSON.stringify(value)) as unknown;
}

function setPointerValue(document: unknown, path: string, value: unknown) {
  if (!path) {
    return cloneJsonValue(value);
  }

  const segments = pointerSegments(path);
  const lastSegment = segments.at(-1);
  const parent = resolvePointer(document, parentPath(path));

  if (!parent.exists || lastSegment === undefined) {
    return document;
  }

  if (Array.isArray(parent.value)) {
    if (lastSegment === "-") {
      parent.value.push(cloneJsonValue(value));
      return document;
    }

    const index = Number(lastSegment);

    if (Number.isInteger(index) && index >= 0 && index <= parent.value.length) {
      parent.value[index] = cloneJsonValue(value);
    }

    return document;
  }

  if (parent.value && typeof parent.value === "object") {
    (parent.value as Record<string, unknown>)[lastSegment] = cloneJsonValue(value);
  }

  return document;
}

function removePointerValue(document: unknown, path: string) {
  if (!path) {
    return undefined;
  }

  const segments = pointerSegments(path);
  const lastSegment = segments.at(-1);
  const parent = resolvePointer(document, parentPath(path));

  if (!parent.exists || lastSegment === undefined) {
    return document;
  }

  if (Array.isArray(parent.value)) {
    const index = Number(lastSegment);

    if (Number.isInteger(index) && index >= 0 && index < parent.value.length) {
      parent.value.splice(index, 1);
    }

    return document;
  }

  if (parent.value && typeof parent.value === "object") {
    delete (parent.value as Record<string, unknown>)[lastSegment];
  }

  return document;
}

function applyPatchOperations(
  document: unknown,
  operations: JsonPatchOperation[],
) {
  return operations.reduce((currentDocument, operation) => {
    if (operation.op === "test") {
      return currentDocument;
    }

    if (operation.op === "remove") {
      return removePointerValue(currentDocument, operation.path);
    }

    if (operation.op === "copy" || operation.op === "move") {
      const source = resolvePointer(currentDocument, operation.from ?? "");

      if (!source.exists) {
        return currentDocument;
      }

      let nextDocument = currentDocument;

      if (operation.op === "move") {
        nextDocument = removePointerValue(nextDocument, operation.from ?? "");
      }

      return setPointerValue(nextDocument, operation.path, source.value);
    }

    return setPointerValue(currentDocument, operation.path, operation.value);
  }, cloneJsonValue(document));
}

function parentPath(path: string) {
  return pointerFromSegments(pointerSegments(path).slice(0, -1));
}

function destinationParentExists(document: unknown, path: string) {
  if (!path) {
    return true;
  }

  const parent = resolvePointer(document, parentPath(path));

  if (!parent.exists) {
    return false;
  }

  if (Array.isArray(parent.value)) {
    const segment = pointerSegments(path).at(-1) ?? "";
    const index = Number(segment);

    return (
      segment === "-" ||
      (Number.isInteger(index) && index >= 0 && index <= parent.value.length)
    );
  }

  return Boolean(parent.value && typeof parent.value === "object");
}

function siblingDestinationPath(
  document: unknown,
  path: string,
  op: "copy" | "move",
) {
  if (!path) {
    return "/newPath";
  }

  const segments = pointerSegments(path);
  const parentSegments = segments.slice(0, -1);
  const parent = pointerFromSegments(parentSegments);
  const parentValue = resolvePointer(document, parent).value;

  if (Array.isArray(parentValue)) {
    return `${parent}/-`;
  }

  return pointerFromSegments([
    ...parentSegments,
    `${segments.at(-1) ?? "value"}${op === "copy" ? "Copy" : "Moved"}`,
  ]);
}

export function validateJsonPointer(path: string) {
  if (!path) {
    return undefined;
  }

  if (!path.startsWith("/")) {
    return "Path must start with /.";
  }

  if (/~(?![01])/u.test(path)) {
    return "Use ~0 for ~ and ~1 for / inside path segments.";
  }

  return undefined;
}

function validateAgainstDocument(
  document: unknown,
  documentIsValid: boolean,
  operation: JsonPatchOperation,
) {
  const pathIssue = validateJsonPointer(operation.path);

  if (pathIssue) {
    return { field: "path" as const, message: pathIssue };
  }

  if (operation.op === "copy" || operation.op === "move") {
    if (operation.from === undefined) {
      return { field: "from" as const, message: "Source path is required." };
    }

    const fromIssue = validateJsonPointer(operation.from);

    if (fromIssue) {
      return { field: "from" as const, message: fromIssue };
    }

    if (documentIsValid && !resolvePointer(document, operation.from).exists) {
      return {
        field: "from" as const,
        message: "Source path was not found in the document.",
      };
    }

    if (
      operation.op === "move" &&
      (operation.path === operation.from ||
        operation.path.startsWith(`${operation.from}/`))
    ) {
      return {
        field: "path" as const,
        message: "Move destination cannot be the source or its child.",
      };
    }
  } else if (
    documentIsValid &&
    (operation.op === "replace" ||
      operation.op === "remove" ||
      operation.op === "test") &&
    !resolvePointer(document, operation.path).exists
  ) {
    return {
      field: "path" as const,
      message: "Selected path was not found in the document.",
    };
  }

  if (
    documentIsValid &&
    !destinationParentExists(document, operation.path)
  ) {
    return {
      field: "path" as const,
      message: "Destination parent was not found in the document.",
    };
  }

  return undefined;
}

export function validatePatchOperation(
  documentInput: string,
  operation: JsonPatchOperation,
) {
  const document = parseJsonDocument(documentInput);

  return validateAgainstDocument(document.value, document.valid, operation);
}

export function validatePatchOperations(
  documentInput: string,
  operations: JsonPatchOperation[],
) {
  const document = parseJsonDocument(documentInput);

  return operations.flatMap((operation, index) => {
    const issue = validateAgainstDocument(
      document.value,
      document.valid,
      operation,
    );

    return issue ? [{ ...issue, index }] : [];
  });
}

export function buildPatchOperation(
  input: string,
  path: string,
  op: JsonPatchOperation["op"],
  existingOperations: JsonPatchOperation[] = [],
): JsonPatchOperation | undefined {
  if (!path && op !== "add") {
    return undefined;
  }

  const document = parseJsonDocument(input);
  const operationDocument = document.valid
    ? applyPatchOperations(document.value, existingOperations)
    : document.value;
  const selectedValue = document.valid
    ? resolvePointer(operationDocument, path).value
    : undefined;

  if (op === "add" || op === "replace" || op === "test") {
    return { op, path, value: selectedValue ?? null };
  }

  if (op === "remove") {
    return { op, path };
  }

  return {
    from: path,
    op,
    path: siblingDestinationPath(document.value, path, op),
  };
}
