import fs from "node:fs";
import path from "node:path";
import { Provider, Rate, SerializedStore, Store } from "./types";

const ARTFACT = path.join(__dirname, "../data/rates.json");

const globalForStore = globalThis as unknown as { store?: Store };

export function loadStore(): Store {
  const before = process.memoryUsage().heapUsed;

  const raw = fs.readFileSync(ARTFACT, "utf-8");

  const data = JSON.parse(raw) as SerializedStore;

  const providers = new Map<string, Provider>(
    Object.entries(data.providers).map(([k, v]) => [
      k,
      { ...v, npis: new Set(v.npis) },
    ]),
  );

  const rates = new Map<string, Rate[]>(Object.entries(data.rates));

  const after = process.memoryUsage().heapUsed;

  console.log(
    `Store loaded: ${providers.size} providers, ${rates.size} codes, ` +
      `heap +${Math.round((after - before) / 1024 / 1024)} MB`,
  );

  return {
    providers,
    rates,
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
