"use client";

import { useState, useCallback } from "react";
import {
  ModelParams,
  MemoryUsage,
  KVQuantization,
} from "@/lib/gguf/types";
import { readModelParams } from "@/lib/gguf/parser";
import { computeMemoryUsage } from "@/lib/gguf/calculator";
import { normalizeHuggingFaceUrl } from "@/lib/gguf/shards";
import {
  getRemoteFileSize,
  totalSplitSizeFromUrl,
} from "@/lib/gguf/remote-size";

interface GGUFReaderState {
  loading: boolean;
  params: ModelParams | null;
  usage: MemoryUsage | null;
  error: string | null;
  logs: string[];
}

export function useGGUFReader() {
  const [state, setState] = useState<GGUFReaderState>({
    loading: false,
    params: null,
    usage: null,
    error: null,
    logs: [],
  });

  const addLog = useCallback((msg: string) => {
    setState((prev) => ({ ...prev, logs: [...prev.logs, msg] }));
  }, []);

  const readUrl = useCallback(
    async (
      url: string,
      contextSize: number,
      kvQuantization: KVQuantization,
      verbose: boolean
    ) => {
      setState({
        loading: true,
        params: null,
        usage: null,
        error: null,
        logs: [],
      });
      const logFn = verbose
        ? (...args: string[]) => {
            setState((prev) => ({
              ...prev,
              logs: [...prev.logs, args.join(" ")],
            }));
          }
        : undefined;

      try {
        const normalized = normalizeHuggingFaceUrl(url.trim());
        const params = await readModelParams(normalized, {
          verbose,
          logFn,
        });
        if (!params) {
          setState((prev) => ({
            ...prev,
            loading: false,
            error: "Failed to read params.",
          }));
          return;
        }
        let sizeBytesTotal = await totalSplitSizeFromUrl(
          normalized,
          params,
          { verbose, logFn }
        );
        if (!sizeBytesTotal) {
          const single = await getRemoteFileSize(normalized, {
            verbose,
            logFn,
          });
          if (!single) {
            setState((prev) => ({
              ...prev,
              loading: false,
              params,
              error:
                "Could not determine file size (CORS/Range?).",
            }));
            return;
          }
          sizeBytesTotal = single;
        }
        const usage = computeMemoryUsage(
          params,
          sizeBytesTotal,
          contextSize,
          kvQuantization
        );
        setState({
          loading: false,
          params,
          usage,
          error: null,
          logs: [],
        });
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        setState((prev) => ({ ...prev, loading: false, error: msg }));
      }
    },
    []
  );

  const readFile = useCallback(
    async (
      file: File,
      contextSize: number,
      kvQuantization: KVQuantization,
      verbose: boolean
    ) => {
      setState({
        loading: true,
        params: null,
        usage: null,
        error: null,
        logs: [],
      });
      const logFn = verbose
        ? (...args: string[]) => {
            setState((prev) => ({
              ...prev,
              logs: [...prev.logs, args.join(" ")],
            }));
          }
        : undefined;

      try {
        const params = await readModelParams(file, { verbose, logFn });
        if (!params) {
          setState((prev) => ({
            ...prev,
            loading: false,
            error: "Failed to read params.",
          }));
          return;
        }
        let totalBytes = file.size;
        if (params.split_count && params.split_count > 1) {
          const m = file.name.match(
            /-(\d{2,})-of-(\d{2,})(?=\.|$)/
          );
          const inferredTotal = m
            ? Number(m[2])
            : params.split_count;
          if (Number.isFinite(inferredTotal) && inferredTotal > 1) {
            totalBytes = file.size * inferredTotal;
          }
        }
        const usage = computeMemoryUsage(
          params,
          totalBytes,
          contextSize,
          kvQuantization
        );
        setState({
          loading: false,
          params,
          usage,
          error: null,
          logs: [],
        });
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        setState((prev) => ({ ...prev, loading: false, error: msg }));
      }
    },
    []
  );

  return { ...state, addLog, readUrl, readFile };
}
