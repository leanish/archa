import http from "node:http";
import type { IncomingMessage } from "node:http";

import {
  DEFAULT_ANSWER_AUDIENCE,
  isSupportedAnswerAudience,
  SUPPORTED_ANSWER_AUDIENCES
} from "../../core/answer/answer-audience.ts";
import { loadConfig } from "../../core/config/config.ts";
import { parseEnvPort, parseEnvPositiveInteger } from "../../core/env/parse-env.ts";
import { createAskJobManager } from "../../core/jobs/ask-job-manager.ts";
import { SUPPORTED_SELECTION_STRATEGIES, isSelectionStrategy } from "../../core/repos/selection-strategies.ts";
import { HTML_UI } from "../ui/html.ts";
import {
  createWebUploadStore,
  DEFAULT_WEB_UPLOAD_LIMIT_BYTES,
  shouldInlineUploadText,
  type WebUploadRecord,
  type WebUploadStore
} from "./web-upload-store.ts";
import type {
  AskJobManager,
  AskJobSnapshot,
  AskRequest,
  AnswerQuestionFn,
  Environment,
  LoadedConfig,
  ManagedRepoDefinition,
  RepoSelectionStrategy
} from "../../core/types.ts";

type HttpRequestLike = {
  method?: string | undefined;
  url?: string | undefined;
  headers: IncomingMessage["headers"];
  on(event: "data", handler: (chunk: Buffer) => void): unknown;
  on(event: "end", handler: () => void): unknown;
  on(event: "error", handler: (error: Error) => void): unknown;
  destroy(): void;
};
type HttpResponseLike = {
  destroyed?: boolean | undefined;
  writableEnded?: boolean | undefined;
  writeHead(statusCode: number, headers?: Record<string, string>): unknown;
  end(chunk?: string): unknown;
  write(chunk: string): boolean;
  setHeader(name: string, value: string): unknown;
  on(event: "close", handler: () => void): unknown;
  on(event: "error", handler: (error: Error) => void): unknown;
};
type HttpJobManager = Pick<AskJobManager, "createJob" | "getJob" | "subscribe"> & Partial<Pick<AskJobManager, "getStats">>;

const DEFAULT_HOST = "127.0.0.1";
const DEFAULT_PORT = 8787;
const DEFAULT_BODY_LIMIT_BYTES = 65_536;

type LoadedRepoList = Pick<LoadedConfig, "repos">;
type LoadedServerConfig = Pick<LoadedConfig, "repos" | "configPath">;
type LoadServerConfigFn = (env: Environment) => Promise<LoadedServerConfig>;
type LoadRepoListFn = (env: Environment) => Promise<LoadedRepoList>;
type StartHttpServerOptions = {
  env?: Environment;
  host?: string | null;
  port?: number | null;
  bodyLimitBytes?: number | null;
  uploadLimitBytes?: number | null;
  jobManager?: AskJobManager | null;
  answerQuestionFn?: AnswerQuestionFn | null;
  loadConfigFn?: LoadServerConfigFn;
  maxConcurrentJobs?: number | null;
  jobRetentionMs?: number | null;
};
type CreateHttpHandlerOptions = {
  jobManager: HttpJobManager;
  bodyLimitBytes?: number;
  uploadLimitBytes?: number;
  env?: Environment;
  loadConfigFn?: LoadRepoListFn;
  uploadStore?: WebUploadStore;
};
type HandleRequestOptions = {
  request: HttpRequestLike;
  response: HttpResponseLike;
  jobManager: HttpJobManager;
  bodyLimitBytes: number;
  uploadLimitBytes: number;
  env: Environment;
  loadConfigFn: LoadRepoListFn;
  uploadStore: WebUploadStore;
};

export interface HttpServerHandle {
  jobManager: AskJobManager;
  server: http.Server;
  url: string | null;
  configuredRepoCount: number;
  configPath: string | null;
  close(): Promise<void>;
}

