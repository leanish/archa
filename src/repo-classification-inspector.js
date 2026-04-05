import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";

import { getDefaultManagedReposRoot } from "./config-paths.js";

const FRONTEND_CONFIG_FILES = [
  "next.config.js",
  "next.config.mjs",
  "next.config.ts",
  "vite.config.js",
  "vite.config.mjs",
  "vite.config.ts",
  "nuxt.config.js",
  "nuxt.config.ts",
  "angular.json",
  "svelte.config.js",
  "svelte.config.ts"
];
const FRONTEND_DIRECTORIES = [
  "app",
  "pages",
  "public",
  "components",
  "src/pages",
  "src/routes",
  "src/components"
];
const MOBILE_DIRECTORIES = ["android", "ios"];
const INFRA_DIRECTORIES = ["terraform", "charts", "helm", "k8s"];
const INFRA_FILE_SUFFIXES = [".tf", ".tfvars", ".yaml", ".yml"];
const INFRA_FILENAMES = ["Dockerfile", "docker-compose.yml", "docker-compose.yaml", "kustomization.yaml", "kustomization.yml"];
const README_CANDIDATES = ["README.md", "README.mdx", "README.txt", "readme.md"];
const FRONTEND_DEPENDENCIES = new Set(["react", "next", "vue", "nuxt", "svelte", "@angular/core", "react-native", "expo"]);
const BACKEND_DEPENDENCIES = new Set(["express", "fastify", "koa", "@nestjs/core", "hono", "graphql-yoga", "apollo-server"]);
const CLI_DEPENDENCIES = new Set(["commander", "yargs", "oclif", "clipanion", "cac"]);
const EXTERNAL_TERMS = [
  "external",
  "customer",
  "shopper",
  "checkout",
  "storefront",
  "onboarding",
  "pricing",
  "catalog",
  "merchant-facing",
  "user-facing",
  "customer-facing",
  "product",
  "public",
  "api",
  "graphql",
  "rest"
];
const INTERNAL_TERMS = ["internal", "employee", "backoffice", "admin-only", "private"];
const LIBRARY_TERMS = ["library", "sdk", "module", "plugin", "package"];
const SERVICE_TERMS = ["microservice", "service", "worker", "daemon"];

export async function inspectRepoClassifications({
  repo,
  sourceRepo = {},
  env = process.env,
  runCommandFn = runCommand,
  fsModule = fs,
  tempDirRoot = os.tmpdir()
}) {
  const inspection = await prepareInspectionDirectory({
    repo,
    env,
    fsModule,
    runCommandFn,
    tempDirRoot
  });

  try {
    return await inferClassificationsFromDirectory({
      directory: inspection.directory,
      repo,
      sourceRepo,
      fsModule
    });
  } catch {
    return [];
  } finally {
    await inspection.cleanup?.();
  }
}

async function prepareInspectionDirectory({ repo, env, fsModule, runCommandFn, tempDirRoot }) {
  const managedRepoDirectory = path.join(getDefaultManagedReposRoot(env), repo.name);
  if (await exists(fsModule, managedRepoDirectory)) {
    return {
      directory: managedRepoDirectory,
      cleanup: null
    };
  }

  const tempRoot = await fsModule.mkdtemp(path.join(tempDirRoot, "archa-discovery-"));
  const cloneDirectory = path.join(tempRoot, repo.name);

  try {
    await runCommandFn("git", [
      "clone",
      "--depth",
      "1",
      "--branch",
      repo.defaultBranch || "main",
      "--single-branch",
      repo.url,
      cloneDirectory
    ]);
  } catch {
    await fsModule.rm(tempRoot, { recursive: true, force: true });
    return {
      directory: managedRepoDirectory,
      cleanup: null
    };
  }

  return {
    directory: cloneDirectory,
    cleanup: () => fsModule.rm(tempRoot, { recursive: true, force: true })
  };
}

