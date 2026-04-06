import { createInterface } from "node:readline/promises";
import process from "node:process";

export function selectGithubDiscoveryRepos(plan, {
  addRepoNames = [],
  overrideRepoNames = []
} = {}) {
  const addableRepos = getAddableRepos(plan);
  const overridableRepos = getOverridableRepos(plan);

  return {
    reposToAdd: resolveSelectedRepos(addRepoNames, addableRepos, "--add", "new"),
    reposToOverride: resolveSelectedRepos(overrideRepoNames, overridableRepos, "--override", "configured")
  };
}

export async function promptGithubDiscoverySelection(plan, {
  input = process.stdin,
  output = process.stdout,
  createInterfaceFn = createInterface
} = {}) {
  if (!input.isTTY || !output.isTTY) {
    throw new Error(
      'Interactive GitHub discovery requires a TTY. Re-run with --apply in a terminal, or pass explicit --add/--override selections.'
    );
  }

  const selectableEntries = getSelectableEntries(plan);
  const readline = createInterfaceFn({
    input,
    output
  });

  try {
    return await promptForSelection(readline, {
      selectableEntries
    });
  } finally {
    readline.close();
  }
}

function getAddableRepos(plan) {
  return plan.entries
    .filter(entry => entry.status === "new")
    .map(entry => entry.repo);
}

function getOverridableRepos(plan) {
  return plan.entries
    .filter(entry => entry.status === "configured")
    .map(entry => entry.repo);
}

function getSelectableEntries(plan) {
  return plan.entries
    .filter(entry => entry.status === "new" || entry.status === "configured")
    .map(entry => ({
      status: entry.status,
      repo: entry.repo
    }));
}

function resolveSelectedRepos(requestedNames, availableRepos, flagName, selectionKind) {
  const normalizedNames = normalizeRequestedNames(requestedNames);
  if (normalizedNames.length === 0) {
    return [];
  }

  if (normalizedNames.length === 1 && normalizedNames[0] === "*") {
    return [...availableRepos];
  }

  const reposByName = new Map(
    availableRepos.map(repo => [repo.name.toLowerCase(), repo])
  );
  const missingNames = [];
  const selectedRepos = [];

  for (const requestedName of normalizedNames) {
    const repo = reposByName.get(requestedName.toLowerCase());
    if (!repo) {
      missingNames.push(requestedName);
      continue;
    }
    if (!selectedRepos.some(candidate => candidate.name === repo.name)) {
      selectedRepos.push(repo);
    }
  }

  if (missingNames.length > 0) {
    const availableNames = availableRepos.map(repo => repo.name).join(", ") || "none";
    throw new Error(
      `Unknown ${selectionKind} repo(s) for ${flagName}: ${missingNames.join(", ")}. Available: ${availableNames}.`
    );
  }

  return selectedRepos;
}

function normalizeRequestedNames(requestedNames) {
  return requestedNames
    .map(name => name.trim())
    .filter(Boolean);
}

async function promptForSelection(readline, {
  selectableEntries
}) {
  if (selectableEntries.length === 0) {
    return {
      reposToAdd: [],
      reposToOverride: []
    };
  }

  const availableNames = selectableEntries.map(entry => entry.repo.name).join(", ");
  const configuredNames = selectableEntries
    .filter(entry => entry.status === "configured")
    .map(entry => entry.repo.name);
  const configuredSummary = configuredNames.length > 0
    ? `\nConfigured already: ${configuredNames.join(", ")}`
    : "";
  const reposByName = new Map(
    selectableEntries.map(entry => [entry.repo.name.toLowerCase(), entry])
  );

  while (true) {
    const answer = await readline.question(
      `Select repos to add or override (comma-separated, "*" for all, blank for none)\n${availableNames}${configuredSummary}\n> `
    );

    try {
      const selectedRepos = resolveSelectedRepos(
        answer.split(","),
        selectableEntries.map(entry => entry.repo),
        "selection",
        "selectable"
      );

      return {
        reposToAdd: selectedRepos
          .filter(repo => reposByName.get(repo.name.toLowerCase())?.status === "new"),
        reposToOverride: selectedRepos
          .filter(repo => reposByName.get(repo.name.toLowerCase())?.status === "configured")
      };
    } catch (error) {
      readline.write(`${error.message}\n`);
    }
  }
}
