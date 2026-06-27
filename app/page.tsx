import RateSearch from "./components/RateSearch";
import { getStore } from "@/lib/store";

type StoreMetadata = {
  sourceUrl: string;
  ingestDate: string;
  chosenFile: string;
};

function getMetadata(): StoreMetadata | null {
  try {
    const store = getStore();
    return {
      sourceUrl: store.sourceUrl,
      ingestDate: store.ingestDate,
      chosenFile: store.chosenFile,
    };
  } catch {
    return null;
  }
}

export default async function Home({
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    code?: string;
    type?: string;
    npi?: string;
    ein?: string;
    facility?: string;
    page?: string;
  }>;
}) {
  const metadata = getMetadata();
  return <RateSearch metadata={metadata} searchParams={await searchParams} />;
}
