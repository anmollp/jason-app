import type { PlaygroundErrorField } from "../types";

export function errorField(error: unknown) {
  return error instanceof Error && "field" in error
    ? (error.field as PlaygroundErrorField | undefined)
    : undefined;
}
