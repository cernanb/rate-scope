import type { QueryResult } from "@/lib/query";

const ROW_CAP = 200;

const fmt = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

type Props = {
  result: QueryResult;
};

export default function ResultsTable({ result }: Props) {
  const rows = result.rows.slice(0, ROW_CAP);

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
          {result.count <= ROW_CAP
            ? `${result.count} result${result.count !== 1 ? "s" : ""}`
            : `showing ${ROW_CAP} of ${result.count.toLocaleString()}`}
        </span>
      </div>

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
              <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500">
                Expiration
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
                <td className="px-4 py-3 text-zinc-600">
                  {row.expirationDate ? (
                    new Date(row.expirationDate).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })
                  ) : (
                    <span className="text-zinc-400">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
