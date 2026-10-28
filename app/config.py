import os
from dotenv import load_dotenv

# Load environment variables at startup
load_dotenv()

# Verified: matched staging_company_skill_levels columns to skill_set_id across 113 companies (100%).
SKILLSET_MAP = {
    1: "COD",
    2: "DSA",
    3: "APTI",
    4: "COMM",
    5: "OOD",
    6: "AI",
    7: "SQL",
    8: "SYSD",
    9: "CLOUD",
    10: "SWE",
    11: "NETW",
    12: "OS",
}
COMPANIES = {4: "Google", 24: "Oracle FSS", 78: "Microsoft"}

LLM_PROVIDER = os.getenv("LLM_PROVIDER", "gemini").lower()
MODEL = os.getenv("RADIX_MODEL", "gemini-3.5-flash-lite")
CODES = list(SKILLSET_MAP.values()) + ["OTHER"]

# Study & Practice planning model: Hours needed to gain 1 competency level
HOURS_PER_LEVEL = {
    "COD": 8,
    "DSA": 8,
    "OOD": 8,
    "SQL": 8,
    "COMM": 6,
    "APTI": 6,
    "SWE": 6,
    "SYSD": 10,
    "CLOUD": 10,
    "AI": 10,
    "NETW": 10,
    "OS": 10
}

