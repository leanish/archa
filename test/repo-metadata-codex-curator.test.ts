import { describe, expect, it, vi } from "vitest";

import { curateRepoMetadataWithCodex } from "../src/core/discovery/repo-metadata-codex-curator.js";
import { createEmptyRepoRouting } from "../src/core/repos/repo-routing.js";

describe("repo-metadata-codex-curator", () => {
  it("accepts Codex-curated routing metadata and normalizes it", async () => {
    const runCodexPromptFn = vi.fn(async () => ({
      text: JSON.stringify({
        description: "Shared Gradle plugin conventions for JDK-based projects.",
        routing: {
          role: " shared-library ",
          reach: ["shared-library", "shared-library"],
          responsibilities: ["Provides reusable Gradle conventions.", "Provides reusable Gradle conventions."],
          owns: ["Gradle plugin", "gradle plugin", "build defaults"],
          exposes: ["Gradle plugin"],
          consumes: ["Gradle"],
          workflows: ["Handles build convention workflows."],
          boundaries: ["Do not select only because another repo depends on this library."],
          selectWhen: ["The question is about build defaults."],
          selectWithOtherReposWhen: ["Use with application repos when debugging convention consumption."]
        }
      })
    }));

    const metadata = await curateRepoMetadataWithCodex({
      directory: "/workspace/repos/java-conventions",
      repo: {
        name: "java-conventions",
        url: "https://github.com/leanish/java-conventions.git",
        defaultBranch: "main"
      },
      sourceRepo: {
        size: 245
      },
      inferredMetadata: {
        description: "Shared Gradle conventions for JDK-based projects",
        routing: createEmptyRepoRouting()
      },
      runCodexPromptFn
    });

    expect(runCodexPromptFn).toHaveBeenCalledWith(expect.objectContaining({
      workingDirectory: "/workspace/repos/java-conventions",
      reasoningEffort: "none",
      timeoutMs: 60_000
    }));
    expect(metadata).toEqual({
      description: "Shared Gradle plugin conventions for JDK-based projects.",
      routing: {
        role: "shared-library",
        reach: ["shared-library"],
        responsibilities: ["Provides reusable Gradle conventions."],
        owns: ["Gradle plugin", "build defaults"],
        exposes: ["Gradle plugin"],
        consumes: ["Gradle"],
        workflows: ["Handles build convention workflows."],
        boundaries: ["Do not select only because another repo depends on this library."],
        selectWhen: ["The question is about build defaults."],
        selectWithOtherReposWhen: ["Use with application repos when debugging convention consumption."]
      }
    });
  });

  it("falls back to inferred metadata when Codex does not return valid JSON", async () => {
    const inferredMetadata = {
      description: "Terminator is a small Java library.",
      routing: {
        role: "shared-library",
        reach: ["shared-library"],
        responsibilities: ["Provides reusable shutdown helpers."],
        owns: ["shutdown coordination"],
        exposes: [],
        consumes: [],
        workflows: [],
        boundaries: [],
        selectWhen: [],
        selectWithOtherReposWhen: []
      }
    };

    const metadata = await curateRepoMetadataWithCodex({
      directory: "/workspace/repos/terminator",
      repo: {
        name: "terminator",
        url: "https://github.com/leanish/terminator.git",
        defaultBranch: "main"
      },
      inferredMetadata,
      runCodexPromptFn: vi.fn(async () => ({
        text: "not json"
      }))
    });

    expect(metadata).toEqual(inferredMetadata);
  });

  it("lets Codex clear routing arrays explicitly", async () => {
    const metadata = await curateRepoMetadataWithCodex({
      directory: "/workspace/repos/noisy-repo",
      repo: {
        name: "noisy-repo",
        url: "https://github.com/leanish/noisy-repo.git",
        defaultBranch: "main"
      },
      inferredMetadata: {
        description: "Shared utilities",
        routing: {
          role: "shared-library",
          reach: ["shared-library"],
          responsibilities: ["Provides shared utilities."],
          owns: ["utilities"],
          exposes: ["npm package"],
          consumes: ["Node.js"],
          workflows: ["Handles utility workflows."],
          boundaries: ["Do not select for app-specific behavior."],
          selectWhen: ["The question is about utilities."],
          selectWithOtherReposWhen: ["Use with app repos when tracing consumers."]
        }
      },
      runCodexPromptFn: vi.fn(async () => ({
        text: JSON.stringify({
          description: "Shared utilities",
          routing: {
            role: "shared-library",
            reach: [],
            responsibilities: [],
            owns: [],
            exposes: [],
            consumes: [],
            workflows: [],
            boundaries: [],
            selectWhen: [],
            selectWithOtherReposWhen: []
          }
        })
      }))
    });

    expect(metadata).toEqual({
      description: "Shared utilities",
      routing: {
        role: "shared-library",
        reach: [],
        responsibilities: [],
        owns: [],
        exposes: [],
        consumes: [],
        workflows: [],
        boundaries: [],
        selectWhen: [],
        selectWithOtherReposWhen: []
      }
    });
  });
});
