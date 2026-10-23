TEMPLATES = {
    "classic": {
        "label": "Classic",
        "best_for": "Work history is your strongest section",
        "order": ["summary", "experience", "projects", "skills", "education", "certifications"],
        "font": "Georgia",
        "accent": "#1F2A44",
        "density": "comfortable",
    },
    "projects_first": {
        "label": "Projects-first",
        "best_for": "Students and new graduates",
        "order": ["summary", "skills", "projects", "experience", "education", "certifications"],
        "font": "Calibri",
        "accent": "#0E7C86",
        "density": "comfortable",
    },
    "technical": {
        "label": "Technical",
        "best_for": "Engineering roles where the tech stack matters",
        "order": ["summary", "skills", "experience", "projects", "education", "certifications"],
        "font": "Arial",
        "accent": "#3B4A63",
        "density": "comfortable",
    },
    "compact": {
        "label": "Compact",
        "best_for": "Fitting more onto one page",
        "order": ["summary", "skills", "projects", "experience", "education", "certifications"],
        "font": "Calibri",
        "accent": "#2B2B2B",
        "density": "tight",
    },
    "modern": {
        "label": "Modern",
        "best_for": "A little personality, still plain text for ATS",
        "order": ["summary", "experience", "projects", "skills", "education", "certifications"],
        "font": "Calibri",
        "accent": "#6B3A7D",
        "density": "comfortable",
    },
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
        "templates": ["projects_first", "technical", "classic"],
    },
    "ai_ml": {
        "label": "AI / Machine Learning",
        "keywords": [
            "machine learning", "ml engineer", "ai engineer", "deep learning", "nlp",
            "natural language processing", "llm", "generative ai", "pytorch", "tensorflow",
            "computer vision", "data scientist", "model training", "neural network",
        ],
        "focus": "Lead with projects that show the model, the data, the evaluation metrics and how it was deployed.",
        "templates": ["projects_first", "technical", "modern"],
    },
    "data": {
        "label": "Data / Analytics",
        "keywords": [
            "data analyst", "business intelligence", "bi developer", "power bi", "tableau",
            "sql", "dashboard", "analytics", "reporting", "data scientist", "excel",
            "data visualization", "etl",
        ],
        "focus": "Show the questions you answered with data, the tools used (SQL, BI, Python), and the business result.",
        "templates": ["technical", "projects_first", "classic"],
    },
    "embedded": {
        "label": "Embedded / Hardware",
        "keywords": [
            "embedded", "firmware", "microcontroller", "rtos", "iot", "fpga", "pcb",
            "arm cortex", "verilog", "vhdl", "hardware", "c programming", "sensor",
        ],
        "focus": "Name the boards, protocols and tools, and describe what the device did and how you tested it.",
        "templates": ["technical", "compact", "classic"],
    },
    "security": {
        "label": "Cybersecurity / Networking",
        "keywords": [
            "cybersecurity", "security analyst", "soc analyst", "network engineer",
            "networking", "penetration", "firewall", "siem", "vulnerability", "ccna",
            "infosec", "intrusion", "network security", "tcp/ip",
        ],
        "focus": "Show labs, certifications and the tools and protocols you have used, with what you found or defended.",
        "templates": ["technical", "classic", "compact"],
    },
    "devops": {
        "label": "DevOps / Cloud",
        "keywords": [
            "devops", "site reliability", "sre", "cloud engineer", "kubernetes", "docker",
            "terraform", "ci/cd", "aws", "azure", "infrastructure", "deployment",
        ],
        "focus": "Show what you deployed, on which platform, how it was automated and monitored.",
        "templates": ["technical", "projects_first", "compact"],
    },
    "general": {
        "label": "General",
        "keywords": [],
        "focus": "Lead with your strongest relevant experience and skills for this posting.",
        "templates": ["classic", "projects_first", "modern"],
    },
}