export const normalizeEIN = (ein: string): string => {
  return ein.replace(/\D/g, "");
};
