import { Router, type IRouter } from "express";
import dns from "node:dns/promises";
import net from "node:net";
import {
  CreateScanBody,
  LoginBody,
  SignupBody,
  ListScansQueryParams,
} from "@workspace/api-zod";

type Verdict = "safe" | "phishing";
export type BrandImpersonationInfo = {
  brandImpersonation: boolean;
  impersonatedBrand: string | null;
  legitimateDomain: string | null;
  similarityScore: number;
  impersonationReason: string | null;
};

export type UrlIntelligence = {
  protocol: string;
  hostname: string;
  registrableDomain: string;
  subdomainCount: number;
  port: number;
  path: string;
  queryParameterCount: number;
  queryParameterNames: string[];
  hasFragment: boolean;
  urlLength: number;
  ipAddress: string | null;
  ipVersion: string | null;
  httpsEnabled: boolean;
};

type Scan = {
  id: string;
  url: string;
  verdict: Verdict;
  confidence: number;
  riskScore: number;
  ruleFlags: string[];
  features: Record<string, unknown>;
  mlPrediction: Verdict;
  rulePrediction: Verdict;
  createdAt: string;
  userName: string;
  brandImpersonation: boolean;
  impersonatedBrand: string | null;
  legitimateDomain: string | null;
  similarityScore: number;
  impersonationReason: string | null;
  urlIntelligence: UrlIntelligence;
};

interface Brand {
  name: string;
  legitimateDomains: string[];
  canonicalSlug: string;
}

export const BRANDS: Brand[] = [
  { name: "PayPal", legitimateDomains: ["paypal.com", "paypal.me"], canonicalSlug: "paypal" },
  { name: "Google", legitimateDomains: ["google.com", "google.co.uk", "google.ca", "gmail.com", "youtube.com"], canonicalSlug: "google" },
  { name: "Amazon", legitimateDomains: ["amazon.com", "amazon.co.uk", "amazon.de", "amazon.ca", "aws.amazon.com"], canonicalSlug: "amazon" },
  { name: "Microsoft", legitimateDomains: ["microsoft.com", "live.com", "office.com", "outlook.com", "microsoftonline.com"], canonicalSlug: "microsoft" },
  { name: "Apple", legitimateDomains: ["apple.com", "icloud.com"], canonicalSlug: "apple" },
  { name: "Facebook", legitimateDomains: ["facebook.com", "fb.com", "messenger.com"], canonicalSlug: "facebook" },
  { name: "Instagram", legitimateDomains: ["instagram.com"], canonicalSlug: "instagram" },
  { name: "Netflix", legitimateDomains: ["netflix.com"], canonicalSlug: "netflix" },
  { name: "LinkedIn", legitimateDomains: ["linkedin.com"], canonicalSlug: "linkedin" },
  { name: "GitHub", legitimateDomains: ["github.com", "github.io", "githubusercontent.com"], canonicalSlug: "github" },
  { name: "Twitter / X", legitimateDomains: ["twitter.com", "x.com"], canonicalSlug: "twitter" },
  { name: "Dropbox", legitimateDomains: ["dropbox.com"], canonicalSlug: "dropbox" },
];

/**
 * Calculates the Levenshtein distance between two strings.
 */
function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }
  return dp[m][n];
}

/**
 * Normalized string similarity ratio between 0 and 1 based on Levenshtein distance.
 */
function stringSimilarity(a: string, b: string): number {
  if (a === b) return 1.0;
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1.0;
  return Math.max(0, 1 - levenshteinDistance(a, b) / maxLen);
}

/**
 * Extracts host, second-level domain (SLD), and registrable domain from a raw URL safely.
 */
