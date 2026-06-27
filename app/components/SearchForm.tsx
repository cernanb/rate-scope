"use client";

import { useState } from "react";

export type SearchParams = {
  code: string;
  type?: string;
  npi?: string;
  ein?: string;
  facility?: string;
};

type Props = {
  onSearch: (params: SearchParams) => void;
  loading: boolean;
};

export default function SearchForm({ onSearch, loading }: Props) {
  const [code, setCode] = useState("");
  const [type, setType] = useState("");
  const [npi, setNpi] = useState("");
  const [ein, setEin] = useState("");
  const [facility, setFacility] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) return;
    onSearch({
      code: code.trim(),
      type: type.trim() || undefined,
      npi: npi.trim() || undefined,
      ein: ein.trim() || undefined,
      facility: facility.trim() || undefined,
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-lg border border-zinc-200 bg-white p-6"
    >
      <div className="flex gap-3">
        <div className="flex-1">
          <label
            htmlFor="code"
            className="mb-1.5 block text-xs font-medium text-zinc-700"
          >
            Billing Code <span className="text-red-500">*</span>
          </label>
          <input
            id="code"
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="e.g. 510, 99213"
            required
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
          />
        </div>

        <div className="w-28">
          <label
            htmlFor="type"
            className="mb-1.5 block text-xs font-medium text-zinc-700"
          >
            Type
          </label>
          <input
            id="type"
            type="text"
            value={type}
            onChange={(e) => setType(e.target.value)}
            placeholder="e.g. CPT"
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
          />
        </div>
      </div>

      <div className="mt-3 flex gap-3">
        <div className="flex-1">
          <label
            htmlFor="facility"
            className="mb-1.5 block text-xs font-medium text-zinc-700"
          >
            Facility Name
          </label>
          <input
            id="facility"
            type="text"
            value={facility}
            onChange={(e) => setFacility(e.target.value)}
            placeholder="e.g. presbyterian"
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
          />
        </div>

        <div className="flex-1">
          <label
            htmlFor="npi"
            className="mb-1.5 block text-xs font-medium text-zinc-700"
          >
            NPI
          </label>
          <input
            id="npi"
            type="text"
            value={npi}
            onChange={(e) => setNpi(e.target.value)}
            placeholder="10-digit NPI"
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
          />
        </div>

        <div className="flex-1">
          <label
            htmlFor="ein"
            className="mb-1.5 block text-xs font-medium text-zinc-700"
          >
            EIN
          </label>
          <input
            id="ein"
            type="text"
            value={ein}
            onChange={(e) => setEin(e.target.value)}
            placeholder="e.g. 12-3456789"
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
          />
        </div>
      </div>

      <div className="mt-4 flex justify-end">
        <button
          type="submit"
          disabled={loading || !code.trim()}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "Searching…" : "Search"}
        </button>
      </div>
    </form>
  );
}
