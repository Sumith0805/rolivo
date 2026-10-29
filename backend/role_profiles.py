from resume_render import TEMPLATES as _SPECS, spec_for

# Templates come from the same list the preview, Word and PDF files use,
# so a suggestion made here always exists on screen.
TEMPLATES = {}
for _tid in _SPECS:
    _s = spec_for(_tid)
    TEMPLATES[_tid] = {
        "label": _s["label"],
        "best_for": _s.get("blurb", ""),
        "order": _s["order"],
        "font": "Georgia" if _s["font"] == "serif" else "Arial",
        "accent": _s["accent"],
        "density": "tight" if _s["density"] == "compact" else "comfortable",
    }

ROLES = {
    "software": {
        "label": "Software / Full-Stack",
        "keywords": [
            "full stack", "full-stack", "backend", "back-end", "frontend", "front-end",
            "software engineer", "software developer", "web developer", "react", "node",
            "java", "api", "microservices", "rest", "typescript",
        ],
        "focus": "Show shipped projects with live links, the stack used, and measurable results.",
        "templates": ["fresher", "centered_rules", "engineer"],
    },
    "ai_ml": {
        "label": "AI / Machine Learning",
        "keywords": [
            "machine learning", "ml engineer", "ai engineer", "deep learning", "nlp",
            "natural language processing", "llm", "generative ai", "pytorch", "tensorflow",
            "computer vision", "data scientist", "model training", "neural network",
        ],
        "focus": "Lead with projects that show the model, the data, the evaluation metrics and how it was deployed.",
        "templates": ["fresher", "blue_rule", "latex_serif"],
    },
    "data": {
        "label": "Data / Analytics",
        "keywords": [
            "data analyst", "business intelligence", "bi developer", "power bi", "tableau",
            "sql", "dashboard", "analytics", "reporting", "data scientist", "excel",
            "data visualization", "etl",
        ],
        "focus": "Show the questions you answered with data, the tools used (SQL, BI, Python), and the business result.",
        "templates": ["plain_ats", "compact_ats", "blue_rule"],
    },
    "embedded": {
        "label": "Embedded / Hardware",
        "keywords": [
            "embedded", "firmware", "microcontroller", "rtos", "iot", "fpga", "pcb",
            "arm cortex", "verilog", "vhdl", "hardware", "c programming", "sensor",
        ],
        "focus": "Name the boards, protocols and tools, and describe what the device did and how you tested it.",
        "templates": ["engineer", "compact_ats", "centered_rules"],
    },
    "security": {
        "label": "Cybersecurity / Networking",
        "keywords": [
            "cybersecurity", "security analyst", "soc analyst", "network engineer",
            "networking", "penetration", "firewall", "siem", "vulnerability", "ccna",
            "infosec", "intrusion", "network security", "tcp/ip",
        ],
        "focus": "Show labs, certifications and the tools and protocols you have used, with what you found or defended.",
        "templates": ["plain_ats", "engineer", "compact_ats"],
    },
    "devops": {
        "label": "DevOps / Cloud",
        "keywords": [
            "devops", "site reliability", "sre", "cloud engineer", "kubernetes", "docker",
            "terraform", "ci/cd", "aws", "azure", "infrastructure", "deployment",
        ],
        "focus": "Show what you deployed, on which platform, how it was automated and monitored.",
        "templates": ["plain_ats", "compact_ats", "centered_rules"],
    },
    # ---- roles outside IT
    "design": {
        "label": "Design / Creative",
        "keywords": [
            "ui designer", "ux designer", "ui/ux", "graphic designer", "product designer",
            "visual design", "figma", "adobe", "photoshop", "illustrator", "branding",
            "wireframe", "prototyping", "user research", "motion graphics", "video editor",
        ],
        "focus": "Show the problem, your design decisions and the result for each piece of work, and link to your portfolio.",
        "templates": ["minimal", "modern", "green_rule"],
    },
    "marketing": {
        "label": "Marketing / Communications",
        "keywords": [
            "digital marketing", "marketing", "seo", "sem", "content marketing", "social media",
            "brand", "campaign", "copywriting", "email marketing", "google analytics",
            "growth marketing", "public relations", "communications", "content writer",
        ],
        "focus": "Show campaigns with the channel, the audience and the result in reach, leads or conversions.",
        "templates": ["green_rule", "modern", "slate_stacked"],
    },
    "sales": {
        "label": "Sales / Business Development",
        "keywords": [
            "sales", "business development", "account executive", "lead generation", "crm",
            "salesforce", "quota", "pipeline", "cold calling", "account manager",
            "client acquisition", "revenue", "negotiation", "inside sales",
        ],
        "focus": "Lead with targets and results: revenue, quota attainment, deals closed and accounts managed.",
        "templates": ["slate_stacked", "corporate", "executive_serif"],
    },
    "finance": {
        "label": "Finance / Accounting",
        "keywords": [
            "accountant", "accounting", "financial analyst", "audit", "taxation", "tax",
            "bookkeeping", "tally", "gst", "financial modeling", "budgeting", "accounts payable",
            "accounts receivable", "reconciliation", "investment banking", "ifrs", "equity research",
        ],
        "focus": "Show the size of what you handled (amounts, accounts, reports), the tools used and the accuracy or savings.",
        "templates": ["corporate", "executive_serif", "slate_stacked"],
    },
    "hr": {
        "label": "HR / Recruitment",
        "keywords": [
            "human resources", "recruiter", "recruitment", "talent acquisition", "onboarding",
            "payroll", "employee engagement", "hr executive", "hrbp", "sourcing", "hr generalist",
        ],
        "focus": "Show the number of hires, processes you improved and the people programs you ran.",
        "templates": ["slate_stacked", "green_rule", "plain_ats"],
    },
    "operations": {
        "label": "Operations / Project Management",
        "keywords": [
            "operations", "supply chain", "logistics", "procurement", "inventory",
            "project manager", "project management", "administration", "coordinator",
            "process improvement", "vendor management", "scheduling",
        ],
        "focus": "Show what you coordinated, the scale (people, orders, budget) and the time or cost you saved.",
        "templates": ["slate_stacked", "plain_ats", "corporate"],
    },
    "healthcare": {
        "label": "Healthcare / Science",
        "keywords": [
            "nurse", "nursing", "clinical", "patient", "healthcare", "medical", "pharmacy",
            "pharmacist", "laboratory", "diagnostic", "physician", "hospital", "biotech",
        ],
        "focus": "Show your licences, clinical or lab settings, patient or sample volumes and the procedures you are trained in.",
        "templates": ["academic", "blue_rule", "plain_ats"],
    },
    "education": {
        "label": "Teaching / Research",
        "keywords": [
            "teacher", "teaching", "lecturer", "professor", "curriculum", "classroom", "tutor",
            "instructional design", "research assistant", "academic", "faculty", "pedagogy",
        ],
        "focus": "Show the subjects and levels taught, class sizes, outcomes, and any research or publications.",
        "templates": ["academic", "latex_serif", "blue_rule"],
    },
    "support": {
        "label": "Customer Support / Success",
        "keywords": [
            "customer support", "customer service", "customer success", "help desk", "call center",
            "technical support", "service desk", "ticketing", "zendesk", "client support",
        ],
        "focus": "Show volumes handled, response or resolution times, satisfaction scores and the tools you used.",
        "templates": ["green_rule", "plain_ats", "slate_stacked"],
    },
    "general": {
        "label": "General",
        "keywords": [],
        "focus": "Lead with your strongest relevant experience and skills for this posting.",
        "templates": ["plain_ats", "centered_rules", "blue_rule"],
    },
}