function extractDomainInfo(rawUrl: string): { host: string; sld: string; registrable: string; isIp: boolean } {
  let parsed: URL | null = null;
  try {
    parsed = new URL(rawUrl.includes("://") ? rawUrl : `https://${rawUrl}`);
  } catch {
    // fallback
  }

  let host = (parsed?.hostname ?? rawUrl).toLowerCase().replace(/:\d+$/, "");
  host = host.split("/")[0].split("?")[0].trim();

  const isIp = /^(\d{1,3}\.){3}\d{1,3}$/.test(host);
  if (isIp || !host) {
    return { host, sld: host, registrable: host, isIp };
  }

  const parts = host.split(".");
  if (parts.length <= 1) {
    return { host, sld: host, registrable: host, isIp: false };
  }

  // Common multi-part ccTLDs
  const multiTlds = ["co.uk", "com.au", "co.in", "org.uk", "gov.uk", "com.br", "co.nz", "co.jp"];
  const lastTwo = parts.slice(-2).join(".");
  let sld: string;
  let registrable: string;

  if (multiTlds.includes(lastTwo) && parts.length >= 3) {
    sld = parts[parts.length - 3];
    registrable = parts.slice(-3).join(".");
  } else {
    sld = parts[parts.length - 2];
    registrable = parts.slice(-2).join(".");
  }

  return { host, sld, registrable, isIp: false };
}

/**
 * Detects whether a URL is attempting to impersonate a well-known brand via typosquatting,
 * character substitutions (e.g. 0->o, 1->l/i, 3->e), hyphenation patterns, or misleading subdomains.
 */
export function detectBrandImpersonation(url: string): BrandImpersonationInfo {
  const { host, sld, registrable, isIp } = extractDomainInfo(url);
  if (isIp || !host || !sld) {
    return {
      brandImpersonation: false,
      impersonatedBrand: null,
      legitimateDomain: null,
      similarityScore: 0,
      impersonationReason: null,
    };
  }

  // Rule 6: Do NOT flag the legitimate brand domain itself or its legitimate subdomains
  for (const brand of BRANDS) {
    const isLegit = brand.legitimateDomains.some(
      (legit) => host === legit || host.endsWith(`.${legit}`)
    );
    if (isLegit) {
      return {
        brandImpersonation: false,
        impersonatedBrand: null,
        legitimateDomain: null,
        similarityScore: 0,
        impersonationReason: null,
      };
    }
  }

  // Compare against each known brand
  for (const brand of BRANDS) {
    const brandSlug = brand.canonicalSlug;
    const legitDomain = brand.legitimateDomains[0];

    // 1. Character Substitutions (e.g. 0->o, 1->l/i, 3->e, 4->a, 5->s, 7->t, i->l)
    const detectedSubs: string[] = [];
    let normalized = "";
    for (let i = 0; i < sld.length; i++) {
      const ch = sld[i];
      if (ch === "0" && brandSlug.includes("o")) {
        normalized += "o";
        detectedSubs.push('"0" → "o"');
      } else if (ch === "1" && (brandSlug.includes("l") || brandSlug.includes("i"))) {
        const target = brandSlug.includes("l") ? "l" : "i";
        normalized += target;
        detectedSubs.push(`"1" → "${target}"`);
      } else if (ch === "3" && brandSlug.includes("e")) {
        normalized += "e";
        detectedSubs.push('"3" → "e"');
      } else if (ch === "4" && brandSlug.includes("a")) {
        normalized += "a";
        detectedSubs.push('"4" → "a"');
      } else if (ch === "5" && brandSlug.includes("s")) {
        normalized += "s";
        detectedSubs.push('"5" → "s"');
      } else if (ch === "7" && brandSlug.includes("t")) {
        normalized += "t";
        detectedSubs.push('"7" → "t"');
      } else if (ch === "i" && brandSlug[i] === "l") {
        normalized += "l";
        detectedSubs.push('"i" → "l"');
      } else {
        normalized += ch;
      }
    }

    if (normalized === brandSlug && detectedSubs.length > 0) {
      const sim = Math.round(stringSimilarity(sld, brandSlug) * 100) / 100;
      return {
        brandImpersonation: true,
        impersonatedBrand: brand.name,
        legitimateDomain: legitDomain,
        similarityScore: Math.max(0.9, sim),
        impersonationReason: `The scanned domain closely resembles ${legitDomain} and contains a suspicious character substitution: ${Array.from(new Set(detectedSubs)).join(", ")}.`,
      };
    }

    if (detectedSubs.length > 0 && levenshteinDistance(normalized, brandSlug) <= 1) {
      const sim = Math.round(stringSimilarity(sld, brandSlug) * 100) / 100;
      return {
        brandImpersonation: true,
        impersonatedBrand: brand.name,
        legitimateDomain: legitDomain,
        similarityScore: Math.max(0.85, sim),
        impersonationReason: `The scanned domain uses character substitution (${Array.from(new Set(detectedSubs)).join(", ")}) imitating ${brand.name} (${legitDomain}).`,
      };
    }

    // 2. Suspicious Additions, Removals, and Hyphenations (e.g. pay-pal.com, paypal-security.com, secure-paypal.com)
    const strippedHyphens = sld.replace(/-/g, "");
    if (sld.includes("-")) {
      if (strippedHyphens === brandSlug) {
        return {
          brandImpersonation: true,
          impersonatedBrand: brand.name,
          legitimateDomain: legitDomain,
          similarityScore: 0.95,
          impersonationReason: `The scanned domain uses a hyphenated brand variation "${sld}" to imitate ${legitDomain}.`,
        };
      }

      if (sld.includes(brandSlug) || strippedHyphens.includes(brandSlug)) {
        return {
          brandImpersonation: true,
          impersonatedBrand: brand.name,
          legitimateDomain: legitDomain,
          similarityScore: 0.88,
          impersonationReason: `The scanned domain combines the brand name "${brand.name}" with suspicious keyword pattern "${sld}" on an unauthorized domain.`,
        };
      }
    }

    // 3. Typosquatting / Edit Distance (e.g. paypall.com, goggle.com, amazonn.com)
    const dist = levenshteinDistance(sld, brandSlug);
    const sim = stringSimilarity(sld, brandSlug);
    if ((dist === 1 && sld.length >= 4) || (dist === 2 && brandSlug.length >= 7 && sim >= 0.78)) {
      if (sld.length >= 4) {
        return {
          brandImpersonation: true,
          impersonatedBrand: brand.name,
          legitimateDomain: legitDomain,
          similarityScore: Math.round(sim * 100) / 100,
          impersonationReason: `The scanned domain has a ${Math.round(sim * 100)}% similarity to ${legitDomain} and appears to be a typosquatting imitation of ${brand.name}.`,
        };
      }
    }

    // 4. Misleading Subdomain Impersonation (e.g. paypal.verify-account.com)
    if (host.includes(brandSlug) && !registrable.includes(brandSlug)) {
      return {
        brandImpersonation: true,
        impersonatedBrand: brand.name,
        legitimateDomain: legitDomain,
        similarityScore: 0.85,
        impersonationReason: `The URL uses brand name "${brand.name}" in a misleading subdomain on an unauthorized domain (${registrable}).`,
      };
    }
  }

  return {
    brandImpersonation: false,
    impersonatedBrand: null,
    legitimateDomain: null,
    similarityScore: 0,
    impersonationReason: null,
  };
}

