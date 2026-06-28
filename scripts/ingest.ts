import { Readable } from "node:stream";
import fs from "node:fs";
import { mkdir } from "node:fs/promises";
import { pipeline } from "node:stream/promises";
import { pick } from "stream-json/filters/pick.js";
import { streamArray } from "stream-json/streamers/stream-array.js";
import {
  BillingCode,
  ProviderNpi,
  ProviderReference,
  ProviderSubGroup,
  Rate,
  RateModifier,
  RateServiceCode,
  SerializedStore,
} from "@/lib/types";
import { STORE_FILE } from "@/lib/store";

const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

function createSpinner() {
  let frame = 0;
  let message = "";
  const start = Date.now();
  const interval = setInterval(() => {
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    process.stdout.write(
      `\r${SPINNER_FRAMES[frame % SPINNER_FRAMES.length]} ${message} (${elapsed}s)`.padEnd(
        72,
      ),
    );
    frame++;
  }, 80);
  return {
    update(msg: string) {
      message = msg;
    },
    stop(finalMsg: string) {
      clearInterval(interval);
      process.stdout.write(`\r${finalMsg}\n`);
    },
  };
}

const fidelisIndexFile =
  "https://www.centene.com/content/dam/centene/Centene%20Corporate/json/DOCUMENT/2026-04-28_fidelis_index.json";

const TMP_FILE = "data/tmp_innetwork.json";

// Local CMS input shapes used only by the ingest pipeline.
type NegotiatedPrice = {
  negotiated_rate: number;
  negotiated_type: string;
  billing_class: string;
  setting?: string;
  additional_information?: string;
  expiration_date?: string;
  service_code?: string[];
  billing_code_modifier?: string[];
};

type NegotiatedRate = {
  provider_references?: number[];
  negotiated_prices?: NegotiatedPrice[];
};

type InNetworkItem = {
  billing_code: string;
  billing_code_type: string;
  name: string;
  description: string;
  negotiated_rates?: NegotiatedRate[];
};

type StreamedItem = InNetworkItem | ProviderReference;

type Spinner = ReturnType<typeof createSpinner>;

type InNetworkFile = {
  location: string;
};

type IndexFile = {
  reporting_structure: {
    in_network_files?: InNetworkFile[];
  }[];
};

type ParsedStoreData = Omit<
  SerializedStore,
  "sourceUrl" | "ingestDate" | "chosenFile"
>;

type ParseState = {
  billingCodes: Map<string, BillingCode>;
  subGroups: ProviderSubGroup[];
  providerNpis: ProviderNpi[];
  rates: Rate[];
  ratesMap: Map<string, Rate[]>;
  rateServiceCodes: RateServiceCode[];
  rateModifiers: RateModifier[];
  seen: Map<string, Set<string>>;
  namesByKey: Map<string, Set<string>>;
  rateId: number;
  subGroupId: number;
};

async function fetchIndexFile(): Promise<IndexFile> {
  const response = await fetch(fidelisIndexFile);

  if (!response.ok) {
    throw new Error(`Failed to fetch index file: ${response.statusText}`);
  }

  return (await response.json()) as IndexFile;
}

function selectFileToIngest(indexData: IndexFile): InNetworkFile {
  const inNetworkFiles = indexData.reporting_structure.flatMap(
    (entry) => entry.in_network_files ?? [],
  );
  console.log(`Found ${inNetworkFiles.length} in-network files.`);

  const fileToIngest = inNetworkFiles.find((file) =>
    file.location.includes("fidelis-es"),
  );

  if (!fileToIngest) {
    throw new Error("Target in-network file not found in index.");
  }

  return fileToIngest;
}

async function downloadInNetworkFile(location: string, destination: string) {
  const response = await fetch(location);
  if (!response.ok) {
    throw new Error(`Failed to fetch in-network file: ${response.statusText}`);
  }

  if (!response.body) {
    throw new Error("No response body found for in-network file.");
  }

  const jsonStream = Readable.fromWeb(
    response.body as import("node:stream/web").ReadableStream,
  );

  await pipeline(jsonStream, fs.createWriteStream(destination));
}

function createParseState(): ParseState {
  return {
    billingCodes: new Map<string, BillingCode>(),
    subGroups: [],
    providerNpis: [],
    rates: [],
    ratesMap: new Map<string, Rate[]>(),
    rateServiceCodes: [],
    rateModifiers: [],
    seen: new Map<string, Set<string>>(),
    namesByKey: new Map<string, Set<string>>(),
    rateId: 0,
    subGroupId: 0,
  };
}

