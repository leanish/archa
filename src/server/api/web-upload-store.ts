import { randomUUID } from "node:crypto";
import path from "node:path";

const DEFAULT_UPLOAD_RETENTION_MS = 4 * 60 * 60 * 1_000;
const MAX_INLINE_TEXT_CHARACTERS = 24_000;

const INLINE_TEXT_MEDIA_PREFIXES = [
  "text/"
] as const;

const INLINE_TEXT_EXTENSIONS = new Set([
  ".cjs",
  ".conf",
  ".css",
  ".csv",
  ".html",
  ".java",
  ".js",
  ".json",
  ".jsx",
  ".log",
  ".markdown",
  ".md",
  ".mjs",
  ".sh",
  ".sql",
  ".svg",
  ".ts",
  ".tsx",
  ".txt",
  ".xml",
  ".yaml",
  ".yml"
]);

const IMAGE_MEDIA_PREFIX = "image/";

export const DEFAULT_WEB_UPLOAD_LIMIT_BYTES = 15 * 1_024 * 1_024;
export const SUPPORTED_WEB_UPLOAD_ACCEPT = [
  ".pdf",
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".txt",
  ".md",
  ".markdown",
  ".json",
  ".yml",
  ".yaml",
  ".xml",
  ".csv",
  ".tsv",
  ".js",
  ".jsx",
  ".ts",
  ".tsx",
  ".css",
  ".html",
  ".log",
  ".mp4",
  ".mov"
].join(",");

export const SUPPORTED_WEB_UPLOAD_LABEL = "PDF, PNG, JPG, MP4, MOV, TXT";

export type WebUploadKind = "text" | "image" | "binary";

export interface WebUploadInput {
  mediaType: string;
  name: string;
  sizeBytes: number;
  textContent: string | null;
}

export interface WebUploadSummary {
  id: string;
  kind: WebUploadKind;
  mediaType: string;
  name: string;
  sizeBytes: number;
}

export interface WebUploadRecord extends WebUploadSummary {
  createdAtMs: number;
  textContent: string | null;
}

export interface WebUploadStore {
  addUpload(input: WebUploadInput): WebUploadSummary;
  close(): void;
  deleteUpload(uploadId: string): boolean;
  getUploads(uploadIds: string[]): WebUploadRecord[];
}

type CreateWebUploadStoreOptions = {
  nowMs?: () => number;
  retentionMs?: number;
};

export function createWebUploadStore({
  nowMs = Date.now,
  retentionMs = DEFAULT_UPLOAD_RETENTION_MS
}: CreateWebUploadStoreOptions = {}): WebUploadStore {
  const uploads = new Map<string, WebUploadRecord>();

  return {
    addUpload,
    close,
    deleteUpload,
    getUploads
  };

  function addUpload(input: WebUploadInput): WebUploadSummary {
    pruneExpired();

    const id = randomUUID();
    const record: WebUploadRecord = {
      id,
      kind: classifyUpload(input.name, input.mediaType, input.textContent),
      mediaType: normalizeMediaType(input.mediaType),
      name: normalizeUploadName(input.name),
      sizeBytes: input.sizeBytes,
      createdAtMs: nowMs(),
      textContent: normalizeInlineText(input.textContent)
    };

    uploads.set(id, record);
    return toUploadSummary(record);
  }

  function getUploads(uploadIds: string[]): WebUploadRecord[] {
    pruneExpired();

    return uploadIds.flatMap(uploadId => {
      const record = uploads.get(uploadId);
      return record ? [record] : [];
    });
  }

  function deleteUpload(uploadId: string): boolean {
    pruneExpired();
    return uploads.delete(uploadId);
  }

  function close(): void {
    uploads.clear();
  }

  function pruneExpired(): void {
    const expiresBeforeMs = nowMs() - retentionMs;
    for (const [uploadId, upload] of uploads.entries()) {
      if (upload.createdAtMs < expiresBeforeMs) {
        uploads.delete(uploadId);
      }
    }
  }
}

function classifyUpload(name: string, mediaType: string, textContent: string | null): WebUploadKind {
  if (textContent !== null) {
    return "text";
  }

  if (normalizeMediaType(mediaType).startsWith(IMAGE_MEDIA_PREFIX) || isImageExtension(name)) {
    return "image";
  }

  return "binary";
}

function isImageExtension(name: string): boolean {
  return [".gif", ".jpeg", ".jpg", ".png", ".webp"].includes(getLowercaseExtension(name));
}

function normalizeMediaType(mediaType: string): string {
  const normalized = mediaType.trim();
  return normalized || "application/octet-stream";
}

function normalizeUploadName(name: string): string {
  const trimmed = path.basename(name.trim());
  return trimmed || "upload";
}

function normalizeInlineText(textContent: string | null): string | null {
  if (textContent === null) {
    return null;
  }

  const normalized = textContent
    .replace(/\u0000/gu, "")
    .replace(/\r\n?/gu, "\n")
    .trim();

  if (!normalized) {
    return null;
  }

  if (normalized.length <= MAX_INLINE_TEXT_CHARACTERS) {
    return normalized;
  }

  return `${normalized.slice(0, MAX_INLINE_TEXT_CHARACTERS)}\n...[truncated by ask-the-code]`;
}

function toUploadSummary(upload: WebUploadRecord): WebUploadSummary {
  return {
    id: upload.id,
    kind: upload.kind,
    mediaType: upload.mediaType,
    name: upload.name,
    sizeBytes: upload.sizeBytes
  };
}

export function shouldInlineUploadText(name: string, mediaType: string): boolean {
  if (INLINE_TEXT_MEDIA_PREFIXES.some(prefix => mediaType.startsWith(prefix))) {
    return true;
  }

  return INLINE_TEXT_EXTENSIONS.has(getLowercaseExtension(name));
}

function getLowercaseExtension(name: string): string {
  return path.extname(name).toLowerCase();
}
