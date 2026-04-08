import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  access: vi.fn(),
  mkdir: vi.fn(),
  spawn: vi.fn()
}));

vi.mock("node:fs/promises", () => ({
  default: {
    access: mocks.access,
    mkdir: mocks.mkdir
  }
}));

vi.mock("node:child_process", () => ({
  spawn: mocks.spawn
}));

import { syncRepos } from "../src/core/repos/repo-sync.js";

describe("syncRepos", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mkdir.mockResolvedValue();
  });

  it("clones missing repos and reports them as cloned", async () => {
    mocks.access.mockRejectedValueOnce(new Error("missing"));
    mocks.spawn.mockReturnValue(createSuccessfulChild());

    const report = await syncRepos([
      {
        name: "sqs-codec",
        url: "git@github.com:leanish/sqs-codec.git",
        directory: "/workspace/repos/sqs-codec",
        defaultBranch: "main"
      }
    ]);

    expect(report).toEqual([
      {
        name: "sqs-codec",
        directory: "/workspace/repos/sqs-codec",
        action: "cloned",
        detail: "main"
      }
    ]);
    expect(mocks.spawn).toHaveBeenCalledWith("git", [
      "clone",
      "--branch",
      "main",
      "--single-branch",
      "git@github.com:leanish/sqs-codec.git",
      "/workspace/repos/sqs-codec"
    ], expect.objectContaining({
      stdio: ["ignore", "pipe", "pipe"]
    }));
  });

  it("updates existing repos and reports them as updated", async () => {
    mocks.access.mockResolvedValue();
    mocks.spawn
      .mockReturnValueOnce(createSuccessfulChild({ stdoutChunks: ["false\n"] }))
      .mockReturnValueOnce(createSuccessfulChild())
      .mockReturnValueOnce(createSuccessfulChild())
      .mockReturnValueOnce(createSuccessfulChild());

    const report = await syncRepos([
      {
        name: "sqs-codec",
        url: "git@github.com:leanish/sqs-codec.git",
        directory: "/workspace/repos/sqs-codec",
        defaultBranch: "main"
      }
    ]);

    expect(report).toEqual([
      {
        name: "sqs-codec",
        directory: "/workspace/repos/sqs-codec",
        action: "updated",
        detail: "main"
      }
    ]);
    expect(mocks.spawn.mock.calls.map(call => call[1])).toEqual([
      ["-C", "/workspace/repos/sqs-codec", "rev-parse", "--is-shallow-repository"],
      ["-C", "/workspace/repos/sqs-codec", "fetch", "origin", "main"],
      ["-C", "/workspace/repos/sqs-codec", "checkout", "main"],
      ["-C", "/workspace/repos/sqs-codec", "merge", "--ff-only", "origin/main"]
    ]);
  });

  it("unshallows existing shallow repos before updating them", async () => {
    mocks.access.mockResolvedValue();
    mocks.spawn
      .mockReturnValueOnce(createSuccessfulChild({ stdoutChunks: ["true\n"] }))
      .mockReturnValueOnce(createSuccessfulChild())
      .mockReturnValueOnce(createSuccessfulChild())
      .mockReturnValueOnce(createSuccessfulChild());

    const report = await syncRepos([
      {
        name: "sqs-codec",
        url: "git@github.com:leanish/sqs-codec.git",
        directory: "/workspace/repos/sqs-codec",
        defaultBranch: "main"
      }
    ]);

    expect(report).toEqual([
      {
        name: "sqs-codec",
        directory: "/workspace/repos/sqs-codec",
        action: "updated",
        detail: "main"
      }
    ]);
    expect(mocks.spawn.mock.calls.map(call => call[1])).toEqual([
      ["-C", "/workspace/repos/sqs-codec", "rev-parse", "--is-shallow-repository"],
      ["-C", "/workspace/repos/sqs-codec", "fetch", "--unshallow", "origin", "main"],
      ["-C", "/workspace/repos/sqs-codec", "checkout", "main"],
      ["-C", "/workspace/repos/sqs-codec", "merge", "--ff-only", "origin/main"]
    ]);
  });

  it("records failures instead of throwing for individual repos", async () => {
    mocks.access.mockResolvedValue();
    mocks.spawn
      .mockReturnValueOnce(createSuccessfulChild({ stdoutChunks: ["false\n"] }))
      .mockReturnValueOnce(createFailingChild("fetch failed"));

    const report = await syncRepos([
      {
        name: "sqs-codec",
        url: "git@github.com:leanish/sqs-codec.git",
        directory: "/workspace/repos/sqs-codec",
        defaultBranch: "main"
      }
    ]);

    expect(report).toEqual([
      {
        name: "sqs-codec",
        directory: "/workspace/repos/sqs-codec",
        action: "failed",
        detail: "git -C /workspace/repos/sqs-codec fetch origin main failed: fetch failed"
      }
    ]);
  });

  it("normalizes missing git errors into an install hint", async () => {
    mocks.access.mockRejectedValueOnce(new Error("missing"));
    mocks.spawn.mockReturnValue(createErroringChild(
      Object.assign(new Error("spawn git ENOENT"), { code: "ENOENT" })
    ));

    const report = await syncRepos([
      {
        name: "sqs-codec",
        url: "git@github.com:leanish/sqs-codec.git",
        directory: "/workspace/repos/sqs-codec",
        defaultBranch: "main"
      }
    ]);

    expect(report).toEqual([
      {
        name: "sqs-codec",
        directory: "/workspace/repos/sqs-codec",
        action: "failed",
        detail: 'Git CLI is required but was not found on PATH. Install it with "brew install git", then retry later.'
      }
    ]);
  });

  it("supports non-standard default branches", async () => {
    mocks.access.mockRejectedValueOnce(new Error("missing"));
    mocks.spawn.mockReturnValue(createSuccessfulChild());

    const report = await syncRepos([
      {
        name: "sqs-codec",
        url: "git@github.com:leanish/sqs-codec.git",
        directory: "/workspace/repos/sqs-codec",
        defaultBranch: "develop"
      }
    ]);

    expect(report).toEqual([
      {
        name: "sqs-codec",
        directory: "/workspace/repos/sqs-codec",
        action: "cloned",
        detail: "develop"
      }
    ]);
    expect(mocks.spawn).toHaveBeenCalledTimes(1);
    expect(mocks.spawn).toHaveBeenCalledWith("git", [
      "clone",
      "--branch",
      "develop",
      "--single-branch",
      "git@github.com:leanish/sqs-codec.git",
      "/workspace/repos/sqs-codec"
    ], expect.objectContaining({
      stdio: ["ignore", "pipe", "pipe"]
    }));
  });

  it("records a clear failure when the tracked branch is missing", async () => {
    const report = await syncRepos([
      {
        name: "sqs-codec",
        url: "git@github.com:leanish/sqs-codec.git",
        directory: "/workspace/repos/sqs-codec",
        defaultBranch: ""
      }
    ]);

    expect(report).toEqual([
      {
        name: "sqs-codec",
        directory: "/workspace/repos/sqs-codec",
        action: "failed",
        detail: "Managed repo sqs-codec is missing a default branch. Update its config entry with defaultBranch, then retry."
      }
    ]);
    expect(mocks.spawn).not.toHaveBeenCalled();
  });
});