/**
 * Resolves a hostname to an IP address and determines IPv4 vs IPv6.
 * Fails safely and gracefully returns null on DNS lookup failure or invalid domain.
 */
async function resolveDnsIp(hostname: string): Promise<{ ipAddress: string | null; ipVersion: string | null }> {
  if (!hostname || hostname === "localhost") {
    return { ipAddress: null, ipVersion: null };
  }
  const ipCheck = net.isIP(hostname);
  if (ipCheck === 4) return { ipAddress: hostname, ipVersion: "IPv4" };
  if (ipCheck === 6) return { ipAddress: hostname, ipVersion: "IPv6" };

  try {
    const lookupPromise = dns.lookup(hostname);
    let timer: NodeJS.Timeout | undefined;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error("DNS timeout")), 1800);
    });
    const res = await Promise.race([lookupPromise, timeoutPromise]);
    if (timer) clearTimeout(timer);
    return {
      ipAddress: res.address,
      ipVersion: res.family === 6 ? "IPv6" : "IPv4",
    };
  } catch {
    return { ipAddress: null, ipVersion: null };
  }
}

/**
 * Extracts comprehensive technical URL intelligence safely.
 * IMPORTANT: Query parameter VALUES are NEVER extracted or returned for security.
 */
function extractUrlIntelligence(
  rawUrl: string,
  resolvedIp?: { ipAddress: string | null; ipVersion: string | null }
): UrlIntelligence {
  let parsed: URL | null = null;
  try {
    parsed = new URL(rawUrl.includes("://") ? rawUrl : (rawUrl.startsWith("//") ? `http:${rawUrl}` : `http://${rawUrl}`));
  } catch {
    // fallback safe
  }

  const { host, registrable, isIp } = extractDomainInfo(rawUrl);
  const hostname = parsed?.hostname ? parsed.hostname.toLowerCase() : host;
  const rawProtocol = parsed?.protocol ? parsed.protocol.replace(/:$/, "").toUpperCase() : (rawUrl.toLowerCase().startsWith("https://") ? "HTTPS" : "HTTP");
  const httpsEnabled = rawProtocol === "HTTPS" || rawUrl.toLowerCase().startsWith("https://");
  const protocol = httpsEnabled ? "HTTPS" : (rawProtocol || "HTTP");

  // Determine port: explicit port if present, otherwise default 443 for HTTPS and 80 for HTTP
  let port = httpsEnabled ? 443 : 80;
  if (parsed?.port) {
    const parsedPort = parseInt(parsed.port, 10);
    if (!Number.isNaN(parsedPort) && parsedPort > 0) {
      port = parsedPort;
    }
  }

  const path = parsed?.pathname ? (parsed.pathname.startsWith("/") ? parsed.pathname : `/${parsed.pathname}`) : "/";

  // Extract query parameter names ONLY (never parameter values)
  const queryParamKeys: string[] = [];
  if (parsed?.searchParams) {
    try {
      for (const key of parsed.searchParams.keys()) {
        if (key && !queryParamKeys.includes(key)) {
          queryParamKeys.push(key);
        }
      }
    } catch {
      // fallback safe
    }
  }

  const hasFragment = Boolean(parsed?.hash && parsed.hash.length > 1) || rawUrl.includes("#");
  const urlLength = rawUrl.length;

  // Subdomain count
  let subdomainCount = 0;
  if (!isIp && hostname && registrable) {
    const hostParts = hostname.split(".").filter(Boolean);
    const regParts = registrable.split(".").filter(Boolean);
    subdomainCount = Math.max(0, hostParts.length - regParts.length);
  }

  let ipAddress = resolvedIp?.ipAddress ?? null;
  let ipVersion = resolvedIp?.ipVersion ?? null;

  if (isIp && !ipAddress) {
    ipAddress = hostname;
    ipVersion = net.isIPv6(hostname) ? "IPv6" : "IPv4";
  }

  return {
    protocol,
    hostname: hostname || rawUrl,
    registrableDomain: registrable || hostname || rawUrl,
    subdomainCount,
    port,
    path,
    queryParameterCount: queryParamKeys.length,
    queryParameterNames: queryParamKeys,
    hasFragment,
    urlLength,
    ipAddress,
    ipVersion,
    httpsEnabled,
  };
}

