import {
  CODEX_COMPLETED_STATUS_PREFIX,
  CODEX_STATUS_PREFIX
} from "../../core/codex/constants.ts";
import { SUPPORTED_SELECTION_STRATEGIES } from "../../core/repos/selection-strategies.ts";
import {
  DEFAULT_WEB_UPLOAD_LIMIT_BYTES,
  SUPPORTED_WEB_UPLOAD_ACCEPT,
  SUPPORTED_WEB_UPLOAD_LABEL
} from "../api/web-upload-store.ts";

const PROGRESS_STEPS = [
  {
    key: "created",
    title: "Job Created",
    waitingMessage: "Your job will be created when you run it."
  },
  {
    key: "selection",
    title: "Repo Selection",
    waitingMessage: "Waiting"
  },
  {
    key: "sync",
    title: "Repository Sync",
    waitingMessage: "Waiting"
  },
  {
    key: "codex",
    title: "Codex Execution",
    waitingMessage: "Waiting"
  },
  {
    key: "synthesis",
    title: "Synthesis",
    waitingMessage: "Waiting"
  }
] as const;

const DEFAULT_UPLOAD_LIMIT_LABEL = formatByteLabel(DEFAULT_WEB_UPLOAD_LIMIT_BYTES);

export const HTML_UI = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>ask-the-code</title>
<style>
:root {
  color-scheme: light;
  --bg: #f5f7fb;
  --bg-accent: rgba(44, 107, 255, 0.08);
  --card: rgba(255, 255, 255, 0.92);
  --card-strong: #ffffff;
  --text: #172554;
  --muted: #64748b;
  --border: rgba(148, 163, 184, 0.28);
  --border-strong: rgba(59, 130, 246, 0.22);
  --primary: #2563eb;
  --primary-strong: #1d4ed8;
  --primary-soft: rgba(37, 99, 235, 0.12);
  --success: #16a34a;
  --success-soft: rgba(22, 163, 74, 0.12);
  --warning: #d97706;
  --warning-soft: rgba(217, 119, 6, 0.12);
  --danger: #dc2626;
  --danger-soft: rgba(220, 38, 38, 0.1);
  --shadow: 0 24px 80px rgba(15, 23, 42, 0.08);
  --brand-shadow: 0 18px 32px rgba(37, 99, 235, 0.18);
  --radius: 26px;
  --radius-sm: 18px;
  --font-body: "Avenir Next", "Segoe UI", "Helvetica Neue", sans-serif;
  --font-display: "Gill Sans", "Avenir Next Condensed", "Trebuchet MS", sans-serif;
}

html[data-theme="dark"] {
  color-scheme: dark;
  --bg: #081120;
  --bg-accent: rgba(59, 130, 246, 0.18);
  --card: rgba(9, 19, 34, 0.88);
  --card-strong: #0f1b31;
  --text: #e2e8f0;
  --muted: #94a3b8;
  --border: rgba(148, 163, 184, 0.16);
  --border-strong: rgba(96, 165, 250, 0.26);
  --primary: #60a5fa;
  --primary-strong: #93c5fd;
  --primary-soft: rgba(96, 165, 250, 0.14);
  --success: #4ade80;
  --success-soft: rgba(74, 222, 128, 0.14);
  --warning: #f59e0b;
  --warning-soft: rgba(245, 158, 11, 0.16);
  --danger: #f87171;
  --danger-soft: rgba(248, 113, 113, 0.14);
  --shadow: 0 24px 80px rgba(2, 6, 23, 0.32);
  --brand-shadow: 0 18px 32px rgba(14, 165, 233, 0.18);
}

*,
*::before,
*::after {
  box-sizing: border-box;
}

html,
body {
  min-height: 100%;
}

