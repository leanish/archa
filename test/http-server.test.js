import { PassThrough } from "node:stream";
import { afterEach, describe, expect, it } from "vitest";

import { createAskJobManager } from "../src/ask-job-manager.js";
import { createHttpHandler } from "../src/http-server.js";

describe("http-server", () => {
  const managers = [];

  afterEach(async () => {
    while (managers.length > 0) {
      managers.pop().close();
    }
  });

  it("creates async ask jobs and exposes them over HTTP", async () => {
    const manager = createAskJobManager({
      answerQuestionFn: async ({ question }, { statusReporter }) => {
        statusReporter.info("selected repos");

        return {
          mode: "answer",
          question,
          selectedRepos: [{ name: "archa" }],
          syncReport: [{ name: "archa", action: "skipped" }],
          synthesis: {
            text: "Final answer"
          }
        };
      },
      jobRetentionMs: 60_000
    });
    managers.push(manager);
    const handler = createHttpHandler({ jobManager: manager });

    const createResponse = await performRequest(handler, {
      method: "POST",
      path: "/ask",
      body: {
        question: "How does archa work?",
        repoNames: ["archa"],
        noSync: true
      }
    });
    const createdJob = JSON.parse(createResponse.body);

    expect(createResponse.statusCode).toBe(202);
    expect(["queued", "running"]).toContain(createdJob.status);
    expect(createdJob.links.self).toBe(`/jobs/${createdJob.id}`);

    await waitFor(async () => {
      const jobResponse = await performRequest(handler, {
        method: "GET",
        path: createdJob.links.self
      });
      const job = JSON.parse(jobResponse.body);
      return job.status === "completed";
    });

    const finalResponse = await performRequest(handler, {
      method: "GET",
      path: createdJob.links.self
    });
    const finalJob = JSON.parse(finalResponse.body);

    expect(finalResponse.statusCode).toBe(200);
    expect(finalJob).toMatchObject({
      id: createdJob.id,
      status: "completed",
      result: {
        synthesis: {
          text: "Final answer"
        }
      }
    });
  });

  it("streams job events over server-sent events", async () => {
    let releaseJob;
    const jobReleased = new Promise(resolve => {
      releaseJob = resolve;
    });
    const manager = createAskJobManager({
      answerQuestionFn: async ({ question }, { statusReporter }) => {
        statusReporter.info(`running ${question}`);
        await jobReleased;
        statusReporter.info(`done ${question}`);

        return {
          mode: "answer",
          question,
          selectedRepos: [],
          syncReport: [],
          synthesis: {
            text: "streamed answer"
          }
        };
      },
      jobRetentionMs: 60_000
    });
    managers.push(manager);
    const handler = createHttpHandler({ jobManager: manager });

    const createResponse = await performRequest(handler, {
      method: "POST",
      path: "/jobs",
      body: {
        question: "stream this"
      }
    });
    const createdJob = JSON.parse(createResponse.body);
    const sseRequest = startRequest(handler, {
      method: "GET",
      path: createdJob.links.events,
      headers: {
        Accept: "text/event-stream"
      }
    });
    const eventsPromise = collectSseEvents(sseRequest.response, "completed");

    releaseJob();

    const events = await eventsPromise;

    expect(sseRequest.response.statusCode).toBe(200);
    expect(events.map(event => event.type)).toContain("snapshot");
    expect(events.map(event => event.type)).toContain("status");
    expect(events.map(event => event.type)).toContain("completed");
    expect(events.find(event => event.type === "snapshot")?.data.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "status",
          message: "running stream this"
        })
      ])
    );
    expect(events.filter(event => event.type === "status").map(event => event.data.message)).toContain("done stream this");
  });

  it("rejects invalid ask payloads", async () => {
    const manager = createAskJobManager({
      answerQuestionFn: async () => ({
        mode: "answer",
        question: "ignored",
        selectedRepos: [],
        syncReport: [],
        synthesis: {
          text: "ignored"
        }
      })
    });
    managers.push(manager);
    const handler = createHttpHandler({ jobManager: manager });

    const response = await performRequest(handler, {
      method: "POST",
      path: "/ask",
      body: {
        question: ""
      }
    });
    const body = JSON.parse(response.body);

    expect(response.statusCode).toBe(400);
    expect(body.error).toContain("non-empty \"question\"");
  });
});

async function waitFor(predicate) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (await predicate()) {
      return;
    }

    await new Promise(resolve => {
      setTimeout(resolve, 0);
    });
  }

  throw new Error("Condition not met in time.");
}

async function collectSseEvents(response, untilType) {
  const events = [];
  let buffer = "";

  return await new Promise((resolve, reject) => {
    response.on("data", chunk => {
      buffer += chunk.toString("utf8");

      let delimiterIndex = buffer.indexOf("\n\n");
      while (delimiterIndex >= 0) {
        const rawEvent = buffer.slice(0, delimiterIndex);
        buffer = buffer.slice(delimiterIndex + 2);

        const event = parseSseEvent(rawEvent);
        if (event) {
          events.push(event);
          if (event.type === untilType) {
            resolve(events);
            return;
          }
        }

        delimiterIndex = buffer.indexOf("\n\n");
      }
    });

    response.on("end", () => {
      resolve(events);
    });
    response.on("error", reject);
  });
}

function parseSseEvent(rawEvent) {
  const lines = rawEvent.split("\n");
  let type = "message";
  let data = "";

  for (const line of lines) {
    if (!line || line.startsWith(":")) {
      continue;
    }

    if (line.startsWith("event:")) {
      type = line.slice("event:".length).trim();
      continue;
    }

    if (line.startsWith("data:")) {
      data += line.slice("data:".length).trim();
    }
  }

  if (!data) {
    return null;
  }

  return {
    type,
    data: JSON.parse(data)
  };
}

async function performRequest(handler, options) {
  const exchange = startRequest(handler, options);
  await exchange.completed;
  return exchange.response;
}

function startRequest(handler, { method, path, headers = {}, body = null }) {
  const request = new PassThrough();
  request.method = method;
  request.url = path;
  request.headers = headers;

  const response = createMockResponse();
  const completed = new Promise((resolve, reject) => {
    response.on("finish", () => {
      resolve();
    });
    response.on("error", reject);
  });

  void handler(request, response);

  queueMicrotask(() => {
    if (body != null) {
      request.write(JSON.stringify(body));
    }

    request.end();
  });

  return {
    request,
    response,
    completed
  };
}

function createMockResponse() {
  const response = new PassThrough();

  response.statusCode = 200;
  response.headers = {};
  response.body = "";
  response.setHeader = (name, value) => {
    response.headers[name.toLowerCase()] = value;
  };
  response.writeHead = (statusCode, headers = {}) => {
    response.statusCode = statusCode;

    for (const [name, value] of Object.entries(headers)) {
      response.setHeader(name, value);
    }

    return response;
  };

  response.on("data", chunk => {
    response.body += chunk.toString("utf8");
  });
  response.on("finish", () => {
    response.emit("close");
  });

  return response;
}
