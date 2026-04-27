import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import { saveAttachments } from "../src/server/attachments.ts";

describe("server attachments", () => {
  it("returns an empty result when no files are provided", async () => {
    const saved = await saveAttachments([]);

    expect(saved.refs).toEqual([]);
    await expect(saved.cleanup()).resolves.toBeUndefined();
  });

  it("saves files with sanitized paths and fallback media types", async () => {
    const saved = await saveAttachments([
      {
        bytes: new TextEncoder().encode("hello"),
        mediaType: "",
        name: "../notes.txt"
      },
      {
        bytes: new TextEncoder().encode("fallback"),
        mediaType: "text/plain",
        name: "   "
      }
    ]);

    try {
      expect(saved.refs).toHaveLength(2);
      expect(saved.refs[0]).toMatchObject({
        name: "../notes.txt",
        mediaType: "application/octet-stream",
        size: 5
      });
      expect(saved.refs[0]?.path).toMatch(/_notes\.txt$/u);
      expect(await readFile(saved.refs[0]?.path ?? "", "utf8")).toBe("hello");
      expect(saved.refs[1]?.path).toMatch(/attachment$/u);
    } finally {
      await saved.cleanup();
    }
  });

  it("rejects too many files", async () => {
    const incoming = Array.from({ length: 9 }, (_value, index) => ({
      bytes: new Uint8Array(),
      mediaType: "text/plain",
      name: `file-${index}.txt`
    }));

    await expect(saveAttachments(incoming)).rejects.toMatchObject({
      message: "Attach at most 8 files.",
      statusCode: 400
    });
  });

  it("rejects oversized files", async () => {
    await expect(saveAttachments([
      {
        bytes: new Uint8Array(100 * 1024 * 1024 + 1),
        mediaType: "application/octet-stream",
        name: "large.bin"
      }
    ])).rejects.toMatchObject({
      message: "large.bin exceeds the 104857600 byte attachment limit.",
      statusCode: 413
    });
  });
});
