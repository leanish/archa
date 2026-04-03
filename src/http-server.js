import http from "node:http";

import { createAskJobManager } from "./ask-job-manager.js";

const DEFAULT_HOST = "127.0.0.1";
const DEFAULT_PORT = 8787;
const DEFAULT_BODY_LIMIT_BYTES = 65_536;

export async function startHttpServer({
  env = process.env,
  host = null,
  port = null,
  bodyLimitBytes = null,
  jobManager = null,
  answerQuestionFn = null,
  maxConcurrentJobs = null,
  jobRetentionMs = null
} = {}) {
  const resolvedHost = host || env.ARCHA_SERVER_HOST || DEFAULT_HOST;
  const resolvedPort = port ?? getOptionalPositiveInteger(env.ARCHA_SERVER_PORT, "ARCHA_SERVER_PORT") ?? DEFAULT_PORT;
  const resolvedBodyLimitBytes = bodyLimitBytes
    ?? getOptionalPositiveInteger(env.ARCHA_SERVER_BODY_LIMIT_BYTES, "ARCHA_SERVER_BODY_LIMIT_BYTES")
    ?? DEFAULT_BODY_LIMIT_BYTES;
  const resolvedMaxConcurrentJobs = maxConcurrentJobs
    ?? getOptionalPositiveInteger(env.ARCHA_SERVER_MAX_CONCURRENT_JOBS, "ARCHA_SERVER_MAX_CONCURRENT_JOBS")
    ?? undefined;
  const resolvedJobRetentionMs = jobRetentionMs
    ?? getOptionalPositiveInteger(env.ARCHA_SERVER_JOB_RETENTION_MS, "ARCHA_SERVER_JOB_RETENTION_MS")
    ?? undefined;
  const resolvedJobManager = jobManager || createAskJobManager({
    env,
    answerQuestionFn: answerQuestionFn || undefined,
    maxConcurrentJobs: resolvedMaxConcurrentJobs,
    jobRetentionMs: resolvedJobRetentionMs
  });
  const handler = createHttpHandler({
    bodyLimitBytes: resolvedBodyLimitBytes,
    jobManager: resolvedJobManager
  });
  const sockets = new Set();
  const server = http.createServer((request, response) => {
    void handler(request, response);
  });

  server.on("connection", socket => {
    sockets.add(socket);
    socket.on("close", () => {
      sockets.delete(socket);
    });
  });

  await new Promise((resolve, reject) => {
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
    async close() {
      resolvedJobManager.close();

      await new Promise(resolve => {
        server.close(() => {
          resolve();
        });

        for (const socket of sockets) {
          socket.destroy();
        }
      });
    }
  };
}

export function createHttpHandler({ jobManager, bodyLimitBytes = DEFAULT_BODY_LIMIT_BYTES }) {
  return async function handleHttpRequest(request, response) {
    await handleRequest({
      request,
      response,
      jobManager,
      bodyLimitBytes
    });
  };
}

async function handleRequest({ request, response, jobManager, bodyLimitBytes }) {
  setCorsHeaders(response);

  if (request.method === "OPTIONS") {
    response.writeHead(204);
    response.end();
    return;
  }

  const url = new URL(request.url || "/", "http://archa.local");

  try {
    if (request.method === "GET" && url.pathname === "/") {
      writeJson(response, 200, {
        service: "archa-server",
        endpoints: {
          createJob: "POST /ask",
          createJobAlias: "POST /jobs",
          getJob: "GET /jobs/:id",
          streamJob: "GET /jobs/:id/events",
          health: "GET /health"
        }
      });
      return;
    }

    if (request.method === "GET" && url.pathname === "/health") {
      writeJson(response, 200, { status: "ok" });
      return;
    }

    if (request.method === "POST" && (url.pathname === "/ask" || url.pathname === "/jobs")) {
      const payload = normalizeAskRequest(await readJsonBody(request, bodyLimitBytes));
      const job = jobManager.createJob(payload);
      writeJson(response, 202, withJobLinks(job));
      return;
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

async function streamJobEvents(response, jobManager, jobId) {
  const job = jobManager.getJob(jobId);
  if (!job) {
    throw new HttpError(404, `Unknown job: ${jobId}`);
  }

  response.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive"
  });

  response.write("retry: 1000\n\n");
  writeSseEvent(response, "snapshot", withJobLinks(job));

  if (isTerminalStatus(job.status)) {
    writeSseEvent(response, job.status, withJobLinks(job));
    response.end();
    return;
  }

  const keepAliveTimer = setInterval(() => {
    response.write(": keep-alive\n\n");
  }, 15_000);
  keepAliveTimer.unref?.();

  const unsubscribe = jobManager.subscribe(jobId, event => {
    writeSseEvent(response, event.type, event);

    if (!isTerminalStatus(event.type)) {
      return;
    }

    const currentJob = jobManager.getJob(jobId);
    if (currentJob) {
      writeSseEvent(response, "snapshot", withJobLinks(currentJob));
    }

    clearInterval(keepAliveTimer);
    unsubscribe?.();
    response.end();
  });

  response.on("close", () => {
    clearInterval(keepAliveTimer);
    unsubscribe?.();
  });
}

async function readJsonBody(request, bodyLimitBytes) {
  const chunks = [];
  let totalBytes = 0;

  return new Promise((resolve, reject) => {
    request.on("data", chunk => {
      totalBytes += chunk.length;
      if (totalBytes > bodyLimitBytes) {
        reject(new HttpError(413, `Request body exceeds ${bodyLimitBytes} bytes.`));
        request.destroy();
        return;
      }

      chunks.push(chunk);
    });

    request.on("end", () => {
      if (chunks.length === 0) {
        reject(new HttpError(400, "Request body must be valid JSON."));
        return;
      }

      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        reject(new HttpError(400, `Request body must be valid JSON: ${message}`));
      }
    });

    request.on("error", error => {
      reject(error);
    });
  });
}

function normalizeAskRequest(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new HttpError(400, "Request body must be a JSON object.");
  }

  if (body.repoNames && body.repos) {
    throw new HttpError(400, 'Use either "repoNames" or "repos", not both.');
  }

  if (typeof body.question !== "string" || body.question.trim() === "") {
    throw new HttpError(400, 'Request body must include a non-empty "question" string.');
  }

  return {
    question: body.question,
    repoNames: normalizeRepoNames(body.repoNames ?? body.repos),
    model: normalizeOptionalString(body.model, "model"),
    reasoningEffort: normalizeOptionalString(body.reasoningEffort, "reasoningEffort"),
    noSync: normalizeOptionalBoolean(body.noSync, "noSync"),
    noSynthesis: normalizeOptionalBoolean(body.noSynthesis, "noSynthesis")
  };
}

