# 🛡️ PhishGuard Threat Analyzer

> **AI-powered hybrid phishing URL detection with explainable risk scoring.**

PhishGuard is a hybrid phishing URL detection system combining a **calibrated Random Forest ML classifier** with a **Heuristic Rules Engine** for accurate, explainable, and reliable URL analysis.

The system extracts URL characteristics, evaluates them through both ML and security rules, and combines the results into a single risk score and final verdict.

## 🚀 Features

* 🤖 **Random Forest:** Uses 20 structural and lexical URL features.
* 🔍 **Heuristics:** Detects IP hosts, missing HTTPS, `@` symbols, shorteners, suspicious domains, etc.
* ⚡ **Risk Score:** Combines **70% ML + 30% Rules** into a 0–100 score.
* 🎯 **Classification:** `≤30%` Safe, `30–70%` Rule-based, `≥70%` Phishing.
* 🔄 **Fallback:** Heuristic scanning continues if the ML service is offline.

## 🎯 Why PhishGuard?

Unlike a purely ML-based detector, PhishGuard combines **learned patterns** with **explicit security rules**. This makes predictions easier to explain while keeping the system functional even when the ML service is unavailable.

## 🏗️ Architecture

```text
                 ┌→ Random Forest ML ─────┐
URL → Features ──┤                        ├→ Risk Score → Verdict
                 └→ Heuristic Rules ──────┘
                         70% ML + 30% Rules
```

### 🔄 Detection Flow

```text
User enters URL
      ↓
Feature Extraction
      ↓
┌───────────────────────┐
│ ML Probability        │
│ +                     │
│ Heuristic Rule Score  │
└───────────┬───────────┘
            ↓
     Risk Score (0–100)
            ↓
 ┌──────────┼──────────┐
 ↓          ↓          ↓
≤30%      30–70%      ≥70%
Safe    Rule-based  Phishing
Decision   Decision
```

### 🧠 How It Works

1. **Feature Extraction** – 20 URL features such as URL length, IP usage, HTTPS, subdomains, special characters, path structure, and digit/letter ratios are extracted.
2. **ML Prediction** – The calibrated Random Forest estimates the probability that the URL is phishing.
3. **Rule Analysis** – The Express backend checks deterministic phishing indicators such as raw IPs, missing HTTPS, URL shorteners, `@` symbols, and suspicious domains.
4. **Score Fusion** – ML and rule signals are combined using **70% ML + 30% Rules** to produce a 0–100 risk score.
5. **Final Verdict** – Thresholds determine whether the URL is Safe, requires rule-based analysis, or is classified as Phishing.

## 🧰 Tech Stack

| Layer      | Technologies                                                 |
| ---------- | ------------------------------------------------------------ |
| Frontend   | React, TypeScript, Vite, Tailwind CSS, React Query, Recharts |
| Backend    | Node.js, Express, Zod, Pino                                  |
| ML Service | Python, FastAPI, Scikit-Learn, Pandas, NumPy, Joblib         |

## ⚙️ Setup

**Requirements:** Node.js 20+, Python 3.11+, pnpm

```bash
npx pnpm install
cd ml
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

Run the three services in separate terminals:

```bash
# ML — :8000
cd ml
uvicorn model_service:app --port 8000
```

```powershell
# Express — :5000
$env:PORT="5000"; $env:NODE_ENV="development"
node --enable-source-maps ./artifacts/api-server/dist/index.mjs
```

```powershell
# React — :5173
$env:PORT="5173"; $env:BASE_PATH="/"
npx pnpm --filter phishguard dev
```

## 🧠 Custom Model Training

Add `ml/data/phishing_urls.csv` with `url` and `label` columns (`1 = phishing`, `0 = safe`), then run:

```bash
cd ml
.venv\Scripts\python train_model.py
```

The pipeline performs a **70/15/15 train-validation-test split**, trains and calibrates the Random Forest, and generates `model.pkl`, `feature_schema.json`, and `metrics.json`.

### 📊 Training Flow

```text
CSV Dataset → Clean Data → Extract Features
                         ↓
                  70% Train / 15% Validation / 15% Test
                         ↓
                  Random Forest Training
                         ↓
                  Probability Calibration
                         ↓
              Model + Evaluation Metrics
```

## 📌 Project Highlights

* **20 URL features** covering structural, lexical, path, and query characteristics.
* **Calibrated probabilities** instead of raw Random Forest votes.
* **70/30 score fusion** for balanced ML and rule-based detection.
* **Graceful fallback** for ML service failures.

## 🚀 Future Improvements

Browser extension • Threat intelligence APIs • WHOIS/DNS analysis • Explainable AI • Docker/cloud deployment

## ⚠️ Disclaimer

PhishGuard is a security analysis tool. A **Safe** result does not guarantee that a URL is trustworthy.

