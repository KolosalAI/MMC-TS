"use client";

import { useState, useRef } from "react";
import { useGGUFReader } from "@/hooks/useGGUFReader";
import {
  KVQuantization,
  KVQ_LABELS,
  CONTEXT_PRESETS,
  ModelParams,
  MemoryUsage,
} from "@/lib/gguf/types";
import { formatMemorySize } from "@/lib/gguf/calculator";

const DEFAULT_URL =
  "https://huggingface.co/unsloth/Qwen3-30B-A3B-Instruct-2507-GGUF/resolve/main/Qwen3-30B-A3B-Instruct-2507-UD-Q4_K_XL.gguf";

export default function Home() {
  const [url, setUrl] = useState(DEFAULT_URL);
  const [contextPreset, setContextPreset] = useState("4096");
  const [customContext, setCustomContext] = useState("");
  const [kvQuantization, setKvQuantization] =
    useState<KVQuantization>("fp16");
  const [verbose, setVerbose] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const { loading, params, usage, error, logs, readUrl, readFile } =
    useGGUFReader();

  const resolveContextTokens = (): number => {
    if (contextPreset === "__custom") {
      const v = parseInt(customContext, 10);
      if (!Number.isFinite(v) || v < 1) return 1;
      return v;
    }
    return Math.max(1, parseInt(contextPreset || "4096", 10));
  };

  const handleReadUrl = () => {
    const ctx = resolveContextTokens();
    readUrl(url, ctx, kvQuantization, verbose);
  };

  const handleReadFile = () => {
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    const ctx = resolveContextTokens();
    readFile(file, ctx, kvQuantization, verbose);
  };

  return (
    <main className="min-h-screen p-4 sm:p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">
        GGUF Memory Calculator
      </h1>

      {/* Input Card */}
      <div className="border border-neutral-300 dark:border-neutral-700 rounded-xl p-5 mb-5">
        {/* URL Input */}
        <div className="mb-4">
          <label
            htmlFor="url"
            className="block font-semibold mb-1 text-sm"
          >
            GGUF URL
          </label>
          <input
            id="url"
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="https://huggingface.co/..."
          />
        </div>

        {/* Controls Row */}
        <div className="flex flex-wrap gap-4 items-end">
          {/* Local File */}
          <div>
            <label
              htmlFor="file"
              className="block font-semibold mb-1 text-sm"
            >
              Or choose a local GGUF file
            </label>
            <input
              id="file"
              ref={fileRef}
              type="file"
              accept=".gguf"
              className="text-sm"
            />
          </div>

          {/* Context Size */}
          <div>
            <label
              htmlFor="ctx"
              className="block font-semibold mb-1 text-sm"
            >
              Context size (tokens)
            </label>
            <div className="flex gap-2 items-center">
              <select
                id="ctx"
                value={contextPreset}
                onChange={(e) => setContextPreset(e.target.value)}
                className="px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-sm"
              >
                {CONTEXT_PRESETS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
                <option value="__custom">Custom…</option>
              </select>
              {contextPreset === "__custom" && (
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={customContext}
                  onChange={(e) => setCustomContext(e.target.value)}
                  placeholder="Tokens"
                  className="w-28 px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-sm"
                />
              )}
            </div>
          </div>

          {/* KV Quantization */}
          <div>
            <label
              htmlFor="kvq"
              className="block font-semibold mb-1 text-sm"
            >
              KV cache quantization
            </label>
            <select
              id="kvq"
              value={kvQuantization}
              onChange={(e) =>
                setKvQuantization(e.target.value as KVQuantization)
              }
              className="px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-sm"
            >
              {(
                Object.entries(KVQ_LABELS) as [
                  KVQuantization,
                  string,
                ][]
              ).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          {/* Verbose */}
          <label className="flex items-center gap-2 text-sm cursor-pointer self-center">
            <input
              type="checkbox"
              checked={verbose}
              onChange={(e) => setVerbose(e.target.checked)}
            />
            Verbose
          </label>
        </div>

        {/* Buttons */}
        <div className="flex gap-3 mt-4">
          <button
            onClick={handleReadUrl}
            disabled={loading}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium transition-colors"
          >
            {loading ? "Working…" : "Read URL"}
          </button>
          <button
            onClick={handleReadFile}
            disabled={loading}
            className="px-4 py-2 rounded-lg bg-neutral-700 hover:bg-neutral-600 disabled:opacity-50 text-white text-sm font-medium transition-colors"
          >
            {loading ? "Working…" : "Read File"}
          </button>
        </div>

        <p className="text-xs opacity-70 mt-3">
          Tip: Many hosts (like Hugging Face) support HTTP Range
          requests needed to avoid downloading the whole file.
        </p>
      </div>

      {/* Result Card */}
      <div className="border border-neutral-300 dark:border-neutral-700 rounded-xl p-5">
        <h2 className="text-lg font-bold mb-3">Result</h2>

        {error && (
          <p className="text-red-500 font-medium mb-3">{error}</p>
        )}

        {params && <ParamsDisplay params={params} />}
        {usage && <UsageDisplay usage={usage} />}

        {!params && !usage && !error && !loading && (
          <p className="text-sm opacity-60">
            Results will appear here after reading a GGUF file.
          </p>
        )}

        {loading && (
          <p className="text-sm opacity-60 animate-pulse">
            Reading GGUF metadata…
          </p>
        )}

        {/* Log */}
        {logs.length > 0 && (
          <pre className="mt-4 bg-black/5 dark:bg-white/5 p-3 rounded-lg text-xs overflow-auto max-h-60">
            {logs.join("\n")}
          </pre>
        )}
      </div>
    </main>
  );
}

function ParamsDisplay({ params }: { params: ModelParams }) {
  return (
    <div className="grid grid-cols-[max-content_1fr] gap-x-3 gap-y-1 text-sm mb-4">
      <div className="font-semibold">attention_heads</div>
      <div>{params.attention_heads}</div>
      <div className="font-semibold">kv_heads</div>
      <div>{params.kv_heads}</div>
      <div className="font-semibold">hidden_layers</div>
      <div>{params.hidden_layers}</div>
      <div className="font-semibold">hidden_size</div>
      <div>{params.hidden_size}</div>
      {params.parameter_count && (
        <>
          <div className="font-semibold">parameter_count</div>
          <div>
            {(params.parameter_count / 1e9).toFixed(2)}B
          </div>
        </>
      )}
      {params.split_count && (
        <>
          <div className="font-semibold">split_count</div>
          <div>{params.split_count}</div>
        </>
      )}
    </div>
  );
}

function UsageDisplay({ usage }: { usage: MemoryUsage }) {
  return (
    <div className="grid grid-cols-[max-content_1fr] gap-x-3 gap-y-1 text-sm">
      <div className="font-semibold">Model Size</div>
      <div>{formatMemorySize(usage.modelSizeMB)}</div>
      <div className="font-semibold">KV Cache</div>
      <div>{formatMemorySize(usage.kvCacheMB)}</div>
      <div className="font-semibold">Overhead</div>
      <div>{formatMemorySize(usage.overheadMB)}</div>
      <div className="font-semibold text-green-600 dark:text-green-400">
        Total Required
      </div>
      <div className="font-semibold text-green-600 dark:text-green-400">
        {formatMemorySize(usage.totalRequiredMB)}
      </div>
      <div className="font-semibold">KV Quantization</div>
      <div>{usage.kvq}</div>
      {usage.gqaRatio !== 1 && (
        <>
          <div className="font-semibold">GQA Ratio</div>
          <div>{usage.gqaRatio.toFixed(2)}</div>
        </>
      )}
      <div className="col-span-2 mt-2 text-xs opacity-70">
        {usage.displayString}
      </div>
    </div>
  );
}
