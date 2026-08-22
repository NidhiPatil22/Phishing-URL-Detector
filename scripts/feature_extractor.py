import re
import math
from urllib.parse import urlparse, parse_qs

# 12 Protected Brands & Safelist
BRANDS = [
    {"name": "PayPal", "slug": "paypal", "domains": ["paypal.com", "paypal.me", "paypal-community.com"]},
    {"name": "Google", "slug": "google", "domains": ["google.com", "google.co.uk", "google.co.in", "accounts.google.com"]},
    {"name": "Amazon", "slug": "amazon", "domains": ["amazon.com", "amazon.co.uk", "amazon.de", "amazon.in", "aws.amazon.com"]},
    {"name": "Microsoft", "slug": "microsoft", "domains": ["microsoft.com", "live.com", "office.com", "outlook.com"]},
    {"name": "Apple", "slug": "apple", "domains": ["apple.com", "icloud.com"]},
    {"name": "Facebook", "slug": "facebook", "domains": ["facebook.com", "fb.com", "meta.com"]},
    {"name": "Instagram", "slug": "instagram", "domains": ["instagram.com"]},
    {"name": "Netflix", "slug": "netflix", "domains": ["netflix.com"]},
    {"name": "LinkedIn", "slug": "linkedin", "domains": ["linkedin.com"]},
    {"name": "GitHub", "slug": "github", "domains": ["github.com", "github.io"]},
    {"name": "Twitter/X", "slug": "twitter", "domains": ["twitter.com", "x.com"]},
    {"name": "Dropbox", "slug": "dropbox", "domains": ["dropbox.com"]},
]

SUBSTITUTIONS = {
    "0": "o",
    "1": "l",
    "3": "e",
    "4": "a",
    "5": "s",
    "7": "t",
    "i": "l",
}

MULTI_CCTLD = {
    ".co.uk", ".com.au", ".co.in", ".co.nz", ".co.za", ".com.br", ".com.mx",
    ".co.jp", ".com.sg", ".org.uk", ".gov.uk", ".edu.au", ".ac.uk", ".com.tr",
}

KEYWORDS = ["login", "verify", "bank", "update", "secure", "account", "confirm", "signin"]
SHORTENERS = {"bit.ly", "tinyurl.com", "t.co", "goo.gl", "ow.ly", "is.gd", "buff.ly", "adf.ly", "bit.do"}

def levenshtein_distance(a: str, b: str) -> int:
    dp = [[0] * (len(b) + 1) for _ in range(len(a) + 1)]
    for i in range(len(a) + 1):
        dp[i][0] = i
    for j in range(len(b) + 1):
        dp[0][j] = j
    for i in range(1, len(a) + 1):
        for j in range(1, len(b) + 1):
            cost = 0 if a[i - 1] == b[j - 1] else 1
            dp[i][j] = min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost)
    return dp[len(a)][len(b)]

def string_similarity(a: str, b: str) -> float:
    max_len = max(len(a), len(b))
    if max_len == 0:
        return 1.0
    return max(0.0, 1.0 - (levenshtein_distance(a, b) / max_len))

def extract_domain_info(raw_url: str):
    url = raw_url.strip()
    parsed = None
    try:
        if "://" not in url:
            url_to_parse = "http://" + url
        else:
            url_to_parse = url
        parsed = urlparse(url_to_parse)
    except Exception:
        pass

    host = (parsed.hostname if parsed and parsed.hostname else url.split("/")[0].split("?")[0].split("#")[0]).lower()
    
    # Check IPv4
    is_ipv4 = bool(re.match(r"^(\d{1,3}\.){3}\d{1,3}$", host))
    is_ipv6 = bool(":" in host and not is_ipv4)
    is_ip = is_ipv4 or is_ipv6

    if is_ip:
        return {
            "host": host,
            "sld": host,
            "registrable": host,
            "is_ip": True,
            "ip_version": 4 if is_ipv4 else 6
        }

    # Extract registrable domain & sld
    matched_cctld = None
    for cc in MULTI_CCTLD:
        if host.endswith(cc):
            matched_cctld = cc
            break

    parts = [p for p in host.split(".") if p]
    if not parts:
        return {"host": host, "sld": host, "registrable": host, "is_ip": False, "ip_version": 0}

    if matched_cctld:
        prefix = host[:-len(matched_cctld)]
        prefix_parts = [p for p in prefix.split(".") if p]
        sld = prefix_parts[-1] if prefix_parts else host
        registrable = f"{sld}{matched_cctld}"
    elif len(parts) >= 2:
        sld = parts[-2]
        registrable = f"{parts[-2]}.{parts[-1]}"
    else:
        sld = parts[0]
        registrable = parts[0]

    return {
        "host": host,
        "sld": sld,
        "registrable": registrable,
        "is_ip": False,
        "ip_version": 0
    }

