import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";

export async function syncRepos(repos, callbacks = {}) {
  const report = [];

  for (const repo of repos) {
    try {
      const trunkBranch = getTrunkBranch(repo);

      await fs.mkdir(path.dirname(repo.directory), { recursive: true });

      if (!(await exists(repo.directory))) {
        callbacks.onRepoStart?.(repo, "clone", trunkBranch);
        await runCommand("git", [
          "clone",
          "--branch",
          trunkBranch,
          "--single-branch",
          repo.url,
          repo.directory
        ]);
        const item = {
          name: repo.name,
          directory: repo.directory,
          action: "cloned",
          detail: trunkBranch
        };
        report.push(item);
        callbacks.onRepoResult?.(item);
        continue;
      }

      callbacks.onRepoStart?.(repo, "update", trunkBranch);
      await runCommand("git", ["-C", repo.directory, "fetch", "origin", trunkBranch]);
      await runCommand("git", ["-C", repo.directory, "checkout", trunkBranch]);
      await runCommand("git", ["-C", repo.directory, "merge", "--ff-only", `origin/${trunkBranch}`]);

      const item = {
        name: repo.name,
        directory: repo.directory,
        action: "updated",
        detail: trunkBranch
      };
      report.push(item);
      callbacks.onRepoResult?.(item);
    } catch (error) {
      const item = {
        name: repo.name,
        directory: repo.directory,
        action: "failed",
        detail: error instanceof Error ? error.message : String(error)
      };
      report.push(item);
      callbacks.onRepoResult?.(item);
    }
  }

  return report;
}

function getTrunkBranch(repo) {
  const branch = repo.defaultBranch || repo.branch;
  if (branch !== "main" && branch !== "master") {
    throw new Error(`Unsupported branch for managed repo ${repo.name}: ${branch}. Only main/master are supported.`);
  }
  return branch;
}

async function exists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function runCommand(command, args) {
  await new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...process.env,
        GIT_TERMINAL_PROMPT: "0"
      }
    });

    let stderr = "";

    child.stderr.on("data", chunk => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", code => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${command} ${args.join(" ")} failed: ${stderr.trim()}`));
    });
  });
}
