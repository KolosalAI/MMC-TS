import { DataSource, BrowserFileDataSource } from "./data-source";
import { UrlDataSource } from "./url-data-source";
import { GGUFType, GGUF_MAGIC, ModelParams } from "./types";
import { readU32, readU64, readString } from "./binary";
import { parseSplitInfoFromUrl, buildSplitUrl } from "./shards";

async function skipArray(
  source: DataSource,
  elemType: number
): Promise<void> {
  const count = await readU64(source);
  if (count > 1000000) throw new Error(`Array count too large: ${count}`);
  for (let i = 0; i < count; i++) await skipValue(source, elemType);
}

async function skipValue(source: DataSource, type: number): Promise<void> {
  switch (type) {
    case GGUFType.UINT8:
    case GGUFType.INT8:
      await source.seek(source.tell() + 1);
      break;
    case GGUFType.UINT16:
    case GGUFType.INT16:
      await source.seek(source.tell() + 2);
      break;
    case GGUFType.UINT32:
    case GGUFType.INT32:
    case GGUFType.FLOAT32:
      await source.seek(source.tell() + 4);
      break;
    case GGUFType.BOOL:
      await source.seek(source.tell() + 1);
      break;
    case GGUFType.STRING: {
      const length = await readU64(source);
      if (length > 1024 * 1024) throw new Error(`String too long: ${length}`);
      await source.seek(source.tell() + length);
      break;
    }
    case GGUFType.ARRAY: {
      const elemTypeVal = await readU32(source);
      if (elemTypeVal >= GGUFType.MAX_TYPE)
        throw new Error(`Invalid array element type: ${elemTypeVal}`);
      await skipArray(source, elemTypeVal);
      break;
    }
    case GGUFType.UINT64:
    case GGUFType.INT64:
    case GGUFType.FLOAT64:
      await source.seek(source.tell() + 8);
      break;
    default:
      throw new Error(`Unknown GGUF type: ${type}`);
  }
}

