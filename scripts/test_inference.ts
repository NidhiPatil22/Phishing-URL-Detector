import { predictUrl, extractMlFeatures } from "../artifacts/api-server/src/ml/detector";

async function runTests() {
  console.log("=================================================");
  console.log("       TESTING REAL ML MODEL INFERENCE (TS)      ");
  console.log("=================================================\n");

  const testUrls = [
    { url: "https://paypal.com/signin", expected: "safe" },
    { url: "https://www.google.com/search?q=security", expected: "safe" },
    { url: "https://github.com/replit", expected: "safe" },
    { url: "https://www.wikipedia.org/wiki/Computer_security", expected: "safe" },
    { url: "https://paypa1.com/login?redirect=account", expected: "phishing" },
    { url: "https://g00gle.com/auth/verify", expected: "phishing" },
    { url: "http://192.168.0.1/admin/login", expected: "phishing" },
    { url: "http://secure-paypal-account-update.xyz/verify", expected: "phishing" },
    { url: "https://netflix-billing-update.com/login", expected: "phishing" },
  ];

  for (const { url, expected } of testUrls) {
    const t0 = performance.now();
    const result = await predictUrl(url);
    const dt = (performance.now() - t0).toFixed(2);

    const isMatch = result.predictedLabel === expected;
    console.log(`URL: ${url}`);
    console.log(`  -> Predicted:  ${result.predictedLabel.toUpperCase()} (Confidence: ${result.confidence}%, PhishProb: ${(result.phishingProbability * 100).toFixed(1)}%)`);
    console.log(`  -> Expected:   ${expected.toUpperCase()} [${isMatch ? "✓ PASS" : "✗ MISMATCH"}] (${dt}ms)`);
    console.log(`  -> Brand Flag: ${result.features.brand_impersonation}, Sim: ${result.features.similarity_score}, Entropy: ${result.features.entropy_score}\n`);
  }
}

runTests().catch(console.error);