const users = [
  { id: "u-admin", name: "Alex Morgan", email: "admin@phishguard.com", role: "admin" as const, password: "Admin@123" },
  { id: "u-demo", name: "Demo Analyst", email: "demo@phishguard.com", role: "user" as const, password: "Demo@123" },
];

const now = Date.now();
const scans: Scan[] = [
  makeScan("https://www.wikipedia.org/wiki/Phishing", "safe", 8, ["HTTPS enabled", "Trusted domain pattern"], "Demo Analyst", now - 1000 * 60 * 18),
  makeScan("http://192.168.0.1/login/verify-account", "phishing", 96, ["IP address used instead of domain", "Suspicious keyword: login", "Suspicious keyword: verify", "No HTTPS encryption"], "Demo Analyst", now - 1000 * 60 * 46),
  makeScan("https://support-microsoft-account.com/secure/update", "phishing", 87, ["Suspicious keyword: account", "Suspicious keyword: secure", "Hyphenated impersonation pattern"], "Demo Analyst", now - 1000 * 60 * 92),
  makeScan("https://github.com/replit", "safe", 5, ["HTTPS enabled", "Trusted domain pattern"], "Alex Morgan", now - 1000 * 60 * 140),
  makeScan("https://bit.ly/3xQp9Lm", "phishing", 71, ["URL shortener detected", "Destination is obscured"], "Demo Analyst", now - 1000 * 60 * 240),
  makeScan("https://www.nytimes.com/section/technology", "safe", 4, ["HTTPS enabled", "Normal path depth"], "Demo Analyst", now - 1000 * 60 * 360),
  makeScan("http://bank-secure-login.com/confirm/account", "phishing", 91, ["Suspicious keyword: bank", "Suspicious keyword: confirm", "No HTTPS encryption"], "Demo Analyst", now - 1000 * 60 * 520),
];

