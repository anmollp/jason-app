export const maxJsonPayloadBytes = 5 * 1024 * 1024;
export const maxJsonPayloadLabel = "5 MB";

export function getUtf8ByteLength(value: string) {
  return new TextEncoder().encode(value).length;
}

export function formatByteSize(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  const kilobytes = bytes / 1024;

  if (kilobytes < 1024) {
    return `${formatSizeNumber(kilobytes)} KB`;
  }

  return `${formatSizeNumber(kilobytes / 1024)} MB`;
}

function formatSizeNumber(value: number) {
  return value >= 10 ? value.toFixed(0) : value.toFixed(1);
}
