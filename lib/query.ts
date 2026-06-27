import { Rate, Store } from "./types";
import { normalizeEIN } from "./util";
export const PER_PAGE = 200;

type QueryParams = {
  code: string;
  type?: string;
  npi?: string;
  ein?: string;
  facility?: string;
  page?: number;
};

export type ResultRow = Rate & {
  businessName: string;
  ein: string;
};

export type QueryResult = {
  code: string;
  type: string | null;
  name: string | null;
  description: string | null;
  count: number;
  page: number;
  totalPages: number;
  rows: ResultRow[];
};

export function query(store: Store, params: QueryParams): QueryResult {
  const { providers, rates, multiNameCodes } = store;

  let rateList: Rate[][];
  let isMultiName = false;
  const page = params.page ?? 1;

  const suffix = `:${params.code}`;

  if (params.type) {
    const key = `${params.type.toUpperCase()}${suffix}`;
    const bucket = rates.get(key);
    rateList = bucket ? [bucket] : [];
    isMultiName = multiNameCodes.has(key);
  } else {
    const matching = [...store.rates.entries()].filter(([key]) =>
      key.endsWith(suffix),
    );
    rateList = matching.map(([, bucket]) => bucket);
    isMultiName = matching.some(([key]) => multiNameCodes.has(key));
  }

  const npi = params.npi?.trim();
  const ein = params.ein ? normalizeEIN(params.ein.trim()) : undefined;
  const facility = params.facility?.trim().toLowerCase();

  const rows: ResultRow[] = [];

  for (const rate of rateList.flat()) {
    const provider = providers.get(rate.groupId);
    if (!provider) continue;

    let subGroups = provider.subGroups;

    if (npi) subGroups = subGroups.filter((sg) => sg.npis.has(npi));
    if (ein) subGroups = subGroups.filter((sg) => normalizeEIN(sg.ein) === ein);
    if (facility)
      subGroups = subGroups.filter((sg) =>
        sg.businessName.toLowerCase().includes(facility),
      );

    for (const sg of subGroups) {
      rows.push({ ...rate, businessName: sg.businessName, ein: sg.ein });
    }
  }

  const paginatedRows = rows.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  return {
    code: params.code,
    type: params.type?.toUpperCase() ?? null,
    name: isMultiName ? null : (rows[0]?.name ?? null),
    description: isMultiName ? null : (rows[0]?.description ?? null),
    count: rows.length,
    page,
    totalPages: Math.max(1, Math.ceil(rows.length / PER_PAGE)),
    rows: paginatedRows,
  };
}
