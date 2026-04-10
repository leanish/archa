import type { RepoRoutingMetadata } from "../types.js";

const ROUTING_LIST_FIELDS = [
  "reach",
  "responsibilities",
  "owns",
  "exposes",
  "consumes",
  "workflows",
  "boundaries",
  "selectWhen",
  "selectWithOtherReposWhen"
] as const;

type RoutingListField = typeof ROUTING_LIST_FIELDS[number];

export function createEmptyRepoRouting(): RepoRoutingMetadata {
  return {
    role: "",
    reach: [],
    responsibilities: [],
    owns: [],
    exposes: [],
    consumes: [],
    workflows: [],
    boundaries: [],
    selectWhen: [],
    selectWithOtherReposWhen: []
  };
}

export function normalizeRepoRouting(
  value: unknown,
  {
    repoName,
    sourcePath
  }: {
    repoName: string;
    sourcePath: string;
  }
): RepoRoutingMetadata {
  if (value == null) {
    return createEmptyRepoRouting();
  }

  if (typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Invalid Archa config at ${sourcePath}: repo "${repoName}" has non-object "routing".`);
  }

  const rawRouting = value as Record<string, unknown>;

  return {
    role: normalizeRoutingRole(rawRouting.role),
    reach: normalizeRoutingList(rawRouting.reach, "reach", repoName, sourcePath),
    responsibilities: normalizeRoutingList(rawRouting.responsibilities, "responsibilities", repoName, sourcePath),
    owns: normalizeRoutingList(rawRouting.owns, "owns", repoName, sourcePath),
    exposes: normalizeRoutingList(rawRouting.exposes, "exposes", repoName, sourcePath),
    consumes: normalizeRoutingList(rawRouting.consumes, "consumes", repoName, sourcePath),
    workflows: normalizeRoutingList(rawRouting.workflows, "workflows", repoName, sourcePath),
    boundaries: normalizeRoutingList(rawRouting.boundaries, "boundaries", repoName, sourcePath),
    selectWhen: normalizeRoutingList(rawRouting.selectWhen, "selectWhen", repoName, sourcePath),
    selectWithOtherReposWhen: normalizeRoutingList(
      rawRouting.selectWithOtherReposWhen,
      "selectWithOtherReposWhen",
      repoName,
      sourcePath
    )
  };
}

export function hasRepoRoutingContent(routing: RepoRoutingMetadata | null | undefined): boolean {
  if (!routing) {
    return false;
  }

  if (routing.role.trim() !== "") {
    return true;
  }

  return ROUTING_LIST_FIELDS.some(field => routing[field].length > 0);
}

export function getRepoRoutingSelectionEvidence(routing: RepoRoutingMetadata | null | undefined): string[] {
  if (!routing) {
    return [];
  }

  return [
    routing.role,
    ...routing.reach,
    ...routing.responsibilities,
    ...routing.owns,
    ...routing.exposes,
    ...routing.consumes,
    ...routing.workflows,
    ...routing.boundaries,
    ...routing.selectWhen,
    ...routing.selectWithOtherReposWhen
  ].filter(value => value.trim() !== "");
}

export function summarizeRepoRouting(routing: RepoRoutingMetadata | null | undefined): string {
  if (!routing || !hasRepoRoutingContent(routing)) {
    return "";
  }

  const parts: string[] = [];
  if (routing.role) {
    parts.push(`role=${routing.role}`);
  }

  if (routing.reach.length > 0) {
    parts.push(`reach=${routing.reach.join(",")}`);
  }

  if (routing.owns.length > 0) {
    parts.push(`owns=${routing.owns.slice(0, 4).join(",")}`);
  }

  if (routing.exposes.length > 0) {
    parts.push(`exposes=${routing.exposes.slice(0, 4).join(",")}`);
  }

  return parts.join(" ");
}

function normalizeRoutingRole(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }

  return value.replace(/\s+/gu, " ").trim();
}

function normalizeRoutingList(
  value: unknown,
  label: RoutingListField,
  repoName: string,
  sourcePath: string
): string[] {
  if (value == null) {
    return [];
  }

  if (!Array.isArray(value)) {
    throw new Error(`Invalid Archa config at ${sourcePath}: repo "${repoName}" has non-array "${label}".`);
  }

  if (!value.every(item => typeof item === "string" && item.trim() !== "")) {
    throw new Error(`Invalid Archa config at ${sourcePath}: repo "${repoName}" has non-string or empty ${label}.`);
  }

  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const item of value) {
    const trimmed = item.trim();
    const normalizedKey = trimmed.toLowerCase();

    if (seen.has(normalizedKey)) {
      continue;
    }

    seen.add(normalizedKey);
    normalized.push(trimmed);
  }

  return normalized;
}
