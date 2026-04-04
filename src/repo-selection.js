export function selectRepos(config, question, requestedRepoNames) {
  if (requestedRepoNames && requestedRepoNames.length > 0) {
    const requested = new Set(requestedRepoNames.map(name => name.toLowerCase()));
    const selectedRepos = config.repos.filter(repo => repoMatchesAnyName(repo, requested));
    const missing = requestedRepoNames.filter(name => !selectedRepos.some(repo => repoMatchesName(repo, name)));

    if (missing.length > 0) {
      throw new Error(`Unknown managed repo(s): ${missing.join(", ")}`);
    }

    return selectedRepos;
  }

  void question;
  return [...config.repos];
}

function repoMatchesName(repo, name) {
  return repoMatchesAnyName(repo, new Set([name.toLowerCase()]));
}

function repoMatchesAnyName(repo, requestedNames) {
  if (requestedNames.has(repo.name.toLowerCase())) {
    return true;
  }

  return (repo.aliases || []).some(alias => requestedNames.has(alias.toLowerCase()));
}
