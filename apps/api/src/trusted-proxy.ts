import { isIP } from "node:net";

/** Only exact addresses of proxies that can connect to the private API port. */
export function trustedProxyAddresses(
  configured = process.env.TRUSTED_PROXY_IPS,
): false | string[] {
  const addresses = (configured || "")
    .split(",")
    .map((address) => address.trim())
    .filter(Boolean);
  if (!addresses.length) return false;
  if (addresses.some((address) => !isIP(address)))
    throw new Error(
      "TRUSTED_PROXY_IPS must contain exact IPv4 or IPv6 addresses, not ranges or blanket trust.",
    );
  return [...new Set(addresses)];
}
