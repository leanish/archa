import { describe, expect, it } from "vitest";

import { selectRepos } from "../src/repo-selection.js";

const config = {
  repos: [
    {
      name: "sqs-codec",
      description: "SQS execution interceptor with compression and checksum metadata",
      topics: ["aws", "sqs", "compression", "checksum"]
    },
    {
      name: "archa",
      description: "Repo-aware CLI for engineering Q&A with local Codex",
      topics: ["cli", "codex", "qa"]
    },
    {
      name: "java-conventions",
      description: "Java conventions and build defaults",
      topics: ["java", "conventions"],
      aliases: ["conventions"]
    }
  ]
};

describe("selectRepos", () => {
  it("prefers matching topics", () => {
    const repos = selectRepos(config, "How does SQS compression metadata work?", null);

    expect(repos[0].name).toBe("sqs-codec");
  });

  it("honors explicit repo names", () => {
    const repos = selectRepos(config, "anything", ["archa"]);

    expect(repos.map(repo => repo.name)).toEqual(["archa"]);
  });

  it("honors explicit repo aliases", () => {
    const repos = selectRepos(config, "anything", ["conventions"]);

    expect(repos.map(repo => repo.name)).toEqual(["java-conventions"]);
  });

  it("throws for unknown explicit repos", () => {
    expect(() => selectRepos(config, "anything", ["missing-repo"])).toThrow(/Unknown managed repo/);
  });

  it("falls back to sqs-codec when no repo scores positively", () => {
    const repos = selectRepos(config, "totally unrelated question", null);

    expect(repos.map(repo => repo.name)).toEqual(["sqs-codec"]);
  });

  it("limits automatically selected repos to positively scored matches", () => {
    const repos = selectRepos(config, "Need build defaults details", null);

    expect(repos.map(repo => repo.name)).toEqual(["java-conventions"]);
  });

  it("falls back to the first configured repo instead of a hardcoded repo name", () => {
    const repos = selectRepos({
      repos: [
        {
          name: "java-conventions",
          description: "Java conventions and build defaults",
          topics: ["java", "conventions", "gradle"]
        },
        {
          name: "archa",
          description: "Repo-aware CLI for engineering Q&A with local Codex",
          topics: ["cli", "codex", "qa"]
        }
      ]
    }, "totally unrelated question", null);

    expect(repos.map(repo => repo.name)).toEqual(["java-conventions"]);
  });
});
