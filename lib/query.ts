import { Rate, Store } from "./types";
import { normalizeEIN } from "./util";

type QueryParams = {
  code: string;
  type?: string;
  npi?: string;
  ein?: string;
  facility?: string;
};

type ResultRow = Rate & {
  businessNames: string[];
  eins: string[];
};

type QueryResult = {
  code: string;
  type: string | null;
  name: string | null;
  description: string | null;
  count: number;
  rows: ResultRow[];
};

export function query(store: Store, params: QueryParams): QueryResult {
  const { providers, rates } = store;

  let rateList: Rate[][];

  const suffix = `:${params.code}`;

  if (params.type) {
    // get the rates for the specific type with the code
    const key = `${params.type}${suffix}`;

    const bucket = rates.get(key);
    rateList = bucket ? [bucket] : [];
  } else {
    // get all rates that end with the code suffix
    rateList = [...store.rates.entries()]
      .filter(([key]) => key.endsWith(suffix))
      .map(([, bucket]) => bucket);
  }

  const rowCandidates = rateList.flat();

  let filteredRateCandidates = rowCandidates;

  if (params.npi) {
    filteredRateCandidates = filteredRateCandidates.filter((rate) => {
      const provider = providers.get(rate.groupId);
      return provider?.npis.has(params.npi!.trim());
    });
  }

  if (params.ein) {
    filteredRateCandidates = filteredRateCandidates.filter((rate) => {
      const provider = providers.get(rate.groupId);
      return provider?.eins.some(
        (ein) => normalizeEIN(ein) === normalizeEIN(params.ein!.trim()),
      );
    });
  }

  if (params.facility) {
    filteredRateCandidates = filteredRateCandidates.filter((rate) => {
      const provider = providers.get(rate.groupId);
      return provider?.businessNames.some((name) =>
        name.toLowerCase().includes(params.facility!.trim().toLowerCase()),
      );
    });
  }

  const rows: ResultRow[] = [];

  for (const rate of filteredRateCandidates) {
    const provider = providers.get(rate.groupId);

    rows.push({
      ...rate,
      businessNames: provider?.businessNames ?? [],
      eins: provider?.eins ?? [],
    });
  }

  return {
    code: params.code,
    type: params.type ?? null,
    name: rows[0]?.name ?? null,
    description: rows[0]?.description ?? null,
    count: rows.length,
    rows,
  };
}
