import fs from "node:fs";

import { loadConfig } from "./config.js";
import { getCodexTimeoutMs, runCodexQuestion } from "./codex-runner.js";
import { selectRepos } from "./repo-selection.js";
import { syncRepos } from "./repo-sync.js";

export async function answerQuestion(options, env = process.env, statusReporter = null) {
  const config = await loadConfig(env);
  const selectedRepos = selectRepos(config, options.question, options.repoNames);

  if (selectedRepos.length === 0) {
    throw new Error("No managed repositories matched the question. Use --repo <name> or update the Archa config.");
  }

  statusReporter?.info(`Selected repos: ${selectedRepos.map(repo => repo.name).join(", ")}`);

  const syncReport = options.noSync
    ? selectedRepos.map(repo => ({
        name: repo.name,
        directory: repo.directory,
        action: "skipped"
      }))
    : await syncRepos(selectedRepos, {
        onRepoStart(repo, action, trunkBranch) {
          statusReporter?.info(`${action === "clone" ? "Cloning" : "Updating"} ${repo.name} (${trunkBranch})...`);
        },
        onRepoResult(item) {
          const detail = item.detail ? ` (${item.detail})` : "";
          statusReporter?.info(`${item.name}: ${item.action}${detail}`);
        }
      });

  if (options.noSynthesis) {
    return {
      mode: "retrieval-only",
      question: options.question,
      selectedRepos,
      syncReport
    };
  }

  const failedSyncs = syncReport.filter(item => item.action === "failed");
  if (failedSyncs.length > 0) {
    throw new Error(`Failed to sync managed repo(s): ${formatSyncFailures(failedSyncs)}`);
  }

  const unavailableRepos = selectedRepos.filter(repo => !fs.existsSync(repo.directory));
  if (unavailableRepos.length > 0) {
    throw new Error(
      `Managed repo(s) unavailable locally after sync: ${unavailableRepos.map(repo => repo.name).join(", ")}`
    );
  }

  const synthesis = await runCodexQuestion({
    question: options.question,
    model: options.model,
    reasoningEffort: options.reasoningEffort,
    selectedRepos,
    workspaceRoot: config.managedReposRoot,
    timeoutMs: getCodexTimeoutMs(env),
    onStatus(message) {
      statusReporter?.info(message);
    }
  });

  return {
    mode: "answer",
    question: options.question,
    selectedRepos,
    syncReport,
    synthesis
  };
}

function formatSyncFailures(failedSyncs) {
  return failedSyncs
    .map(item => item.detail ? `${item.name} (${item.detail})` : item.name)
    .join(", ");
}
