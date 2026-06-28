# Rate Scope

A tool for searching in-network negotiated rates from Fidelis/Centene machine-readable files. Search by billing code, filter by provider name, NPI, or EIN.

## Setup

### Prerequisites

- Node.js 20+
- npm

### Install dependencies

```bash
npm install
```

### Ingest data

The app reads from a pre-built artifact at `data/store.json`. You need to generate it before running the dev server.

```bash
npm run ingest
```

This fetches the Fidelis in-network MRF, parses it as a stream, and writes the normalized artifact to `data/store.json`. Depending on your connection, expect it to take some time — the source file is large.

### Run the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Scripts

| Command          | Description                                                              |
| ---------------- | ------------------------------------------------------------------------ |
| `npm run ingest` | Fetch and parse the MRF, write `data/store.json`                         |
| `npm run dev`    | Start the Next.js dev server                                             |
| `npm run query`  | Run a one-off query against the local artifact (edit `scripts/query.ts`) |
| `npm run build`  | Production build                                                         |

---

## Architecture

The app is split into three layers:

- **Ingest** (`scripts/ingest.ts`) — streams the source MRF, parses it, and writes `data/store.json` in a normalized format
- **Store** (`lib/store.ts`) — loads `data/store.json` on first request and builds in-memory indexes
- **Query** (`lib/query.ts`) — filters and joins across the indexes to produce results

The data model mirrors a relational schema (billing codes, provider sub-groups, NPIs, rates, and junction tables for modifiers and service codes) stored as JSON.

---

## Tradeoffs

### JSON file vs. database

The take-home explicitly permits in-memory processing without a database, and the dataset fits that model well: 1,119 billing codes, ~8,500 rate rows, and ~5,800 provider sub-groups load comfortably into memory in under a second. For that scale, skipping a database removes a significant amount of setup and operational complexity with no real cost to query performance.

That said, the data model was designed to make a future migration straightforward. `data/store.json` is structured as normalized, relational tables — billing codes, provider sub-groups, NPIs, rates, and junction tables for modifiers and service codes — rather than a nested document. In Postgres, each top-level key becomes a table, foreign key relationships are already explicit, and the query logic in `lib/query.ts` maps directly to SQL joins. The main change would be replacing the in-memory index lookups in `lib/store.ts` with a connection pool and replacing the `for` loops in `lib/query.ts` with parameterized queries.

The tradeoff worth calling out is that the JSON approach requires loading the entire dataset into memory on startup and re-running ingest whenever the source file changes. A database would allow partial updates and queries without a full reload, which matters more as the dataset grows.

### In-memory store vs. query-time reads

On first request, `lib/store.ts` reads `data/store.json` in full and builds a set of in-memory indexes — rates keyed by billing code, sub-groups keyed by group ID, NPI, and EIN. Every subsequent query operates entirely in memory with no disk I/O. For this dataset (~8,500 rate rows, ~5,800 sub-groups), the store loads in under a second and adds roughly 50–100 MB to the heap.

The alternative would be to read and filter `data/store.json` on each request — streaming or partially parsing it to avoid loading everything at once. That would reduce memory pressure but make query latency proportional to file size, which defeats the purpose of having a pre-built artifact.

The in-memory approach works well here because the dataset is small, the Next.js server process is long-lived, and `globalThis` lets the store persist across requests without re-loading. The main limitation is that the store is not shared across multiple server instances — in a horizontally scaled deployment each instance would hold its own copy, which is wasteful but not incorrect. That is another place where a real database would be the right answer.

One intentional structural difference between the serialized and in-memory forms is worth noting. `data/store.json` stores everything as flat arrays — straightforward to write and valid portable JSON. On load, `lib/store.ts` inverts those arrays into a set of Maps keyed for the access patterns the query layer needs: rates by billing code, sub-groups by group ID, NPI, and EIN. The serialized and in-memory shapes are deliberately different — the JSON is optimized for writing, the Maps are optimized for reading.

