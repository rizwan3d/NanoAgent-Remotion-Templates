#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const ROOT = process.cwd();
const PUBLIC_ASSET_DIR = path.join(ROOT, "public", "stock");
const MANIFEST_PATH = path.join(PUBLIC_ASSET_DIR, "manifest.json");
const DEFAULT_PROPS_PATH = path.join(ROOT, "out", "pexels-props.json");
const PEXELS_PHOTO_SEARCH_URL = "https://api.pexels.com/v1/search";
const PEXELS_VIDEO_SEARCH_URL = "https://api.pexels.com/v1/videos/search";

const allowedMediaTypes = new Set(["photo", "video"]);
const allowedOrientations = new Set(["landscape", "portrait", "square"]);
const allowedPhotoSizes = new Set(["original", "large2x", "large", "medium", "small"]);
const allowedVideoSizes = new Set(["large", "medium", "small"]);

const help = `Usage:
  npm run assets:pexels -- --query "modern business team office" --orientation landscape --count 1 --props out/pexels-props.json

Required:
  --query <text>              Pexels search query

Optional:
  --media <value>             photo | video (default: photo)
  --orientation <value>       landscape | portrait | square (default: landscape)
  --count <number>            Number of assets to save, max 10 for this helper (default: 1)
  --size <value>              Photos: original | large2x | large | medium | small
                              Videos: large | medium | small
  --title <text>              Remotion title prop for the generated props file
  --subtitle <text>           Remotion subtitle prop for the generated props file
  --props <path>              Write Remotion props JSON to this path (default: out/pexels-props.json)
  --help                      Show this message

Environment:
  PEXELS_API_KEY must be available in your shell or in a .env file.
`;

const readDotEnv = async () => {
  const envPath = path.join(ROOT, ".env");

  try {
    const raw = await fs.readFile(envPath, "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
        continue;
      }

      const [key, ...valueParts] = trimmed.split("=");
      const value = valueParts.join("=").replace(/^['\"]|['\"]$/g, "");
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  } catch {
    // .env is optional. Users may provide PEXELS_API_KEY in their shell.
  }
};

const parseArgs = (argv) => {
  const args = {
    media: "photo",
    orientation: "landscape",
    count: 1,
    props: DEFAULT_PROPS_PATH,
    title: "NanoAgent Pexels Asset Demo",
    subtitle: "A local Remotion render using a Pexels asset",
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const next = argv[index + 1];

    if (token === "--help" || token === "-h") {
      console.log(help);
      process.exit(0);
    }

    if (!token.startsWith("--")) {
      continue;
    }

    const key = token.slice(2);
    if (next === undefined || next.startsWith("--")) {
      throw new Error(`Missing value for ${token}`);
    }

    args[key] = next;
    index += 1;
  }

  if (!args.query) {
    throw new Error("Missing required --query value.");
  }

  if (!allowedMediaTypes.has(args.media)) {
    throw new Error("--media must be photo or video.");
  }

  if (!allowedOrientations.has(args.orientation)) {
    throw new Error("--orientation must be landscape, portrait, or square.");
  }

  if (!args.size) {
    args.size = args.media === "video" ? "large" : "large2x";
  }

  if (args.media === "photo" && !allowedPhotoSizes.has(args.size)) {
    throw new Error("--size for photos must be original, large2x, large, medium, or small.");
  }

  if (args.media === "video" && !allowedVideoSizes.has(args.size)) {
    throw new Error("--size for videos must be large, medium, or small.");
  }

  args.count = Math.max(1, Math.min(Number(args.count) || 1, 10));

  return args;
};

const slug = (value) =>
  String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "pexels-asset";

const readManifest = async () => {
  try {
    const parsed = JSON.parse(await fs.readFile(MANIFEST_PATH, "utf8"));

    return {
      photos: Array.isArray(parsed.photos) ? parsed.photos : [],
      videos: Array.isArray(parsed.videos) ? parsed.videos : [],
    };
  } catch {
    return { photos: [], videos: [] };
  }
};

const writeJson = async (filePath, data) => {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`);
};

const chooseImageUrl = (photo, orientation, size) => {
  if (orientation === "landscape" && photo.src.landscape) {
    return photo.src.landscape;
  }

  if (orientation === "portrait" && photo.src.portrait) {
    return photo.src.portrait;
  }

  return photo.src[size] || photo.src.large2x || photo.src.large || photo.src.original;
};

const getRateLimit = (response) => ({
  limit: response.headers.get("x-ratelimit-limit"),
  remaining: response.headers.get("x-ratelimit-remaining"),
  reset: response.headers.get("x-ratelimit-reset"),
});

const searchPexelsPhotos = async ({ apiKey, query, orientation, count }) => {
  const url = new URL(PEXELS_PHOTO_SEARCH_URL);
  url.searchParams.set("query", query);
  url.searchParams.set("orientation", orientation);
  url.searchParams.set("per_page", String(count));

  const response = await fetch(url, {
    headers: {
      Authorization: apiKey,
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Pexels search failed (${response.status}): ${body}`);
  }

  const payload = await response.json();
  return {
    photos: Array.isArray(payload.photos) ? payload.photos : [],
    rateLimit: getRateLimit(response),
  };
};

