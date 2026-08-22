import path from "node:path";
import fs from "node:fs";

export const FEATURE_NAMES = [
  "url_length",
  "has_ip",
  "ip_version",
  "num_dots",
  "num_subdomains",
  "has_https",
  "has_at_symbol",
  "has_hyphen",
  "num_special_chars",
  "suspicious_keyword_count",
  "digit_ratio",
  "path_depth",
  "is_shortened",
  "entropy_score",
  "is_non_standard_port",
  "query_param_count",
  "has_fragment",
  "brand_impersonation",
  "similarity_score",
  "has_character_substitution",
  "has_hyphenated_brand",
  "has_compound_brand_keyword"
] as const;

export type FeatureName = typeof FEATURE_NAMES[number];

export interface MlInferenceResult {
  predictedLabel: "safe" | "phishing";
  phishingProbability: number;
  safeProbability: number;
  confidence: number;
  features: Record<FeatureName, number>;
  featureVector: number[];
}

const BRANDS = [
  { name: "PayPal", slug: "paypal", domains: ["paypal.com", "paypal.me", "paypal-community.com"] },
  { name: "Google", slug: "google", domains: ["google.com", "google.co.uk", "google.co.in", "accounts.google.com"] },
  { name: "Amazon", slug: "amazon", domains: ["amazon.com", "amazon.co.uk", "amazon.de", "amazon.in", "aws.amazon.com"] },
  { name: "Microsoft", slug: "microsoft", domains: ["microsoft.com", "live.com", "office.com", "outlook.com"] },
  { name: "Apple", slug: "apple", domains: ["apple.com", "icloud.com"] },
  { name: "Facebook", slug: "facebook", domains: ["facebook.com", "fb.com", "meta.com"] },
  { name: "Instagram", slug: "instagram", domains: ["instagram.com"] },
  { name: "Netflix", slug: "netflix", domains: ["netflix.com"] },
  { name: "LinkedIn", slug: "linkedin", domains: ["linkedin.com"] },
  { name: "GitHub", slug: "github", domains: ["github.com", "github.io"] },
  { name: "Twitter/X", slug: "twitter", domains: ["twitter.com", "x.com"] },
  { name: "Dropbox", slug: "dropbox", domains: ["dropbox.com"] },
];

const SUBSTITUTIONS: Record<string, string> = {
  "0": "o",
  "1": "l",
  "3": "e",
  "4": "a",
  "5": "s",
  "7": "t",
  "i": "l",
};

const MULTI_CCTLD = new Set([
  ".co.uk", ".com.au", ".co.in", ".co.nz", ".co.za", ".com.br", ".com.mx",
  ".co.jp", ".com.sg", ".org.uk", ".gov.uk", ".edu.au", ".ac.uk", ".com.tr"
]);

const KEYWORDS = ["login", "verify", "bank", "update", "secure", "account", "confirm", "signin"];
const SHORTENERS = new Set(["bit.ly", "tinyurl.com", "t.co", "goo.gl", "ow.ly", "is.gd", "buff.ly", "adf.ly", "bit.do"]);

function levenshteinDistance(a: string, b: string): number {
  const dp: number[][] = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) dp[i][0] = i;
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = min3(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[a.length][b.length];
}

function min3(a: number, b: number, c: number): number {
  return Math.min(a, Math.min(b, c));
}

function stringSimilarity(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1.0;
  return Math.max(0.0, 1.0 - levenshteinDistance(a, b) / maxLen);
}

function extractDomainInfo(rawUrl: string) {
  const url = rawUrl.trim();
  let parsed: URL | null = null;
  try {
    parsed = new URL(url.includes("://") ? url : `http://${url}`);
  } catch {
    // fallback
  }

  const host = (parsed?.hostname ?? url.split("/")[0].split("?")[0].split("#")[0]).toLowerCase();
  const isIpv4 = /^(\d{1,3}\.){3}\d{1,3}$/.test(host);
  const isIpv6 = host.includes(":") && !isIpv4;
  const isIp = isIpv4 || isIpv6;

  if (isIp) {
    return {
      host,
      sld: host,
      registrable: host,
      isIp: true,
      ipVersion: isIpv4 ? 4 : 6,
    };
  }

  let matchedCctld: string | null = null;
  for (const cc of Array.from(MULTI_CCTLD)) {
    if (host.endsWith(cc)) {
      matchedCctld = cc;
      break;
    }
  }

  const parts = host.split(".").filter(Boolean);
  if (!parts.length) {
    return { host, sld: host, registrable: host, isIp: false, ipVersion: 0 };
  }

  let sld: string;
  let registrable: string;

  if (matchedCctld) {
    const prefix = host.slice(0, -matchedCctld.length);
    const prefixParts = prefix.split(".").filter(Boolean);
    sld = prefixParts[prefixParts.length - 1] ?? host;
    registrable = `${sld}${matchedCctld}`;
  } else if (parts.length >= 2) {
    sld = parts[parts.length - 2];
    registrable = `${parts[parts.length - 2]}.${parts[parts.length - 1]}`;
  } else {
    sld = parts[0];
    registrable = parts[0];
  }

  return {
    host,
    sld,
    registrable,
    isIp: false,
    ipVersion: 0,
  };
}