### Duplicate billing codes with differing names

Some billing codes appear more than once in the source file with the same `billing_code` and `billing_code_type` but different `name` and `description` values. This happens because the same procedure code can be listed under multiple negotiated rate blocks, each carrying slightly different descriptive text — likely an artifact of how the payer assembles the MRF from multiple fee schedule sources.

During ingest, the first `name` and `description` encountered for a given code key wins and is stored in the `billingCodes` table. The `namesByKey` map tracks every distinct name seen per code, and any code with more than one distinct name is recorded in `multiNameCodes`.

At query time, if a code is in `multiNameCodes`, the API returns `null` for both `name` and `description` rather than surfacing a name that may only apply to a subset of the results. The UI omits the procedure name header in this case, which is preferable to displaying a potentially misleading label.

This was an acceptable tradeoff for this implementation because the primary mode of search is the billing code itself, not the procedure name. Users are expected to already know the code they are looking for — the name and description are supplementary context, not the search key. Dropping them in the ambiguous case does not break the search experience.

The cleaner long-term fix would be to store all observed names per billing code and surface them as alternatives, or to flag the ambiguity inline in the result so users know to verify the procedure description against an external code lookup.

### Streaming ingest vs. full parse

The Fidelis in-network file is large enough that loading it into memory with `JSON.parse` is not viable — doing so would exhaust the Node.js heap before the parse completes. The ingest script handles this by streaming the file with `stream-json`, which parses the JSON incrementally and emits only the top-level array items (`in_network` and `provider_references`) one at a time. Peak memory during ingest stays flat regardless of file size.

The tradeoff is that streaming makes the code more complex than a simple `fetch` + `JSON.parse`. The `stream-json` pipeline requires understanding how the library surfaces nested objects, and the `pick` filter has to be carefully scoped to avoid pulling in more data than intended. It also means the two top-level arrays (`in_network` and `provider_references`) are interleaved in a single pass, so provider group data has to be accumulated before it can be joined against rates — which is why the store artifact exists at all rather than querying the source file directly.

An alternative would be to require the source file to be downloaded separately and only process it locally, which would allow memory-mapped reads or a SQLite import. For the take-home scope, streaming directly from the remote URL keeps setup to a single `npm run ingest` command.

---

## What I Would Improve With More Time

- **Database-backed storage.** The JSON artifact works for this dataset, but migrating to Postgres would unlock incremental updates, multi-instance deployments, and the ability to query without loading everything into memory. The data model is already normalized and would map directly to tables with minimal changes to the query layer.

- **Search by procedure name.** The current UI requires users to know the billing code they are looking for. A name-based or fuzzy search would make the tool accessible to users who know what procedure they need but not its code. This would also resolve the multi-name ambiguity more gracefully — surfacing all matching codes rather than requiring an exact code entry.

- **Ingest multiple in-network files.** The index references more than one in-network file. The current ingest targets a single file by name match. A more complete implementation would process all referenced files and merge the results, with plan-level metadata attached to each rate row for filtering.

- **Stale data detection.** There is no mechanism to detect when the source file has been updated. A scheduled job that re-runs ingest when the upstream URL changes — or at least surfaces the `ingestDate` as a warning when it is older than a threshold — would make the tool more reliable in practice.

- **Tests.** The query logic in `lib/query.ts` is pure and deterministic, which makes it well-suited for unit tests. A small fixture of known billing codes and providers would let the filtering and pagination logic be verified without running a full ingest.

---

## Assumptions

### Provider TIN type

The CMS MRF schema allows `tin.type` to be either `"ein"` or `"npi"`. In this Fidelis file, all observed TINs are EIN-typed and carry a `business_name`. The ingest script guards against this explicitly — skipping any TIN where `type !== "ein"` or where `value` or `business_name` is missing — so the store only contains named EIN sub-groups. If a future file includes NPI-typed TINs or unnamed entries, they will be silently skipped rather than causing a parse error, but they also will not appear in search results.
