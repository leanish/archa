import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  existsSync: vi.fn()
}));

vi.mock("node:fs", () => ({
  default: {
    existsSync: mocks.existsSync
  }
}));

import { renderAnswer, renderRepoList, renderRetrievalOnly, renderSyncReport } from "../src/render.js";

describe("render", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders repo list entries with local state and aliases", () => {
    mocks.existsSync.mockReturnValue(true);

    const output = renderRepoList([
      {
        name: "sqs-codec",
        directory: "/workspace/repos/sqs-codec",
        aliases: ["codec"],
        defaultBranch: "main",
        description: "SQS execution interceptor with compression and checksum metadata"
      }
    ]);

    expect(output).toContain("Managed repos:");
    expect(output).toContain("- sqs-codec [local] main: aliases=codec SQS execution interceptor with compression and checksum metadata");
  });

  it("renders retrieval-only mode with selected repos and sync report", () => {
    const output = renderRetrievalOnly({
      question: "How does x-codec-meta work?",
      selectedRepos: [{ name: "sqs-codec" }, { name: "java-conventions" }],
      syncReport: [
        {
          name: "sqs-codec",
          action: "updated",
          detail: "main"
        }
      ]
    });

    expect(output).toContain("Question: How does x-codec-meta work?");
    expect(output).toContain("Selected repos: sqs-codec, java-conventions");
    expect(output).toContain("Sync report:");
    expect(output).toContain("sqs-codec: updated (main)");
  });

  it("renders answer mode and sync details", () => {
    const output = renderAnswer({
      synthesis: {
        text: "Final answer"
      },
      selectedRepos: [{ name: "sqs-codec" }],
      syncReport: [
        {
          name: "sqs-codec",
          action: "skipped"
        }
      ]
    });

    expect(output).toContain("Final answer");
    expect(output).toContain("Repos used: sqs-codec");
    expect(output).toContain("sqs-codec: skipped");
  });

  it("renders sync report details only when present", () => {
    expect(renderSyncReport([
      { name: "sqs-codec", action: "updated", detail: "main" },
      { name: "java-conventions", action: "skipped" }
    ])).toBe([
      "Sync report:",
      "- sqs-codec: updated (main)",
      "- java-conventions: skipped"
    ].join("\n"));
  });
});
