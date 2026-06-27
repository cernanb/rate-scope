import { PER_PAGE, type QueryResult } from "@/lib/query";

const fmt = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

type Props = {
  result: QueryResult;
  onPageChange: (page: number) => void;
  loading: boolean;
};

export default function ResultsTable({ result, onPageChange, loading }: Props) {
  const rows = result.rows;

  return (
    <div className="mt-6">
      <div className="mb-3 flex items-baseline justify-between">
        <div>
          <span className="text-sm font-medium text-zinc-900">
            {result.code}
          </span>
          {result.type && (
            <span className="ml-2 text-xs font-medium text-zinc-400">
              {result.type}
            </span>
          )}
          {result.name && (
            <span className="ml-2 text-sm text-zinc-500">{result.name}</span>
          )}
          {result.description && result.description !== result.name && (
            <p className="text-xs text-zinc-400">{result.description}</p>
          )}
        </div>
        <span className="shrink-0 text-xs text-zinc-400">
          {result.totalPages > 1
            ? `Showing ${((result.page - 1) * PER_PAGE + 1).toLocaleString()}–${((result.page - 1) * PER_PAGE + rows.length).toLocaleString()} of ${result.count.toLocaleString()}`
            : `${result.count.toLocaleString()} result${result.count !== 1 ? "s" : ""}`}
        </span>
      </div>
      {result.totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between mb-4">
          <button
            onClick={() => onPageChange(result.page - 1)}
            disabled={result.page <= 1 || loading}
            className="rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Previous
          </button>
          <span className="text-xs text-zinc-400">
            Page {result.page} of {result.totalPages}
          </span>
          <button
            onClick={() => onPageChange(result.page + 1)}
            disabled={result.page >= result.totalPages || loading}
            className="rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-zinc-200">
        <table className="w-full min-w-[800px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-50">
              <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500">
                Provider
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500">
                EIN
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-zinc-500">
                Rate
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500">
                Rate Type
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500">
                Modifiers
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500">
                Billing Class
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500">
                Setting
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500">
                Additional Info
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr
                key={i}
                className="border-b border-zinc-100 last:border-0 hover:bg-zinc-50"
              >
                <td className="px-4 py-3 text-zinc-900">
                  {row.businessName || <span className="text-zinc-400">—</span>}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-zinc-600">
                  {row.ein || <span className="text-zinc-400">—</span>}
                </td>
                <td className="px-4 py-3 text-right font-mono text-zinc-900">
                  {fmt.format(row.negotiatedRate)}
                </td>
                <td className="px-4 py-3 text-zinc-600">
                  {row.negotiatedType}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-zinc-600">
                  {row.modifiers.length > 0 ? (
                    row.modifiers.join(", ")
                  ) : (
                    <span className="text-zinc-400">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-zinc-600">{row.billingClass}</td>
                <td className="px-4 py-3 text-zinc-600">
                  {row.setting ?? <span className="text-zinc-400">—</span>}
                </td>
                <td
                  className="max-w-[200px] truncate px-4 py-3 text-zinc-600"
                  title={row.additionalInformation ?? undefined}
                >
                  {row.additionalInformation ?? (
                    <span className="text-zinc-400">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {result.totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <button
            onClick={() => onPageChange(result.page - 1)}
            disabled={result.page <= 1 || loading}
            className="rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Previous
          </button>
          <span className="text-xs text-zinc-400">
            Page {result.page} of {result.totalPages}
          </span>
          <button
            onClick={() => onPageChange(result.page + 1)}
            disabled={result.page >= result.totalPages || loading}
            className="rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
