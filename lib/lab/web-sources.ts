export const TRUSTED_WEB_DOMAINS = ["acs.org", "cdc.gov", "osha.gov", "pubchem.ncbi.nlm.nih.gov", "rsc.org"] as const;

export function trustedWebUrl(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || (url.port && url.port !== "443")) return null;
    if (!TRUSTED_WEB_DOMAINS.some(domain => url.hostname === domain || url.hostname.endsWith(`.${domain}`))) return null;
    url.hash = "";
    return url.toString();
  } catch { return null; }
}
