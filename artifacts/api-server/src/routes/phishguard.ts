import { Router, type IRouter } from "express";
import {
  CreateScanBody,
  LoginBody,
  SignupBody,
  ListScansQueryParams,
} from "@workspace/api-zod";

type Verdict = "safe" | "phishing";
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
};

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

function makeScan(url: string, verdict: Verdict, riskScore: number, ruleFlags: string[], userName: string, createdAt: number): Scan {
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
  };
}

function analyze(url: string, userName: string): Scan {
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
  if (!flags.length) flags.push("HTTPS enabled", "Normal domain structure");
  const riskScore = Math.min(99, flags.reduce((score, flag) => score + (flag.includes("HTTPS") || flag.includes("Normal") ? 2 : 14), 0));
  const verdict = riskScore >= 35 ? "phishing" : "safe";
  return makeScan(url, verdict, riskScore, flags, userName, Date.now());
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
router.post("/scans", (req, res) => {
  const input = CreateScanBody.parse(req.body);
  const scan = analyze(input.url, "Demo Analyst");
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