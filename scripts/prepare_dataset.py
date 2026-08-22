import os
import re
import csv
import random
import io
import zipfile
import requests
from urllib.parse import urlparse
from feature_extractor import BRANDS, extract_domain_info

DATA_DIR = os.path.join(os.path.dirname(__file__), "data")
os.makedirs(DATA_DIR, exist_ok=True)
OUTPUT_CSV = os.path.join(DATA_DIR, "phishing_dataset.csv")

def download_phishtank_urls(limit=8000):
    urls = set()
    print("Fetching verified phishing URLs from public feeds...")
    
    feeds = [
        ("URLhaus Recent Verified Feed", "https://urlhaus.abuse.ch/downloads/csv_recent/"),
        ("Phishing Database Active Feed", "https://raw.githubusercontent.com/mitchellkrogza/Phishing.Database/master/phishing-links-ACTIVE-TODAY.txt")
    ]
    
    for name, url in feeds:
        try:
            print(f"  Attempting to download from {name} ({url})...")
            res = requests.get(url, timeout=25, headers={"User-Agent": "PhishGuard-DatasetBuilder/1.0"})
            if res.status_code == 200:
                lines = res.text.splitlines()
                count_before = len(urls)
                for line in lines:
                    line = line.strip()
                    if not line or line.startswith("#"):
                        continue
                    # Parse CSV line or raw URL
                    if "," in line and ("http" in line):
                        parts = [p.strip().strip('"') for p in line.split(",")]
                        for p in parts:
                            if p.startswith("http://") or p.startswith("https://"):
                                urls.add(p)
                                break
                    elif line.startswith("http://") or line.startswith("https://"):
                        urls.add(line)
                    
                    if len(urls) >= limit:
                        break
                print(f"  -> Successfully extracted {len(urls) - count_before} URLs from {name}.")
            else:
                print(f"  -> HTTP {res.status_code} from {name}.")
        except Exception as e:
            print(f"  -> Could not download from {name}: {e}")
        
        if len(urls) >= limit:
            break

    print(f"Total verified phishing URLs collected: {len(urls)}")
    return list(urls)[:limit]

def download_benign_urls(limit=8000):
    urls = set()
    print("Fetching authoritative benign domains from Cisco Umbrella Top 1M...")
    
    url = "http://s3-us-west-1.amazonaws.com/umbrella-static/top-1m.csv.zip"
    benign_paths = [
        "", "/", "/about", "/contact", "/terms", "/privacy", "/help", "/faq",
        "/products", "/services", "/blog", "/news", "/careers", "/docs",
        "/explore", "/features", "/pricing", "/support", "/community",
        "/wiki/Computer_security", "/wiki/Main_Page", "/wiki/Internet",
        "/account/settings", "/login", "/signin", "/auth/login",
        "/search?q=technology", "/downloads/release", "/api/v1/health",
        "/article/security-best-practices", "/resources/whitepapers"
    ]
    
    try:
        print(f"  Downloading and unzipping {url}...")
        res = requests.get(url, timeout=35, headers={"User-Agent": "PhishGuard-DatasetBuilder/1.0"})
        if res.status_code == 200:
            with zipfile.ZipFile(io.BytesIO(res.content)) as z:
                first_file = z.namelist()[0]
                with z.open(first_file) as f:
                    for line in f:
                        line_str = line.decode("utf-8", errors="ignore").strip()
                        if not line_str:
                            continue
                        parts = line_str.split(",")
                        domain = parts[-1].strip() if len(parts) > 1 else parts[0].strip()
                        if domain and "." in domain and not domain.startswith("http"):
                            proto = "https://" if random.random() > 0.15 else "http://"
                            path = random.choice(benign_paths)
                            urls.add(f"{proto}{domain}{path}")
                        
                        if len(urls) >= limit:
                            break
            print(f"  -> Successfully extracted {len(urls)} top benign domains.")
        else:
            print(f"  -> HTTP {res.status_code} when downloading benign dataset.")
    except Exception as e:
        print(f"  -> Error downloading benign dataset: {e}")

    print(f"Total benign URLs collected: {len(urls)}")
    return list(urls)[:limit]

