import type {
  DiffJsonResponse,
  FormatJsonErrorResponse,
  FormatJsonResponse,
  PatchJsonResponse,
  PointerJsonResponse,
} from "./types";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3000";
const formatEndpoint = `${apiBaseUrl}/format`;
const diffEndpoint = `${apiBaseUrl}/diff`;
const patchEndpoint = `${apiBaseUrl}/patch`;
const pointerEndpoint = `${apiBaseUrl}/pointer`;

async function readJsonResponse<TSuccess>(
  response: Response,
  fallbackMessage: string,
) {
  const data = (await response.json()) as TSuccess | FormatJsonErrorResponse;

  if (!response.ok) {
    const errorResponse = data as FormatJsonErrorResponse;

    throw Object.assign(
      new Error(
        errorResponse.detail ?? errorResponse.message ?? fallbackMessage,
      ),
      { field: errorResponse.field },
    );
  }

  return data as TSuccess;
}

export async function formatJson(input: string) {
  const response = await fetch(formatEndpoint, {
    body: JSON.stringify({ input }),
    headers: {
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  return readJsonResponse<FormatJsonResponse>(
    response,
    "Jason could not parse this JSON.",
  );
}

export async function diffJson(before: string, after: string) {
  const response = await fetch(diffEndpoint, {
    body: JSON.stringify({ after, before }),
    headers: {
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  return readJsonResponse<DiffJsonResponse>(
    response,
    "Jason could not compare these documents.",
  );
}

export async function patchJson(document: string, patch: string) {
  const response = await fetch(patchEndpoint, {
    body: JSON.stringify({ document, patch }),
    headers: {
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  return readJsonResponse<PatchJsonResponse>(
    response,
    "Jason could not apply this patch.",
  );
}

export async function pointerJson(document: string, path: string) {
  const response = await fetch(pointerEndpoint, {
    body: JSON.stringify({ document, path }),
    headers: {
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  return readJsonResponse<PointerJsonResponse>(
    response,
    "Jason could not resolve this pointer.",
  );
}