export async function startHttpServer({
  env = process.env,
  host = null,
  port = null,
  bodyLimitBytes = null,
  uploadLimitBytes = null,
  jobManager = null,
  answerQuestionFn = null,
  loadConfigFn = loadConfig,
  maxConcurrentJobs = null,
  jobRetentionMs = null
}: StartHttpServerOptions = {}): Promise<HttpServerHandle> {
  const resolvedHost = host || env.ATC_SERVER_HOST || DEFAULT_HOST;
  const resolvedPort = port
    ?? getOptionalPort(env.ATC_SERVER_PORT, "ATC_SERVER_PORT")
    ?? DEFAULT_PORT;
  const resolvedBodyLimitBytes = bodyLimitBytes
    ?? getOptionalPositiveInteger(env.ATC_SERVER_BODY_LIMIT_BYTES, "ATC_SERVER_BODY_LIMIT_BYTES")
    ?? DEFAULT_BODY_LIMIT_BYTES;
  const resolvedUploadLimitBytes = uploadLimitBytes
    ?? getOptionalPositiveInteger(env.ATC_SERVER_UPLOAD_LIMIT_BYTES, "ATC_SERVER_UPLOAD_LIMIT_BYTES")
    ?? DEFAULT_WEB_UPLOAD_LIMIT_BYTES;
  const resolvedMaxConcurrentJobs = maxConcurrentJobs
    ?? getOptionalPositiveInteger(env.ATC_SERVER_MAX_CONCURRENT_JOBS, "ATC_SERVER_MAX_CONCURRENT_JOBS")
    ?? undefined;
  const resolvedJobRetentionMs = jobRetentionMs
    ?? getOptionalPositiveInteger(env.ATC_SERVER_JOB_RETENTION_MS, "ATC_SERVER_JOB_RETENTION_MS")
    ?? undefined;
  const loadedConfig = await loadConfigFn(env);
  const uploadStore = createWebUploadStore();
  const resolvedJobManager = jobManager ?? createAskJobManager({
    env,
    answerQuestionFn: answerQuestionFn ?? undefined,
    maxConcurrentJobs: resolvedMaxConcurrentJobs,
    jobRetentionMs: resolvedJobRetentionMs
  });
  const handler = createHttpHandler({
    bodyLimitBytes: resolvedBodyLimitBytes,
    env,
    jobManager: resolvedJobManager,
    loadConfigFn,
    uploadLimitBytes: resolvedUploadLimitBytes,
    uploadStore
  });
  const server = http.createServer((request, response) => {
    void handler(request, response);
  });

  await new Promise<void>((resolve, reject) => {
    server.on("error", reject);
    server.listen(resolvedPort, resolvedHost, () => {
      server.off("error", reject);
      resolve();
    });
  });

  return {
    jobManager: resolvedJobManager,
    server,
    url: formatServerUrl(server),
    configuredRepoCount: loadedConfig.repos.length,
    configPath: loadedConfig.configPath ?? null,
    async close(): Promise<void> {
      const shutdownPromise = typeof resolvedJobManager.shutdown === "function"
        ? resolvedJobManager.shutdown()
        : Promise.resolve();

      await Promise.all([
        shutdownPromise,
        new Promise<void>(resolve => {
          server.close(() => {
            resolve();
          });
          server.closeIdleConnections?.();
        })
      ]);

      uploadStore.close();
      resolvedJobManager.close();
    }
  };
}

export function createHttpHandler({
  jobManager,
  bodyLimitBytes = DEFAULT_BODY_LIMIT_BYTES,
  uploadLimitBytes = DEFAULT_WEB_UPLOAD_LIMIT_BYTES,
  env = process.env,
  loadConfigFn = loadConfig,
  uploadStore = createWebUploadStore()
}: CreateHttpHandlerOptions): (request: HttpRequestLike, response: HttpResponseLike) => Promise<void> {
  return async function handleHttpRequest(request: HttpRequestLike, response: HttpResponseLike): Promise<void> {
    await handleRequest({
      request,
      response,
      jobManager,
      bodyLimitBytes,
      uploadLimitBytes,
      env,
      loadConfigFn,
      uploadStore
    });
  };
}

