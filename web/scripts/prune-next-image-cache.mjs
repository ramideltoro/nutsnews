#!/usr/bin/env node
import { lstat, mkdir, readdir, unlink } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const IMAGE_CACHE_ROOT = "/app/.next/cache/images";
const MAX_BYTES = 10 * 1024 * 1024 * 1024;
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1_000;
const WATCH_INTERVAL_MS = 60 * 60 * 1_000;

async function collectFiles(directory, files = []) {
  const entries = await readdir(directory, { withFileTypes: true });

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);

    if (entry.isSymbolicLink()) continue;
    if (entry.isDirectory()) {
      await collectFiles(entryPath, files);
      continue;
    }
    if (!entry.isFile()) continue;

    const stat = await lstat(entryPath);
    files.push({ path: entryPath, bytes: stat.size, modifiedAtMs: stat.mtimeMs });
  }

  return files;
}

export async function pruneNextImageCache({
  cacheRoot = IMAGE_CACHE_ROOT,
  maxAgeMs = MAX_AGE_MS,
  maxBytes = MAX_BYTES,
  nowMs = Date.now(),
} = {}) {
  const resolvedRoot = path.resolve(cacheRoot);
  const testRootAllowed = process.env.NODE_ENV === "test";

  if (
    !path.isAbsolute(cacheRoot) ||
    resolvedRoot === path.parse(resolvedRoot).root ||
    (!testRootAllowed && resolvedRoot !== IMAGE_CACHE_ROOT)
  ) {
    throw new Error("Refusing to prune an unexpected image-cache path");
  }

  await mkdir(resolvedRoot, { recursive: true });
  const rootStat = await lstat(resolvedRoot);

  if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) {
    throw new Error("Refusing to prune a non-directory or linked image-cache root");
  }

  const files = await collectFiles(resolvedRoot);
  const expired = files.filter((file) => nowMs - file.modifiedAtMs > maxAgeMs);
  const removedPaths = new Set();
  let removedBytes = 0;

  for (const file of expired) {
    await unlink(file.path);
    removedPaths.add(file.path);
    removedBytes += file.bytes;
  }

  const retained = files
    .filter((file) => !removedPaths.has(file.path))
    .sort((left, right) => left.modifiedAtMs - right.modifiedAtMs);
  let retainedBytes = retained.reduce((sum, file) => sum + file.bytes, 0);

  for (const file of retained) {
    if (retainedBytes <= maxBytes) break;
    await unlink(file.path);
    removedPaths.add(file.path);
    removedBytes += file.bytes;
    retainedBytes -= file.bytes;
  }

  const result = {
    event: "cache.image_storage.measured",
    cacheRoot: resolvedRoot,
    maxBytes,
    maxAgeDays: Math.round(maxAgeMs / (24 * 60 * 60 * 1_000)),
    bytes: retainedBytes,
    fileCount: files.length - removedPaths.size,
    removedBytes,
    removedFileCount: removedPaths.size,
    measuredAt: new Date(nowMs).toISOString(),
  };

  console.log(JSON.stringify(result));
  return result;
}

async function run() {
  try {
    await pruneNextImageCache();
  } catch (error) {
    console.error(JSON.stringify({
      event: "cache.image_storage.prune_failed",
      message: error instanceof Error ? error.message : String(error),
    }));
    if (process.argv.includes("--watch")) return;
    process.exitCode = 1;
  }
}

const isMainModule = Boolean(
  process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url)),
);

if (isMainModule) {
  await run();

  if (process.argv.includes("--watch")) {
    setInterval(run, WATCH_INTERVAL_MS);
  }
}