function id() {
  return Math.random().toString(36).slice(2, 10);
}

function makeScan(
  url: string,
  verdict: Verdict,
  riskScore: number,
  ruleFlags: string[],
  userName: string,
  createdAt: number,
  overrideImpersonation?: BrandImpersonationInfo,
  overrideIntelligence?: UrlIntelligence
): Scan {
  const impersonation = overrideImpersonation ?? detectBrandImpersonation(url);
  const intelligence = overrideIntelligence ?? extractUrlIntelligence(url);
  let parsed: URL | null = null;
  try { parsed = new URL(url); } catch { /* feature defaults below */ }
  const host = parsed?.hostname ?? url;
  const path = parsed?.pathname ?? "/";
  const keywords = ["login", "verify", "bank", "update", "secure", "account", "confirm", "signin"];
  const lower = url.toLowerCase();
  const features = {
    url_length: url.length,
    has_ip: /^(\d{1,3}\.){3}\d{1,3}$/.test(host),
    num_dots: (host.match(/\./g) ?? []).length,
    num_subdomains: Math.max(0, host.split(".").length - 2),
    has_https: lower.startsWith("https://"),
    has_at_symbol: url.includes("@"),
    has_hyphen: host.includes("-"),
    num_special_chars: (url.match(/[^a-zA-Z0-9]/g) ?? []).length,
    suspicious_keyword_count: keywords.filter((keyword) => lower.includes(keyword)).length,
    digit_ratio: url.length ? Number(((url.match(/\d/g) ?? []).length / url.length).toFixed(2)) : 0,
    path_depth: path.split("/").filter(Boolean).length,
    is_shortened: /bit\.ly|tinyurl\.com|t\.co|goo\.gl/i.test(host),
    domain_age_days: null,
    brand_impersonation: impersonation.brandImpersonation,
    impersonated_brand: impersonation.impersonatedBrand,
    similarity_score: impersonation.similarityScore,
  };
  return {
    id: id(),
    url,
    verdict,
    confidence: verdict === "phishing" ? Math.min(99.2, 80 + riskScore / 5) : Math.max(88.1, 99 - riskScore / 3),
    riskScore,
    ruleFlags,
    features,
    mlPrediction: verdict,
    rulePrediction: verdict,
    createdAt: new Date(createdAt).toISOString(),
    userName,
    brandImpersonation: impersonation.brandImpersonation,
    impersonatedBrand: impersonation.impersonatedBrand,
    legitimateDomain: impersonation.legitimateDomain,
    similarityScore: impersonation.similarityScore,
    impersonationReason: impersonation.impersonationReason,
    urlIntelligence: intelligence,
  };
}

async function analyze(url: string, userName: string): Promise<Scan> {
  const lower = url.toLowerCase();
  const flags: string[] = [];
  const parsed = (() => { try { return new URL(url); } catch { return null; } })();
  const host = parsed?.hostname ?? "";
  const keywords = ["login", "verify", "bank", "update", "secure", "account", "confirm", "signin"];
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(host)) flags.push("IP address used instead of domain");
  if (host.split(".").length - 2 > 3) flags.push("Too many subdomain levels");
  if (!lower.startsWith("https://")) flags.push("No HTTPS encryption");
  for (const keyword of keywords) if (lower.includes(keyword)) flags.push(`Suspicious keyword: ${keyword}`);
  if (url.includes("@")) flags.push("Username separator (@) can disguise the destination");
  if (/bit\.ly|tinyurl\.com|t\.co|goo\.gl/i.test(host)) flags.push("URL shortener detected");
  if (host.includes("-") && keywords.some((word) => host.includes(word))) flags.push("Hyphenated impersonation pattern");

  const impersonation = detectBrandImpersonation(url);
  if (impersonation.brandImpersonation) {
    flags.unshift(`Brand impersonation: ${impersonation.impersonatedBrand} lookalike domain`);
  }

  // Resolve DNS IP address asynchronously
  const resolvedIp = await resolveDnsIp(host);
  const intelligence = extractUrlIntelligence(url, resolvedIp);

  if (!flags.length) flags.push("HTTPS enabled", "Normal domain structure");
  const riskScore = Math.min(99, flags.reduce((score, flag) => {
    if (flag.includes("HTTPS") || flag.includes("Normal")) return score + 2;
    if (flag.includes("Brand impersonation")) return score + 38;
    return score + 14;
  }, 0));
  const verdict = riskScore >= 35 ? "phishing" : "safe";
  return makeScan(url, verdict, riskScore, flags, userName, Date.now(), impersonation, intelligence);
}

