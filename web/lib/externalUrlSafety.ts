import { isIP } from "node:net";

const PRIVATE_HOSTNAME_SUFFIXES = [".localhost", ".local"] as const;

export class ExternalUrlSafetyError extends Error {
  constructor(
    readonly code: string,
    message = "External URL is not allowed.",
  ) {
    super(message);
    this.name = "ExternalUrlSafetyError";
  }
}

function normalizeHostname(hostname: string) {
  return hostname.trim().toLowerCase().replace(/^\[|\]$/g, "").replace(/\.$/, "");
}

function ipv4ToNumber(hostname: string) {
  const parts = hostname.split(".");

  if (parts.length !== 4) {
    return null;
  }

  let value = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) {
      return null;
    }

    const octet = Number(part);
    if (!Number.isInteger(octet) || octet < 0 || octet > 255) {
      return null;
    }

    value = (value << 8) + octet;
  }

  return value >>> 0;
}

function ipv4InRange(value: number, base: string, prefixLength: number) {
  const baseValue = ipv4ToNumber(base);
  if (baseValue === null) {
    return false;
  }

  const mask = prefixLength === 0 ? 0 : (0xffffffff << (32 - prefixLength)) >>> 0;
  return (value & mask) === (baseValue & mask);
}

function isPrivateIpv4(hostname: string) {
  const value = ipv4ToNumber(hostname);

  return (
    value !== null &&
    (
      ipv4InRange(value, "0.0.0.0", 8) ||
      ipv4InRange(value, "10.0.0.0", 8) ||
      ipv4InRange(value, "100.64.0.0", 10) ||
      ipv4InRange(value, "127.0.0.0", 8) ||
      ipv4InRange(value, "169.254.0.0", 16) ||
      ipv4InRange(value, "172.16.0.0", 12) ||
      ipv4InRange(value, "192.0.0.0", 24) ||
      ipv4InRange(value, "192.0.2.0", 24) ||
      ipv4InRange(value, "192.168.0.0", 16) ||
      ipv4InRange(value, "198.18.0.0", 15) ||
      ipv4InRange(value, "198.51.100.0", 24) ||
      ipv4InRange(value, "203.0.113.0", 24) ||
      ipv4InRange(value, "224.0.0.0", 4) ||
      ipv4InRange(value, "240.0.0.0", 4)
    )
  );
}

function isPrivateIpv6(hostname: string) {
  const normalized = hostname.toLowerCase();

  return (
    normalized === "::" ||
    normalized === "::1" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe80:") ||
    normalized.startsWith("ff")
  );
}

function isPrivateOrLocalHostname(hostname: string) {
  if (!hostname) {
    return true;
  }

  if (hostname === "localhost") {
    return true;
  }

  if (PRIVATE_HOSTNAME_SUFFIXES.some((suffix) => hostname.endsWith(suffix))) {
    return true;
  }

  if (isIP(hostname) === 4) {
    return isPrivateIpv4(hostname);
  }

  if (isIP(hostname) === 6) {
    return isPrivateIpv6(hostname);
  }

  return false;
}

export function assertPublicHttpUrl(value: string, label = "external URL") {
  let parsed: URL;

  try {
    parsed = new URL(value);
  } catch {
    throw new ExternalUrlSafetyError("url_malformed", `${label} is malformed.`);
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new ExternalUrlSafetyError("url_scheme_not_allowed", `${label} must use HTTP or HTTPS.`);
  }

  if (parsed.username || parsed.password) {
    throw new ExternalUrlSafetyError("url_credentials_not_allowed", `${label} must not include credentials.`);
  }

  if (isPrivateOrLocalHostname(normalizeHostname(parsed.hostname))) {
    throw new ExternalUrlSafetyError("url_private_host_not_allowed", `${label} must use a public host.`);
  }

  return parsed.toString();
}
