# 🛡️ PhishGuard Threat Analyzer — Project Technical Specification

Welcome to the complete technical blueprint and specification registry of the **PhishGuard Threat Analyzer** workspace. This file summarizes the architecture, technology stack, REST API endpoints, security heuristic rules, machine learning parameters, and visual system components implemented to date.

---

## 🖥️ 1. Redesigned Frontend visual System

The frontend interface has been redesigned to reflect a premium, state-of-the-art consumer AI application inspired by **Pinterest, Notion, Linear, and Arc Browser**. It prioritizes editorial spacing, warm tactile off-white colors, and high-readability modern typography.

### 🎨 Design Tokens & Aesthetics
* **Typography**: Integrated **Space Grotesk** globally for headings and interactive elements, paired with **DM Mono** for raw code representations, regex details, and neural feature names.
* **Palette (Light-First)**:
  * **App Background**: Tactile Warm Ivory (`#fbfaf7` / `hsl(30 20% 97%)`) and Soft Off-White (`#f9f9fb`).
  * **Containers & Cards**: Floating solid white panels (`#ffffff`) with thin, low-contrast borders (`#e8e6e1` / `hsl(30 10% 88%)`) and subtle drop shadows (`shadow-[0_8px_30px_rgba(0,0,0,0.02)]`).
  * **Typography Color**: Deep Charcoal (`#1c1c1c` / `hsl(220 15% 15%)`) for primary text; slate gray for notes.
  * **Diagnostic Alerts**: 
    * **Safe**: Muted Forest Green (`#10b981` / `hsl(150 50% 35%)`)
    * **Suspicious**: Calm Warm Amber (`#f59e0b` / `hsl(38 92% 50%)`)
    * **Phishing**: Terracotta / Soft Coral (`#ef4444` / `hsl(10 65% 55%)`)
    * **AI Accents**: Dusty Slate Blue (`#3b82f6` / `hsl(205 35% 50%)`)
* **Dark Mode**: Persisted statefully via a custom `useTheme` hook, toggling to a warm dark charcoal/gray workspace (`hsl(220 15% 10%)`).
* **Animations**: Subtle, slow-floating `@keyframes float` loop styles for background trust badges and graphic snippets.

### 🧩 UI Pages & Components (Inside [App.tsx](file:///c:/Users/Asus/Downloads/PhishGuard-Threat-Analyzer/PhishGuard-Threat-Analyzer/artifacts/phishguard/src/App.tsx))
1. **Interactive Hero Section**: Contains the public-facing URL analyzer input. It is surrounded by slow-floating card previews representing safety factors (SSL chip, brand mimicry ratio, neural count).
2. **URL Anatomy live preview**: Displays a raw URL split interactive diagram illustrating the protocol, subdomain count, hostname, path parameters, and query parameters.
3. **How It Works (Pinterest Masonry)**: A responsive grid layout mapping the four stages of analysis: Lexical Extraction ➔ ML Probability Assessment ➔ Rules Flagging ➔ Hybrid Score Fusion.
4. **Cinematic Scanner Stepper**: A logs-style scanning ticker showing real-time loading checkmarks synced to API request states.
5. **Investigative Result Panel**: 
   * **Circular SVG Gauge**: Renders the risk score (0-100) dynamically using stateful alert colors.
   * **Timeline of Heuristics**: Maps triggered rules to severity badges, icons, and plain-language descriptions.
   * **Recharts Visualizers**: A custom Recharts pie chart showing safe vs phishing ratios, alongside comparative progress bars mapping ML probability vs rule scores.
   * **Neural Features Table**: Exposes the 20 active lexical features extracted from the tested URL.
6. **Model Notes Page**: Displays training dimensions, test-set accuracies (accuracy, precision, recall, F1), training dates, and a custom bar chart rendering Random Forest feature weights.

---

## 🧰 2. Technology Stack

The project runs on a monorepo workspace structured under **pnpm workspaces**:

| Layer | Component | Technologies |
|---|---|---|
| **Frontend** | Client | React 18, TypeScript, Vite, Tailwind CSS v4, Recharts, Wouter (Routing), TanStack React Query, Lucide Icons |
| **Backend** | API Gateway | Node.js, Express 5, Zod Schema Validation, Pino Logging, Cookie Parser, CORS |
| **Database** | Persistence | PostgreSQL, Drizzle ORM (configured in workspace, mocked locally in-memory for zero-dependency operation) |
| **ML Engine** | Classifier Service | Python 3.11, FastAPI, Scikit-Learn, Pandas, NumPy, Joblib |

---

## 🔌 3. REST API Endpoint Specification

The backend server exposes the following OpenAPI-compliant JSON endpoints under the base path `/api`:

