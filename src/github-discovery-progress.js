import process from "node:process";

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

  return {
    start(owner) {
      output.write(`Discovering GitHub repos for ${owner}...\n`);
    },
    startCuration(selectedCount) {
      output.write(`Refining selected repo metadata for ${selectedCount} repo(s)...\n`);
    },
    onProgress(event) {
      if (!event || typeof event !== "object") {
        return;
      }

      if (event.type === "discovery-listed") {
        output.write(
          `Found ${event.discoveredCount} repo(s); loading GitHub metadata for ${event.eligibleCount} eligible repo(s)...\n`
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
        const message = `Refining repos: ${event.processedCount}/${event.totalCount} (${event.repoName})`;
        if (isInteractive) {
          writeInlineProgress(message, event.processedCount === event.totalCount);
          return;
        }

        output.write(`${message}\n`);
      }
    },
    finish() {
      if (!hasActiveInlineProgress) {
        return;
      }

      hasActiveInlineProgress = false;
      lastInlineMessageLength = 0;
      output.write("\n");
    }
  };
}