async function inferClassificationsFromDirectory({ directory, repo, sourceRepo, fsModule }) {
  if (!(await exists(fsModule, directory))) {
    return [];
  }

  const signals = new Set();
  const classifications = [];
  const hasFrontend = await hasAnyPath(fsModule, directory, FRONTEND_DIRECTORIES)
    || await hasAnyFile(fsModule, directory, FRONTEND_CONFIG_FILES);
  const hasMobile = await hasAnyPath(fsModule, directory, MOBILE_DIRECTORIES);
  const hasInfra = await hasAnyPath(fsModule, directory, INFRA_DIRECTORIES)
    || await hasAnyFile(fsModule, directory, INFRA_FILENAMES)
    || await hasRootFileWithSuffix(fsModule, directory, INFRA_FILE_SUFFIXES);
  const packageJson = await readJson(fsModule, path.join(directory, "package.json"));
  const gradleText = await readTextIfExists(fsModule, path.join(directory, "build.gradle"));
  const gradleKtsText = await readTextIfExists(fsModule, path.join(directory, "build.gradle.kts"));
  const pomText = await readTextIfExists(fsModule, path.join(directory, "pom.xml"));
  const goModText = await readTextIfExists(fsModule, path.join(directory, "go.mod"));
  const readmeText = await readFirstExisting(fsModule, directory, README_CANDIDATES);

  addWords(signals, repo.name);
  addWords(signals, repo.description);
  addWords(signals, readmeText);
  addWords(signals, packageJson?.keywords || []);

  const dependencyNames = collectPackageDependencies(packageJson);
  for (const dependencyName of dependencyNames) {
    signals.add(dependencyName.toLowerCase());
  }

  const gradleSource = `${gradleText}\n${gradleKtsText}`.toLowerCase();
  const pomSource = pomText.toLowerCase();
  const goSource = goModText.toLowerCase();
  const hasBackendFramework = hasMatchingDependency(dependencyNames, BACKEND_DEPENDENCIES)
    || gradleSource.includes("spring-boot")
    || pomSource.includes("spring-boot")
    || goSource.includes("gin-gonic") || goSource.includes("chi");
  const hasCliFramework = hasMatchingDependency(dependencyNames, CLI_DEPENDENCIES)
    || typeof packageJson?.bin === "string"
    || (packageJson?.bin && typeof packageJson.bin === "object")
    || goSource.includes("spf13/cobra");
  const hasLibraryPackaging = hasMatchingDependency(dependencyNames, FRONTEND_DEPENDENCIES) && !hasFrontend
    ? true
    : LIBRARY_TERMS.some(term => signals.has(term))
      || gradleSource.includes("java-library")
      || pomSource.includes("<packaging>jar</packaging>")
      || typeof packageJson?.exports === "object"
      || typeof packageJson?.module === "string"
      || typeof packageJson?.main === "string";
  const hasMicroserviceSignal = SERVICE_TERMS.some(term => signals.has(term))
    || hasBackendFramework && (await hasAnyFile(fsModule, directory, ["Dockerfile"]))
    || pomSource.includes("spring-boot-starter-web")
    || gradleSource.includes("spring-boot-starter-web");

  if (hasInfra) {
    classifications.push("infra");
  }

  if (hasLibraryPackaging && !hasInfra) {
    classifications.push("library");
  }

  if (hasAnyTerm(signals, INTERNAL_TERMS)) {
    classifications.push("internal");
  }

  if (hasCliFramework) {
    classifications.push("cli");
  }

  if (hasFrontend || hasMobile) {
    classifications.push("frontend");
  }

  if (hasBackendFramework) {
    classifications.push("backend");
  }

  if (hasMicroserviceSignal) {
    classifications.push("microservice");
  }

  if ((hasFrontend || hasMobile || hasAnyTerm(signals, EXTERNAL_TERMS)) && !classifications.includes("internal")) {
    classifications.push("external");
  }

  return Array.from(new Set(classifications));
}

async function hasAnyPath(fsModule, rootDirectory, relativePaths) {
  for (const relativePath of relativePaths) {
    if (await exists(fsModule, path.join(rootDirectory, relativePath))) {
      return true;
    }
  }

  return false;
}

async function hasAnyFile(fsModule, rootDirectory, filenames) {
  for (const filename of filenames) {
    const candidatePath = path.join(rootDirectory, filename);
    if (await exists(fsModule, candidatePath)) {
      return true;
    }
  }

  return false;
}

async function hasRootFileWithSuffix(fsModule, rootDirectory, suffixes) {
  let entries = [];
  try {
    entries = await fsModule.readdir(rootDirectory, { withFileTypes: true });
  } catch {
    return false;
  }

  return entries.some(entry => entry.isFile() && suffixes.some(suffix => entry.name.endsWith(suffix)));
}

async function readFirstExisting(fsModule, rootDirectory, filenames) {
  for (const filename of filenames) {
    const text = await readTextIfExists(fsModule, path.join(rootDirectory, filename));
    if (text) {
      return text;
    }
  }

  return "";
}

async function readTextIfExists(fsModule, targetPath) {
  try {
    return await fsModule.readFile(targetPath, "utf8");
  } catch {
    return "";
  }
}

async function readJson(fsModule, targetPath) {
  try {
    return JSON.parse(await fsModule.readFile(targetPath, "utf8"));
  } catch {
    return null;
  }
}

function collectPackageDependencies(packageJson) {
  if (!packageJson || typeof packageJson !== "object") {
    return [];
  }

  return [
    ...Object.keys(packageJson.dependencies || {}),
    ...Object.keys(packageJson.devDependencies || {}),
    ...Object.keys(packageJson.peerDependencies || {})
  ];
}

function hasMatchingDependency(dependencyNames, knownNames) {
  return dependencyNames.some(name => knownNames.has(name.toLowerCase()));
}

function addWords(target, value) {
  if (Array.isArray(value)) {
    for (const item of value) {
      addWords(target, item);
    }
    return;
  }

  if (typeof value !== "string") {
    return;
  }

  for (const token of value.toLowerCase().match(/[a-z0-9-]+/g) || []) {
    target.add(token);
    if (token.includes("-")) {
      for (const part of token.split("-")) {
        target.add(part);
      }
    }
  }
}

function hasAnyTerm(signals, terms) {
  return terms.some(term => signals.has(term));
}

async function exists(fsModule, targetPath) {
  try {
    await fsModule.access(targetPath);
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
