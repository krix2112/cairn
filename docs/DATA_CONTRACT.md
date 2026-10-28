# RADIX Shared Data Contract

Locked data contract schemas connecting the five components of the RADIX / Cairn Talent Match engine: **JD Analytics**, **Resume Parsing**, **Profile Builder**, **Talent Check**, and **Skill Matching**.

All interfaces communicate via standardized JSON structures. Every skill is normalized to exactly one of the 12 RADIX Competency Codes (`COD`, `DSA`, `APTI`, `COMM`, `OOD`, `AI`, `SQL`, `SYSD`, `CLOUD`, `SWE`, `NETW`, `OS`) or `OTHER`.

---

## 1. The Building Block: Single Skill (`<skill>`)

Represents a normalized atomic competency extracted from either a hiring specification or candidate resume.

### JSON Schema
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "SkillItem",
  "type": "object",
  "required": ["skill_name", "category_code", "evidence", "confidence"],
  "properties": {
    "skill_name": {
      "type": "string",
      "description": "Standardized name of the technology or competency."
    },
    "category_code": {
      "type": "string",
      "enum": ["COD", "DSA", "APTI", "COMM", "OOD", "AI", "SQL", "SYSD", "CLOUD", "SWE", "NETW", "OS", "OTHER"]
    },
    "evidence": {
      "type": "string",
      "maxLength": 120,
      "description": "Exact excerpt from text substantiating the skill (excluding compensation or perks)."
    },
    "confidence": {
      "type": "string",
      "enum": ["high", "medium", "low"],
      "description": "Extraction strength: high (demonstrated in projects/internships or core requirement), medium (listed/coursework), low (passing mention)."
    }
  }
}
```

### Real Project Example (from `karthik_subramaniam.pdf`)
```json
{
  "skill_name": "SQL",
  "category_code": "SQL",
  "evidence": "Built an end-to-end churn-prediction pipeline (SQL extraction → feature engineering",
  "confidence": "high"
}
```

---

## 2. Extracted Skill List

Produced by **JD Analytics** (`/jd/analyze` or `/samples/analyze`) and **Resume Parsing** (`/resume/parse`).

### JSON Schema
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "ExtractedSkillList",
  "type": "object",
  "required": ["source_type", "source_file", "company", "role", "skills"],
  "properties": {
    "source_type": { "type": "string", "enum": ["jd", "resume"] },
    "source_file": { "type": "string" },
    "company": { "type": "string" },
    "role": { "type": "string" },
    "skills": {
      "type": "array",
      "items": { "$ref": "#/definitions/SkillItem" }
    }
  }
}
```

### Real Project Example (from `google_swe.pdf`)
```json
{
  "source_type": "jd",
  "source_file": "google_swe.pdf",
  "company": "Google LLC",
  "role": "Software Engineer (SWE)",
  "skills": [
    {
      "skill_name": "C++",
      "category_code": "COD",
      "evidence": "Proficiency in one or more general-purpose programming languages: C++, Java, Python, or Go",
      "confidence": "high"
    },
    {
      "skill_name": "Data Structures and Algorithms",
      "category_code": "DSA",
      "evidence": "Solid foundation in data structures and algorithms (complexity analysis, trees, graphs, dynamic programming)",
      "confidence": "high"
    },
    {
      "skill_name": "Distributed Systems",
      "category_code": "SYSD",
      "evidence": "Basic understanding of distributed systems principles (RPC, concurrency, caching, data consistency)",
      "confidence": "high"
    },
    {
      "skill_name": "Linux/Unix",
      "category_code": "OS",
      "evidence": "Familiarity with Linux/Unix development environments and tools",
      "confidence": "medium"
    },
    {
      "skill_name": "Testing and CI/CD",
      "category_code": "SWE",
      "evidence": "Experience with testing frameworks, code review practices, and CI/CD pipelines",
      "confidence": "medium"
    }
  ]
}
```

---

## 3. Candidate Profile

Produced by **Profile Builder** and stored locally as `profiles/<email>.json`. Serves as the persistent source of truth for downstream scoring.