function detectBrandImpersonation(rawUrl: string) {
  const info = extractDomainInfo(rawUrl);
  const host = info.host;
  const sld = info.sld;
  const registrable = info.registrable;

  if (info.isIp || !sld || sld.length < 3) {
    return {
      brandImpersonation: 0,
      similarityScore: 0.0,
      hasCharacterSubstitution: 0,
      hasHyphenatedBrand: 0,
      hasCompoundBrandKeyword: 0,
    };
  }

  for (const brand of BRANDS) {
    for (const legitDomain of brand.domains) {
      if (host === legitDomain || host.endsWith("." + legitDomain)) {
        return {
          brandImpersonation: 0,
          similarityScore: 0.0,
          hasCharacterSubstitution: 0,
          hasHyphenatedBrand: 0,
          hasCompoundBrandKeyword: 0,
        };
      }
    }
  }

  for (const brand of BRANDS) {
    const brandSlug = brand.slug;
    let normalized = "";
    const detectedSubs: string[] = [];

    for (const char of sld) {
      if (char in SUBSTITUTIONS) {
        normalized += SUBSTITUTIONS[char];
        detectedSubs.push(`${char}->${SUBSTITUTIONS[char]}`);
      } else {
        normalized += char;
      }
    }

    if (normalized === brandSlug && detectedSubs.length > 0) {
      const sim = stringSimilarity(sld, brandSlug);
      return {
        brandImpersonation: 1,
        similarityScore: Math.max(0.9, sim),
        hasCharacterSubstitution: 1,
        hasHyphenatedBrand: 0,
        hasCompoundBrandKeyword: 0,
      };
    }

    if (detectedSubs.length > 0 && levenshteinDistance(normalized, brandSlug) <= 1) {
      const sim = stringSimilarity(sld, brandSlug);
      return {
        brandImpersonation: 1,
        similarityScore: Math.max(0.85, sim),
        hasCharacterSubstitution: 1,
        hasHyphenatedBrand: 0,
        hasCompoundBrandKeyword: 0,
      };
    }

    const strippedHyphens = sld.replace(/-/g, "");
    if (sld.includes("-")) {
      if (strippedHyphens === brandSlug) {
        return {
          brandImpersonation: 1,
          similarityScore: 0.95,
          hasCharacterSubstitution: 0,
          hasHyphenatedBrand: 1,
          hasCompoundBrandKeyword: 0,
        };
      }
      if (sld.includes(brandSlug) || strippedHyphens.includes(brandSlug)) {
        return {
          brandImpersonation: 1,
          similarityScore: 0.88,
          hasCharacterSubstitution: 0,
          hasHyphenatedBrand: 1,
          hasCompoundBrandKeyword: 1,
        };
      }
    }

    const dist = levenshteinDistance(sld, brandSlug);
    const sim = stringSimilarity(sld, brandSlug);
    if ((dist === 1 && sld.length >= 4) || (dist === 2 && brandSlug.length >= 7 && sim >= 0.78)) {
      if (sld.length >= 4) {
        return {
          brandImpersonation: 1,
          similarityScore: sim,
          hasCharacterSubstitution: 0,
          hasHyphenatedBrand: 0,
          hasCompoundBrandKeyword: 0,
        };
      }
    }

    if (host.includes(brandSlug) && !registrable.includes(brandSlug)) {
      return {
        brandImpersonation: 1,
        similarityScore: 0.85,
        hasCharacterSubstitution: 0,
        hasHyphenatedBrand: 0,
        hasCompoundBrandKeyword: 1,
      };
    }
  }

  return {
    brandImpersonation: 0,
    similarityScore: 0.0,
    hasCharacterSubstitution: 0,
    hasHyphenatedBrand: 0,
    hasCompoundBrandKeyword: 0,
  };
}

function calculateShannonEntropy(s: string): number {
  if (!s) return 0.0;
  const freq: Record<string, number> = {};
  for (const c of s) freq[c] = (freq[c] ?? 0) + 1;
  let entropy = 0.0;
  const len = s.length;
  for (const count of Object.values(freq)) {
    const p = count / len;
    entropy -= p * Math.log2(p);
  }
  return Number(entropy.toFixed(4));
}

/**
 * Extracts 22 mathematical/lexical features with full parity to Python feature_extractor.py
 */