async function handleRequest({
  request,
  response,
  jobManager,
  bodyLimitBytes,
  uploadLimitBytes,
  env,
  loadConfigFn,
  uploadStore
}: HandleRequestOptions): Promise<void> {
  setCorsHeaders(response);

  if (request.method === "OPTIONS") {
    response.writeHead(204);
    response.end();
    return;
  }

  try {
    const url = parseRequestUrl(request.url);

    if (request.method === "GET" && url.pathname === "/") {
      if (prefersHtml(request)) {
        response.writeHead(200, {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-cache"
        });
        response.end(HTML_UI);
        return;
      }

      writeJson(response, 200, {
        service: "atc-server",
        endpoints: {
          createJob: "POST /ask",
          getJob: "GET /jobs/:id",
          listRepos: "GET /repos",
          uploadFiles: "POST /uploads",
          deleteUpload: "DELETE /uploads/:id",
          streamJob: "GET /jobs/:id/events",
          health: "GET /health"
        }
      });
      return;
    }

    if (request.method === "GET" && url.pathname === "/health") {
      writeJson(response, 200, {
        status: "ok",
        jobs: typeof jobManager.getStats === "function" ? jobManager.getStats() : null
      });
      return;
    }

    if (request.method === "GET" && url.pathname === "/repos") {
      const config = await loadConfigFn(env);
      writeJson(response, 200, {
        repos: config.repos.map(serializeRepoSummary),
        setupHint: config.repos.length === 0 ? getEmptyConfigSetupHint() : null
      });
      return;
    }

    if (request.method === "POST" && url.pathname === "/uploads") {
      const uploads = await readUploadedFiles(request, uploadLimitBytes);
      writeJson(response, 201, {
        uploads: await Promise.all(uploads.map(async upload => uploadStore.addUpload(await toWebUploadInput(upload))))
      });
      return;
    }

    const uploadId = matchUploadPath(url.pathname);
    if (request.method === "DELETE" && uploadId) {
      uploadStore.deleteUpload(uploadId);
      response.writeHead(204);
      response.end();
      return;
    }

    if (request.method === "POST" && url.pathname === "/ask") {
      const body = await readJsonBody(request, bodyLimitBytes);
      const payload = normalizeAskRequest(body);
      const uploads = resolveReferencedUploads(body, uploadStore);
      const job = jobManager.createJob({
        ...payload,
        question: uploads.length > 0 ? appendUploadContext(payload.question, uploads) : payload.question
      });
      writeJson(response, 202, withJobLinks(job));
      return;
    }

    if (request.method === "POST" && url.pathname === "/jobs") {
      throw new HttpError(410, "POST /jobs was removed. Use POST /ask.");
    }

    const jobId = matchJobPath(url.pathname, "/events");
    if (request.method === "GET" && jobId) {
      await streamJobEvents(response, jobManager, jobId);
      return;
    }

    const plainJobId = matchJobPath(url.pathname);
    if (request.method === "GET" && plainJobId) {
      const job = jobManager.getJob(plainJobId);
      if (!job) {
        throw new HttpError(404, `Unknown job: ${plainJobId}`);
      }

      writeJson(response, 200, withJobLinks(job));
      return;
    }

    throw new HttpError(404, `No route for ${request.method} ${url.pathname}`);
  } catch (error) {
    const statusCode = error instanceof HttpError ? error.statusCode : 500;
    const message = error instanceof Error ? error.message : String(error);
    writeJson(response, statusCode, { error: message });
  }
}

async function streamJobEvents(response: HttpResponseLike, jobManager: HttpJobManager, jobId: string): Promise<void> {
  const job = jobManager.getJob(jobId);
  if (!job) {
    throw new HttpError(404, `Unknown job: ${jobId}`);
  }

  let streamClosed = false;
  let keepAliveTimer: NodeJS.Timeout | undefined;
  let unsubscribe: (() => void) | null = null;

  response.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive"
  });

  if (!writeResponseChunk(response, "retry: 1000\n\n", () => streamClosed)) {
    return;
  }

  if (!writeSseEvent(response, "snapshot", withJobLinks(job), () => streamClosed)) {
    return;
  }

  if (isTerminalStatus(job.status)) {
    writeSseEvent(response, job.status, withJobLinks(job), () => streamClosed);
    endSseStream(response, cleanupStream, () => streamClosed);
    return;
  }

  keepAliveTimer = setInterval(() => {
    if (!writeResponseChunk(response, ": keep-alive\n\n", () => streamClosed)) {
      cleanupStream();
    }
  }, 15_000);
  keepAliveTimer.unref?.();

  unsubscribe = jobManager.subscribe(jobId, event => {
    if (!writeSseEvent(response, event.type, event, () => streamClosed)) {
      cleanupStream();
      return;
    }

    if (!isTerminalStatus(event.type)) {
      return;
    }

    const currentJob = jobManager.getJob(jobId);
    if (currentJob && !writeSseEvent(response, "snapshot", withJobLinks(currentJob), () => streamClosed)) {
      endSseStream(response, cleanupStream, () => streamClosed);
      return;
    }

    endSseStream(response, cleanupStream, () => streamClosed);
  });
  if (!unsubscribe) {
    endSseStream(response, cleanupStream, () => streamClosed);
    return;
  }

  response.on("close", cleanupStream);
  response.on("error", cleanupStream);

  function cleanupStream(): void {
    if (streamClosed) {
      return;
    }

    streamClosed = true;
    clearInterval(keepAliveTimer);
    unsubscribe?.();
  }
}