### JSON Schema
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "CandidateProfile",
  "type": "object",
  "required": ["name", "email", "education", "skills"],
  "properties": {
    "name": { "type": "string" },
    "email": { "type": "string", "format": "email" },
    "education": { "type": "string" },
    "skills": {
      "type": "array",
      "items": { "$ref": "#/definitions/SkillItem" }
    },
    "hackathons": { "type": "array", "items": { "type": "string" } },
    "internships": { "type": "array", "items": { "type": "string" } },
    "certifications": { "type": "array", "items": { "type": "string" } },
    "preferred_roles": { "type": "array", "items": { "type": "string" } },
    "cv_file": { "type": "string" }
  }
}
```

### Real Project Example (from `rohan_verma.pdf`)
```json
{
  "name": "Rohan Verma",
  "email": "rohan.verma@demo.local",
  "education": "B.Tech, Computer Science and Engineering, Class of 2026 — CGPA 9.1 / 10",
  "skills": [
    {
      "skill_name": "Python",
      "category_code": "COD",
      "evidence": "open-source contributor (2 merged PRs to a mid-size Python library)",
      "confidence": "high"
    },
    {
      "skill_name": "Data Structures & Algorithms",
      "category_code": "DSA",
      "evidence": "500+ problems solved across competitive programming platforms",
      "confidence": "high"
    },
    {
      "skill_name": "System Design",
      "category_code": "SYSD",
      "evidence": "Designed and built a scalable notification service (pub-sub architecture",
      "confidence": "high"
    },
    {
      "skill_name": "Object-Oriented Design",
      "category_code": "OOD",
      "evidence": "Wrote a technical blog series on object-oriented design patterns",
      "confidence": "high"
    },
    {
      "skill_name": "Machine Learning",
      "category_code": "AI",
      "evidence": "Built a recommendation engine using collaborative filtering",
      "confidence": "high"
    }
  ],
  "hackathons": [
    "Winner, national inter-college hackathon — built a real-time collaborative document editor"
  ],
  "internships": [
    "Software Engineering intern at a Series-B startup — shipped a feature end-to-end including tests and CI"
  ],
  "certifications": [
    "Self-taught via applied projects; no formal certifications listed"
  ],
  "preferred_roles": [
    "Software Engineer",
    "Data Scientist",
    "Backend Engineer"
  ],
  "cv_file": "rohan_verma.pdf"
}
```

---

## 4. Talent Check Result

Produced by **Talent Check** (`POST /talent-check`), calculating readiness against company-wide empirical hiring standards (e.g. Google, Oracle FSS, Microsoft).

### JSON Schema
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "TalentCheckResult",
  "type": "object",
  "required": ["company", "skillset_gap", "readiness_score"],
  "properties": {
    "company": { "type": "string" },
    "readiness_score": { "type": "integer", "minimum": 0, "maximum": 100 },
    "skillset_gap": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["category_code", "required_level", "candidate_level", "gap"],
        "properties": {
          "category_code": { "type": "string" },
          "required_level": { "type": "integer", "minimum": 1, "maximum": 10 },
          "candidate_level": { "type": "integer", "minimum": 0, "maximum": 10 },
          "gap": { "type": "boolean" }
        }
      }
    }
  }
}
```

### Real Project Example (Priya Menon vs Oracle FSS)
```json
{
  "company": "Oracle FSS",
  "readiness_score": 41,
  "skillset_gap": [
    { "category_code": "DSA", "required_level": 6, "candidate_level": 0, "gap": true },
    { "category_code": "OOD", "required_level": 6, "candidate_level": 0, "gap": true },
    { "category_code": "APTI", "required_level": 6, "candidate_level": 0, "gap": true },
    { "category_code": "COMM", "required_level": 6, "candidate_level": 0, "gap": true },
    { "category_code": "AI", "required_level": 6, "candidate_level": 0, "gap": true },
    { "category_code": "CLOUD", "required_level": 5, "candidate_level": 0, "gap": true },
    { "category_code": "SYSD", "required_level": 5, "candidate_level": 0, "gap": true },
    { "category_code": "SWE", "required_level": 7, "candidate_level": 7, "gap": false },
    { "category_code": "NETW", "required_level": 5, "candidate_level": 6, "gap": false },
    { "category_code": "OS", "required_level": 5, "candidate_level": 6, "gap": false },
    { "category_code": "SQL", "required_level": 6, "candidate_level": 7, "gap": false },
    { "category_code": "COD", "required_level": 5, "candidate_level": 7, "gap": false }
  ]
}
```

---

## 5. Skill Matching Result

Produced by **Skill Matching** (`POST /match`), evaluating candidate skills directly against a target Job Description.

### JSON Schema
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "SkillMatchingResult",
  "type": "object",
  "required": ["jd_source_file", "match_score", "matched_skills", "missing_skills"],
  "properties": {
    "jd_source_file": { "type": "string" },
    "match_score": { "type": "integer", "minimum": 0, "maximum": 100 },
    "matched_skills": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["jd_skill", "category_code", "candidate_skill"],
        "properties": {
          "jd_skill": { "type": "string" },
          "category_code": { "type": "string" },
          "candidate_skill": { "type": "string" }
        }
      }
    },
    "missing_skills": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["skill", "category_code", "why_needed"],
        "properties": {
          "skill": { "type": "string" },
          "category_code": { "type": "string" },
          "why_needed": { "type": "string" }
        }
      }
    }
  }
}
```

### Real Project Example (Rohan Verma vs Google SWE)
```json
{
  "jd_source_file": "google_swe.pdf",
  "match_score": 71,
  "matched_skills": [
    {
      "jd_skill": "C++",
      "category_code": "COD",
      "candidate_skill": "C++"
    },
    {
      "jd_skill": "Data Structures and Algorithms",
      "category_code": "DSA",
      "candidate_skill": "Data Structures & Algorithms"
    },
    {
      "jd_skill": "Object-Oriented Design",
      "category_code": "OOD",
      "candidate_skill": "Object-Oriented Design"
    },
    {
      "jd_skill": "Operating Systems Internals",
      "category_code": "OS",
      "candidate_skill": "Operating Systems"
    },
    {
      "jd_skill": "Testing and CI/CD",
      "category_code": "SWE",
      "candidate_skill": "Software Engineering"
    }
  ],
  "missing_skills": [
    {
      "skill": "Networking Fundamentals",
      "category_code": "NETW",
      "why_needed": "Understanding of computer networking protocols (TCP/IP, HTTP, DNS)"
    },
    {
      "skill": "Distributed Systems",
      "category_code": "SYSD",
      "why_needed": "Basic understanding of distributed systems principles (RPC, concurrency, caching, data consistency)"
    }
  ]
}
```
