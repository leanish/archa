# Overview

Archa is your personal code archaeologist. Ask your codebase how it behaves.

The `archa` CLI manages a configured set of repositories, keeps local clones up to date, and runs the local `codex exec` CLI against the most relevant repo workspace for a given question.

## Goals

- keep the repo-aware question-answering workflow reusable across installations
- avoid shipping organization-specific repo catalogs in source control
- preserve a simple local workflow around repo selection, sync, and Codex execution

## Core behavior

- user-level config defines the managed repo set and clone root
- `repos list` shows configured repos and whether they are cloned locally
- `repos sync` clones or fast-forwards the managed repos
- asking a question selects likely repos, syncs them, and runs Codex
- when no repo matches heuristically, the first configured repo is used as a fallback
- output is written for readers without access to the analyzed source code

## Non-goals

- no bundled vector index or semantic retrieval layer
- no hosted backend or shared service state
- no source-controlled organization catalog
