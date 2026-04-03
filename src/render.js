import fs from "node:fs";

export function renderRepoList(repos) {
  const lines = ["Managed repos:"];

  for (const repo of repos) {
    const status = fs.existsSync(repo.directory) ? "local" : "missing";
    const aliases = repo.aliases && repo.aliases.length > 0 ? ` aliases=${repo.aliases.join(",")}` : "";
    lines.push(`- ${repo.name} [${status}] ${repo.defaultBranch || repo.branch}:${aliases} ${repo.description}`);
  }

  return lines.join("\n");
}

export function renderSyncReport(report) {
  const lines = ["Sync report:"];

  for (const item of report) {
    const detail = item.detail ? ` (${item.detail})` : "";
    lines.push(`- ${item.name}: ${item.action}${detail}`);
  }

  return lines.join("\n");
}

export function renderRetrievalOnly(result) {
  const lines = [
    `Question: ${result.question}`,
    `Selected repos: ${result.selectedRepos.map(repo => repo.name).join(", ")}`,
    ""
  ];

  lines.push(renderSyncReport(result.syncReport));
  return lines.join("\n");
}

export function renderAnswer(result) {
  return [
    result.synthesis.text,
    "",
    `Repos used: ${result.selectedRepos.map(repo => repo.name).join(", ")}`,
    renderSyncReport(result.syncReport)
  ].join("\n");
}