function createSuccessfulChild(options = {}) {
  return createChild({ exitCode: 0, ...options });
}

function createFailingChild(stderr) {
  return createChild({ exitCode: 1, stderrChunks: [stderr] });
}

function createChild({ exitCode, stdoutChunks = [], stderrChunks = [] }) {
  const stdoutHandlers = [];
  const stderrHandlers = [];
  const closeHandlers = [];
  const errorHandlers = [];

  setTimeout(() => {
    stdoutChunks.forEach(chunk => {
      stdoutHandlers.forEach(handler => handler(Buffer.from(chunk)));
    });
    stderrChunks.forEach(chunk => {
      stderrHandlers.forEach(handler => handler(Buffer.from(chunk)));
    });
    closeHandlers.forEach(handler => handler(exitCode));
  }, 0);

  return {
    stdout: {
      on: vi.fn((event, handler) => {
        if (event === "data") {
          stdoutHandlers.push(handler);
        }
      })
    },
    stderr: {
      on: vi.fn((event, handler) => {
        if (event === "data") {
          stderrHandlers.push(handler);
        }
      })
    },
    on: vi.fn((event, handler) => {
      if (event === "close") {
        closeHandlers.push(handler);
      }
      if (event === "error") {
        errorHandlers.push(handler);
      }
    }),
    emitError(error) {
      errorHandlers.forEach(handler => handler(error));
    }
  };
}

function createErroringChild(error) {
  const stdoutHandlers = [];
  const stderrHandlers = [];
  const closeHandlers = [];
  const errorHandlers = [];

  setTimeout(() => {
    errorHandlers.forEach(handler => handler(error));
  }, 0);

  return {
    stdout: {
      on: vi.fn((event, handler) => {
        if (event === "data") {
          stdoutHandlers.push(handler);
        }
      })
    },
    stderr: {
      on: vi.fn((event, handler) => {
        if (event === "data") {
          stderrHandlers.push(handler);
        }
      })
    },
    on: vi.fn((event, handler) => {
      if (event === "close") {
        closeHandlers.push(handler);
      }
      if (event === "error") {
        errorHandlers.push(handler);
      }
    })
  };
}
