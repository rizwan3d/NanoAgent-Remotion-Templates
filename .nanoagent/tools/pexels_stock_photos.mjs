#!/usr/bin/env node

import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const ORIENTATIONS = new Set(["landscape", "portrait", "square"]);
const MEDIA_TYPES = new Set(["photo", "video"]);
const PHOTO_SIZES = new Set(["original", "large2x", "large", "medium", "small"]);
const VIDEO_SIZES = new Set(["large", "medium", "small"]);

const readStdinJson = async () => {
  const chunks = [];

  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }

  const raw = Buffer.concat(chunks).toString("utf8").trim();

  if (!raw) {
    return {};
  }

  return JSON.parse(raw);
};

const writeResponse = (payload) => {
  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
};

const invalidArguments = (message, details = {}) => {
  writeResponse({
    status: "invalid_arguments",
    message,
    data: details,
    renderText: message,
  });
  process.exit(0);
};

const executionError = (message, details = {}) => {
  writeResponse({
    status: "error",
    message,
    data: details,
    renderText: message,
  });
  process.exit(0);
};

const getWorkspacePath = (payload) => {
  return payload?.session?.workspacePath || process.cwd();
};

const normalizeArgs = (args) => {
  const query = typeof args.query === "string" ? args.query.trim() : "";

  if (!query) {
    invalidArguments("Missing required argument: query");
  }

  const media =
    typeof args.media === "string"
      ? args.media
      : "photo";

  if (!MEDIA_TYPES.has(media)) {
    invalidArguments("media must be photo or video");
  }

  const orientation = ORIENTATIONS.has(args.orientation)
    ? args.orientation
    : "landscape";

  const requestedSize = typeof args.size === "string" ? args.size : "";
  if (requestedSize && media === "video" && !VIDEO_SIZES.has(requestedSize)) {
    invalidArguments("size for video must be large, medium, or small");
  }

  if (requestedSize && media === "photo" && !PHOTO_SIZES.has(requestedSize)) {
    invalidArguments("size for photo must be original, large2x, large, medium, or small");
  }

  const size =
    media === "video"
      ? VIDEO_SIZES.has(requestedSize)
        ? requestedSize
        : "large"
      : PHOTO_SIZES.has(requestedSize)
        ? requestedSize
        : "large2x";
  const countNumber = Number(args.count ?? 1);
  const count = Number.isFinite(countNumber)
    ? Math.max(1, Math.min(Math.round(countNumber), 10))
    : 1;

  const props =
    typeof args.props === "string" && args.props.trim()
      ? args.props.trim()
      : "out/pexels-props.json";

  return {
    query,
    media,
    orientation,
    count,
    size,
    title: typeof args.title === "string" ? args.title.trim() : "",
    subtitle: typeof args.subtitle === "string" ? args.subtitle.trim() : "",
    props,
  };
};

const runNodeScript = ({ workspacePath, args }) => {
  return new Promise((resolve) => {
    const scriptArgs = [
      "scripts/pexels-assets.mjs",
      "--query",
      args.query,
      "--media",
      args.media,
      "--orientation",
      args.orientation,
      "--count",
      String(args.count),
      "--size",
      args.size,
      "--props",
      args.props,
    ];

    if (args.title) {
      scriptArgs.push("--title", args.title);
    }

    if (args.subtitle) {
      scriptArgs.push("--subtitle", args.subtitle);
    }

    const child = spawn(process.execPath, scriptArgs, {
      cwd: workspacePath,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("close", (code) => {
      resolve({ code, stdout, stderr, command: `${process.execPath} ${scriptArgs.join(" ")}` });
    });
  });
};

const readJsonIfExists = async (workspacePath, filePath) => {
  try {
    const absolutePath = path.resolve(workspacePath, filePath);
    const raw = await fs.readFile(absolutePath, "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const main = async () => {
  let payload;

  try {
    payload = await readStdinJson();
  } catch (error) {
    invalidArguments("Input was not valid JSON.", { error: String(error) });
  }

  const args = normalizeArgs(payload.arguments || {});
  const workspacePath = getWorkspacePath(payload);
  const result = await runNodeScript({ workspacePath, args });

  if (result.code !== 0) {
    executionError("Pexels stock photo tool failed.", {
      command: result.command,
      stdout: result.stdout,
      stderr: result.stderr,
    });
  }

  const propsJson = await readJsonIfExists(workspacePath, args.props);
  const manifestJson = await readJsonIfExists(workspacePath, "public/stock/manifest.json");

  writeResponse({
    status: "success",
    message: `Saved Pexels stock ${args.media} assets and generated Remotion props.`,
    data: {
      provider: "pexels",
      media: args.media,
      query: args.query,
      orientation: args.orientation,
      count: args.count,
      size: args.size,
      storageDir: "public/stock",
      manifestPath: "public/stock/manifest.json",
      propsPath: args.props,
      backgroundImage: propsJson?.backgroundImage || null,
      backgroundVideo: propsJson?.backgroundVideo || null,
      attribution: propsJson?.attribution || null,
      manifestPhotoCount: Array.isArray(manifestJson?.photos)
        ? manifestJson.photos.length
        : null,
      manifestVideoCount: Array.isArray(manifestJson?.videos)
        ? manifestJson.videos.length
        : null,
      stdout: result.stdout.trim(),
    },
    renderText: propsJson?.backgroundVideo
      ? `Saved ${args.count} Pexels video(s). Use ${propsJson.backgroundVideo} as backgroundVideo.`
      : propsJson?.backgroundImage
        ? `Saved ${args.count} Pexels photo(s). Use ${propsJson.backgroundImage} as backgroundImage.`
        : `Saved ${args.count} Pexels ${args.media}(s) and wrote props to ${args.props}.`,
  });
};

main().catch((error) => {
  executionError("Unexpected Pexels stock photo tool error.", {
    error: error instanceof Error ? error.message : String(error),
  });
});