async function readJsonBody(request: HttpRequestLike, bodyLimitBytes: number): Promise<unknown> {
  const bodyBuffer = await readBufferedBody(request, bodyLimitBytes, "Request body must be valid JSON.");

  try {
    return JSON.parse(bodyBuffer.toString("utf8"));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new HttpError(400, `Request body must be valid JSON: ${message}`);
  }
}

async function readBufferedBody(
  request: HttpRequestLike,
  bodyLimitBytes: number,
  emptyBodyMessage: string
): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let totalBytes = 0;

  return new Promise<Buffer>((resolve, reject) => {
    let settled = false;

    request.on("data", (chunk: Buffer) => {
      if (settled) {
        return;
      }

      totalBytes += chunk.length;
      if (totalBytes > bodyLimitBytes) {
        settleReject(new HttpError(413, `Request body exceeds ${bodyLimitBytes} bytes.`));
        request.destroy();
        return;
      }

      chunks.push(chunk);
    });

    request.on("end", () => {
      if (settled) {
        return;
      }

      if (chunks.length === 0) {
        settleReject(new HttpError(400, emptyBodyMessage));
        return;
      }

      settled = true;
      resolve(Buffer.concat(chunks));
    });

    request.on("error", error => {
      settleReject(error);
    });

    function settleReject(error: unknown): void {
      if (settled) {
        return;
      }

      settled = true;
      reject(error);
    }
  });
}

async function readUploadedFiles(request: HttpRequestLike, uploadLimitBytes: number): Promise<File[]> {
  const contentType = request.headers["content-type"];
  const normalizedContentType = Array.isArray(contentType) ? contentType.join(", ") : contentType || "";
  if (!normalizedContentType.toLowerCase().includes("multipart/form-data")) {
    throw new HttpError(400, "Upload requests must use multipart/form-data.");
  }

  const bodyBuffer = await readBufferedBody(request, uploadLimitBytes, "Upload request must include multipart form data.");
  const headers = new Headers();
  for (const [name, value] of Object.entries(request.headers)) {
    if (Array.isArray(value)) {
      headers.set(name, value.join(", "));
      continue;
    }

    if (typeof value === "string") {
      headers.set(name, value);
    }
  }

  try {
    const parsedRequest = new Request("http://atc.local/uploads", {
      method: request.method ?? "POST",
      headers,
      body: bodyBuffer
    });
    const formData = await parsedRequest.formData();
    const files = Array.from(formData.values()).filter((value): value is File => value instanceof File);
    if (files.length === 0) {
      throw new HttpError(400, "Upload request must include at least one file.");
    }

    return files;
  } catch (error) {
    if (error instanceof HttpError) {
      throw error;
    }

    const message = error instanceof Error ? error.message : String(error);
    throw new HttpError(400, `Upload request must be valid multipart form data: ${message}`);
  }
}

function normalizeAskRequest(body: unknown): AskRequest {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new HttpError(400, "Request body must be a JSON object.");
  }

  const requestBody = body as Record<string, unknown>;

  if (hasOwn(requestBody, "repoNames") && hasOwn(requestBody, "repos")) {
    throw new HttpError(400, 'Use either "repoNames" or "repos", not both.');
  }

  if (typeof requestBody.question !== "string" || requestBody.question.trim() === "") {
    throw new HttpError(400, 'Request body must include a non-empty "question" string.');
  }

  const audience = normalizeAudience(requestBody.audience);

  return {
    question: requestBody.question,
    repoNames: normalizeRepoNames(requestBody.repoNames ?? requestBody.repos),
    ...(audience === undefined ? {} : { audience }),
    model: normalizeOptionalString(requestBody.model, "model"),
    reasoningEffort: normalizeOptionalString(requestBody.reasoningEffort, "reasoningEffort"),
    selectionMode: normalizeSelectionMode(requestBody.selectionMode),
    selectionShadowCompare: normalizeOptionalBoolean(requestBody.selectionShadowCompare, "selectionShadowCompare"),
    noSync: normalizeOptionalBoolean(requestBody.noSync, "noSync"),
    noSynthesis: normalizeOptionalBoolean(requestBody.noSynthesis, "noSynthesis")
  };
}