| Method | Endpoint | Tags | Description | Request Payload | Response Schema |
|---|---|---|---|---|---|
| **GET** | `/healthz` | `health` | Health Check | None | `{ status: "operational" }` |
| **GET** | `/auth/me` | `auth` | Get Current Session User | Cookie Auth | `User` (id, name, email, role) |
| **POST** | `/auth/login` | `auth` | Sign In User | `{ email, password }` | `AuthResponse` (includes `User` object) |
| **POST** | `/auth/signup` | `auth` | Register Account | `{ name, email, password }` | `AuthResponse` (status `201`) |
| **POST** | `/auth/logout` | `auth` | End User Session | None | Status `204` (No Content) |
| **GET** | `/scans` | `scans` | Query Scan History | URL Query Filters | `Scan[]` |
| **POST** | `/scans` | `scans` | Analyze new threat vector | `{ url }` | `Scan` details |
| **GET** | `/scans/{id}` | `scans` | Query scan details | Path Parameter `{id}` | `Scan` details |
| **GET** | `/dashboard/stats` | `dashboard` | Read platform KPIs | None | `DashboardStats` metrics |
| **GET** | `/model-info` | `model` | Neural model telemetry | None | `ModelInfo` evaluation metrics |

---

## 🤖 4. Machine Learning Classifier

The machine learning classifier runs inside the Python environment. It utilizes a **Random Forest Classifier** calibrated to yield actual statistical probabilities rather than default raw class scores.

* **Probability Calibration**: Built using `CalibratedClassifierCV` utilizing Platt's scaling (sigmoid method) to ensure model confidence percentages correspond directly with empirical threat likelihood.
* **Lexical Features Extracted (20 Features)**:
  * URL length, hostname length, path length, subdomain count.
  * Dot (`.`) count, hyphen (`-`) count, underscore (`_`) count, slash (`/`) count, equals (`=`) count.
  * Numerical digit ratio, character token distributions.
  * Special characters (`@`, `?`, `&`, `!`) detection.
* **Training Pipeline**: Features a 70% Train, 15% Validation, and 15% Test split. Evaluates performance metrics dynamically (`train_model.py`), saving the serialized pipeline to `model.pkl`.

---

## 🔍 5. Heuristic Rules Engine

Operating in parallel with the machine learning model, the rules engine (written inside [phishguard.ts](file:///c:/Users/Asus/Downloads/PhishGuard-Threat-Analyzer/PhishGuard-Threat-Analyzer/artifacts/api-server/src/routes/phishguard.ts)) flags specific structural threat signatures:

1. **IP Host Address**: Checks if the hostname is a raw IP address (e.g. `192.168.1.1`).
2. **Missing HTTPS**: Flags unsecured HTTP connections.
3. **URL Shorteners**: Matches known shortener domains (e.g. `bit.ly`, `tinyurl.com`, `t.co`).
4. **Suspicious TLDs**: Flags URLs using high-frequency phishing top-level domains (e.g. `.xyz`, `.fit`, `.top`, `.tk`, `.cc`).
5. **Brand Impersonation / Lookalike**: Compares registrable domains against legitimate technology brands (e.g. `google`, `amazon`, `netflix`, `paypal`) using **Levenshtein Distance**. If a similarity score is high but not an exact match (e.g. `netflix-security-update.com`), a critical warning flag is raised.

---

## 🛡️ 6. Score Fusion Logic

The overall threat assessment fuses empirical ML and rules-based weights:

$$\text{Combined Risk Score} = (0.7 \times \text{ML Probability}) + (0.3 \times \text{Rules Severity})$$

The final verdict category is mapped using the following calibrated thresholds:
* **Safe (`verdict === 'safe'`)**: Risk Score $\le 30$.
* **Suspicious (`verdict === 'phishing'` & Risk Score $< 60$)**: Risk Score between $30$ and $60$. High probability of rules flags but low ML confidence, or moderate indicators on both.
* **Phishing (`verdict === 'phishing'` & Risk Score $\ge 60$)**: Risk Score $\ge 60$. Confirmed signature match and high ML probability classifier rating.

---

## ⚙️ 7. Setup and Local Commands

### Environment Settings
* `PORT` (Required for Vite & Express Backend)
* `BASE_PATH` (Required for Vite Client build assets resolution)

### Operation Scripts (Windows PowerShell)
To run the project locally, launch the Express API gateway and the Vite frontend concurrently:

```powershell
# A. Start the Express API Backend Gateway (listening on Port 5000)
$env:NODE_ENV="development"; pnpm --filter @workspace/api-server run build; $env:PORT="5000"; pnpm --filter @workspace/api-server run start

# B. Start the React Frontend Vite Client (listening on Port 3000)
$env:PORT="3000"; $env:BASE_PATH="/"; pnpm --filter @workspace/phishguard run dev --force
```

*(Note: The `--force` flag on the Vite developer server is recommended on Windows to clear cached dependencies and verify JIT stylesheet compilation).*
