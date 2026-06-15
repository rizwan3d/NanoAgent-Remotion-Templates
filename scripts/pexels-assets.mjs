#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const ROOT = process.cwd();
const PUBLIC_ASSET_DIR = path.join(ROOT, "public", "stock");
const MANIFEST_PATH = path.join(PUBLIC_ASSET_DIR, "manifest.json");
const DEFAULT_PROPS_PATH = path.join(ROOT, "out", "pexels-props.json");
const PEXELS_SEARCH_URL = "https://api.pexels.com/v1/search";

const allowedOrientations = new Set(["landscape", "portrait", "square"]);
const allowedSizes = new Set(["original", "large2x", "large", "medium", "small"]);

const help = `Usage:
  npm run assets:pexels -- --query "modern business team office" --orientation landscape --count 1 --props out/pexels-props.json

Required:
  --query <text>              Pexels search query

Optional:
  --orientation <value>       landscape | portrait | square (default: landscape)
  --count <number>            Number of images to save, max 10 for this helper (default: 1)
  --size <value>              original | large2x | large | medium | small (default: large2x)
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
    orientation: "landscape",
    count: 1,
    size: "large2x",
    props: DEFAULT_PROPS_PATH,
    title: "NanoAgent Pexels Asset Demo",
    subtitle: "A local Remotion render using a Pexels image",
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

  if (!allowedOrientations.has(args.orientation)) {
    throw new Error("--orientation must be landscape, portrait, or square.");
  }

  if (!allowedSizes.has(args.size)) {
    throw new Error("--size must be original, large2x, large, medium, or small.");
  }

  args.count = Math.max(1, Math.min(Number(args.count) || 1, 10));

  return args;
};

const slug = (value) =>
  String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "pexels-image";

const readManifest = async () => {
  try {
    return JSON.parse(await fs.readFile(MANIFEST_PATH, "utf8"));
  } catch {
    return { photos: [] };
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

const searchPexels = async ({ apiKey, query, orientation, count }) => {
  const url = new URL(PEXELS_SEARCH_URL);
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
    rateLimit: {
      limit: response.headers.get("x-ratelimit-limit"),
      remaining: response.headers.get("x-ratelimit-remaining"),
      reset: response.headers.get("x-ratelimit-reset"),
    },
  };
};

const saveRemoteImage = async (url, filePath) => {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Image save failed (${response.status}) for ${url}`);
  }

  const bytes = Buffer.from(await response.arrayBuffer());
  await fs.writeFile(filePath, bytes);
};

const toAssetRecord = ({ photo, query, orientation, publicPath, localPath, rateLimit }) => ({
  provider: "pexels",
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

const main = async () => {
  await readDotEnv();

  const options = parseArgs(process.argv.slice(2));
  const apiKey = process.env.PEXELS_API_KEY;

  if (!apiKey) {
    throw new Error("PEXELS_API_KEY is required. Add it to .env or export it in your shell.");
  }

  await fs.mkdir(PUBLIC_ASSET_DIR, { recursive: true });

  const manifest = await readManifest();
  const result = await searchPexels({
    apiKey,
    query: options.query,
    orientation: options.orientation,
    count: options.count,
  });

  if (result.photos.length === 0) {
    throw new Error(`No Pexels photos found for query: ${options.query}`);
  }

  const savedAssets = [];

  for (const photo of result.photos) {
    const imageUrl = chooseImageUrl(photo, options.orientation, options.size);
    const filename = `${slug(options.query)}-${options.orientation}-${photo.id}.jpg`;
    const localPath = path.join(PUBLIC_ASSET_DIR, filename);
    const publicPath = `/stock/${filename}`;

    await saveRemoteImage(imageUrl, localPath);

    const asset = toAssetRecord({
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

  await writeJson(MANIFEST_PATH, manifest);

  const selected = savedAssets[0];
  const props = {
    title: options.title,
    subtitle: options.subtitle,
    backgroundImage: selected.publicPath,
    attribution: {
      provider: selected.provider,
      photographer: selected.photographer,
      photographerUrl: selected.photographerUrl,
      sourceUrl: selected.sourceUrl,
    },
  };

  await writeJson(path.resolve(ROOT, options.props), props);

  console.log(`Saved ${savedAssets.length} image(s) to ${path.relative(ROOT, PUBLIC_ASSET_DIR)}`);
  console.log(`Updated ${path.relative(ROOT, MANIFEST_PATH)}`);
  console.log(`Wrote Remotion props to ${path.relative(ROOT, path.resolve(ROOT, options.props))}`);
  console.log(`Use: npm run render:pexels-demo`);
};

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