function addInNetworkItem(value: InNetworkItem, state: ParseState) {
  const billingCode = value.billing_code;
  const billingCodeType = value.billing_code_type;
  const name = value.name;
  const description = value.description;
  const key = `${billingCodeType}:${billingCode}`;

  if (!state.namesByKey.has(key)) state.namesByKey.set(key, new Set());
  state.namesByKey.get(key)!.add(name);

  if (!state.billingCodes.has(key)) {
    state.billingCodes.set(key, {
      billingCode,
      billingCodeType,
      name,
      description,
    });
  }

  let bucket = state.ratesMap.get(key);
  if (!bucket) {
    bucket = [];
    state.ratesMap.set(key, bucket);
    state.seen.set(key, new Set());
  }
  const seenKeys = state.seen.get(key)!;

  for (const negotiated of value.negotiated_rates ?? []) {
    for (const price of negotiated.negotiated_prices ?? []) {
      for (const groupId of negotiated.provider_references ?? []) {
        const modifiersStr = (price.billing_code_modifier ?? []).join(",");
        const serviceCodesStr = (price.service_code ?? []).join(",");
        const rowKey = `${groupId}|${price.negotiated_rate}|${price.negotiated_type}|${price.billing_class}|${price.setting ?? ""}|${modifiersStr}|${serviceCodesStr}|${price.expiration_date ?? ""}`;
        if (seenKeys.has(rowKey)) continue;
        seenKeys.add(rowKey);

        const id = state.rateId++;
        const rate: Rate = {
          id,
          codeKey: key,
          groupId: String(groupId),
          negotiatedRate: price.negotiated_rate,
          negotiatedType: price.negotiated_type,
          billingClass: price.billing_class,
          setting: price.setting ?? null,
          additionalInformation: price.additional_information ?? null,
          expirationDate: price.expiration_date ?? null,
        };
        bucket.push(rate);
        state.rates.push(rate);

        for (const sc of price.service_code ?? []) {
          state.rateServiceCodes.push({ rateId: id, serviceCode: sc });
        }
        for (const mod of price.billing_code_modifier ?? []) {
          state.rateModifiers.push({ rateId: id, modifier: mod });
        }
      }
    }
  }
}

function addProviderReference(value: ProviderReference, state: ParseState) {
  const groupId = String(value.provider_group_id);

  for (const group of value.provider_groups ?? []) {
    if (group.tin?.type !== "ein") continue;
    if (!group.tin.value || !group.tin.business_name) continue;

    const id = String(state.subGroupId++);
    state.subGroups.push({
      id,
      groupId,
      businessName: group.tin.business_name,
      ein: group.tin.value,
    });

    for (const npi of (group.npi ?? []).map(String)) {
      state.providerNpis.push({ subGroupId: id, npi });
    }
  }
}

function toParsedStoreData(state: ParseState): ParsedStoreData {
  const multiNameCodes = new Set(
    [...state.namesByKey.entries()]
      .filter(([, names]) => names.size > 1)
      .map(([key]) => key),
  );

  const codeTypes = [
    ...new Set(
      [...state.billingCodes.values()].map((bc) => bc.billingCodeType),
    ),
  ].sort();

  return {
    billingCodes: Object.fromEntries(state.billingCodes),
    subGroups: state.subGroups,
    providerNpis: state.providerNpis,
    rates: state.rates,
    rateServiceCodes: state.rateServiceCodes,
    rateModifiers: state.rateModifiers,
    multiNameCodes: [...multiNameCodes],
    codeTypes,
  };
}

async function parseStoreFile(filePath: string, spinner: Spinner) {
  spinner.update("Parsing...");
  console.time("parse");

  try {
    const stream = fs
      .createReadStream(filePath)
      .pipe(
        pick.withParserAsStream({
          filter: /^(provider_references|in_network)$/,
        }),
      )
      .pipe(streamArray.asStream());

    const state = createParseState();

    for await (const { value } of stream as AsyncIterable<{
      value: StreamedItem;
    }>) {
      spinner.update(
        `Parsing... ${state.rateId.toLocaleString()} rates, ${state.subGroupId.toLocaleString()} sub-groups`,
      );
      if ("billing_code" in value) {
        addInNetworkItem(value, state);
      } else {
        addProviderReference(value, state);
      }
    }

    return toParsedStoreData(state);
  } finally {
    console.timeEnd("parse");
  }
}

function buildSerializedStore(
  parsedStore: ParsedStoreData,
  fileToIngest: InNetworkFile,
): SerializedStore {
  return {
    ...parsedStore,
    sourceUrl: fileToIngest.location,
    ingestDate: new Date().toISOString(),
    chosenFile: fileToIngest.location.split("/").pop() ?? "unknown",
  };
}

async function writeStore(serializedStore: SerializedStore) {
  console.time("write");
  await fs.promises.writeFile(STORE_FILE, JSON.stringify(serializedStore));
  console.timeEnd("write");
}

async function ingest() {
  console.time("ingest duration");
  let spinner: Spinner | null = null;

  try {
    await mkdir("data", { recursive: true });

    const indexData = await fetchIndexFile();
    const fileToIngest = selectFileToIngest(indexData);

    console.log(`Fetching in-network file from: ${fileToIngest.location}`);

    spinner = createSpinner();
    spinner.update("Downloading...");

    await downloadInNetworkFile(fileToIngest.location, TMP_FILE);

    const parsedStore = await parseStoreFile(TMP_FILE, spinner);
    spinner.stop(
      `✓ Parsed ${Object.keys(parsedStore.billingCodes).length.toLocaleString()} billing codes, ${parsedStore.rates.length.toLocaleString()} rates, ${parsedStore.subGroups.length.toLocaleString()} sub-groups`,
    );
    spinner = null;

    const serializedStore = buildSerializedStore(parsedStore, fileToIngest);
    await writeStore(serializedStore);

    console.log(`Ingestion complete. Data written to ${STORE_FILE}`);
  } catch (error) {
    console.error("Error during ingestion:", error);
    process.exitCode = 1;
  } finally {
    spinner?.stop("Ingestion stopped.");
    await fs.promises.rm(TMP_FILE, { force: true });
    console.timeEnd("ingest duration");
  }
}

ingest();
