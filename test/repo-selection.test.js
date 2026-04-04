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

  it("uses all configured repos when no explicit repo names are provided", () => {
    const repos = selectRepos(config, "totally unrelated question", null);

    expect(repos.map(repo => repo.name)).toEqual(["sqs-codec", "archa", "java-conventions"]);
  });

  it("preserves configured repo order when using all repos by default", () => {
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

    expect(repos.map(repo => repo.name)).toEqual(["java-conventions", "archa"]);
  });
});