function resolveReferencedUploads(body: unknown, uploadStore: WebUploadStore): WebUploadRecord[] {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return [];
  }

  const uploadIds = normalizeAttachmentIds((body as Record<string, unknown>).attachmentIds);
  if (uploadIds.length === 0) {
    return [];
  }

  const uploads = uploadStore.getUploads(uploadIds);
  if (uploads.length !== uploadIds.length) {
    throw new HttpError(400, "One or more attachmentIds do not exist or have expired.");
  }

  return uploads;
}

function normalizeAttachmentIds(value: unknown): string[] {
  if (value == null) {
    return [];
  }

  if (!Array.isArray(value)) {
    throw new HttpError(400, '"attachmentIds" must be an array of non-empty strings.');
  }

  const uploadIds = value.map(uploadId => {
    if (typeof uploadId !== "string" || uploadId.trim() === "") {
      throw new HttpError(400, '"attachmentIds" must be an array of non-empty strings.');
    }

    return uploadId.trim();
  });

  return Array.from(new Set(uploadIds));
}

function normalizeRepoNames(value: unknown): string[] | null {
  if (value == null) {
    return null;
  }

  if (typeof value === "string") {
    const repoNames = value
      .split(",")
      .map(name => name.trim())
      .filter(Boolean);

    return repoNames.length > 0 ? repoNames : null;
  }

  if (Array.isArray(value) && value.every(item => typeof item === "string" && item.trim() !== "")) {
    return value.map(item => item.trim());
  }

  throw new HttpError(400, '"repoNames" must be a comma-separated string or an array of non-empty strings.');
}

function normalizeAudience(value: unknown): AskRequest["audience"] {
  if (value == null) {
    return DEFAULT_ANSWER_AUDIENCE;
  }

  if (typeof value !== "string" || value.trim() === "") {
    throw new HttpError(400, `"audience" must be one of: ${SUPPORTED_ANSWER_AUDIENCES.join(", ")}.`);
  }

  const audience = value.trim();
  if (!isSupportedAnswerAudience(audience)) {
    throw new HttpError(400, `"audience" must be one of: ${SUPPORTED_ANSWER_AUDIENCES.join(", ")}.`);
  }

  return audience;
}

function normalizeOptionalString(value: unknown, label: string): string | null {
  if (value == null) {
    return null;
  }

  if (typeof value !== "string" || value.trim() === "") {
    throw new HttpError(400, `"${label}" must be a non-empty string when provided.`);
  }

  return value;
}

function normalizeOptionalBoolean(value: unknown, label: string): boolean {
  if (value == null) {
    return false;
  }

  if (typeof value !== "boolean") {
    throw new HttpError(400, `"${label}" must be a boolean when provided.`);
  }

  return value;
}

function normalizeSelectionMode(value: unknown): RepoSelectionStrategy {
  if (value == null) {
    return "single";
  }

  if (isSelectionStrategy(value)) {
    return value;
  }

  throw new HttpError(400, `"selectionMode" must be one of: ${SUPPORTED_SELECTION_STRATEGIES.join(", ")}.`);
}

const JOB_PATH_PATTERN = /^\/jobs\/([^/]+)$/u;
const JOB_EVENTS_PATH_PATTERN = /^\/jobs\/([^/]+)\/events$/u;
const UPLOAD_PATH_PATTERN = /^\/uploads\/([^/]+)$/u;

function matchJobPath(pathname: string, suffix: "" | "/events" = ""): string | null {
  const pattern = suffix === "/events" ? JOB_EVENTS_PATH_PATTERN : JOB_PATH_PATTERN;
  const match = pathname.match(pattern);

  if (!match || !match[1]) {
    return null;
  }

  return decodeURIComponent(match[1]);
}

function matchUploadPath(pathname: string): string | null {
  const match = pathname.match(UPLOAD_PATH_PATTERN);
  if (!match || !match[1]) {
    return null;
  }

  return decodeURIComponent(match[1]);
}

function withJobLinks(job: AskJobSnapshot): AskJobSnapshot & { links: { self: string; events: string } } {
  return {
    ...job,
    links: {
      self: `/jobs/${encodeURIComponent(job.id)}`,
      events: `/jobs/${encodeURIComponent(job.id)}/events`
    }
  };
}

function serializeRepoSummary(
  repo: Pick<ManagedRepoDefinition, "name" | "defaultBranch" | "description" | "aliases">
): Pick<ManagedRepoDefinition, "name" | "defaultBranch" | "description" | "aliases"> {
  return {
    name: repo.name,
    defaultBranch: repo.defaultBranch,
    description: repo.description,
    aliases: repo.aliases
  };
}

