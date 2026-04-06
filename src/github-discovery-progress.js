import process from "node:process";

const ACCESSIBLE_GITHUB_OWNER = "@accessible";

export function createGithubDiscoveryProgressReporter({
  output = process.stderr,
  isInteractive = Boolean(output?.isTTY)
} = {}) {
  let hasActiveInlineProgress = false;
  let lastInlineMessageLength = 0;

  function writeInlineProgress(message, isFinalMessage) {
    const paddedMessage = message.padEnd(lastInlineMessageLength);
    output.write(`\r${paddedMessage}${isFinalMessage ? "\n" : ""}`);
    lastInlineMessageLength = isFinalMessage ? 0 : paddedMessage.length;
    hasActiveInlineProgress = !isFinalMessage;
  }

  function closeInlineProgressIfNeeded() {
    if (!hasActiveInlineProgress) {
      return;
    }

    hasActiveInlineProgress = false;
    lastInlineMessageLength = 0;
    output.write("\n");
  }

  return {
    start(owner) {
      if (owner === ACCESSIBLE_GITHUB_OWNER) {
        output.write("Discovering accessible GitHub repos...\n");
        return;
      }

      output.write(`Discovering GitHub repos for ${owner}...\n`);
    },
    onProgress(event) {
      if (!event || typeof event !== "object") {
        return;
      }

      if (event.type === "discovery-fetching") {
        if (isInteractive) {
          writeInlineProgress("Fetching repos...", false);
          return;
        }

        output.write("Fetching repos...\n");
        return;
      }

      if (event.type === "discovery-page") {
        const pageMessage = `Fetching repos, page ${event.page}...`;
        const fetchedMessage = `${event.fetchedCount} repos fetched`;
        if (isInteractive) {
          writeInlineProgress(pageMessage, true);
          output.write(`${fetchedMessage}\n`);
          if (event.hasMorePages) {
            writeInlineProgress(`Fetching repos, page ${event.page + 1}...`, false);
          }
          return;
        }

        output.write(`${pageMessage}\n`);
        output.write(`${fetchedMessage}\n`);
        if (event.hasMorePages) {
          output.write(`Fetching repos, page ${event.page + 1}...\n`);
        }
        return;
      }

      if (event.type === "discovery-listed") {
        closeInlineProgressIfNeeded();

        if (!event.hydrateMetadata) {
          output.write(
            `Found ${event.discoveredCount} repo(s); ready to choose from ${event.eligibleCount} eligible repo(s).\n`
          );
          return;
        }

        const action = event.inspectRepos
          ? "loading and curating metadata"
          : "loading GitHub metadata";
        output.write(
          `Found ${event.discoveredCount} repo(s); ${action} for ${event.eligibleCount} eligible repo(s)...\n`
        );
        return;
      }

      if (event.type === "repo-processed") {
        const message = `Loading repos: ${event.processedCount}/${event.totalCount} (${event.repoName})`;
        if (isInteractive) {
          writeInlineProgress(message, event.processedCount === event.totalCount);
          return;
        }

        output.write(`${message}\n`);
        return;
      }

      if (event.type === "repo-curated") {
        const message = `Curating repos: ${event.processedCount}/${event.totalCount} (${event.repoName})`;
        if (isInteractive) {
          writeInlineProgress(message, event.processedCount === event.totalCount);
          return;
        }

        output.write(`${message}\n`);
        return;
      }

      if (event.type === "repo-applied") {
        const message = `Saving repos: ${event.processedCount}/${event.totalCount} (${event.repoName})`;
        if (isInteractive) {
          writeInlineProgress(message, event.processedCount === event.totalCount);
          return;
        }

        output.write(`${message}\n`);
      }
    },
    finish() {
      closeInlineProgressIfNeeded();
    }
  };
}