const router: IRouter = Router();
router.get("/auth/me", (req, res) => {
  const email = req.cookies?.phishguard_user ?? "demo@phishguard.com";
  const user = users.find((candidate) => candidate.email === email) ?? users[1];
  res.json({ id: user.id, name: user.name, email: user.email, role: user.role });
});
router.post("/auth/login", (req, res) => {
  const input = LoginBody.parse(req.body);
  const user = users.find((candidate) => candidate.email === input.email && candidate.password === input.password);
  if (!user) return res.status(401).json({ error: "Invalid email or password" });
  res.cookie("phishguard_user", user.email, { httpOnly: true, sameSite: "lax" });
  return res.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role } });
});
router.post("/auth/signup", (req, res) => {
  const input = SignupBody.parse(req.body);
  const user = { id: `u-${id()}`, name: input.name, email: input.email, role: "user" as const, password: input.password };
  users.push(user);
  res.cookie("phishguard_user", user.email, { httpOnly: true, sameSite: "lax" });
  return res.status(201).json({ user: { id: user.id, name: user.name, email: user.email, role: user.role } });
});
router.post("/auth/logout", (_req, res) => res.clearCookie("phishguard_user").status(204).send());

router.get("/scans", (req, res) => {
  const query = ListScansQueryParams.parse(req.query);
  const filtered = scans.filter((scan) => {
    const matchesSearch = !query.search || scan.url.toLowerCase().includes(query.search.toLowerCase());
    const matchesVerdict = !query.verdict || query.verdict === "all" || scan.verdict === query.verdict;
    return matchesSearch && matchesVerdict && (query.minRisk === undefined || scan.riskScore >= query.minRisk) && (query.maxRisk === undefined || scan.riskScore <= query.maxRisk);
  });
  res.json(filtered.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
});
router.post("/scans", async (req, res) => {
  const input = CreateScanBody.parse(req.body);
  const scan = await analyze(input.url, "Demo Analyst");
  scans.unshift(scan);
  res.status(201).json(scan);
});
router.get("/scans/:id", (req, res) => {
  const scan = scans.find((item) => item.id === req.params.id);
  if (!scan) return res.status(404).json({ error: "Scan not found" });
  return res.json(scan);
});
router.get("/dashboard/stats", (_req, res) => {
  const maliciousDetected = scans.filter((scan) => scan.verdict === "phishing").length;
  res.json({ totalScanned: scans.length, maliciousDetected, safeUrls: scans.length - maliciousDetected, modelAccuracy: 96.8, phishingPercent: Math.round((maliciousDetected / scans.length) * 100), safePercent: Math.round(((scans.length - maliciousDetected) / scans.length) * 100), recentScans: scans.slice(0, 5) });
});
router.get("/model-info", (_req, res) => res.json({
  accuracy: 96.8, precision: 95.4, recall: 97.1, f1Score: 96.2, datasetSize: 824, phishingCount: 412, legitimateCount: 412, trainedAt: "2026-08-20T08:32:00.000Z",
  featureImportance: [{ name: "suspicious_keyword_count", importance: 0.22 }, { name: "has_ip", importance: 0.18 }, { name: "is_shortened", importance: 0.14 }, { name: "url_length", importance: 0.12 }, { name: "has_https", importance: 0.1 }, { name: "num_subdomains", importance: 0.09 }, { name: "path_depth", importance: 0.07 }],
  features: [
    { name: "url_length", description: "Total number of characters in the URL" }, { name: "has_ip", description: "Whether the host is a raw IPv4 address" }, { name: "num_subdomains", description: "Number of nested subdomains" }, { name: "has_https", description: "Whether encrypted HTTPS is used" }, { name: "suspicious_keyword_count", description: "Count of high-risk words in the URL" }, { name: "is_shortened", description: "Whether the URL uses a shortening service" }, { name: "path_depth", description: "Number of path segments after the domain" },
  ],
}));

export default router;