const searchPexelsVideos = async ({ apiKey, query, orientation, size, count }) => {
  const url = new URL(PEXELS_VIDEO_SEARCH_URL);
  url.searchParams.set("query", query);
  url.searchParams.set("orientation", orientation);
  url.searchParams.set("size", size);
  url.searchParams.set("per_page", String(count));

  const response = await fetch(url, {
    headers: {
      Authorization: apiKey,
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Pexels video search failed (${response.status}): ${body}`);
  }

  const payload = await response.json();
  return {
    videos: Array.isArray(payload.videos) ? payload.videos : [],
    rateLimit: getRateLimit(response),
  };
};

const saveRemoteFile = async (url, filePath) => {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Asset save failed (${response.status}) for ${url}`);
  }

  const bytes = Buffer.from(await response.arrayBuffer());
  await fs.writeFile(filePath, bytes);
};

const toPhotoAssetRecord = ({ photo, query, orientation, publicPath, localPath, rateLimit }) => ({
  provider: "pexels",
  mediaType: "photo",
  id: photo.id,
  query,
  orientation,
  publicPath,
  localPath,
  width: photo.width,
  height: photo.height,
  photographer: photo.photographer,
  photographerUrl: photo.photographer_url,
  sourceUrl: photo.url,
  alt: photo.alt,
  downloadedAt: new Date().toISOString(),
  rateLimit,
});

const chooseVideoFile = (video, size) => {
  const targetLongEdge = {
    small: 1280,
    medium: 1920,
    large: 3840,
  }[size];

  const videoFiles = Array.isArray(video.video_files) ? video.video_files : [];
  const mp4Candidates = videoFiles.filter(
    (file) => file?.file_type === "video/mp4" && typeof file?.link === "string",
  );
  const dimensionalCandidates = mp4Candidates.filter(
    (file) => Number.isFinite(file.width) && Number.isFinite(file.height),
  );
  const candidates = dimensionalCandidates.length > 0 ? dimensionalCandidates : mp4Candidates;

  if (candidates.length === 0) {
    throw new Error(`No downloadable MP4 files found for Pexels video ${video.id}.`);
  }

  return [...candidates].sort((left, right) => {
    const leftLongEdge = Math.max(left.width || 0, left.height || 0);
    const rightLongEdge = Math.max(right.width || 0, right.height || 0);
    const leftDistance = Math.abs(leftLongEdge - targetLongEdge);
    const rightDistance = Math.abs(rightLongEdge - targetLongEdge);

    if (leftDistance !== rightDistance) {
      return leftDistance - rightDistance;
    }

    const leftMeetsTarget = leftLongEdge >= targetLongEdge;
    const rightMeetsTarget = rightLongEdge >= targetLongEdge;
    if (leftMeetsTarget !== rightMeetsTarget) {
      return leftMeetsTarget ? -1 : 1;
    }

    const leftArea = (left.width || 0) * (left.height || 0);
    const rightArea = (right.width || 0) * (right.height || 0);
    if (leftArea !== rightArea) {
      return rightArea - leftArea;
    }

    return (right.fps || 0) - (left.fps || 0);
  })[0];
};

const toVideoAssetRecord = ({
  video,
  videoFile,
  query,
  orientation,
  size,
  publicPath,
  localPath,
  rateLimit,
}) => ({
  provider: "pexels",
  mediaType: "video",
  id: video.id,
  query,
  orientation,
  size,
  publicPath,
  localPath,
  width: videoFile.width || video.width,
  height: videoFile.height || video.height,
  duration: video.duration,
  fps: videoFile.fps || null,
  quality: videoFile.quality || null,
  fileType: videoFile.file_type || null,
  videographer: video.user?.name || null,
  videographerUrl: video.user?.url || null,
  sourceUrl: video.url,
  previewImage: video.image || video.video_pictures?.[0]?.picture || null,
  downloadedAt: new Date().toISOString(),
  rateLimit,
});

const main = async () => {
  await readDotEnv();

  const options = parseArgs(process.argv.slice(2));
  const apiKey = process.env.PEXELS_API_KEY;

  if (!apiKey) {
    throw new Error("PEXELS_API_KEY is required. Add it to .env or export it in your shell.");
  }

  await fs.mkdir(PUBLIC_ASSET_DIR, { recursive: true });

  const manifest = await readManifest();
  const savedAssets = [];

  if (options.media === "photo") {
    const result = await searchPexelsPhotos({
      apiKey,
      query: options.query,
      orientation: options.orientation,
      count: options.count,
    });

    if (result.photos.length === 0) {
      throw new Error(`No Pexels photos found for query: ${options.query}`);
    }

    for (const photo of result.photos) {
      const imageUrl = chooseImageUrl(photo, options.orientation, options.size);
      const filename = `${slug(options.query)}-${options.orientation}-${photo.id}.jpg`;
      const localPath = path.join(PUBLIC_ASSET_DIR, filename);
      const publicPath = `/stock/${filename}`;

      await saveRemoteFile(imageUrl, localPath);

      const asset = toPhotoAssetRecord({
        photo,
        query: options.query,
        orientation: options.orientation,
        publicPath,
        localPath: path.relative(ROOT, localPath),
        rateLimit: result.rateLimit,
      });

      manifest.photos = manifest.photos.filter(
        (existing) => !(existing.provider === "pexels" && existing.id === photo.id),
      );
      manifest.photos.push(asset);
      savedAssets.push(asset);
    }
  } else {
    const result = await searchPexelsVideos({
      apiKey,
      query: options.query,
      orientation: options.orientation,
      size: options.size,
      count: options.count,
    });

    if (result.videos.length === 0) {
      throw new Error(`No Pexels videos found for query: ${options.query}`);
    }

    for (const video of result.videos) {
      const videoFile = chooseVideoFile(video, options.size);
      const filename = `${slug(options.query)}-${options.orientation}-${video.id}.mp4`;
      const localPath = path.join(PUBLIC_ASSET_DIR, filename);
      const publicPath = `/stock/${filename}`;

      await saveRemoteFile(videoFile.link, localPath);

      const asset = toVideoAssetRecord({
        video,
        videoFile,
        query: options.query,
        orientation: options.orientation,
        size: options.size,
        publicPath,
        localPath: path.relative(ROOT, localPath),
        rateLimit: result.rateLimit,
      });

      manifest.videos = manifest.videos.filter(
        (existing) => !(existing.provider === "pexels" && existing.id === video.id),
      );
      manifest.videos.push(asset);
      savedAssets.push(asset);
    }
  }

  await writeJson(MANIFEST_PATH, manifest);

  const selected = savedAssets[0];
  const props = {
    title: options.title,
    subtitle: options.subtitle,
    ...(selected.mediaType === "photo"
      ? {
          backgroundImage: selected.publicPath,
        }
      : {
          backgroundVideo: selected.publicPath,
        }),
    attribution: {
      provider: selected.provider,
      mediaType: selected.mediaType,
      creatorName: selected.mediaType === "photo" ? selected.photographer : selected.videographer,
      creatorUrl:
        selected.mediaType === "photo" ? selected.photographerUrl : selected.videographerUrl,
      sourceUrl: selected.sourceUrl,
    },
  };

  await writeJson(path.resolve(ROOT, options.props), props);

  console.log(
    `Saved ${savedAssets.length} ${options.media === "photo" ? "photo" : "video"} asset(s) to ${path.relative(ROOT, PUBLIC_ASSET_DIR)}`,
  );
  console.log(`Updated ${path.relative(ROOT, MANIFEST_PATH)}`);
  console.log(`Wrote Remotion props to ${path.relative(ROOT, path.resolve(ROOT, options.props))}`);
  console.log(`Use: npm run render:pexels-demo`);
};

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
