import fs from "node:fs";
import path from "node:path";
import {
  BillingCode,
  ProviderSubGroup,
  Rate,
  SerializedStore,
  Store,
} from "./types";
import { normalizeEIN } from "./util";

export const STORE_FILE = "data/store.json";
const ARTIFACT = path.join(process.cwd(), STORE_FILE);

const globalForStore = globalThis as unknown as { store?: Store };

export function loadStore(): Store {
  const before = process.memoryUsage().heapUsed;

  const raw = fs.readFileSync(ARTIFACT, "utf-8");
  const data = JSON.parse(raw) as SerializedStore;

  const billingCodes = new Map<string, BillingCode>(
    Object.entries(data.billingCodes),
  );

  const subGroups = new Map<string, ProviderSubGroup>(
    data.subGroups.map((sg) => [sg.id, sg]),
  );

  const subGroupsByGroup = new Map<string, string[]>();
  for (const sg of data.subGroups) {
    const arr = subGroupsByGroup.get(sg.groupId) ?? [];
    arr.push(sg.id);
    subGroupsByGroup.set(sg.groupId, arr);
  }

  const subGroupsByNpi = new Map<string, string[]>();
  for (const { npi, subGroupId } of data.providerNpis) {
    const arr = subGroupsByNpi.get(npi) ?? [];
    arr.push(subGroupId);
    subGroupsByNpi.set(npi, arr);
  }

  const subGroupsByEin = new Map<string, string[]>();
  for (const sg of data.subGroups) {
    const normalized = normalizeEIN(sg.ein);
    const arr = subGroupsByEin.get(normalized) ?? [];
    arr.push(sg.id);
    subGroupsByEin.set(normalized, arr);
  }

  const ratesByCode = new Map<string, Rate[]>();
  for (const rate of data.rates) {
    const arr = ratesByCode.get(rate.codeKey) ?? [];
    arr.push(rate);
    ratesByCode.set(rate.codeKey, arr);
  }

  const serviceCodesByRate = new Map<number, string[]>();
  for (const { rateId, serviceCode } of data.rateServiceCodes) {
    const arr = serviceCodesByRate.get(rateId) ?? [];
    arr.push(serviceCode);
    serviceCodesByRate.set(rateId, arr);
  }

  const modifiersByRate = new Map<number, string[]>();
  for (const { rateId, modifier } of data.rateModifiers) {
    const arr = modifiersByRate.get(rateId) ?? [];
    arr.push(modifier);
    modifiersByRate.set(rateId, arr);
  }

  const after = process.memoryUsage().heapUsed;

  console.log(
    `Store loaded: ${subGroups.size} sub-groups, ${billingCodes.size} codes, ` +
      `heap +${Math.round((after - before) / 1024 / 1024)} MB`,
  );

  return {
    billingCodes,
    subGroups,
    subGroupsByGroup,
    subGroupsByNpi,
    subGroupsByEin,
    ratesByCode,
    serviceCodesByRate,
    modifiersByRate,
    multiNameCodes: new Set(data.multiNameCodes),
    codeTypes: data.codeTypes ?? [],
    sourceUrl: data.sourceUrl,
    ingestDate: data.ingestDate,
    chosenFile: data.chosenFile,
  };
}

export function getStore(): Store {
  if (!globalForStore.store) {
    globalForStore.store = loadStore();
  }
  return globalForStore.store;
}
