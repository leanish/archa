import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  existsSync: vi.fn(),
  getCodexTimeoutMs: vi.fn(),
  loadConfig: vi.fn(),
  runCodexQuestion: vi.fn(),
  selectRepos: vi.fn(),
  syncRepos: vi.fn()
}));

vi.mock("node:fs", () => ({
  default: {
    existsSync: mocks.existsSync
  }
}));

vi.mock("../src/config.js", () => ({
  loadConfig: mocks.loadConfig
}));

vi.mock("../src/codex-runner.js", () => ({
  getCodexTimeoutMs: mocks.getCodexTimeoutMs,
  runCodexQuestion: mocks.runCodexQuestion
}));

vi.mock("../src/repo-selection.js", () => ({
  selectRepos: mocks.selectRepos
}));

vi.mock("../src/repo-sync.js", () => ({
  syncRepos: mocks.syncRepos
}));

import { answerQuestion } from "../src/question-answering.js";

describe("answerQuestion", () => {
  const config = {
    managedReposRoot: "/workspace/repos",
    repos: []
  };
  const selectedRepos = [
    {
      name: "sqs-codec",
      directory: "/workspace/repos/sqs-codec"
    }
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.loadConfig.mockResolvedValue(config);
    mocks.getCodexTimeoutMs.mockReturnValue(300_000);
    mocks.selectRepos.mockReturnValue(selectedRepos);
    mocks.syncRepos.mockResolvedValue([
      {
        name: "sqs-codec",
        directory: "/workspace/repos/sqs-codec",
        action: "updated",
        detail: "main"
      }
    ]);
    mocks.existsSync.mockReturnValue(true);
    mocks.runCodexQuestion.mockResolvedValue({
      text: "Final answer"
    });
  });

  it("runs codex after a successful sync", async () => {
    const statusReporter = { info: vi.fn() };

    const result = await answerQuestion({
      question: "How does x-codec-meta work?",
      model: "gpt-5.4",
      reasoningEffort: "low",
      noSync: false,
      noSynthesis: false,
      repoNames: null
    }, process.env, statusReporter);

    expect(result.mode).toBe("answer");
    expect(mocks.runCodexQuestion).toHaveBeenCalledWith({
      question: "How does x-codec-meta work?",
      model: "gpt-5.4",
      reasoningEffort: "low",
      selectedRepos,
      workspaceRoot: "/workspace/repos",
      timeoutMs: 300_000,
      onStatus: expect.any(Function)
    });
  });

  it("fails before codex when sync leaves a selected repo in failed state", async () => {
    mocks.syncRepos.mockResolvedValue([
      {
        name: "sqs-codec",
        directory: "/workspace/repos/sqs-codec",
        action: "failed",
        detail: "git fetch failed"
      }
    ]);

    await expect(answerQuestion({
      question: "How does x-codec-meta work?",
      model: "gpt-5.4",
      reasoningEffort: "low",
      noSync: false,
      noSynthesis: false,
      repoNames: null
    })).rejects.toThrow("Failed to sync managed repo(s): sqs-codec (git fetch failed)");

    expect(mocks.runCodexQuestion).not.toHaveBeenCalled();
  });

  it("skips sync and marks repos as skipped when requested", async () => {
    const result = await answerQuestion({
      question: "How does x-codec-meta work?",
      model: "gpt-5.4",
      reasoningEffort: "low",
      noSync: true,
      noSynthesis: true,
      repoNames: null
    });

    expect(result).toEqual({
      mode: "retrieval-only",
      question: "How does x-codec-meta work?",
      selectedRepos,
      syncReport: [
        {
          name: "sqs-codec",
          directory: "/workspace/repos/sqs-codec",
          action: "skipped"
        }
      ]
    });
    expect(mocks.syncRepos).not.toHaveBeenCalled();
  });

  it("returns retrieval-only results even when sync reports failures", async () => {
    mocks.syncRepos.mockResolvedValue([
      {
        name: "sqs-codec",
        directory: "/workspace/repos/sqs-codec",
        action: "failed",
        detail: "git fetch failed"
      }
    ]);

    const result = await answerQuestion({
      question: "How does x-codec-meta work?",
      model: "gpt-5.4",
      reasoningEffort: "low",
      noSync: false,
      noSynthesis: true,
      repoNames: null
    });

    expect(result).toEqual({
      mode: "retrieval-only",
      question: "How does x-codec-meta work?",
      selectedRepos,
      syncReport: [
        {
          name: "sqs-codec",
          directory: "/workspace/repos/sqs-codec",
          action: "failed",
          detail: "git fetch failed"
        }
      ]
    });
    expect(mocks.runCodexQuestion).not.toHaveBeenCalled();
  });

  it("fails when no managed repositories are selected", async () => {
    mocks.selectRepos.mockReturnValue([]);

    await expect(answerQuestion({
      question: "How does x-codec-meta work?",
      model: "gpt-5.4",
      reasoningEffort: "low",
      noSync: false,
      noSynthesis: false,
      repoNames: null
    })).rejects.toThrow(
      "No managed repositories matched the question. Use --repo <name> or update the Archa config."
    );
  });

  it("fails when repos are still unavailable locally after sync", async () => {
    mocks.existsSync.mockReturnValue(false);

    await expect(answerQuestion({
      question: "How does x-codec-meta work?",
      model: "gpt-5.4",
      reasoningEffort: "low",
      noSync: false,
      noSynthesis: false,
      repoNames: null
    })).rejects.toThrow(
      "Managed repo(s) unavailable locally after sync: sqs-codec"
    );

    expect(mocks.runCodexQuestion).not.toHaveBeenCalled();
  });
});
