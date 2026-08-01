import { mkdir, mkdtemp, readFile, rm, symlink, utimes, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { pruneNextImageCache } from "../../scripts/prune-next-image-cache.mjs";

const temporaryRoots: string[] = [];

afterEach(async () => {
  vi.restoreAllMocks();
  for (const root of temporaryRoots.splice(0)) {
    await rm(root, { recursive: true, force: true });
  }
});

async function temporaryRoot() {
  const root = await mkdtemp(path.join(os.tmpdir(), "nutsnews-image-cache-test-"));
  temporaryRoots.push(root);
  return root;
}

describe("Next.js optimized-image cache pruning", () => {
  it("removes expired files and then the oldest files until the byte limit is met", async () => {
    const root = await temporaryRoot();
    const nowMs = Date.UTC(2026, 6, 31, 12);
    const oldPath = path.join(root, "old.webp");
    const oldestRetainedPath = path.join(root, "oldest-retained.webp");
    const newestPath = path.join(root, "newest.webp");
    await writeFile(oldPath, "old!");
    await writeFile(oldestRetainedPath, "123456");
    await writeFile(newestPath, "abcdef");
    await utimes(oldPath, new Date(nowMs - 31 * 86_400_000), new Date(nowMs - 31 * 86_400_000));
    await utimes(oldestRetainedPath, new Date(nowMs - 2_000), new Date(nowMs - 2_000));
    await utimes(newestPath, new Date(nowMs - 1_000), new Date(nowMs - 1_000));
    vi.spyOn(console, "log").mockImplementation(() => {});

    const result = await pruneNextImageCache({ cacheRoot: root, maxBytes: 6, nowMs });

    expect(result).toMatchObject({ bytes: 6, fileCount: 1, removedBytes: 10, removedFileCount: 2 });
    await expect(readFile(newestPath, "utf8")).resolves.toBe("abcdef");
    await expect(readFile(oldPath)).rejects.toMatchObject({ code: "ENOENT" });
    await expect(readFile(oldestRetainedPath)).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("never follows a nested symbolic link into unrelated data", async () => {
    const root = await temporaryRoot();
    const unrelatedRoot = await temporaryRoot();
    const unrelatedFile = path.join(unrelatedRoot, "keep.txt");
    await writeFile(unrelatedFile, "keep me");
    await mkdir(path.join(root, "nested"));
    await symlink(unrelatedRoot, path.join(root, "nested", "outside"));
    vi.spyOn(console, "log").mockImplementation(() => {});

    await pruneNextImageCache({ cacheRoot: root, maxBytes: 0, maxAgeMs: 0 });

    await expect(readFile(unrelatedFile, "utf8")).resolves.toBe("keep me");
  });

  it("refuses a filesystem root even in test mode", async () => {
    await expect(pruneNextImageCache({ cacheRoot: path.parse(process.cwd()).root })).rejects.toThrow(
      "Refusing to prune an unexpected image-cache path",
    );
  });
});
