import { Readable } from "node:stream";
import fs from "node:fs";
import { mkdir } from "node:fs/promises";
import { pipeline } from "node:stream/promises";
import { pick } from "stream-json/filters/pick.js";
import { streamArray } from "stream-json/streamers/stream-array.js";
import { Provider, ProviderReference, Rate } from "@/lib/types";

const fidelisIndexFile =
  "https://www.centene.com/content/dam/centene/Centene%20Corporate/json/DOCUMENT/2026-04-28_fidelis_index.json";

const TMP_FILE = "data/tmp_innetwork.json";

async function ingest() {
  console.time("ingest duration");
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

    // Find the specific in-network file we want to ingest based on its name
    const fileToIngest = inNetworkFiles.find((file: { location: string }) =>
      file.location.includes("fidelis-es"),
    );

    if (!fileToIngest) {
      throw new Error("Target in-network file not found in index.");
    }

    console.log(`Fetching in-network file from: ${fileToIngest.location}`);

    // stream the JSON data from the in-network file
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

    console.time("download");
    await pipeline(jsonStream, fs.createWriteStream(TMP_FILE));
    console.timeEnd("download");

    console.log("Finished streaming in-network file.");

    console.time("parse");
    const stream = fs
      .createReadStream(TMP_FILE)
      .pipe(
        pick.withParserAsStream({
          filter: /^(provider_references|in_network)$/,
        }),
      )
      .pipe(streamArray.asStream());

    const providers = new Map<string, Provider>();
    const rates = new Map<string, Rate[]>();

    for await (const { value } of stream as AsyncIterable<{ value: any }>) {
      if (value.billing_code !== undefined) {
        // in_network item -> rate rows
        const billingCode = value.billing_code;
        const billingCodeType = value.billing_code_type;
        const name = value.name;
        const description = value.description;
        const key = `${billingCodeType}:${billingCode}`;

        let bucket = rates.get(key);
        if (!bucket) {
          bucket = [];
          rates.set(key, bucket);
        }

        for (const negotiated of value.negotiated_rates ?? []) {
          for (const price of negotiated.negotiated_prices ?? []) {
            for (const groupId of negotiated.provider_references ?? []) {
              bucket.push({
                groupId: String(groupId),
                billingCode,
                billingCodeType,
                name,
                description,
                negotiatedRate: price.negotiated_rate,
                negotiatedType: price.negotiated_type,
                billingClass: price.billing_class,
                setting: price.setting ?? null,
                serviceCodes: price.service_code ?? [],
                modifiers: price.billing_code_modifier ?? [],
                additionalInformation: price.additional_information ?? null,
                expirationDate: price.expiration_date ?? null,
              });
            }
          }
        }
      } else {
        // provider_references item -> provider entry keyed by group id.
        const ref = value as ProviderReference;
        const groupId = String(ref.provider_group_id);
        const npis = new Set<string>();
        const businessNames = new Set<string>();
        const eins = new Set<string>();

        for (const group of ref.provider_groups ?? []) {
          for (const n of group.npi ?? []) npis.add(String(n));
          if (group.tin?.type === "ein") {
            if (group.tin.value) eins.add(group.tin.value);
            if (group.tin.business_name)
              businessNames.add(group.tin.business_name);
          }
        }

        providers.set(groupId, {
          businessNames: [...businessNames],
          eins: [...eins],
          npis,
        });
      }
    }

    console.timeEnd("parse");
    console.log(`Parsed ${providers.size} provider references.`);
    const rowCount = [...rates.values()].reduce((n, r) => n + r.length, 0);
    console.log(
      `Parsed ${rates.size} unique billing codes (${rowCount} rate rows).`,
    );

    const store = {
      providers,
      rates,
      sourceUrl: fileToIngest.location,
      ingestDate: new Date().toISOString(),
      chosenFile: fileToIngest.location.split("/").pop() ?? "unknown",
    };

    // Write the store to disk as JSON
    const serializedStore = {
      providers: Object.fromEntries(
        [...store.providers.entries()].map(([k, v]) => [
          k,
          { ...v, npis: [...v.npis] },
        ]),
      ),
      rates: Object.fromEntries(store.rates),
      sourceUrl: store.sourceUrl,
      ingestDate: store.ingestDate,
      chosenFile: store.chosenFile,
    };

    console.time("write");
    await fs.promises.writeFile(
      "data/rates.json",
      JSON.stringify(serializedStore),
    );
    console.timeEnd("write");

    // Drop the temp in-network copy now that the artifact is written.
    await fs.promises.rm(TMP_FILE, { force: true });

    console.log("Ingestion complete. Data written to data/rates.json");
  } catch (error) {
    console.error("Error during ingestion:", error);
    process.exitCode = 1;
  } finally {
    console.timeEnd("ingest duration");
  }
}

ingest();