def detect_brand_impersonation(raw_url: str):
    info = extract_domain_info(raw_url)
    host = info["host"]
    sld = info["sld"]
    registrable = info["registrable"]

    if info["is_ip"] or not sld or len(sld) < 3:
        return {
            "brand_impersonation": 0,
            "similarity_score": 0.0,
            "has_character_substitution": 0,
            "has_hyphenated_brand": 0,
            "has_compound_brand_keyword": 0,
        }

    # Safelist check
    for brand in BRANDS:
        for legit_domain in brand["domains"]:
            if host == legit_domain or host.endswith("." + legit_domain):
                return {
                    "brand_impersonation": 0,
                    "similarity_score": 0.0,
                    "has_character_substitution": 0,
                    "has_hyphenated_brand": 0,
                    "has_compound_brand_keyword": 0,
                }

    for brand in BRANDS:
        brand_slug = brand["slug"]
        
        # 1. Character Substitutions
        normalized = ""
        detected_subs = []
        for char in sld:
            if char in SUBSTITUTIONS:
                normalized += SUBSTITUTIONS[char]
                detected_subs.append(f"{char}->{SUBSTITUTIONS[char]}")
            else:
                normalized += char

        if normalized == brand_slug and len(detected_subs) > 0:
            sim = string_similarity(sld, brand_slug)
            return {
                "brand_impersonation": 1,
                "similarity_score": round(max(0.9, sim), 4),
                "has_character_substitution": 1,
                "has_hyphenated_brand": 0,
                "has_compound_brand_keyword": 0,
            }

        if len(detected_subs) > 0 and levenshtein_distance(normalized, brand_slug) <= 1:
            sim = string_similarity(sld, brand_slug)
            return {
                "brand_impersonation": 1,
                "similarity_score": round(max(0.85, sim), 4),
                "has_character_substitution": 1,
                "has_hyphenated_brand": 0,
                "has_compound_brand_keyword": 0,
            }

        # 2. Hyphenations & Compound Keyword Attacks
        stripped_hyphens = sld.replace("-", "")
        if "-" in sld:
            if stripped_hyphens == brand_slug:
                return {
                    "brand_impersonation": 1,
                    "similarity_score": 0.95,
                    "has_character_substitution": 0,
                    "has_hyphenated_brand": 1,
                    "has_compound_brand_keyword": 0,
                }
            if brand_slug in sld or brand_slug in stripped_hyphens:
                return {
                    "brand_impersonation": 1,
                    "similarity_score": 0.88,
                    "has_character_substitution": 0,
                    "has_hyphenated_brand": 1,
                    "has_compound_brand_keyword": 1,
                }

        # 3. Typosquatting / Edit Distance
        dist = levenshtein_distance(sld, brand_slug)
        sim = string_similarity(sld, brand_slug)
        if (dist == 1 and len(sld) >= 4) or (dist == 2 and len(brand_slug) >= 7 and sim >= 0.78):
            if len(sld) >= 4:
                return {
                    "brand_impersonation": 1,
                    "similarity_score": round(sim, 4),
                    "has_character_substitution": 0,
                    "has_hyphenated_brand": 0,
                    "has_compound_brand_keyword": 0,
                }

        # 4. Misleading Subdomain
        if brand_slug in host and brand_slug not in registrable:
            return {
                "brand_impersonation": 1,
                "similarity_score": 0.85,
                "has_character_substitution": 0,
                "has_hyphenated_brand": 0,
                "has_compound_brand_keyword": 1,
            }

    return {
        "brand_impersonation": 0,
        "similarity_score": 0.0,
        "has_character_substitution": 0,
        "has_hyphenated_brand": 0,
        "has_compound_brand_keyword": 0,
    }