function normalizeRepoNames(value) {
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

function normalizeOptionalString(value, label) {
  if (value == null) {
    return null;
  }

  if (typeof value !== "string" || value.trim() === "") {
    throw new HttpError(400, `"${label}" must be a non-empty string when provided.`);
  }

  return value;
}

function normalizeOptionalBoolean(value, label) {
  if (value == null) {
    return false;
  }

  if (typeof value !== "boolean") {
    throw new HttpError(400, `"${label}" must be a boolean when provided.`);
  }

  return value;
}

function matchJobPath(pathname, suffix = "") {
  const pattern = suffix
    ? new RegExp(`^/jobs/([^/]+)${escapeRegExp(suffix)}$`, "u")
    : /^\/jobs\/([^/]+)$/u;
  const match = pathname.match(pattern);

  return match ? decodeURIComponent(match[1]) : null;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

function withJobLinks(job) {
  return {
    ...job,
    links: {
      self: `/jobs/${encodeURIComponent(job.id)}`,
      events: `/jobs/${encodeURIComponent(job.id)}/events`
    }
  };
}

function setCorsHeaders(response) {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type,Accept");
}

function writeJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8"
  });
  response.end(`${JSON.stringify(payload, null, 2)}\n`);
}

function writeSseEvent(response, type, payload) {
  response.write(`event: ${type}\n`);
  response.write(`data: ${JSON.stringify(payload)}\n\n`);
}

function formatServerUrl(server) {
  const address = server.address();
  if (!address || typeof address === "string") {
    return null;
  }

  const host = address.family === "IPv6" ? `[${address.address}]` : address.address;
  return `http://${host}:${address.port}`;
}

function getOptionalPositiveInteger(value, label) {
  if (value == null || value === "") {
    return null;
  }

  if (!/^\d+$/u.test(String(value))) {
    throw new Error(`Invalid ${label}: ${value}. Use a positive integer.`);
  }

  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Invalid ${label}: ${value}. Use a positive integer.`);
  }

  return parsed;
}

function isTerminalStatus(status) {
  return status === "completed" || status === "failed";
}

class HttpError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
  }
}