def generate_brand_synthetic_data():
    phishing_typos = []
    benign_brand_urls = []
    
    substitutions = {"o": "0", "l": "1", "e": "3", "a": "4", "s": "5", "t": "7"}
    tlds = [".com", ".net", ".org", ".info", ".xyz", ".top", ".club", ".security", ".login-update.com"]
    keywords = ["login", "verify", "secure", "account", "update", "billing", "auth", "portal", "support"]

    for brand in BRANDS:
        name = brand["name"]
        slug = brand["slug"]
        legit_domains = brand["domains"]
        
        # 1. Legitimate Brand URLs (SAFE = 0)
        for d in legit_domains:
            benign_brand_urls.append(f"https://{d}/")
            benign_brand_urls.append(f"https://{d}/signin")
            benign_brand_urls.append(f"https://{d}/help")
            benign_brand_urls.append(f"https://{d}/account")
            benign_brand_urls.append(f"https://www.google.com/search?q={slug}")
            benign_brand_urls.append(f"https://checkout.{d}/payment")

        # 2. Homoglyph / Character Substitutions (PHISHING = 1)
        for char, sub in substitutions.items():
            if char in slug:
                typo_slug = slug.replace(char, sub, 1)
                for tld in [".com", ".net", ".xyz", ".org"]:
                    phishing_typos.append(f"https://{typo_slug}{tld}/login")
                    phishing_typos.append(f"http://{typo_slug}{tld}/verify-account?token=123")
                    phishing_typos.append(f"https://security.{typo_slug}{tld}/")

        # 3. Hyphenated and Compound Keywords (PHISHING = 1)
        for kw in keywords:
            phishing_typos.append(f"https://{slug}-{kw}.com/login")
            phishing_typos.append(f"https://{kw}-{slug}.net/verify")
            phishing_typos.append(f"http://secure-{slug}-portal.xyz/account")
            phishing_typos.append(f"https://{slug}-security-update.com/signin")
            phishing_typos.append(f"http://{slug}.{kw}-verify.com/login")

        # 4. Typosquatting / Edit Distance (PHISHING = 1)
        if len(slug) >= 4:
            double_char = slug[:-1] + slug[-1] + slug[-1]
            phishing_typos.append(f"https://{double_char}.com/login")
            phishing_typos.append(f"http://{double_char}.net/verify")
            
        if len(slug) >= 5:
            omit_char = slug[:-1]
            phishing_typos.append(f"https://{omit_char}.com/login")

    return phishing_typos, benign_brand_urls

def build_dataset():
    phishing_urls = download_phishtank_urls(limit=7000)
    benign_urls = download_benign_urls(limit=7000)
    synthetic_phish, synthetic_benign = generate_brand_synthetic_data()

    if len(phishing_urls) < 100 or len(benign_urls) < 100:
        raise RuntimeError("Failed to collect sufficient real phishing/benign samples from external feeds. Please verify internet connectivity.")

    dataset = []
    seen_urls = set()

    # Add verified phishing
    for u in phishing_urls:
        u_clean = u.strip()
        if u_clean and u_clean not in seen_urls:
            seen_urls.add(u_clean)
            info = extract_domain_info(u_clean)
            dataset.append({
                "url": u_clean,
                "label": 1,
                "source": "urlhaus_phishtank",
                "registrable_domain": info["registrable"]
            })

    # Add synthetic brand phishing
    for u in synthetic_phish:
        u_clean = u.strip()
        if u_clean and u_clean not in seen_urls:
            seen_urls.add(u_clean)
            info = extract_domain_info(u_clean)
            dataset.append({
                "url": u_clean,
                "label": 1,
                "source": "synthetic_brand_impersonation",
                "registrable_domain": info["registrable"]
            })

    # Add benign Tranco / Cisco Umbrella
    for u in benign_urls:
        u_clean = u.strip()
        if u_clean and u_clean not in seen_urls:
            seen_urls.add(u_clean)
            info = extract_domain_info(u_clean)
            dataset.append({
                "url": u_clean,
                "label": 0,
                "source": "cisco_umbrella_top1m",
                "registrable_domain": info["registrable"]
            })

    # Add benign brand URLs
    for u in synthetic_benign:
        u_clean = u.strip()
        if u_clean and u_clean not in seen_urls:
            seen_urls.add(u_clean)
            info = extract_domain_info(u_clean)
            dataset.append({
                "url": u_clean,
                "label": 0,
                "source": "legitimate_brand_safelist",
                "registrable_domain": info["registrable"]
            })

    # Shuffle
    random.seed(42)
    random.shuffle(dataset)

    # Save to CSV
    with open(OUTPUT_CSV, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["url", "label", "source", "registrable_domain"])
        writer.writeheader()
        writer.writerows(dataset)

    safe_count = sum(1 for d in dataset if d["label"] == 0)
    phish_count = sum(1 for d in dataset if d["label"] == 1)

    print(f"\n================ DATASET GENERATION COMPLETE ================")
    print(f"File Saved: {OUTPUT_CSV}")
    print(f"Total Unique Samples: {len(dataset)}")
    print(f"  Safe Samples (0):     {safe_count}")
    print(f"  Phishing Samples (1): {phish_count}")
    print(f"=============================================================\n")

if __name__ == "__main__":
    build_dataset()
