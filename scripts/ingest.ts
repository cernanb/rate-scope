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

async function ingest() {
  console.time("ingest duration");
  let spinner: ReturnType<typeof createSpinner> | null = null;

  try {
    await mkdir("data", { recursive: true });

    const response = await fetch(fidelisIndexFile);

    if (!response.ok) {
      throw new Error(`Failed to fetch index file: ${response.statusText}`);
    }

    const indexData = await response.json();

    const inNetworkFiles = indexData.reporting_structure.flatMap(
      (entry: { in_network_files: { location: string }[] }) =>
        entry.in_network_files,
    );
    console.log(`Found ${inNetworkFiles.length} in-network files.`);

    const fileToIngest = inNetworkFiles.find((file: { location: string }) =>
      file.location.includes("fidelis-es"),
    );

    if (!fileToIngest) {
      throw new Error("Target in-network file not found in index.");
    }

    console.log(`Fetching in-network file from: ${fileToIngest.location}`);

    spinner = createSpinner();
    spinner.update("Downloading...");

    const inNetworkResponse = await fetch(fileToIngest.location);
    if (!inNetworkResponse.ok) {
      throw new Error(
        `Failed to fetch in-network file: ${inNetworkResponse.statusText}`,
      );
    }

    if (!inNetworkResponse.body) {
      throw new Error("No response body found for in-network file.");
    }

    const jsonStream = Readable.fromWeb(
      inNetworkResponse.body as import("node:stream/web").ReadableStream,
    );

    await pipeline(jsonStream, fs.createWriteStream(TMP_FILE));
    spinner.update("Parsing...");
    console.time("parse");
    const stream = fs
      .createReadStream(TMP_FILE)
      .pipe(
        pick.withParserAsStream({
          filter: /^(provider_references|in_network)$/,
        }),
      )
      .pipe(streamArray.asStream());

    const billingCodes = new Map<string, BillingCode>();
    const subGroups: ProviderSubGroup[] = [];
    const providerNpis: ProviderNpi[] = [];
    const rates: Rate[] = [];
    const ratesMap = new Map<string, Rate[]>();
    const rateServiceCodes: RateServiceCode[] = [];
    const rateModifiers: RateModifier[] = [];
    const seen = new Map<string, Set<string>>();
    const namesByKey = new Map<string, Set<string>>();
    let rateId = 0;
    let subGroupId = 0;

    for await (const { value } of stream as AsyncIterable<{
      value: StreamedItem;
    }>) {
      spinner.update(
        `Parsing... ${rateId.toLocaleString()} rates, ${subGroupId.toLocaleString()} sub-groups`,
      );
      if ("billing_code" in value) {
        // in_network item -> billing code + rate rows
        const billingCode = value.billing_code;
        const billingCodeType = value.billing_code_type;
        const name = value.name;
        const description = value.description;
        const key = `${billingCodeType}:${billingCode}`;

        if (!namesByKey.has(key)) namesByKey.set(key, new Set());
        namesByKey.get(key)!.add(name);

        if (!billingCodes.has(key)) {
          billingCodes.set(key, {
            billingCode,
            billingCodeType,
            name,
            description,
          });
        }

        let bucket = ratesMap.get(key);
        if (!bucket) {
          bucket = [];
          ratesMap.set(key, bucket);
          seen.set(key, new Set());
        }
        const seenKeys = seen.get(key)!;

        for (const negotiated of value.negotiated_rates ?? []) {
          for (const price of negotiated.negotiated_prices ?? []) {
            for (const groupId of negotiated.provider_references ?? []) {
              const modifiersStr = (price.billing_code_modifier ?? []).join(
                ",",
              );
              const serviceCodesStr = (price.service_code ?? []).join(",");
              const rowKey = `${groupId}|${price.negotiated_rate}|${price.negotiated_type}|${price.billing_class}|${price.setting ?? ""}|${modifiersStr}|${serviceCodesStr}|${price.expiration_date ?? ""}`;
              if (seenKeys.has(rowKey)) continue;
              seenKeys.add(rowKey);

              const id = rateId++;
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
              rates.push(rate);

              for (const sc of price.service_code ?? []) {
                rateServiceCodes.push({ rateId: id, serviceCode: sc });
              }
              for (const mod of price.billing_code_modifier ?? []) {
                rateModifiers.push({ rateId: id, modifier: mod });
              }
            }
          }
        }
      } else {
        // provider_references item -> sub-groups and NPIs
        const ref = value;
        const groupId = String(ref.provider_group_id);

        for (const group of ref.provider_groups ?? []) {
          if (group.tin?.type !== "ein") continue;
          if (!group.tin.value || !group.tin.business_name) continue;

          const id = String(subGroupId++);
          subGroups.push({
            id,
            groupId,
            businessName: group.tin.business_name,
            ein: group.tin.value,
          });

          for (const npi of (group.npi ?? []).map(String)) {
            providerNpis.push({ subGroupId: id, npi });
          }
        }
      }
    }

    spinner.stop(
      `✓ Parsed ${billingCodes.size.toLocaleString()} billing codes, ${rates.length.toLocaleString()} rates, ${subGroups.length.toLocaleString()} sub-groups`,
    );
    spinner = null;
    console.timeEnd("parse");

    const multiNameCodes = new Set(
      [...namesByKey.entries()]
        .filter(([, names]) => names.size > 1)
        .map(([key]) => key),
    );

    const codeTypes = [
      ...new Set([...billingCodes.values()].map((bc) => bc.billingCodeType)),
    ].sort();

    const serializedStore = {
      billingCodes: Object.fromEntries(billingCodes),
      subGroups: subGroups,
      providerNpis: providerNpis,
      rates,
      rateServiceCodes,
      rateModifiers,
      multiNameCodes: [...multiNameCodes],
      codeTypes,
      sourceUrl: fileToIngest.location,
      ingestDate: new Date().toISOString(),
      chosenFile: fileToIngest.location.split("/").pop() ?? "unknown",
    };

    console.time("write");
    await fs.promises.writeFile(STORE_FILE, JSON.stringify(serializedStore));
    console.timeEnd("write");

    await fs.promises.rm(TMP_FILE, { force: true });

    console.log(`Ingestion complete. Data written to ${STORE_FILE}`);
  } catch (error) {
    console.error("Error during ingestion:", error);
    process.exitCode = 1;
  } finally {
    spinner?.stop("Ingestion stopped.");
    console.timeEnd("ingest duration");
  }
}

ingest();