export async function readModelParams(
  pathOrFile: string | File | Blob,
  options: {
    verbose?: boolean;
    logFn?: (...args: string[]) => void;
  } = {}
): Promise<ModelParams | null> {
  const { verbose = false, logFn } = options;
  const log = logFn || ((..._args: string[]) => {});
  const isUrl = typeof pathOrFile === "string";
  let source: DataSource;

  if (isUrl) {
    let metaUrl = pathOrFile;
    const info = parseSplitInfoFromUrl(metaUrl);
    if (info && info.index > 1) {
      metaUrl = buildSplitUrl(metaUrl, 1, info.width);
      if (verbose)
        log(
          `[Split] Non-first shard provided; reading metadata from: ${metaUrl}`
        );
    }
    source = new UrlDataSource(metaUrl, { verbose, logFn });
  } else {
    source = new BrowserFileDataSource(pathOrFile as File | Blob);
  }

  const magic = await readU32(source);
  if (magic !== GGUF_MAGIC) {
    if (verbose)
      log(`Invalid GGUF file format. Magic number: 0x${magic.toString(16)}`);
    return null;
  }

  const version = await readU32(source);
  if (version > 3) {
    if (verbose) log(`Unsupported GGUF version: ${version}`);
    return null;
  }
  if (verbose) log(`GGUF version: ${version}`);

  let tensorCount = 0;
  if (version >= 1) {
    tensorCount = await readU64(source);
    if (verbose) log(`Tensor count: ${tensorCount}`);
  }

  const metadataCount = await readU64(source);
  if (verbose) log(`Metadata count: ${metadataCount}`);

  const suffixes = [
    ".attention.head_count",
    ".attention.head_count_kv",
    ".block_count",
    ".embedding_length",
    "split.count",
    "general.parameter_count",
  ];

  const params: Partial<ModelParams> = {};
  const found = {
    attention_heads: false,
    kv_heads: false,
    hidden_layers: false,
    hidden_size: false,
    split_count: false,
    parameter_count: false,
  };

  for (let i = 0; i < metadataCount && !source.eof(); i++) {
    let key: string;
    try {
      key = await readString(source);
    } catch (e) {
      throw new Error(
        `Failed to read key: ${e instanceof Error ? e.message : e}`
      );
    }

    const typeVal = await readU32(source);
    if (typeVal >= GGUFType.MAX_TYPE)
      throw new Error(`Invalid metadata type: ${typeVal} for key: ${key}`);
    if (verbose) log(`Key: ${key}, Type: ${typeVal}`);

    const matchedSuffix = suffixes.find((s) => key.endsWith(s));
    if (matchedSuffix) {
      if (
        matchedSuffix === ".attention.head_count" &&
        (typeVal === GGUFType.UINT32 || typeVal === GGUFType.INT32)
      ) {
        const value = await readU32(source);
        params.attention_heads = value;
        found.attention_heads = true;
        if (verbose) log(`  Found attention_heads: ${value} (from key: ${key})`);
      } else if (
        matchedSuffix === ".attention.head_count_kv" &&
        (typeVal === GGUFType.UINT32 || typeVal === GGUFType.INT32)
      ) {
        const value = await readU32(source);
        params.kv_heads = value;
        found.kv_heads = true;
        if (verbose) log(`  Found kv_heads: ${value} (from key: ${key})`);
      } else if (
        matchedSuffix === ".block_count" &&
        (typeVal === GGUFType.UINT32 || typeVal === GGUFType.INT32)
      ) {
        const value = await readU32(source);
        params.hidden_layers = value;
        found.hidden_layers = true;
        if (verbose) log(`  Found hidden_layers: ${value} (from key: ${key})`);
      } else if (matchedSuffix === ".embedding_length") {
        if (typeVal === GGUFType.UINT64 || typeVal === GGUFType.INT64) {
          const value = await readU64(source);
          params.hidden_size = value;
          found.hidden_size = true;
          if (verbose) log(`  Found hidden_size: ${value} (from key: ${key})`);
        } else if (typeVal === GGUFType.UINT32 || typeVal === GGUFType.INT32) {
          const value = await readU32(source);
          params.hidden_size = value;
          found.hidden_size = true;
          if (verbose) log(`  Found hidden_size: ${value} (from key: ${key})`);
        } else {
          await skipValue(source, typeVal);
        }
      } else if (matchedSuffix === "split.count") {
        if (typeVal === GGUFType.UINT64 || typeVal === GGUFType.INT64) {
          const value = await readU64(source);
          params.split_count = value;
          found.split_count = true;
          if (verbose) log(`  Found split_count: ${value} (from key: ${key})`);
        } else if (typeVal === GGUFType.UINT32 || typeVal === GGUFType.INT32) {
          const value = await readU32(source);
          params.split_count = value;
          found.split_count = true;
          if (verbose) log(`  Found split_count: ${value} (from key: ${key})`);
        } else {
          await skipValue(source, typeVal);
        }
      } else if (matchedSuffix === "general.parameter_count") {
        if (typeVal === GGUFType.UINT64 || typeVal === GGUFType.INT64) {
          const value = await readU64(source);
          params.parameter_count = value;
          found.parameter_count = true;
          if (verbose)
            log(`  Found parameter_count: ${value} (from key: ${key})`);
        } else if (typeVal === GGUFType.UINT32 || typeVal === GGUFType.INT32) {
          const value = await readU32(source);
          params.parameter_count = value;
          found.parameter_count = true;
          if (verbose)
            log(`  Found parameter_count: ${value} (from key: ${key})`);
        } else {
          await skipValue(source, typeVal);
        }
      } else {
        await skipValue(source, typeVal);
      }
    } else {
      await skipValue(source, typeVal);
    }

    if (
      found.attention_heads &&
      found.hidden_layers &&
      found.hidden_size &&
      (found.kv_heads || found.attention_heads)
    ) {
      if (isUrl) {
        source.setAbortFlag?.();
        if (verbose) log("All required metadata found, aborting download");
      }
      break;
    }
  }

  // Fallback: if kv_heads not found, default to attention_heads
  if (!found.kv_heads && found.attention_heads) {
    params.kv_heads = params.attention_heads;
    found.kv_heads = true;
    if (verbose) log(`  Using attention_heads as kv_heads: ${params.kv_heads}`);
  }

  const allFound = found.attention_heads && found.hidden_layers && found.hidden_size;
  if (!allFound) {
    if (verbose) log("Failed to find all required model parameters.");
    return null;
  }

  return params as ModelParams;
}
