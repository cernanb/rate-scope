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

export type ResultRow = {
  id: number;
  groupId: string;
  negotiatedRate: number;
  negotiatedType: string;
  billingClass: string;
  setting: string | null;
  serviceCodes: string[];
  modifiers: string[];
  additionalInformation: string | null;
  expirationDate: string | null;
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
  const {
    billingCodes,
    ratesByCode,
    subGroups,
    subGroupsByGroup,
    subGroupsByNpi,
    subGroupsByEin,
    serviceCodesByRate,
    modifiersByRate,
    multiNameCodes,
  } = store;

  let rateLists: Rate[][];
  let isMultiName = false;
  const page = params.page ?? 1;

  const suffix = `:${params.code}`;

  if (params.type) {
    const key = `${params.type.toUpperCase()}${suffix}`;
    const bucket = ratesByCode.get(key);
    rateLists = bucket ? [bucket] : [];
    isMultiName = multiNameCodes.has(key);
  } else {
    const matching = [...ratesByCode.entries()].filter(([key]) =>
      key.endsWith(suffix),
    );
    rateLists = matching.map(([, bucket]) => bucket);
    isMultiName = matching.some(([key]) => multiNameCodes.has(key));
  }

  const npi = params.npi?.trim();
  const ein = params.ein ? normalizeEIN(params.ein.trim()) : undefined;
  const facility = params.facility?.trim().toLowerCase();

  const npiSubGroupIds = npi ? new Set(subGroupsByNpi.get(npi) ?? []) : null;
  const einSubGroupIds = ein ? new Set(subGroupsByEin.get(ein) ?? []) : null;

  const rows: ResultRow[] = [];

  for (const rate of rateLists.flat()) {
    const sgIds = subGroupsByGroup.get(rate.groupId);
    if (!sgIds) continue;

    for (const sgId of sgIds) {
      if (npiSubGroupIds && !npiSubGroupIds.has(sgId)) continue;
      if (einSubGroupIds && !einSubGroupIds.has(sgId)) continue;

      const sg = subGroups.get(sgId)!;
      if (facility && !sg.businessName.toLowerCase().includes(facility))
        continue;

      rows.push({
        id: rate.id,
        groupId: rate.groupId,
        negotiatedRate: rate.negotiatedRate,
        negotiatedType: rate.negotiatedType,
        billingClass: rate.billingClass,
        setting: rate.setting,
        additionalInformation: rate.additionalInformation,
        expirationDate: rate.expirationDate,
        serviceCodes: serviceCodesByRate.get(rate.id) ?? [],
        modifiers: modifiersByRate.get(rate.id) ?? [],
        businessName: sg.businessName,
        ein: sg.ein,
      });
    }
  }

  const paginatedRows = rows.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  let name: string | null = null;
  let description: string | null = null;
  if (!isMultiName) {
    const firstKey = params.type
      ? `${params.type.toUpperCase()}${suffix}`
      : [...ratesByCode.keys()].find((k) => k.endsWith(suffix));
    if (firstKey) {
      const bc = billingCodes.get(firstKey);
      name = bc?.name ?? null;
      description = bc?.description ?? null;
    }
  }

  return {
    code: params.code,
    type: params.type?.toUpperCase() ?? null,
    name,
    description,
    count: rows.length,
    page,
    totalPages: Math.max(1, Math.ceil(rows.length / PER_PAGE)),
    rows: paginatedRows,
  };
}
