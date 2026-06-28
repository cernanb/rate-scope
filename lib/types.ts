export type BillingCode = {
  billingCode: string;
  billingCodeType: string;
  name: string;
  description: string;
};

export type ProviderSubGroup = {
  id: string;
  groupId: string;
  businessName: string;
  ein: string;
};

export type ProviderNpi = {
  subGroupId: string;
  npi: string;
};

export type Rate = {
  id: number;
  codeKey: string;
  groupId: string;
  negotiatedRate: number;
  negotiatedType: string;
  billingClass: string;
  setting: string | null;
  additionalInformation: string | null;
  expirationDate: string | null;
};

export type RateServiceCode = {
  rateId: number;
  serviceCode: string;
};

export type RateModifier = {
  rateId: number;
  modifier: string;
};

export type SerializedStore = {
  billingCodes: Record<string, BillingCode>;
  subGroups: ProviderSubGroup[];
  providerNpis: ProviderNpi[];
  rates: Rate[];
  rateServiceCodes: RateServiceCode[];
  rateModifiers: RateModifier[];
  multiNameCodes: string[];
  codeTypes: string[];
  sourceUrl: string;
  ingestDate: string;
  chosenFile: string;
};

export type Store = {
  billingCodes: Map<string, BillingCode>;
  subGroups: Map<string, ProviderSubGroup>;
  subGroupsByGroup: Map<string, string[]>;
  subGroupsByNpi: Map<string, string[]>;
  subGroupsByEin: Map<string, string[]>;
  ratesByCode: Map<string, Rate[]>;
  serviceCodesByRate: Map<number, string[]>;
  modifiersByRate: Map<number, string[]>;
  multiNameCodes: Set<string>;
  codeTypes: string[];
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
