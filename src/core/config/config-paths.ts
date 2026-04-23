import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import type { Environment } from "../types.js";

export function getConfigPath(env: Environment = process.env): string {
  if (env.ATC_CONFIG_PATH) {
    return env.ATC_CONFIG_PATH;
  }
  if (env.ARCHA_CONFIG_PATH) {
    return env.ARCHA_CONFIG_PATH;
  }

  const configHome = env.XDG_CONFIG_HOME || path.join(os.homedir(), ".config");
  const configPath = path.join(configHome, "atc", "config.json");
  const legacyConfigPath = path.join(configHome, "archa", "config.json");
  if (existsSync(configPath) || !existsSync(legacyConfigPath)) {
    return configPath;
  }

  return legacyConfigPath;
}

export function getDefaultManagedReposRoot(env: Environment = process.env): string {
  const dataHome = env.XDG_DATA_HOME || path.join(os.homedir(), ".local", "share");
  return path.join(dataHome, "atc", "repos");
}