def calculate_shannon_entropy(s: str) -> float:
    if not s:
        return 0.0
    freq = {}
    for c in s:
        freq[c] = freq.get(c, 0) + 1
    entropy = 0.0
    length = len(s)
    for count in freq.values():
        p = count / length
        entropy -= p * math.log2(p)
    return round(entropy, 4)

FEATURE_NAMES = [
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
]

def extract_features(raw_url: str) -> dict:
    url = raw_url.strip()
    lower_url = url.lower()
    
    parsed = None
    try:
        if "://" not in url:
            url_to_parse = "http://" + url
        else:
            url_to_parse = url
        parsed = urlparse(url_to_parse)
    except Exception:
        pass

    domain_info = extract_domain_info(url)
    host = domain_info["host"]
    registrable = domain_info["registrable"]
    is_ip = domain_info["is_ip"]
    ip_version = domain_info["ip_version"]

    path = parsed.path if parsed and parsed.path else "/"
    query = parsed.query if parsed else ""
    fragment = parsed.fragment if parsed else ""

    # Port extraction
    port = parsed.port if parsed else None
    has_https = 1 if lower_url.startswith("https://") else 0
    is_non_standard_port = 1 if port and port not in (80, 443) else 0

    # Subdomains
    subdomain_count = 0
    if not is_ip and host and registrable:
        host_parts = [p for p in host.split(".") if p]
        reg_parts = [p for p in registrable.split(".") if p]
        subdomain_count = max(0, len(host_parts) - len(reg_parts))

    # Path depth
    path_depth = len([p for p in path.split("/") if p])

    # Query params count
    query_param_count = 0
    if query:
        try:
            params = parse_qs(query)
            query_param_count = len(params.keys())
        except Exception:
            pass

    has_fragment = 1 if fragment or "#" in url else 0

    # Digits
    num_digits = sum(1 for c in url if c.isdigit())
    digit_ratio = round(num_digits / len(url), 4) if len(url) > 0 else 0.0

    # Special chars
    num_special_chars = sum(1 for c in url if not c.isalnum())

    # Keywords
    suspicious_keyword_count = sum(1 for kw in KEYWORDS if kw in lower_url)

    # Shorteners
    is_shortened = 1 if any(s in host for s in SHORTENERS) else 0

    # Brand Impersonation features (Feature 1)
    brand_features = detect_brand_impersonation(url)

    # Entropy
    entropy_score = calculate_shannon_entropy(url)

    return {
        "url_length": len(url),
        "has_ip": 1 if is_ip else 0,
        "ip_version": ip_version,
        "num_dots": host.count("."),
        "num_subdomains": subdomain_count,
        "has_https": has_https,
        "has_at_symbol": 1 if "@" in url else 0,
        "has_hyphen": 1 if "-" in host else 0,
        "num_special_chars": num_special_chars,
        "suspicious_keyword_count": suspicious_keyword_count,
        "digit_ratio": digit_ratio,
        "path_depth": path_depth,
        "is_shortened": is_shortened,
        "entropy_score": entropy_score,
        "is_non_standard_port": is_non_standard_port,
        "query_param_count": query_param_count,
        "has_fragment": has_fragment,
        "brand_impersonation": brand_features["brand_impersonation"],
        "similarity_score": brand_features["similarity_score"],
        "has_character_substitution": brand_features["has_character_substitution"],
        "has_hyphenated_brand": brand_features["has_hyphenated_brand"],
        "has_compound_brand_keyword": brand_features["has_compound_brand_keyword"]
    }
