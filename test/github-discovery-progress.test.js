import { describe, expect, it, vi } from "vitest";

import { createGithubDiscoveryProgressReporter } from "../src/github-discovery-progress.js";

describe("github-discovery-progress", () => {
  it("prints line-based progress updates for non-interactive output", () => {
    const output = {
      write: vi.fn(),
      isTTY: false
    };
    const reporter = createGithubDiscoveryProgressReporter({
      output,
      isInteractive: false
    });

    reporter.start("leanish");
    reporter.onProgress({
      type: "discovery-listed",
      discoveredCount: 3,
      eligibleCount: 2,
      inspectRepos: false
    });
    reporter.onProgress({
      type: "repo-processed",
      processedCount: 1,
      totalCount: 2,
      repoName: "archa"
    });
    reporter.onProgress({
      type: "repo-processed",
      processedCount: 2,
      totalCount: 2,
      repoName: "terminator"
    });
    reporter.finish();

    expect(output.write).toHaveBeenNthCalledWith(1, "Discovering GitHub repos for leanish...\n");
    expect(output.write).toHaveBeenNthCalledWith(2, "Found 3 repo(s); loading GitHub metadata for 2 eligible repo(s)...\n");
    expect(output.write).toHaveBeenNthCalledWith(3, "Loading repos: 1/2 (archa)\n");
    expect(output.write).toHaveBeenNthCalledWith(4, "Loading repos: 2/2 (terminator)\n");
  });

  it("uses inline progress updates for interactive output and finishes with a newline", () => {
    const output = {
      write: vi.fn(),
      isTTY: true
    };
    const reporter = createGithubDiscoveryProgressReporter({
      output,
      isInteractive: true
    });

    reporter.start("leanish");
    reporter.onProgress({
      type: "repo-processed",
      processedCount: 1,
      totalCount: 2,
      repoName: "archa"
    });
    reporter.finish();

    expect(output.write).toHaveBeenNthCalledWith(1, "Discovering GitHub repos for leanish...\n");
    expect(output.write).toHaveBeenNthCalledWith(2, "\rLoading repos: 1/2 (archa)");
    expect(output.write).toHaveBeenNthCalledWith(3, "\n");
  });

  it("clears leftover characters when a shorter repo name overwrites a longer one", () => {
    const output = {
      write: vi.fn(),
      isTTY: true
    };
    const reporter = createGithubDiscoveryProgressReporter({
      output,
      isInteractive: true
    });
    const firstMessage = "Loading repos: 1/2 (java-conventions)";
    const finalMessage = "Loading repos: 2/2 (terminator)";

    reporter.onProgress({
      type: "repo-processed",
      processedCount: 1,
      totalCount: 2,
      repoName: "java-conventions"
    });
    reporter.onProgress({
      type: "repo-processed",
      processedCount: 2,
      totalCount: 2,
      repoName: "terminator"
    });

    expect(output.write).toHaveBeenNthCalledWith(1, `\r${firstMessage}`);
    expect(output.write).toHaveBeenNthCalledWith(2, `\r${finalMessage.padEnd(firstMessage.length)}\n`);
  });

  it("shows curated discovery progress when repo inspection is enabled", () => {
    const output = {
      write: vi.fn(),
      isTTY: false
    };
    const reporter = createGithubDiscoveryProgressReporter({
      output,
      isInteractive: false
    });

    reporter.start("leanish");
    reporter.onProgress({
      type: "discovery-listed",
      discoveredCount: 1,
      eligibleCount: 1,
      inspectRepos: true
    });
    reporter.onProgress({
      type: "repo-curated",
      processedCount: 1,
      totalCount: 1,
      repoName: "archa"
    });

    expect(output.write).toHaveBeenNthCalledWith(1, "Discovering GitHub repos for leanish...\n");
    expect(output.write).toHaveBeenNthCalledWith(2, "Found 1 repo(s); loading and curating metadata for 1 eligible repo(s)...\n");
    expect(output.write).toHaveBeenNthCalledWith(3, "Curating repos: 1/1 (archa)\n");
  });
});