export function extractMlFeatures(rawUrl: string): Record<FeatureName, number> {
  const url = rawUrl.trim();
  const lowerUrl = url.toLowerCase();

  let parsed: URL | null = null;
  try {
    parsed = new URL(url.includes("://") ? url : `http://${url}`);
  } catch {
    // fallback
  }

  const domainInfo = extractDomainInfo(url);
  const host = domainInfo.host;
  const registrable = domainInfo.registrable;
  const isIp = domainInfo.isIp;
  const ipVersion = domainInfo.ipVersion;

  const path = parsed?.pathname ?? "/";
  const search = parsed?.search ?? "";
  const hash = parsed?.hash ?? "";

  const port = parsed?.port ? parseInt(parsed.port, 10) : null;
  const hasHttps = lowerUrl.startsWith("https://") ? 1 : 0;
  const isNonStandardPort = port && port !== 80 && port !== 443 ? 1 : 0;

  let subdomainCount = 0;
  if (!isIp && host && registrable) {
    const hostParts = host.split(".").filter(Boolean);
    const regParts = registrable.split(".").filter(Boolean);
    subdomainCount = Math.max(0, hostParts.length - regParts.length);
  }

  const pathDepth = path.split("/").filter(Boolean).length;
  let queryParamCount = 0;
  if (parsed?.searchParams) {
    queryParamCount = Array.from(new Set(parsed.searchParams.keys())).length;
  }

  const hasFragment = hash || url.includes("#") ? 1 : 0;
  const numDigits = (url.match(/\d/g) ?? []).length;
  const digitRatio = url.length > 0 ? Number((numDigits / url.length).toFixed(4)) : 0.0;
  const numSpecialChars = (url.match(/[^a-zA-Z0-9]/g) ?? []).length;
  const suspiciousKeywordCount = KEYWORDS.filter((kw) => lowerUrl.includes(kw)).length;
  const isShortened = Array.from(SHORTENERS).some((s) => host.includes(s)) ? 1 : 0;

  const brandFeatures = detectBrandImpersonation(url);
  const entropyScore = calculateShannonEntropy(url);

  return {
    url_length: url.length,
    has_ip: isIp ? 1 : 0,
    ip_version: ipVersion,
    num_dots: (host.match(/\./g) ?? []).length,
    num_subdomains: subdomainCount,
    has_https: hasHttps,
    has_at_symbol: url.includes("@") ? 1 : 0,
    has_hyphen: host.includes("-") ? 1 : 0,
    num_special_chars: numSpecialChars,
    suspicious_keyword_count: suspiciousKeywordCount,
    digit_ratio: digitRatio,
    path_depth: pathDepth,
    is_shortened: isShortened,
    entropy_score: entropyScore,
    is_non_standard_port: isNonStandardPort,
    query_param_count: queryParamCount,
    has_fragment: hasFragment,
    brand_impersonation: brandFeatures.brandImpersonation,
    similarity_score: Number(brandFeatures.similarityScore.toFixed(4)),
    has_character_substitution: brandFeatures.hasCharacterSubstitution,
    has_hyphenated_brand: brandFeatures.hasHyphenatedBrand,
    has_compound_brand_keyword: brandFeatures.hasCompoundBrandKeyword,
  };
}

export function toFeatureVector(features: Record<FeatureName, number>): number[] {
  return FEATURE_NAMES.map((name) => features[name]);
}

interface TreeData {
  children_left: number[];
  children_right: number[];
  feature: number[];
  threshold: number[];
  value: number[][]; // [safe, phish]
}

interface ForestData {
  n_estimators: number;
  trees: TreeData[];
}

let cachedForest: ForestData | null = null;

function loadForest(): ForestData {
  if (cachedForest) return cachedForest;
  const treePath = path.resolve(import.meta.dirname, "model_trees.json");
  const raw = fs.readFileSync(treePath, "utf-8");
  cachedForest = JSON.parse(raw);
  return cachedForest!;
}

/**
 * Predicts phishing probability using the trained decision tree ensemble.
 */
export async function predictFeatures(featureVector: number[]): Promise<MlInferenceResult> {
  const forest = loadForest();
  let totalSafeWeight = 0;
  let totalPhishWeight = 0;

  for (const tree of forest.trees) {
    let node = 0;
    while (tree.children_left[node] !== -1) {
      const featIdx = tree.feature[node];
      const thresh = tree.threshold[node];
      if (featureVector[featIdx] <= thresh) {
        node = tree.children_left[node];
      } else {
        node = tree.children_right[node];
      }
    }
    const val = tree.value[node]; // [safe, phish]
    const sum = val[0] + val[1];
    if (sum > 0) {
      totalSafeWeight += val[0] / sum;
      totalPhishWeight += val[1] / sum;
    }
  }

  const n = forest.n_estimators;
  const safeProb = totalSafeWeight / n;
  const phishProb = totalPhishWeight / n;

  const predictedLabel = phishProb >= 0.5 ? "phishing" : "safe";
  const confidence = Number((Math.max(safeProb, phishProb) * 100).toFixed(2));

  const featuresMap = {} as Record<FeatureName, number>;
  FEATURE_NAMES.forEach((name, idx) => {
    featuresMap[name] = featureVector[idx];
  });

  return {
    predictedLabel,
    phishingProbability: Number(phishProb.toFixed(4)),
    safeProbability: Number(safeProb.toFixed(4)),
    confidence,
    features: featuresMap,
    featureVector,
  };
}

export async function predictUrl(url: string): Promise<MlInferenceResult> {
  const features = extractMlFeatures(url);
  const vector = toFeatureVector(features);
  return predictFeatures(vector);
}
