import { Readable } from "node:stream";
import fs from "node:fs";
import { mkdir } from "node:fs/promises";
import { pipeline } from "node:stream/promises";
const fidelisIndexFile =
  "https://www.centene.com/content/dam/centene/Centene%20Corporate/json/DOCUMENT/2026-04-28_fidelis_index.json";

async function ingest() {
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

    await pipeline(jsonStream, fs.createWriteStream("data/tmp_innetwork.json"));

    console.log("Finished streaming in-network file.");
