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

export default function Home() {
  const metadata = getMetadata();
  return <RateSearch metadata={metadata} />;
}
