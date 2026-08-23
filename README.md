# 🛡️ PhishGuard Threat Analyzer

> **AI-powered hybrid phishing URL detection with explainable risk scoring.**

PhishGuard is a hybrid phishing URL detection system combining a **calibrated Random Forest ML classifier** with a **Heuristic Rules Engine** for accurate, explainable, and reliable URL analysis.

The system extracts URL characteristics, evaluates them through both ML and security rules, and combines the results into a single risk score and final verdict.

---

## 🚀 Key Features

* 🤖 **Random Forest Classifier:** Evaluates URLs against **20 structural and lexical features**, calibrated using `CalibratedClassifierCV` (Platt's scaling) to yield true statistical probabilities.
* 🔍 **Heuristic Rules:** Detects IP hosts, missing HTTPS, `@` symbols, shorteners, suspicious domains, and brand impersonation.
* ⚡ **Score Fusion:** Combines **70% ML + 30% Rules** into a single 0–100 risk score.
* 🎯 **Verdict Thresholds:** `≤30%` Safe, `30–70%` Rule-based fallback, `≥70%` Phishing.
* 🔄 **Graceful Fallback:** Heuristic scanning continues if the ML service is offline.

---

## 🏗️ Architecture

```text
URL ➔ Central Feature Extractor
         │
         ├──► Calibrated Random Forest (Python) ──► ML Probability (70%) ──┐
         │                                                                 ▼
         └──► Heuristics Rule Engine (Express)  ──► Rule Severity   (30%) ──┴─► Combined Risk Score (0-100)
                                                                                   │
                                                                                   ▼
                                                                            Final Verdict
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

---

## 🧰 Tech Stack

| Layer      | Technologies                                                 |
| ---------- | ------------------------------------------------------------ |
| **Frontend**   | React 18, TypeScript, Vite, Tailwind CSS v4, React Query, Recharts |
| **Backend**    | Node.js, Express, Zod, Pino |
| **ML Service** | Python, FastAPI, Scikit-Learn, Pandas, NumPy, Joblib |

---

## ⚙️ Setup & Installation

**Requirements:** Node.js 20+, Python 3.11+, pnpm

### 1. Install Workspace Dependencies
From the root directory, run:
```bash
npx pnpm install
```

### 2. Prepare the Python ML Environment
Create and configure the virtual environment:
```bash
cd ml
python -m venv .venv
.venv\Scripts\activate      # On Windows
source .venv/bin/activate   # On Unix/macOS
pip install -r requirements.txt
```

---

## 🚀 Running the Project Locally

Start the three services concurrently in separate terminals:

### A. Start the Python ML Service (port `8000`)
```bash
cd ml
.venv\Scripts\activate
uvicorn model_service:app --port 8000
```

### B. Start the Express API Backend (port `5000`)
```powershell
$env:PORT="5000"; $env:NODE_ENV="development"
node --enable-source-maps ./artifacts/api-server/dist/index.mjs
```

### C. Start the React Frontend UI (port `5173`)
```powershell
$env:PORT="5173"; $env:BASE_PATH="/"
npx pnpm --filter phishguard dev
```

---

## 🧠 Custom Model Training

Add your dataset CSV file at `ml/data/phishing_urls.csv` containing a `url` column and a binary `label` column (`1 = phishing`, `0 = safe`), then run:

```bash
cd ml
.venv\Scripts\python train_model.py
```

The pipeline performs a **70/15/15 train-validation-test split**, trains and calibrates the Random Forest, and generates `model.pkl`, `feature_schema.json`, and `metrics.json`.

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

---

## 🚀 Future Roadmap
* Browser extensions for Chrome and Firefox.
* External Threat intelligence API integrations.
* Real-time WHOIS registration and DNS resolution checks.
* Dockerized deployment containerization.

---

## ⚠️ Disclaimer

PhishGuard is a security analysis tool. A **Safe** result does not guarantee that a URL is trustworthy.
