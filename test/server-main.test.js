import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  startHttpServer: vi.fn()
}));

vi.mock("../src/http-server.js", () => ({
  startHttpServer: mocks.startHttpServer
}));

import { main } from "../src/server-main.js";

describe("server-main", () => {
  let stdout;
  let stderr;
  let originalStdoutWrite;
  let originalStderrWrite;

  beforeEach(() => {
    vi.clearAllMocks();
    stdout = [];
    stderr = [];
    originalStdoutWrite = process.stdout.write;
    originalStderrWrite = process.stderr.write;
    process.stdout.write = vi.fn(chunk => {
      stdout.push(chunk);
      return true;
    });
    process.stderr.write = vi.fn(chunk => {
      stderr.push(chunk);
      return true;
    });
  });

  afterEach(() => {
    process.stdout.write = originalStdoutWrite;
    process.stderr.write = originalStderrWrite;
  });

  it("prints the listening url and suggests discovery when no repos are configured", async () => {
    const serverHandle = {
      url: "http://127.0.0.1:8787",
      configuredRepoCount: 0
    };
    mocks.startHttpServer.mockResolvedValue(serverHandle);

    const result = await main([]);

    expect(result).toBe(serverHandle);
    expect(stdout.join("")).toBe("Archa server listening on http://127.0.0.1:8787\n");
    expect(stderr.join("")).toContain('Suggestion: run "archa config discover-github --owner <github-user-or-org> --apply".');
  });

  it("does not print the discovery suggestion when repos are already configured", async () => {
    mocks.startHttpServer.mockResolvedValue({
      url: "http://127.0.0.1:8787",
      configuredRepoCount: 2
    });

    await main([]);

    expect(stderr.join("")).toBe("");
  });
});
