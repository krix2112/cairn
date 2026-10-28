/**
 * BRAND CONFIGURATION - CAIRN
 * "Know your footing."
 * Define BRAND and project metadata in this single place.
 */
const BRAND = "Cairn";
const TAGLINE = "Know your footing.";
const SUBTITLE = "Upload a job description and a resume. Cairn stacks your skills against what the company expects, and shows you the next stone to place.";
const VERSION = "v2.0.0 · Hackathon Edition";
const ENGINE_NAME = "RADIX Talent Match Engine";
const DATA_BENCHMARK = "113 Verified Benchmarks · 12 Competencies";
const EVENT_NAME = "RADIX Talent Match Hackathon · JSS Noida";
const PRIVACY_NOTE = "Files are processed on this server; saved profiles are stored locally.";

// 12 stones in fixed bottom-to-top order: foundations to flourishes
const CAIRN_ORDER = [
  "OS",
  "NETW",
  "COD",
  "DSA",
  "OOD",
  "SQL",
  "SWE",
  "CLOUD",
  "SYSD",
  "AI",
  "APTI",
  "COMM"
];

const SKILL_METADATA = {
  OS:    { code: "OS",    name: "Operating Systems",             waypoint: "The Engine Room",  tier: "Foundation",   tint: "#D98B6A", bg: "#0E0F11", promise: "Understand how computers manage memory, background tasks, and core operating systems.", desc: "Computer basics: memory, multitasking, background processes, and system speed." },
  NETW:  { code: "NETW",  name: "Networking",                    waypoint: "The Signal Tower", tier: "Foundation",   tint: "#6BFF9E", bg: "#05100A", promise: "Know how computers communicate across the internet, APIs, and networks.", desc: "Internet fundamentals: web requests, APIs, data transfer, and connection security." },
  COD:   { code: "COD",   name: "Programming",                   waypoint: "The Forge",        tier: "Core",         tint: "#FF9A3D", bg: "#120B08", promise: "Write clean, reliable, and working code to solve real-world problems.", desc: "Core coding: clean code structure, syntax mastery, and fixing bugs quickly." },
  DSA:   { code: "DSA",   name: "Data Structures & Algorithms",  waypoint: "The Grove",        tier: "Core",         tint: "#9BC53D", bg: "#08130C", promise: "Organize information smartly and choose the fastest way to solve puzzles.", desc: "Smart problem-solving: organizing data efficiently and optimizing speed." },
  OOD:   { code: "OOD",   name: "Object-Oriented Design",        waypoint: "The Workshop",     tier: "Architecture", tint: "#5BC8E8", bg: "#0A1626", promise: "Build well-organized software that is easy to expand and maintain over time.", desc: "Software design: modular code, reusable parts, and clean application structure." },
  SQL:   { code: "SQL",   name: "Databases & SQL",               waypoint: "The Archive",      tier: "Data",         tint: "#E5646B", bg: "#110A0A", promise: "Store, organize, and search business information quickly and securely.", desc: "Data storage: database tables, fast data lookups, and data safety." },
  SWE:   { code: "SWE",   name: "Software Engineering",          waypoint: "The Switchyard",   tier: "Practice",     tint: "#FFD84A", bg: "#101113", promise: "Follow team best practices: automated testing, code reviews, and smooth releases.", desc: "Team practices: automated testing, code reviews, and releasing software reliably." },
  CLOUD: { code: "CLOUD", name: "Cloud & Infrastructure",        waypoint: "The Skyway",       tier: "Platform",     tint: "#FFB59A", bg: "#0E1A33", promise: "Run and manage applications on modern cloud platforms like AWS and Google Cloud.", desc: "Cloud computing: servers in the cloud, container tools, and automated deployment." },
  SYSD:  { code: "SYSD",  name: "System Design",                 waypoint: "The Citadel",      tier: "Scale",        tint: "#BFD3E6", bg: "#0B1018", promise: "Design large-scale apps that handle millions of users smoothly without crashing.", desc: "Large systems: scaling up apps, handling traffic spikes, and preventing outages." },
  AI:    { code: "AI",    name: "Machine Learning & Stats",      waypoint: "The Firefly Net",  tier: "Intelligence", tint: "#4FE3C1", bg: "#060A12", promise: "Use smart data models and machine learning to find trends and automate decisions.", desc: "Data intelligence: finding patterns in data, prediction models, and smart automation." },
  APTI:  { code: "APTI",  name: "Quantitative Aptitude",         waypoint: "The Observatory",  tier: "Reasoning",    tint: "#8FB4FF", bg: "#070B1A", promise: "Fast practical math, logical reasoning, and clear analytical thinking.", desc: "Logical thinking: quick math, numerical estimation, and puzzle solving." },
  COMM:  { code: "COMM",  name: "Communication",                 waypoint: "The Amphitheatre", tier: "Leadership",   tint: "#F2C166", bg: "#130D14", promise: "Explain technical ideas clearly and work smoothly with team members and managers.", desc: "Team communication: explaining ideas clearly, listening, and leading projects." }
};

if (typeof window !== "undefined") {
  window.BRAND = BRAND;
  window.TAGLINE = TAGLINE;
  window.SUBTITLE = SUBTITLE;
  window.VERSION = VERSION;
  window.ENGINE_NAME = ENGINE_NAME;
  window.DATA_BENCHMARK = DATA_BENCHMARK;
  window.EVENT_NAME = EVENT_NAME;
  window.PRIVACY_NOTE = PRIVACY_NOTE;
  window.CAIRN_ORDER = CAIRN_ORDER;
  window.SKILL_METADATA = SKILL_METADATA;
}