body {
  margin: 0;
  font-family: var(--font-body);
  background:
    radial-gradient(circle at top left, rgba(20, 184, 166, 0.11), transparent 28%),
    radial-gradient(circle at top right, rgba(59, 130, 246, 0.1), transparent 24%),
    linear-gradient(180deg, var(--bg), color-mix(in srgb, var(--bg) 92%, #ffffff 8%));
  color: var(--text);
}

button,
input,
select,
textarea {
  font: inherit;
}

button {
  cursor: pointer;
}

.page-shell {
  max-width: 1520px;
  margin: 0 auto;
  padding: 20px 28px 40px;
}

.app-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1.5rem;
  margin-bottom: 18px;
}

.brand {
  display: flex;
  align-items: center;
  gap: 18px;
}

.brand-mark {
  width: 96px;
  height: 64px;
  border-radius: 22px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.02em;
  font-family: var(--font-display);
  font-size: 2.25rem;
  font-weight: 800;
  letter-spacing: -0.08em;
  color: #ffffff;
  background:
    linear-gradient(135deg, rgba(255,255,255,0.26), rgba(255,255,255,0)),
    linear-gradient(90deg, #ff5f6d 0%, #ffb703 33%, #22c55e 66%, #2563eb 100%);
  box-shadow: var(--brand-shadow);
}

.brand-copy h1 {
  margin: 0;
  font-size: clamp(1.7rem, 2vw, 2.3rem);
  line-height: 1.1;
}

.brand-copy p {
  margin: 6px 0 0;
  color: var(--muted);
  font-size: 1.02rem;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.icon-button,
.ghost-button,
.primary-button,
.subtle-button {
  border: 1px solid var(--border);
  background: var(--card-strong);
  color: var(--text);
  border-radius: 16px;
  min-height: 48px;
  transition: transform 140ms ease, border-color 140ms ease, background 140ms ease;
}

.icon-button:hover,
.ghost-button:hover,
.primary-button:hover,
.subtle-button:hover {
  transform: translateY(-1px);
  border-color: var(--border-strong);
}

.icon-button {
  width: 48px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.ghost-button {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 0 18px;
  font-weight: 600;
}

.primary-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 0 20px;
  color: #ffffff;
  background: linear-gradient(135deg, var(--primary), var(--primary-strong));
  border-color: transparent;
  font-weight: 700;
}

.primary-button:disabled,
.subtle-button:disabled {
  opacity: 0.55;
  cursor: not-allowed;
  transform: none;
}

.subtle-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 0 16px;
  background: transparent;
}

.subtle-button-full {
  width: 100%;
}

.top-message,
.setup-hint {
  margin-bottom: 18px;
  padding: 16px 18px;
  border-radius: 18px;
  border: 1px solid var(--border);
  background: color-mix(in srgb, var(--card) 90%, #ffffff 10%);
  color: var(--text);
  box-shadow: var(--shadow);
}

.top-message[hidden] {
  display: none;
}

.layout {
  display: grid;
  grid-template-columns: minmax(0, 1.9fr) minmax(320px, 0.95fr);
  gap: 20px;
  align-items: start;
}

.primary-column,
.secondary-column {
  display: grid;
  gap: 20px;
}

.secondary-column {
  position: sticky;
  top: 20px;
}

.panel {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  backdrop-filter: blur(18px);
  overflow: hidden;
}

.panel-inner {
  padding: 26px 24px;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 24px 24px 0;
}

.panel-header h2 {
  margin: 0;
  font-size: 1.95rem;
  line-height: 1.1;
}

.panel-body {
  padding: 18px 24px 24px;
}

.question-input {
  width: 100%;
  min-height: 176px;
  resize: vertical;
  border-radius: 18px;
  border: 1px solid var(--border);
  padding: 18px 18px 20px;
  font-size: 1rem;
  line-height: 1.65;
  color: var(--text);
  background: color-mix(in srgb, var(--card-strong) 88%, #ffffff 12%);
  outline: none;
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.28);
}

.question-input:focus,
.repo-filter:focus,
.control-input:focus,
.control-select:focus {
  border-color: var(--primary);
  box-shadow: 0 0 0 4px var(--primary-soft);
}

.field-hint,
.dropzone-note,
.muted-copy,
.repo-option-meta,
.repo-option-description,
.upload-meta,
.summary-meta,
.step-description,
.log-empty {
  color: var(--muted);
}

.ask-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin-top: 16px;
  margin-bottom: 16px;
}

.attach-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.upload-dropzone {
  display: grid;
  place-items: center;
  gap: 6px;
  min-height: 120px;
  border: 1px dashed color-mix(in srgb, var(--primary) 32%, var(--border));
  border-radius: 18px;
  background: linear-gradient(180deg, color-mix(in srgb, var(--card-strong) 88%, var(--primary-soft) 12%), var(--card-strong));
  color: var(--text);
  text-align: center;
  padding: 20px;
  transition: border-color 140ms ease, background 140ms ease, transform 140ms ease;
}

.upload-dropzone.drag-active {
  border-color: var(--primary);
  background: color-mix(in srgb, var(--card-strong) 75%, var(--primary-soft) 25%);
  transform: scale(0.995);
}

.upload-list {
  display: grid;
  gap: 10px;
  margin-top: 12px;
}

.upload-item {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto auto;
  align-items: center;
  gap: 14px;
  padding: 16px 18px;
  border: 1px solid var(--border);
  border-radius: 18px;
  background: color-mix(in srgb, var(--card-strong) 88%, #ffffff 12%);
}

.upload-icon {
  width: 42px;
  height: 42px;
  border-radius: 14px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 0.86rem;
  font-weight: 700;
  color: var(--primary);
  background: var(--primary-soft);
}

.upload-name {
  font-weight: 700;
  line-height: 1.2;
}

.upload-status {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  justify-content: flex-end;
  white-space: nowrap;
  font-weight: 600;
}

.upload-status.success {
  color: var(--success);
}

.upload-status.pending {
  color: var(--warning);
}

.upload-status.error {
  color: var(--danger);
}

.remove-upload {
  border: 0;
  background: transparent;
  color: var(--muted);
  width: 34px;
  height: 34px;
  border-radius: 12px;
}

.remove-upload:hover {
  background: rgba(148, 163, 184, 0.12);
  color: var(--text);
}

.advanced-options {
  margin-top: 18px;
  padding: 18px;
  border-radius: 20px;
  border: 1px solid var(--border);
  background: color-mix(in srgb, var(--card-strong) 86%, var(--primary-soft) 14%);
}

.advanced-title {
  margin: 0 0 12px;
  font-size: 1rem;
  font-weight: 700;
}

.advanced-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.control-group {
  display: grid;
  gap: 6px;
}

.control-label {
  font-size: 0.88rem;
  font-weight: 600;
  color: var(--muted);
}

.repo-picker {
  display: grid;
  gap: 10px;
  grid-column: 1 / -1;
}

.repo-selected {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.repo-chip {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: var(--card-strong);
  font-size: 0.84rem;
}

.repo-chip-muted {
  color: var(--muted);
}

.repo-chip-remove {
  border: 0;
  background: transparent;
  color: inherit;
  padding: 0;
}

.repo-filter,
.control-input,
.control-select {
  width: 100%;
  min-height: 46px;
  border-radius: 14px;
  border: 1px solid var(--border);
  background: var(--card-strong);
  color: var(--text);
  padding: 0 14px;
  outline: none;
}

.repo-options {
  display: grid;
  gap: 8px;
  max-height: 220px;
  overflow-y: auto;
  padding: 4px;
  border-radius: 16px;
  border: 1px solid var(--border);
  background: color-mix(in srgb, var(--card-strong) 94%, #ffffff 6%);
}

.repo-options[hidden] {
  display: none;
}

.repo-option {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: start;
  gap: 12px;
  padding: 12px;
  border-radius: 14px;
  border: 1px solid transparent;
  background: var(--card-strong);
}

.repo-option:hover {
  border-color: var(--border-strong);
}

.repo-option input {
  margin-top: 2px;
  accent-color: var(--primary);
}

.repo-option-name {
  font-weight: 700;
}

.checkbox-row {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 46px;
  padding: 0 14px;
  border-radius: 14px;
  border: 1px solid var(--border);
  background: var(--card-strong);
}

.checkbox-row input {
  accent-color: var(--primary);
}

.answer-panel-body {
  padding: 18px 24px 24px;
}

.answer-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.answer-placeholder,
.summary-placeholder {
  min-height: 180px;
  border-radius: 18px;
  border: 1px solid color-mix(in srgb, var(--border) 78%, transparent 22%);
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--card-strong) 88%, #ffffff 12%), color-mix(in srgb, var(--card-strong) 94%, var(--primary-soft) 6%));
  display: grid;
  place-items: center;
  padding: 28px;
  text-align: center;
}

.placeholder-copy {
  max-width: 420px;
}

.placeholder-title {
  display: block;
  font-size: 1.85rem;
  font-weight: 700;
  margin-bottom: 8px;
}

.placeholder-copy .muted-copy {
  font-size: 1rem;
}

.answer-content {
  min-height: 180px;
  border-radius: 18px;
  border: 1px solid color-mix(in srgb, var(--border) 78%, transparent 22%);
  background: color-mix(in srgb, var(--card-strong) 92%, #ffffff 8%);
  padding: 24px;
}

.answer-content[hidden] {
  display: none;
}

.answer-content h1,
.answer-content h2,
.answer-content h3 {
  margin: 1.1em 0 0.5em;
  line-height: 1.2;
}

.answer-content h1:first-child,
.answer-content h2:first-child,
.answer-content h3:first-child,
.answer-content p:first-child {
  margin-top: 0;
}

.answer-content p,
.answer-content ul,
.answer-content ol,
.answer-content pre {
  margin: 0.85em 0;
}

.answer-content ul,
.answer-content ol {
  padding-left: 1.3rem;
}

.answer-content li + li {
  margin-top: 0.35rem;
}

.answer-content code {
  font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace;
  font-size: 0.94em;
  padding: 0.12em 0.34em;
  border-radius: 0.45em;
  background: color-mix(in srgb, var(--primary-soft) 72%, transparent 28%);
}

.answer-content pre {
  overflow-x: auto;
  padding: 16px 18px;
  border-radius: 16px;
  background: color-mix(in srgb, var(--card-strong) 75%, var(--primary-soft) 25%);
}

.answer-content pre code {
  background: transparent;
  padding: 0;
}

.answer-content strong {
  font-weight: 700;
}

.answer-content a {
  color: var(--primary);
}

.error-box {
  margin-top: 14px;
  padding: 14px 16px;
  border-radius: 16px;
  border: 1px solid rgba(220, 38, 38, 0.2);
  background: var(--danger-soft);
  color: var(--danger);
}

.error-box[hidden] {
  display: none;
}

.progress-panel-body {
  padding: 18px 24px 24px;
}

.progress-steps {
  display: grid;
  gap: 4px;
}

.progress-step {
  display: grid;
  grid-template-columns: 26px minmax(0, 1fr) auto;
  gap: 12px;
  align-items: start;
  padding: 16px 0;
}

.progress-step + .progress-step {
  border-top: 1px solid color-mix(in srgb, var(--border) 65%, transparent 35%);
}

.step-marker {
  width: 26px;
  height: 26px;
  border-radius: 999px;
  border: 2px solid var(--border);
  position: relative;
  margin-top: 2px;
}

.step-marker::after {
  content: "";
  position: absolute;
  top: 24px;
  left: 50%;
  transform: translateX(-50%);
  width: 2px;
  height: 44px;
  background: color-mix(in srgb, var(--border) 70%, transparent 30%);
}

.progress-step:last-child .step-marker::after {
  display: none;
}

.progress-step.completed .step-marker {
  border-color: var(--success);
  background: var(--success);
}

.progress-step.completed .step-marker::before {
  content: "✓";
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  color: #ffffff;
  font-size: 0.9rem;
  font-weight: 700;
}

.progress-step.active .step-marker {
  border-color: var(--primary);
}

.progress-step.active .step-marker::before {
  content: "";
  position: absolute;
  inset: 4px;
  border-radius: 999px;
  background: var(--primary);
}

.progress-step.failed .step-marker {
  border-color: var(--danger);
  background: var(--danger-soft);
}

.progress-step.failed .step-marker::before {
  content: "!";
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  color: var(--danger);
  font-size: 0.95rem;
  font-weight: 700;
}

.step-title {
  font-size: 1rem;
  font-weight: 700;
  margin-bottom: 4px;
}

.step-time {
  color: var(--muted);
  font-size: 0.88rem;
  white-space: nowrap;
  padding-top: 1px;
}

.status-log {
  margin-top: 14px;
  padding: 16px;
  border-radius: 18px;
  border: 1px solid var(--border);
  background: color-mix(in srgb, var(--card-strong) 82%, var(--primary-soft) 18%);
  color: var(--text);
  font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace;
  font-size: 0.86rem;
  line-height: 1.55;
  white-space: pre-wrap;
  max-height: 280px;
  overflow-y: auto;
}

.status-log[hidden] {
  display: none;
}

.summary-panel-body {
  padding: 18px 24px 24px;
}

.summary-state {
  display: grid;
  gap: 18px;
}

.repo-summary-list {
  display: grid;
  gap: 12px;
}

.repo-summary-item {
  display: grid;
  gap: 4px;
  padding: 14px 16px;
  border-radius: 18px;
  border: 1px solid var(--border);
  background: color-mix(in srgb, var(--card-strong) 90%, #ffffff 10%);
}

.repo-summary-name {
  font-weight: 700;
}

.summary-stats {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.summary-stat {
  padding: 16px 14px;
  border-radius: 18px;
  border: 1px solid var(--border);
  background: color-mix(in srgb, var(--card-strong) 90%, var(--primary-soft) 10%);
  text-align: center;
}

.summary-value {
  display: block;
  font-size: 1.8rem;
  font-weight: 800;
  line-height: 1.1;
}

.summary-label {
  display: block;
  margin-top: 6px;
  color: var(--muted);
  font-size: 0.88rem;
}

.summary-status {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: fit-content;
  padding: 10px 14px;
  border-radius: 999px;
  font-weight: 700;
}

.summary-status.completed {
  background: var(--success-soft);
  color: var(--success);
}

.summary-status.failed {
  background: var(--danger-soft);
  color: var(--danger);
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

@media (max-width: 1080px) {
  .layout {
    grid-template-columns: minmax(0, 1fr);
  }

  .secondary-column {
    position: static;
  }
}

@media (max-width: 720px) {
  .page-shell {
    padding: 18px 16px 32px;
  }

  .app-header,
  .brand,
  .ask-toolbar,
  .panel-header {
    align-items: flex-start;
  }

  .app-header,
  .ask-toolbar,
  .panel-header,
  .header-actions {
    flex-direction: column;
  }

  .header-actions,
  .answer-actions,
  .summary-stats,
  .advanced-grid {
    width: 100%;
  }

  .summary-stats,
  .advanced-grid {
    grid-template-columns: minmax(0, 1fr);
  }

  .upload-item,
  .progress-step {
    grid-template-columns: auto minmax(0, 1fr);
  }

  .step-time,
  .upload-status {
    grid-column: 2;
    justify-content: flex-start;
  }

  .remove-upload {
    grid-column: 2;
    justify-self: end;
  }
}
</style>
</head>
<body>
<div class="page-shell">
  <header class="app-header">
    <div class="brand">
      <div class="brand-mark" aria-hidden="true">ATC</div>
      <div class="brand-copy">
        <h1>ask-the-code (ATC)</h1>
        <p>Repo-aware • Codex</p>
      </div>
    </div>
    <div class="header-actions">
      <button type="button" id="theme-toggle" class="icon-button" aria-label="Toggle theme">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="4.5" stroke="currentColor" stroke-width="1.8"></circle>
          <path d="M12 2.5v2.5M12 19v2.5M4.93 4.93l1.77 1.77M17.3 17.3l1.77 1.77M2.5 12H5M19 12h2.5M4.93 19.07l1.77-1.77M17.3 6.7l1.77-1.77" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"></path>
        </svg>
      </button>
      <button type="button" id="google-sign-in" class="ghost-button">
        <span aria-hidden="true">G</span>
        <span>Sign in with Google</span>
      </button>
    </div>
  </header>

  <div id="top-message" class="top-message" hidden></div>
  <div id="setup-hint" class="setup-hint" hidden></div>

  <div class="layout">
    <section class="primary-column">
      <form id="ask-form" class="panel">
        <div class="panel-header">
          <h2>Ask a question</h2>
        </div>
        <div class="panel-body">
          <label class="sr-only" for="question">Question</label>
          <textarea
            id="question"
            name="question"
            class="question-input"
            rows="7"
            placeholder="Ask a question about your code...&#10;&#10;Be specific about what you want to understand, build, debug, or refactor."
            required
          ></textarea>

          <section id="advanced-options" class="advanced-options" hidden>
            <h3 class="advanced-title">Advanced options</h3>
            <div class="advanced-grid">
              <div class="repo-picker">
                <label class="control-label" for="repo-filter">Repos</label>
                <div id="repo-selected" class="repo-selected" aria-live="polite"></div>
                <input type="text" id="repo-filter" class="repo-filter" placeholder="Loading configured repos..." disabled>
                <div id="repo-options" class="repo-options" role="listbox" aria-multiselectable="true" hidden></div>
                <div id="repo-help" class="field-hint">Leave it empty to use automatic repo selection, or search to narrow the scope explicitly.</div>
              </div>

              <div class="control-group">
                <label class="control-label" for="audience">Audience</label>
                <select id="audience" name="audience" class="control-select">
                  <option value="general" selected>general</option>
                  <option value="codebase">codebase</option>
                </select>
              </div>

              <div class="control-group">
                <label class="control-label" for="model">Model</label>
                <select id="model" name="model" class="control-select">
                  <option value="gpt-5.4">gpt-5.4</option>
                  <option value="gpt-5.4-mini" selected>gpt-5.4-mini</option>
                </select>
              </div>

              <div class="control-group">
                <label class="control-label" for="reasoning-effort">Reasoning effort</label>
                <select id="reasoning-effort" name="reasoningEffort" class="control-select">
                  <option value="none">none</option>
                  <option value="minimal">minimal</option>
                  <option value="low" selected>low</option>
                  <option value="medium">medium</option>
                  <option value="high">high</option>
                  <option value="xhigh">xhigh</option>
                </select>
              </div>

              <div class="control-group">
                <label class="control-label" for="selection-mode">Repo selection</label>
                <select id="selection-mode" name="selectionMode" class="control-select">
${SUPPORTED_SELECTION_STRATEGIES.map((strategy, index) => `                  <option value="${strategy}"${index === 0 ? " selected" : ""}>${strategy}</option>`).join("\n")}
                </select>
              </div>

              <label class="checkbox-row">
                <input type="checkbox" id="selection-shadow-compare" name="selectionShadowCompare">
                <span>Benchmark none, low, and high repo selection in the background</span>
              </label>

              <label class="checkbox-row">
                <input type="checkbox" id="no-sync" name="noSync">
                <span>Skip repo sync</span>
              </label>
            </div>
          </section>

          <div class="ask-toolbar">
            <div class="attach-row">
              <button type="button" id="attach-files-button" class="subtle-button">Attach files</button>
              <span class="muted-copy">${SUPPORTED_WEB_UPLOAD_LABEL} supported</span>
            </div>
            <button type="submit" id="submit-btn" class="primary-button">
              <span aria-hidden="true">▶</span>
              <span>Ask (Run Job)</span>
            </button>
          </div>

          <input id="file-input" type="file" multiple accept="${SUPPORTED_WEB_UPLOAD_ACCEPT}" hidden>
          <div id="dropzone" class="upload-dropzone" tabindex="0" role="button" aria-label="Upload files">
            <div>
              <div><strong>Drag &amp; drop files here, or click to browse</strong></div>
              <div class="dropzone-note">${SUPPORTED_WEB_UPLOAD_LABEL} • Max ${DEFAULT_UPLOAD_LIMIT_LABEL} each</div>
            </div>
          </div>
          <div id="upload-list" class="upload-list"></div>
        </div>
      </form>

      <section class="panel">
        <div class="panel-header">
          <h2>Answer</h2>
          <div class="answer-actions">
            <button type="button" id="copy-answer" class="subtle-button" disabled>Copy Answer</button>
            <button type="button" id="download-answer" class="subtle-button" disabled>Download Markdown</button>
          </div>
        </div>
        <div class="answer-panel-body">
          <div id="answer-placeholder" class="answer-placeholder">
            <div class="placeholder-copy">
              <span class="placeholder-title">Your answer will appear here</span>
              <div class="muted-copy">Run your job to see the results.</div>
            </div>
          </div>
          <div id="answer-content" class="answer-content" hidden></div>
          <div id="error-box" class="error-box" hidden></div>
        </div>
      </section>
    </section>

    <aside class="secondary-column">
      <section class="panel">
        <div class="panel-header">
          <h2>Progress</h2>
        </div>
        <div class="progress-panel-body">
          <div id="progress-steps" class="progress-steps"></div>
          <button type="button" id="toggle-log" class="subtle-button subtle-button-full">View Full Log</button>
          <pre id="status-log" class="status-log" hidden></pre>
        </div>
      </section>

      <section class="panel">
        <div class="panel-header">
          <h2>After the run</h2>
        </div>
        <div class="summary-panel-body">
          <div id="after-run" class="summary-state">
            <div class="summary-placeholder">
              <div class="placeholder-copy">
                <span class="placeholder-title">We&apos;ll show which repositories were used</span>
                <div class="muted-copy">and a summary of what happened after your job completes.</div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </aside>
  </div>
</div>

<script>
(function () {
  const PROGRESS_STEPS = ${JSON.stringify(PROGRESS_STEPS)};
  const CODEX_STATUS_PREFIX = ${JSON.stringify(CODEX_STATUS_PREFIX)};
  const CODEX_COMPLETED_STATUS_PREFIX = ${JSON.stringify(CODEX_COMPLETED_STATUS_PREFIX)};

  const form = document.getElementById("ask-form");
  const questionField = document.getElementById("question");
  const submitButton = document.getElementById("submit-btn");
  const attachFilesButton = document.getElementById("attach-files-button");
  const fileInput = document.getElementById("file-input");
  const dropzone = document.getElementById("dropzone");
  const uploadList = document.getElementById("upload-list");
  const toggleLogButton = document.getElementById("toggle-log");
  const statusLog = document.getElementById("status-log");
  const answerPlaceholder = document.getElementById("answer-placeholder");
  const answerContent = document.getElementById("answer-content");
  const copyAnswerButton = document.getElementById("copy-answer");
  const downloadAnswerButton = document.getElementById("download-answer");
  const errorBox = document.getElementById("error-box");
  const progressSteps = document.getElementById("progress-steps");
  const afterRun = document.getElementById("after-run");
  const setupHint = document.getElementById("setup-hint");
  const topMessage = document.getElementById("top-message");
  const themeToggleButton = document.getElementById("theme-toggle");
  const googleSignInButton = document.getElementById("google-sign-in");
  const advancedOptions = document.getElementById("advanced-options");
  const repoSelected = document.getElementById("repo-selected");
  const repoOptions = document.getElementById("repo-options");
  const repoFilter = document.getElementById("repo-filter");
  const repoHelp = document.getElementById("repo-help");

  const repoState = {
    available: [],
    isSearchActive: false,
    ready: false,
    selected: new Set()
  };

  const uiState = {
    answerMarkdown: "",
    currentJob: null,
    logExpanded: false,
    uploads: []
  };

  let eventSource = null;
  let copyFeedbackTimer = null;

  applyTheme(loadStoredThemePreference());
  revealAdvancedOptionsWhenAllowed();
  renderRepoPicker();
  renderUploads();
  renderProgress(null);
  renderSummary(null);
  void initializeRepoPicker();

  themeToggleButton.addEventListener("click", () => {
    const nextTheme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    applyTheme(nextTheme);
    window.localStorage.setItem("atc-theme", nextTheme);
  });

  googleSignInButton.addEventListener("click", () => {
    showTopMessage("Google sign-in is not wired into the built-in local server yet.");
  });

  attachFilesButton.addEventListener("click", () => {
    fileInput.click();
  });

  fileInput.addEventListener("change", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement) || !target.files) {
      return;
    }

    void uploadSelectedFiles(Array.from(target.files));
    target.value = "";
  });

  dropzone.addEventListener("click", () => {
    fileInput.click();
  });

  dropzone.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }

    event.preventDefault();
    fileInput.click();
  });

  ["dragenter", "dragover"].forEach(eventName => {
    dropzone.addEventListener(eventName, event => {
      event.preventDefault();
      dropzone.classList.add("drag-active");
    });
  });

  ["dragleave", "dragend", "drop"].forEach(eventName => {
    dropzone.addEventListener(eventName, event => {
      event.preventDefault();
      dropzone.classList.remove("drag-active");
    });
  });

  dropzone.addEventListener("drop", event => {
    if (!event.dataTransfer || !event.dataTransfer.files || event.dataTransfer.files.length === 0) {
      return;
    }

    void uploadSelectedFiles(Array.from(event.dataTransfer.files));
  });

  uploadList.addEventListener("click", event => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }

    const button = target.closest("button[data-upload-local-id]");
    if (!button) {
      return;
    }

    const localId = button.getAttribute("data-upload-local-id");
    if (!localId) {
      return;
    }

    void removeUpload(localId);
  });

  toggleLogButton.addEventListener("click", () => {
    uiState.logExpanded = !uiState.logExpanded;
    renderStatusLog();
  });

  repoFilter.addEventListener("input", () => {
    renderRepoOptions();
  });

  repoFilter.addEventListener("focus", () => {
    repoState.isSearchActive = true;
    renderRepoOptions();
  });

  repoFilter.addEventListener("blur", () => {
    setTimeout(() => {
      if (document.activeElement === repoFilter) {
        return;
      }

      repoState.isSearchActive = false;
      renderRepoOptions();
    }, 0);
  });

  repoOptions.addEventListener("mousedown", event => {
    const target = event.target;
    if (!(target instanceof HTMLElement) || !target.closest(".repo-option")) {
      return;
    }

    event.preventDefault();
  });

  repoOptions.addEventListener("change", event => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement) || target.type !== "checkbox") {
      return;
    }

    const repoName = target.getAttribute("data-repo-name");
    if (!repoName) {
      return;
    }

    if (target.checked) {
      repoState.selected.add(repoName);
    } else {
      repoState.selected.delete(repoName);
    }

    repoFilter.focus({ preventScroll: true });
    renderRepoPicker();
  });

  repoSelected.addEventListener("click", event => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }

    const button = target.closest("button[data-repo-name]");
    if (!button) {
      return;
    }

    const repoName = button.getAttribute("data-repo-name");
    if (!repoName) {
      return;
    }

    repoState.selected.delete(repoName);
    renderRepoPicker();
  });

  copyAnswerButton.addEventListener("click", async () => {
    if (!uiState.answerMarkdown) {
      return;
    }

    try {
      await copyText(uiState.answerMarkdown);
      setCopyButtonLabel("Copied");
    } catch {
      setCopyButtonLabel("Copy failed");
    }
  });

  downloadAnswerButton.addEventListener("click", () => {
    if (!uiState.answerMarkdown) {
      return;
    }

    const blob = new Blob([uiState.answerMarkdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "ask-the-code-answer.md";
    link.click();
    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 0);
  });

  form.addEventListener("submit", async event => {
    event.preventDefault();
    clearTopMessage();
    clearError();

    const payload = buildPayload();
    if (!payload) {
      return;
    }

    resetJobUi();
    submitButton.disabled = true;
    submitButton.textContent = "Creating job...";
    renderRunningAnswer("Creating your job...");

    try {
      const response = await fetch("/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const job = await response.json();
      if (!response.ok) {
        throw new Error(job.error || "Failed to create the job.");
      }

      uiState.currentJob = job;
      submitButton.textContent = "Running...";
      renderJob(job);
      connectSse(job.links.events);
    } catch (error) {
      showError(error instanceof Error ? error.message : String(error));
      finishRun();
    }
  });

  function loadStoredThemePreference() {
    try {
      return window.localStorage.getItem("atc-theme") || "";
    } catch {
      return "";
    }
  }

  function applyTheme(theme) {
    const resolvedTheme = theme === "dark"
      ? "dark"
      : theme === "light"
        ? "light"
        : window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light";
    document.documentElement.dataset.theme = resolvedTheme;
  }

  function revealAdvancedOptionsWhenAllowed() {
    const params = new URLSearchParams(window.location.search);
    if ((params.get("admin") || "").toLowerCase() === "true") {
      advancedOptions.hidden = false;
    }
  }

  function buildPayload() {
    if (!(questionField instanceof HTMLTextAreaElement)) {
      return null;
    }

    const question = questionField.value.trim();
    if (!question) {
      showError("Question is required.");
      return null;
    }

    if (uiState.uploads.some(upload => upload.status === "uploading")) {
      showError("Wait for file uploads to finish before running the job.");
      return null;
    }

    const payload = { question };
    const selectedRepoNames = Array.from(repoState.selected);
    if (selectedRepoNames.length > 0) {
      payload.repoNames = selectedRepoNames;
    }

    const attachmentIds = uiState.uploads
      .filter(upload => upload.status === "uploaded" && upload.id)
      .map(upload => upload.id);
    if (attachmentIds.length > 0) {
      payload.attachmentIds = attachmentIds;
    }

    if (!advancedOptions.hidden) {
      const audience = document.getElementById("audience").value.trim();
      const model = document.getElementById("model").value.trim();
      const reasoningEffort = document.getElementById("reasoning-effort").value.trim();
      const selectionMode = document.getElementById("selection-mode").value.trim();
      const selectionShadowCompare = document.getElementById("selection-shadow-compare").checked;
      const noSync = document.getElementById("no-sync").checked;
      if (audience) {
        payload.audience = audience;
      }
      if (model) {
        payload.model = model;
      }
      if (reasoningEffort) {
        payload.reasoningEffort = reasoningEffort;
      }
      if (selectionMode) {
        payload.selectionMode = selectionMode;
      }
      if (selectionShadowCompare) {
        payload.selectionShadowCompare = true;
      }
      if (noSync) {
        payload.noSync = true;
      }
    }

    return payload;
  }

  async function uploadSelectedFiles(files) {
    if (!Array.isArray(files) || files.length === 0) {
      return;
    }

    clearTopMessage();

    const pendingItems = files.map(file => ({
      error: "",
      id: "",
      kind: inferUploadKind(file.type, file.name),
      localId: "upload-" + Math.random().toString(36).slice(2),
      mediaType: file.type || "application/octet-stream",
      name: file.name,
      sizeBytes: file.size,
      status: "uploading"
    }));

    uiState.uploads.push.apply(uiState.uploads, pendingItems);
    renderUploads();

    const formData = new FormData();
    for (const file of files) {
      formData.append("files", file, file.name);
    }

    try {
      const response = await fetch("/uploads", {
        method: "POST",
        body: formData
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "File upload failed.");
      }

      const uploadedItems = Array.isArray(payload.uploads) ? payload.uploads : [];
      for (let index = 0; index < pendingItems.length; index += 1) {
        const currentItem = pendingItems[index];
        const uploadedItem = uploadedItems[index];
        if (!uploadedItem || typeof uploadedItem.id !== "string") {
          currentItem.status = "error";
          currentItem.error = "Upload response was incomplete.";
          continue;
        }

        currentItem.id = uploadedItem.id;
        currentItem.kind = uploadedItem.kind || currentItem.kind;
        currentItem.mediaType = uploadedItem.mediaType || currentItem.mediaType;
        currentItem.sizeBytes = typeof uploadedItem.sizeBytes === "number" ? uploadedItem.sizeBytes : currentItem.sizeBytes;
        currentItem.status = "uploaded";
      }
    } catch (error) {
      for (const currentItem of pendingItems) {
        currentItem.status = "error";
        currentItem.error = error instanceof Error ? error.message : String(error);
      }
      showTopMessage(error instanceof Error ? error.message : String(error));
    }

    renderUploads();
  }

  async function removeUpload(localId) {
    const uploadIndex = uiState.uploads.findIndex(upload => upload.localId === localId);
    if (uploadIndex < 0) {
      return;
    }

    const upload = uiState.uploads[uploadIndex];
    uiState.uploads.splice(uploadIndex, 1);
    renderUploads();

    if (!upload.id) {
      return;
    }

    try {
      await fetch("/uploads/" + encodeURIComponent(upload.id), {
        method: "DELETE"
      });
    } catch {
      // The UI can ignore cleanup failures; uploads expire server-side.
    }
  }

  async function initializeRepoPicker() {
    try {
      const response = await fetch("/repos", {
        headers: { Accept: "application/json" }
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "Failed to load configured repos.");
      }

      const repos = Array.isArray(payload.repos)
        ? payload.repos.filter(repo => repo && typeof repo.name === "string")
        : [];
      if (repos.length === 0) {
        const hint = typeof payload.setupHint === "string" && payload.setupHint.trim()
          ? payload.setupHint.trim()
          : 'No configured repos available. Try "atc config discover-github" to discover and add repos.';
        repoFilter.disabled = true;
        repoFilter.placeholder = "No configured repos available";
        repoHelp.textContent = hint;
        setSetupHint(hint);
        renderRepoPicker();
        return;
      }

      repoState.available = repos.sort((left, right) => left.name.localeCompare(right.name));
      repoState.ready = true;
      repoFilter.disabled = false;
      repoFilter.placeholder = "Search configured repos";
      repoHelp.textContent = "Leave it empty to use automatic repo selection, or search to narrow to specific repos.";
      setSetupHint("");
      renderRepoPicker();
    } catch {
      repoFilter.disabled = true;
      repoFilter.placeholder = "Configured repos unavailable";
      repoHelp.textContent = "Configured repo list unavailable. The server will still use automatic repo selection.";
      setSetupHint("");
      renderRepoPicker();
    }
  }

  function setSetupHint(message) {
    setupHint.textContent = message;
    setupHint.hidden = !message;
  }

  function renderRepoPicker() {
    renderSelectedRepos();
    renderRepoOptions();
  }

  function renderSelectedRepos() {
    repoSelected.textContent = "";

    const selectedNames = Array.from(repoState.selected);
    if (selectedNames.length === 0) {
      const chip = document.createElement("span");
      chip.className = "repo-chip repo-chip-muted";
      chip.textContent = "automatic";
      repoSelected.append(chip);
      return;
    }

    for (const repoName of selectedNames) {
      const chip = document.createElement("span");
      chip.className = "repo-chip";
      chip.append(document.createTextNode(repoName));

      const removeButton = document.createElement("button");
      removeButton.type = "button";
      removeButton.className = "repo-chip-remove";
      removeButton.setAttribute("data-repo-name", repoName);
      removeButton.setAttribute("aria-label", "Remove " + repoName);
      removeButton.textContent = "×";
      chip.append(removeButton);

      repoSelected.append(chip);
    }
  }

  function renderRepoOptions() {
    repoOptions.textContent = "";

    if (!repoState.ready || !repoState.isSearchActive) {
      repoOptions.hidden = true;
      return;
    }

    const filter = repoFilter.value.trim().toLowerCase();
    const matchingRepos = filter
      ? repoState.available.filter(repo => matchesRepoFilter(repo, filter))
      : repoState.available;

    repoOptions.hidden = false;
    if (matchingRepos.length === 0) {
      const empty = document.createElement("div");
      empty.className = "field-hint";
      empty.textContent = "No configured repos match this filter.";
      repoOptions.append(empty);
      return;
    }

    for (const repo of matchingRepos) {
      const option = document.createElement("label");
      option.className = "repo-option";

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = repoState.selected.has(repo.name);
      checkbox.setAttribute("data-repo-name", repo.name);
      option.append(checkbox);

      const text = document.createElement("div");
      const name = document.createElement("div");
      name.className = "repo-option-name";
      name.textContent = repo.name;
      text.append(name);

      const meta = document.createElement("div");
      meta.className = "repo-option-meta";
      meta.textContent = formatRepoMeta(repo);
      text.append(meta);

      if (repo.description) {
        const description = document.createElement("div");
        description.className = "repo-option-description";
        description.textContent = repo.description;
        text.append(description);
      }

      option.append(text);
      repoOptions.append(option);
    }
  }

  function matchesRepoFilter(repo, filter) {
    const aliases = Array.isArray(repo.aliases) ? repo.aliases : [];
    return [repo.name, repo.description || "", repo.defaultBranch || ""]
      .concat(aliases)
      .some(value => String(value).toLowerCase().includes(filter));
  }

  function formatRepoMeta(repo) {
    const parts = [];
    if (repo.defaultBranch) {
      parts.push(repo.defaultBranch);
    }
    if (Array.isArray(repo.aliases) && repo.aliases.length > 0) {
      parts.push("aliases: " + repo.aliases.join(", "));
    }
    return parts.join(" · ");
  }

  function renderUploads() {
    uploadList.textContent = "";
    if (uiState.uploads.length === 0) {
      return;
    }

    for (const upload of uiState.uploads) {
      const item = document.createElement("div");
      item.className = "upload-item";

      const icon = document.createElement("div");
      icon.className = "upload-icon";
      icon.textContent = getUploadIconLabel(upload);
      item.append(icon);

      const copy = document.createElement("div");
      const name = document.createElement("div");
      name.className = "upload-name";
      name.textContent = upload.name;
      copy.append(name);

      const meta = document.createElement("div");
      meta.className = "upload-meta";
      meta.textContent = [
        getUploadTypeLabel(upload),
        formatByteLabel(upload.sizeBytes)
      ].filter(Boolean).join(" · ");
      copy.append(meta);
      item.append(copy);

      const status = document.createElement("div");
      status.className = "upload-status " + getUploadStatusClass(upload.status);
      status.textContent = getUploadStatusLabel(upload);
      item.append(status);

      const removeButton = document.createElement("button");
      removeButton.type = "button";
      removeButton.className = "remove-upload";
      removeButton.setAttribute("data-upload-local-id", upload.localId);
      removeButton.setAttribute("aria-label", "Remove " + upload.name);
      removeButton.textContent = "×";
      item.append(removeButton);

      uploadList.append(item);
    }
  }

  function connectSse(eventsUrl) {
    closeSse();
    eventSource = new EventSource(eventsUrl);

    eventSource.addEventListener("snapshot", event => {
      const job = JSON.parse(event.data);
      uiState.currentJob = job;
      renderJob(job);
      if (job.status === "completed" || job.status === "failed") {
        closeSse();
      }
    });

    ["started", "status", "completed", "failed"].forEach(type => {
      eventSource.addEventListener(type, event => {
        const update = JSON.parse(event.data);
        applyJobEvent(type, update);
      });
    });

    eventSource.onerror = () => {
      if (eventSource && eventSource.readyState === EventSource.CLOSED) {
        closeSse();
      }
    };
  }

  function applyJobEvent(type, event) {
    if (!uiState.currentJob) {
      return;
    }

    const currentJob = uiState.currentJob;
    const nextEvents = Array.isArray(currentJob.events) ? currentJob.events.slice() : [];
    if (!nextEvents.some(existing => existing.sequence === event.sequence)) {
      nextEvents.push(event);
    }

    uiState.currentJob = {
      ...currentJob,
      status: type === "failed"
        ? "failed"
        : type === "completed"
          ? "completed"
          : currentJob.status === "queued"
            ? "running"
            : currentJob.status,
      startedAt: type === "started" && !currentJob.startedAt ? event.timestamp : currentJob.startedAt,
      finishedAt: type === "completed" || type === "failed" ? event.timestamp : currentJob.finishedAt,
      error: type === "failed" ? event.message : currentJob.error,
      events: nextEvents
    };

    renderJob(uiState.currentJob);
  }

  function renderJob(job) {
    renderProgress(job);
    renderStatusLog();
    renderSummary(job);

    if (!job) {
      return;
    }

    if (job.status === "completed") {
      renderCompletedAnswer(job);
      finishRun();
      return;
    }

    if (job.status === "failed") {
      showError(job.error || "Job failed.");
      finishRun();
      return;
    }

    renderRunningAnswer("Generating answer...");
  }

  function renderProgress(job) {
    progressSteps.textContent = "";
    const computedSteps = computeProgressSteps(job);
    for (const step of computedSteps) {
      const item = document.createElement("div");
      item.className = "progress-step " + step.state;

      const marker = document.createElement("div");
      marker.className = "step-marker";
      item.append(marker);

      const text = document.createElement("div");
      const title = document.createElement("div");
      title.className = "step-title";
      title.textContent = step.title;
      text.append(title);

      const description = document.createElement("div");
      description.className = "step-description";
      description.textContent = step.description;
      text.append(description);
      item.append(text);

      const time = document.createElement("div");
      time.className = "step-time";
      time.textContent = step.timestamp ? formatClock(step.timestamp) : "";
      item.append(time);

      progressSteps.append(item);
    }
  }

  function computeProgressSteps(job) {
    const events = Array.isArray(job && job.events) ? job.events : [];
    const selectionComplete = findLastEvent(events, event => /^(Requested repos|Resolved repos|All repos)\b/u.test(event.message));
    const syncRelevantEvents = events.filter(event => isSyncEvent(event.message));
    const syncComplete = job && job.result ? {
      message: summarizeSyncReport(job.result.syncReport, Boolean(job.request && job.request.noSync)),
      timestamp: getSyncTimestamp(syncRelevantEvents, findFirstEvent(events, event => isCodexEvent(event.message)), job.finishedAt || job.createdAt)
    } : null;
    const codexStart = findFirstEvent(events, event => isCodexEvent(event.message));
    const codexComplete = findLastEvent(events, event => typeof event.message === "string" && event.message.startsWith(CODEX_COMPLETED_STATUS_PREFIX));
    const terminalState = job ? job.status : "queued";

    return PROGRESS_STEPS.map(step => {
      if (step.key === "created") {
        return {
          title: step.title,
          state: job ? (terminalState === "queued" ? "active" : "completed") : "active",
          description: job ? "Your job has been created." : step.waitingMessage,
          timestamp: job ? job.createdAt : ""
        };
      }

      if (step.key === "selection") {
        if (!job) {
          return waitingStep(step);
        }

        if (selectionComplete) {
          return completedStep(step, selectionComplete.message, selectionComplete.timestamp);
        }

        if (terminalState === "failed") {
          return failedStep(step, job.error || "Selection failed.");
        }

        return activeStep(step, "Selecting repositories...", job.startedAt || job.createdAt);
      }

      if (step.key === "sync") {
        if (!job || !selectionComplete) {
          return waitingStep(step);
        }

        if (syncComplete) {
          return completedStep(step, syncComplete.message, syncComplete.timestamp);
        }

        if (terminalState === "failed") {
          return failedStep(step, job.error || "Sync failed.");
        }

        const liveSyncMessage = findLastEvent(syncRelevantEvents, () => true);
        return activeStep(step, liveSyncMessage ? liveSyncMessage.message : "Synchronizing repositories...", liveSyncMessage ? liveSyncMessage.timestamp : selectionComplete.timestamp);
      }

      if (step.key === "codex") {
        if (!job || !selectionComplete) {
          return waitingStep(step);
        }

        if (job.result && job.result.mode === "retrieval-only") {
          return completedStep(step, "Skipped in retrieval-only mode.", job.finishedAt || job.createdAt);
        }

        if (codexComplete) {
          return completedStep(step, codexComplete.message, codexComplete.timestamp);
        }

        if (terminalState === "failed" && codexStart) {
          return failedStep(step, job.error || "Codex execution failed.", codexStart.timestamp);
        }

        if (codexStart) {
          return activeStep(step, getLatestCodexMessage(events), codexStart.timestamp);
        }

        if (syncComplete) {
          return activeStep(step, "Waiting to start Codex...", syncComplete.timestamp);
        }

        return waitingStep(step);
      }

      if (!job) {
        return waitingStep(step);
      }

      if (terminalState === "completed") {
        return completedStep(step, "Answer ready.", job.finishedAt || job.createdAt);
      }

      if (terminalState === "failed") {
        return failedStep(step, job.error || "Synthesis failed.", job.finishedAt || job.createdAt);
      }

      return waitingStep(step);
    });
  }

  function renderStatusLog() {
    const events = Array.isArray(uiState.currentJob && uiState.currentJob.events) ? uiState.currentJob.events : [];
    if (events.length === 0) {
      statusLog.textContent = "No log output yet.";
    } else {
      statusLog.textContent = events
        .filter(event => event && typeof event.message === "string" && event.message.trim())
        .map(event => "[" + formatClock(event.timestamp) + "] " + event.message)
        .join("\\n");
    }

    statusLog.hidden = !uiState.logExpanded;
    toggleLogButton.textContent = uiState.logExpanded ? "Hide Full Log" : "View Full Log";
  }

  function renderSummary(job) {
    afterRun.textContent = "";

    if (!job || (job.status !== "completed" && job.status !== "failed")) {
      const placeholder = document.createElement("div");
      placeholder.className = "summary-placeholder";
      placeholder.innerHTML = [
        '<div class="placeholder-copy">',
        '<span class="placeholder-title">We\\'ll show which repositories were used</span>',
        '<div class="muted-copy">and a summary of what happened after your job completes.</div>',
        "</div>"
      ].join("");
      afterRun.append(placeholder);
      return;
    }

    const result = job.result || null;
    const selectedRepos = Array.isArray(result && result.selectedRepos) ? result.selectedRepos : [];
    const syncReport = Array.isArray(result && result.syncReport) ? result.syncReport : [];
    const repoDirectories = new Map(syncReport.filter(item => item && item.name).map(item => [item.name, item.directory || ""]));
    const repoList = document.createElement("div");
    repoList.className = "repo-summary-list";

    if (selectedRepos.length > 0) {
      for (const repo of selectedRepos) {
        const repoItem = document.createElement("div");
        repoItem.className = "repo-summary-item";

        const name = document.createElement("div");
        name.className = "repo-summary-name";
        name.textContent = repo.name;
        repoItem.append(name);

        const meta = document.createElement("div");
        meta.className = "summary-meta";
        meta.textContent = repoDirectories.get(repo.name) || "Selected by the routing step.";
        repoItem.append(meta);

        repoList.append(repoItem);
      }
    } else {
      const empty = document.createElement("div");
      empty.className = "muted-copy";
      empty.textContent = "No repository summary was produced.";
      repoList.append(empty);
    }

    const stats = document.createElement("div");
    stats.className = "summary-stats";
    [
      { label: "Repositories used", value: String(selectedRepos.length) },
      { label: "Total duration", value: formatDuration(job.createdAt, job.finishedAt || job.createdAt) },
      { label: "Steps completed", value: String(computeProgressSteps(job).filter(step => step.state === "completed").length) }
    ].forEach(stat => {
      const element = document.createElement("div");
      element.className = "summary-stat";
      element.innerHTML = [
        '<span class="summary-value">' + escapeHtml(stat.value) + "</span>",
        '<span class="summary-label">' + escapeHtml(stat.label) + "</span>"
      ].join("");
      stats.append(element);
    });

    const status = document.createElement("div");
    status.className = "summary-status " + (job.status === "completed" ? "completed" : "failed");
    status.textContent = job.status === "completed" ? "Completed successfully" : "Completed with errors";

    afterRun.append(repoList, stats, status);
  }

  function renderCompletedAnswer(job) {
    if (job.result && job.result.synthesis && typeof job.result.synthesis.text === "string") {
      uiState.answerMarkdown = job.result.synthesis.text;
      answerContent.innerHTML = renderMarkdown(uiState.answerMarkdown);
      answerContent.hidden = false;
      answerPlaceholder.hidden = true;
      copyAnswerButton.disabled = false;
      downloadAnswerButton.disabled = false;
      setCopyButtonLabel("Copy Answer", false);
      clearError();
      return;
    }

    if (job.result && job.result.mode === "retrieval-only") {
      const repoNames = (job.result.selectedRepos || []).map(repo => repo.name).join(", ");
      uiState.answerMarkdown = "Retrieval only. Selected repos: " + (repoNames || "none");
      answerContent.innerHTML = renderMarkdown(uiState.answerMarkdown);
      answerContent.hidden = false;
      answerPlaceholder.hidden = true;
      copyAnswerButton.disabled = false;
      downloadAnswerButton.disabled = false;
      clearError();
      return;
    }

    renderRunningAnswer("Answer ready, but no synthesis text was returned.");
  }

  function renderRunningAnswer(title) {
    answerPlaceholder.hidden = false;
    answerContent.hidden = true;
    answerPlaceholder.innerHTML = [
      '<div class="placeholder-copy">',
      '<span class="placeholder-title">' + escapeHtml(title) + "</span>",
      '<div class="muted-copy">This may take a minute. You can keep this tab open.</div>',
      "</div>"
    ].join("");
    copyAnswerButton.disabled = true;
    downloadAnswerButton.disabled = true;
  }

  function showError(message) {
    errorBox.textContent = message;
    errorBox.hidden = false;
    answerContent.hidden = true;
    answerPlaceholder.hidden = false;
    answerPlaceholder.innerHTML = [
      '<div class="placeholder-copy">',
      '<span class="placeholder-title">The run failed</span>',
      '<div class="muted-copy">Check the progress log for more detail.</div>',
      "</div>"
    ].join("");
  }

  function clearError() {
    errorBox.textContent = "";
    errorBox.hidden = true;
  }

  function resetJobUi() {
    clearTimeout(copyFeedbackTimer);
    uiState.answerMarkdown = "";
    uiState.currentJob = null;
    uiState.logExpanded = false;
    answerContent.hidden = true;
    answerContent.innerHTML = "";
    answerPlaceholder.hidden = false;
    answerPlaceholder.innerHTML = [
      '<div class="placeholder-copy">',
      '<span class="placeholder-title">Your answer will appear here</span>',
      '<div class="muted-copy">Run your job to see the results.</div>',
      "</div>"
    ].join("");
    copyAnswerButton.disabled = true;
    downloadAnswerButton.disabled = true;
    copyAnswerButton.textContent = "Copy Answer";
    clearError();
    renderProgress(null);
    renderStatusLog();
    renderSummary(null);
  }

  function closeSse() {
    if (eventSource) {
      eventSource.close();
      eventSource = null;
    }
  }

  function finishRun() {
    closeSse();
    submitButton.disabled = false;
    submitButton.textContent = "Ask (Run Job)";
  }

  function setCopyButtonLabel(label, reset) {
    clearTimeout(copyFeedbackTimer);
    copyAnswerButton.textContent = label;
    if (!reset || label === "Copy Answer") {
      return;
    }

    copyFeedbackTimer = setTimeout(() => {
      copyAnswerButton.textContent = "Copy Answer";
    }, 1_500);
  }

  async function copyText(text) {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
      await navigator.clipboard.writeText(text);
      return;
    }

    const temporaryField = document.createElement("textarea");
    temporaryField.value = text;
    document.body.append(temporaryField);
    temporaryField.focus();
    temporaryField.select();
    document.execCommand("copy");
    temporaryField.remove();
  }

  function showTopMessage(message) {
    topMessage.textContent = message;
    topMessage.hidden = !message;
  }

  function clearTopMessage() {
    showTopMessage("");
  }

  function renderMarkdown(markdown) {
    const lines = String(markdown || "").replace(/\\r\\n?/gu, "\\n").split("\\n");
    const blocks = [];
    let paragraph = [];
    let listItems = [];
    let listType = "";
    let codeLines = [];
    let codeFence = false;

    function flushParagraph() {
      if (paragraph.length === 0) {
        return;
      }

      blocks.push("<p>" + renderInline(paragraph.join(" ")) + "</p>");
      paragraph = [];
    }

    function flushList() {
      if (listItems.length === 0 || !listType) {
        return;
      }

      blocks.push("<" + listType + ">" + listItems.join("") + "</" + listType + ">");
      listItems = [];
      listType = "";
    }

    function flushCode() {
      if (!codeFence) {
        return;
      }

      blocks.push("<pre><code>" + escapeHtml(codeLines.join("\\n")) + "</code></pre>");
      codeLines = [];
      codeFence = false;
    }

    for (const line of lines) {
      if (/^\`\`\`/u.test(line)) {
        flushParagraph();
        flushList();
        if (codeFence) {
          flushCode();
        } else {
          codeFence = true;
        }
        continue;
      }

      if (codeFence) {
        codeLines.push(line);
        continue;
      }

      if (!line.trim()) {
        flushParagraph();
        flushList();
        continue;
      }

      const headingMatch = line.match(/^(#{1,3})\\s+(.*)$/u);
      if (headingMatch) {
        flushParagraph();
        flushList();
        const level = headingMatch[1].length;
        blocks.push("<h" + level + ">" + renderInline(headingMatch[2]) + "</h" + level + ">");
        continue;
      }

      const orderedMatch = line.match(/^\\d+\\.\\s+(.*)$/u);
      if (orderedMatch) {
        flushParagraph();
        if (listType && listType !== "ol") {
          flushList();
        }
        listType = "ol";
        listItems.push("<li>" + renderInline(orderedMatch[1]) + "</li>");
        continue;
      }

      const bulletMatch = line.match(/^[-*]\\s+(.*)$/u);
      if (bulletMatch) {
        flushParagraph();
        if (listType && listType !== "ul") {
          flushList();
        }
        listType = "ul";
        listItems.push("<li>" + renderInline(bulletMatch[1]) + "</li>");
        continue;
      }

      paragraph.push(line.trim());
    }

    flushParagraph();
    flushList();
    flushCode();

    return blocks.join("");
  }

  function renderInline(text) {
    return escapeHtml(text)
      .replace(/\\*\\*(.+?)\\*\\*/gu, "<strong>$1</strong>")
      .replace(/\`([^\`]+)\`/gu, "<code>$1</code>")
      .replace(/\\[([^\\]]+)\\]\\((https?:\\/\\/[^\\s)]+)\\)/gu, '<a href="$2" target="_blank" rel="noreferrer">$1</a>');
  }

  function escapeHtml(text) {
    return String(text)
      .replace(/&/gu, "&amp;")
      .replace(/</gu, "&lt;")
      .replace(/>/gu, "&gt;")
      .replace(/"/gu, "&quot;")
      .replace(/'/gu, "&#39;");
  }

  function waitingStep(step) {
    return {
      title: step.title,
      state: "waiting",
      description: step.waitingMessage,
      timestamp: ""
    };
  }

  function activeStep(step, description, timestamp) {
    return {
      title: step.title,
      state: "active",
      description,
      timestamp
    };
  }

  function completedStep(step, description, timestamp) {
    return {
      title: step.title,
      state: "completed",
      description,
      timestamp
    };
  }

  function failedStep(step, description, timestamp) {
    return {
      title: step.title,
      state: "failed",
      description,
      timestamp: timestamp || ""
    };
  }

  function findFirstEvent(events, matcher) {
    return events.find(matcher) || null;
  }

  function findLastEvent(events, matcher) {
    for (let index = events.length - 1; index >= 0; index -= 1) {
      const event = events[index];
      if (matcher(event)) {
        return event;
      }
    }

    return null;
  }

  function isCodexEvent(message) {
    return typeof message === "string" && message.startsWith(CODEX_STATUS_PREFIX);
  }

  function isSyncEvent(message) {
    return /^(Cloning|Updating|Waiting for)\\b/u.test(message)
      || /^Skip repo sync:/u.test(message)
      || /^[^:]+: (cloned|updated|skipped|failed)/u.test(message);
  }

  function getLatestCodexMessage(events) {
    const event = findLastEvent(events, current => isCodexEvent(current.message));
    return event ? event.message : "Running Codex...";
  }

  function summarizeSyncReport(syncReport, noSync) {
    if (noSync) {
      return "Skipped by request.";
    }

    if (!Array.isArray(syncReport) || syncReport.length === 0) {
      return "Waiting";
    }

    const failed = syncReport.filter(item => item.action === "failed").length;
    if (failed > 0) {
      return failed + " repo sync failure" + (failed === 1 ? "" : "s") + ".";
    }

    const cloned = syncReport.filter(item => item.action === "cloned").length;
    const updated = syncReport.filter(item => item.action === "updated").length;
    if (cloned + updated > 0) {
      return (cloned + updated) + " repos synchronized.";
    }

    return "Up to date.";
  }

  function getSyncTimestamp(syncEvents, codexStart, fallbackTimestamp) {
    if (syncEvents.length > 0) {
      return syncEvents[syncEvents.length - 1].timestamp;
    }

    if (codexStart) {
      return codexStart.timestamp;
    }

    return fallbackTimestamp || "";
  }

  function formatClock(timestamp) {
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) {
      return "";
    }

    return date.toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit"
    });
  }

  function formatDuration(startTimestamp, endTimestamp) {
    const start = Date.parse(startTimestamp || "");
    const end = Date.parse(endTimestamp || "");
    if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) {
      return "n/a";
    }

    const totalSeconds = Math.round((end - start) / 1_000);
    if (totalSeconds < 60) {
      return totalSeconds + "s";
    }

    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    if (minutes < 60) {
      return minutes + "m " + String(seconds).padStart(2, "0") + "s";
    }

    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return hours + "h " + String(remainingMinutes).padStart(2, "0") + "m";
  }

  function formatByteLabel(sizeBytes) {
    if (sizeBytes < 1024) {
      return sizeBytes + " B";
    }
    if (sizeBytes < 1024 * 1024) {
      return (sizeBytes / 1024).toFixed(1) + " KB";
    }
    return (sizeBytes / (1024 * 1024)).toFixed(1) + " MB";
  }

  function inferUploadKind(mediaType, name) {
    if (String(mediaType || "").startsWith("image/")) {
      return "image";
    }

    if (/\\.(txt|md|markdown|json|yml|yaml|xml|csv|tsv|js|jsx|ts|tsx|css|html|log)$/iu.test(name || "")) {
      return "text";
    }

    return "binary";
  }

  function getUploadIconLabel(upload) {
    if (upload.kind === "image") {
      return "IMG";
    }
    if (upload.kind === "text") {
      return "TXT";
    }
    return "PDF";
  }

  function getUploadTypeLabel(upload) {
    const mediaType = String(upload.mediaType || "").toLowerCase();
    if (mediaType.includes("pdf")) {
      return "PDF";
    }
    if (mediaType.startsWith("image/")) {
      return mediaType.replace("image/", "").toUpperCase();
    }
    if (mediaType.startsWith("video/")) {
      return mediaType.replace("video/", "").toUpperCase();
    }
    if (upload.kind === "text") {
      return "TXT";
    }
    return mediaType || "FILE";
  }

  function getUploadStatusClass(status) {
    if (status === "uploaded") {
      return "success";
    }
    if (status === "error") {
      return "error";
    }
    return "pending";
  }

  function getUploadStatusLabel(upload) {
    if (upload.status === "uploaded") {
      return "Uploaded";
    }
    if (upload.status === "error") {
      return upload.error || "Upload failed";
    }
    return "Uploading…";
  }
})();
</script>
</body>
</html>`;

function formatByteLabel(sizeBytes: number): string {
  if (sizeBytes < 1_024) {
    return `${sizeBytes} B`;
  }

  if (sizeBytes < 1_024 * 1_024) {
    return `${(sizeBytes / 1_024).toFixed(1)} KB`;
  }

  return `${(sizeBytes / (1_024 * 1_024)).toFixed(1)} MB`;
}
