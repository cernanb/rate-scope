"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
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
  searchParams: {
    code?: string;
    type?: string;
    npi?: string;
    ein?: string;
    facility?: string;
    page?: string;
  };
};

export default function RateSearch({ metadata, searchParams }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [result, setResult] = useState<QueryResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>();
  function buildUrl(params: SearchParams, page?: number) {
    const urlParams = new URLSearchParams({ code: params.code });
    if (params.type) urlParams.set("type", params.type);
    if (params.npi) urlParams.set("npi", params.npi);
    if (params.ein) urlParams.set("ein", params.ein);
    if (params.facility) urlParams.set("facility", params.facility);
    if (page && page > 1) urlParams.set("page", String(page));
    return `${pathname}?${urlParams}`;
  }

  const initialValues: SearchParams | undefined = searchParams.code
    ? {
        code: searchParams.code,
        type: searchParams.type,
        npi: searchParams.npi,
        ein: searchParams.ein,
        facility: searchParams.facility,
      }
    : undefined;

  useEffect(() => {
    if (!initialValues) return;
    const page = searchParams.page ? Math.max(1, parseInt(searchParams.page, 10)) : 1;
    fetchPage(initialValues, page);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function handleClear() {
    setResult(null);
    setError(null);
    router.replace(pathname);
  }

  async function fetchPage(params: SearchParams, page: number) {
    setLoading(true);
    setError(null);
    try {
      const urlParams = new URLSearchParams({ code: params.code });
      if (params.type) urlParams.set("type", params.type);
      if (params.npi) urlParams.set("npi", params.npi);
      if (params.ein) urlParams.set("ein", params.ein);
      if (params.facility) urlParams.set("facility", params.facility);
      if (page > 1) urlParams.set("page", String(page));
      const res = await fetch(`/api/rates?${urlParams}`);
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

  async function handleSearch(params: SearchParams) {
    setResult(null);
    router.replace(buildUrl(params));
    await fetchPage(params, 1);
  }

  function handlePageChange(page: number) {
    if (!searchParams.code) return;
    const params: SearchParams = {
      code: searchParams.code,
      type: searchParams.type,
      npi: searchParams.npi,
      ein: searchParams.ein,
      facility: searchParams.facility,
    };
    router.replace(buildUrl(params, page));
    fetchPage(params, page);
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
          initialValues={initialValues}
        />

        <div className="mt-6">
          {error && (
            <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </p>
          )}

          {result && (
            <ResultsTable
              result={result}
              onPageChange={handlePageChange}
              loading={loading}
            />
          )}

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