function getEmptyConfigSetupHint(): string {
  return 'No configured repos available. Try "atc config discover-github" to discover and add repos.';
}

async function toWebUploadInput(upload: File): Promise<{
  mediaType: string;
  name: string;
  sizeBytes: number;
  textContent: string | null;
}> {
  return {
    mediaType: upload.type,
    name: upload.name,
    sizeBytes: upload.size,
    textContent: shouldInlineUploadedText(upload) ? await upload.text() : null
  };
}

function shouldInlineUploadedText(upload: File): boolean {
  return upload.size <= DEFAULT_WEB_UPLOAD_LIMIT_BYTES
    && upload.size <= 512_000
    && shouldInlineUploadText(upload.name, upload.type);
}

function appendUploadContext(question: string, uploads: WebUploadRecord[]): string {
  const attachmentBlocks = uploads.map(upload => {
    const header = `- ${upload.name} (${upload.mediaType}, ${formatUploadSize(upload.sizeBytes)})`;
    if (upload.textContent) {
      return [
        header,
        `Attached text content from ${upload.name}:`,
        '"""',
        upload.textContent,
        '"""'
      ].join("\n");
    }

    const detail = upload.kind === "image"
      ? "Image attachment uploaded through the built-in web UI. Only the filename, media type, and size are forwarded to the prompt."
      : "Binary attachment uploaded through the built-in web UI. Only the filename, media type, and size are forwarded to the prompt.";

    return `${header}\n${detail}`;
  });

  return [
    question.trim(),
    "",
    "Attached files from the built-in web UI:",
    "Use these uploads as additional context when answering the question.",
    "",
    ...attachmentBlocks
  ].join("\n");
}

function formatUploadSize(sizeBytes: number): string {
  if (sizeBytes < 1_024) {
    return `${sizeBytes} B`;
  }

  if (sizeBytes < 1_024 * 1_024) {
    return `${(sizeBytes / 1_024).toFixed(1)} KB`;
  }

  return `${(sizeBytes / (1_024 * 1_024)).toFixed(1)} MB`;
}

function setCorsHeaders(response: HttpResponseLike): void {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Methods", "GET,POST,DELETE,OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type,Accept");
}

function writeJson(response: HttpResponseLike, statusCode: number, payload: unknown): void {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8"
  });
  response.end(`${JSON.stringify(payload, null, 2)}\n`);
}

function writeSseEvent(
  response: HttpResponseLike,
  type: string,
  payload: unknown,
  isClosed: () => boolean = () => false
): boolean {
  return writeResponseChunk(
    response,
    `event: ${type}\ndata: ${JSON.stringify(payload)}\n\n`,
    isClosed
  );
}

function formatServerUrl(server: http.Server): string | null {
  const address = server.address();
  if (!address || typeof address === "string") {
    return null;
  }

  const host = address.family === "IPv6" ? `[${address.address}]` : address.address;
  return `http://${host}:${address.port}`;
}

function parseRequestUrl(value: string | undefined): URL {
  try {
    return new URL(value || "/", "http://atc.local");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new HttpError(400, `Invalid request URL: ${message}`);
  }
}

function hasOwn(object: object, property: string): boolean {
  return Object.prototype.hasOwnProperty.call(object, property);
}

function getOptionalPort(value: string | undefined, label: string): number | null {
  return parseEnvPort(value, label);
}

function getOptionalPositiveInteger(value: string | undefined, label: string): number | null {
  return parseEnvPositiveInteger(value, { label });
}

function isTerminalStatus(status: string): boolean {
  return status === "completed" || status === "failed";
}

function writeResponseChunk(response: HttpResponseLike, chunk: string, isClosed: () => boolean): boolean {
  if (isResponseClosed(response, isClosed)) {
    return false;
  }

  response.write(chunk);
  return !isResponseClosed(response, isClosed);
}

function endSseStream(response: HttpResponseLike, cleanup: () => void, isClosed: () => boolean): void {
  if (isResponseClosed(response, isClosed)) {
    cleanup();
    return;
  }

  cleanup();
  response.end();
}

function isResponseClosed(response: HttpResponseLike, isClosed: () => boolean): boolean {
  return isClosed() || response.destroyed === true || response.writableEnded === true;
}

function prefersHtml(request: HttpRequestLike): boolean {
  const accept = request.headers.accept || "";
  return accept.includes("text/html");
}

class HttpError extends Error {
  statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
  }
}
