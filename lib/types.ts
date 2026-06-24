export type Rate = {
  groupId: string; // foreign key into the providers map
  billingCode: string;
  billingCodeType: string;
  name: string;
  description: string;
  negotiatedRate: number;
  negotiatedType: string;
  billingClass: string;
  setting: string | null;
  serviceCodes: string[];
  modifiers: string[];
  additionalInformation: string | null;
  expirationDate: string | null;
};

export type Provider = {
  businessNames: string[];
  eins: string[];
  npis: Set<string>;
};

export type SerializedProvider = Omit<Provider, "npis"> & {
  npis: string[];
};

export type SerializedStore = {
  providers: Record<string, SerializedProvider>;
  rates: Record<string, Rate[]>; // key = "<billingCodeType>:<billingCode>"
  sourceUrl: string;
  ingestDate: string;
  chosenFile: string;
};

export type Store = {
  providers: Map<string, Provider>;
  rates: Map<string, Rate[]>; // key = "<billingCodeType>:<billingCode>"
  sourceUrl: string;
  ingestDate: string;
  chosenFile: string;
};

export type ProviderReference = {
  provider_group_id: number;
  provider_groups?: {
    npi?: number[];
    tin?: { type?: string; value?: string; business_name?: string };
  }[];
};
