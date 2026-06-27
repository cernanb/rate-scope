"use client";

import { useState } from "react";
import type { QueryResult } from "@/lib/query";
import SearchForm, { type SearchParams } from "./SearchForm";
import ResultsTable from "./ResultsTable";

type StoreMetadata = {
  sourceUrl: string;
  ingestDate: string;
  chosenFile: string;
};

type Props = {
  metadata: StoreMetadata | null;
};

export default function RateSearch({ metadata }: Props) {
  const [result, setResult] = useState<QueryResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>();

  function handleClear() {
    setResult(null);
    setError(null);
  }

  async function handleSearch(params: SearchParams) {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const searchParams = new URLSearchParams({ code: params.code });
      if (params.type) searchParams.set("type", params.type);
      if (params.npi) searchParams.set("npi", params.npi);
      if (params.ein) searchParams.set("ein", params.ein);
      if (params.facility) searchParams.set("facility", params.facility);
      const res = await fetch(`/api/rates?${searchParams}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Request failed (${res.status})`);
      }
      setResult(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 font-sans">
      <header className="border-b border-zinc-200 bg-white px-6 py-5">
        <div className="mx-auto max-w-5xl">
          <h1 className="text-xl font-semibold tracking-tight text-zinc-900">
            Rate Scope
          </h1>
          <p className="mt-0.5 text-sm text-zinc-500">
            Search negotiated rates from health insurance transparency files
          </p>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-8">
        <SearchForm
          onClear={handleClear}
          onSearch={handleSearch}
          loading={loading}
        />

        <div className="mt-6">
          {error && (
            <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </p>
          )}

          {result && <ResultsTable result={result} />}

          {!result && !loading && !error && (
            <p className="mt-8 text-center text-sm text-zinc-400">
              Enter a billing code above to see negotiated rates.
            </p>
          )}

          {loading && (
            <p className="mt-8 text-center text-sm text-zinc-400">Loading…</p>
          )}
        </div>
      </main>

      <footer className="border-t border-zinc-200 bg-white px-6 py-4">
        <div className="mx-auto max-w-5xl">
          {metadata ? (
            <p className="text-xs text-zinc-400">
              Source:{" "}
              <a
                href={metadata.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-zinc-600"
              >
                {metadata.chosenFile}
              </a>{" "}
              · ingested{" "}
              {new Date(metadata.ingestDate).toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </p>
          ) : (
            <p className="text-xs text-zinc-400">No data loaded.</p>
          )}
        </div>
      </footer>
    </div>
  );
}
