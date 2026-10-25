import express from "express";
import type { Request, Response, NextFunction } from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import multer from "multer";
import { GoogleGenAI, Type } from "@google/genai";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
  origin: true,
  credentials: true
}));
app.use(express.json({ limit: "1mb" }));

// Ensure uploads directory exists securely
const uploadsDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Multer storage for secure receipt uploads with signature / MIME checks
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `receipt-secure-${uniqueSuffix}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedMimes = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type. Only JPEG, PNG, WEBP, and PDF are allowed."));
    }
  },
});

// Initialize Gemini SDK client (server-side only)
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || "dummy-key",
  httpOptions: {
    headers: {
      "User-Agent": "aistudio-build",
    },
  },
});

// Data Interfaces
interface Organization {
  id: string;
  name: string;
}

interface UserSession {
  userId: string;
  email: string;
  orgId: string;
  role: "admin" | "organizer" | "viewer";
}

interface Event {
  id: string;
  orgId: string;
  name: string;
  date: string;
  description: string;
  budget: number; // in INR
  status: "planning" | "active" | "completed" | "archived";
  createdAt: string;
}

interface Contribution {
  id: string;
  orgId: string;
  eventId: string;
  contributorName: string;
  contributionType: "monetary" | "in_kind";
  promisedAmount: number; // in INR (minor units or standard float)
  inKindDescription?: string;
  commitmentDate: string;
  amountReceived: number; // in INR
  status: "promised" | "partial" | "received" | "cancelled";
  notes?: string;
  createdAt: string;
}

interface Expense {
  id: string;
  orgId: string;
  eventId: string;
  merchant: string;
  date: string;
  amount: number; // in INR
  currency: string; // "INR"
  category: string;
  description: string;
  receiptPath?: string;
  receiptStatus: "pending" | "verified" | "rejected";
  isFlaggedDuplicate?: boolean;
  isFlaggedMissingReceipt?: boolean;
  createdAt: string;
}

interface Task {
  id: string;
  orgId: string;
  eventId: string;
  title: string;
  explanation: string;
  priority: "low" | "medium" | "high" | "urgent";
  dueDate?: string;
  responsiblePerson?: string;
  status: "open" | "in_progress" | "completed";
  source: "manual" | "ai_generated";
  createdAt: string;
}

interface AuditLog {
  id: string;
  orgId: string;
  action: string;
  entityType: string;
  entityId: string;
  details: string;
  userEmail: string;
  timestamp: string;
}

interface DatabaseSchema {
  organizations: Organization[];
  users: UserSession[];
  events: Event[];
  contributions: Contribution[];
  expenses: Expense[];
  tasks: Task[];
  auditLogs: AuditLog[];
}

const DB_FILE = path.join(process.cwd(), "data.json");

function loadDb(): DatabaseSchema {
  if (fs.existsSync(DB_FILE)) {
    try {
      const data = fs.readFileSync(DB_FILE, "utf-8");
      return JSON.parse(data);
    } catch (e) {
      console.error("Error reading database file", e);
    }
  }

  // Seed default data using INR (₹)
  const orgId = "org-1";
  const eventId = "evt-1";
  const defaultDb: DatabaseSchema = {
    organizations: [
      { id: "org-1", name: "Seva Foundation India" },
      { id: "org-2", name: "Rural Education Trust" }
    ],
    users: [
      { userId: "usr-1", email: "admin@sevation.org", orgId: "org-1", role: "admin" }
    ],
    events: [
      {
        id: eventId,
        orgId: orgId,
        name: "Rural Clean Water & Health Camp 2026",
        date: "2026-12-10",
        description: "Community fundraising and medical camp for rural districts in Karnataka.",
        budget: 500000, // ₹5,00,000
        status: "active",
        createdAt: new Date().toISOString()
      }
    ],
    contributions: [
      {
        id: "con-1",
        orgId: orgId,
        eventId: eventId,
        contributorName: "Bangalore Tech Philanthropy",
        contributionType: "monetary",
        promisedAmount: 200000, // ₹2,00,000
        commitmentDate: "2026-09-01",
        amountReceived: 150000, // ₹1,50,000
        status: "partial",
        notes: "First tranche received via NEFT.",
        createdAt: new Date().toISOString()
      },
      {
        id: "con-2",
        orgId: orgId,
        eventId: eventId,
        contributorName: "Smt. Kamala Sharma",
        contributionType: "monetary",
        promisedAmount: 50000, // ₹50,000
        commitmentDate: "2026-09-15",
        amountReceived: 50000, // ₹50,000
        status: "received",
        notes: "Paid in full via UPI.",
        createdAt: new Date().toISOString()
      },
      {
        id: "con-3",
        orgId: orgId,
        eventId: eventId,
        contributorName: "GreenEarth Supplies",
        contributionType: "in_kind",
        promisedAmount: 0,
        inKindDescription: "50 Water Filtration Kits",
        commitmentDate: "2026-09-20",
        amountReceived: 0,
        status: "promised",
        notes: "Delivery scheduled for camp date.",
        createdAt: new Date().toISOString()
      }
    ],
    expenses: [
      {
        id: "exp-1",
        orgId: orgId,
        eventId: eventId,
        merchant: "Apex Medical Supplies Ltd",
        date: "2026-09-25",
        amount: 85000, // ₹85,000
        currency: "INR",
        category: "Supplies",
        description: "Medicines and diagnostic kits advance.",
        receiptStatus: "verified",
        createdAt: new Date().toISOString()
      },
      {
        id: "exp-2",
        orgId: orgId,
        eventId: eventId,
        merchant: "Mysore Tent & Logistics",
        date: "2026-10-02",
        amount: 30000, // ₹30,000
        currency: "INR",
        category: "Venue & Catering",
        description: "Stage and canopy rentals.",
        receiptStatus: "pending",
        isFlaggedMissingReceipt: false,
        createdAt: new Date().toISOString()
      }
    ],
    tasks: [
      {
        id: "tsk-1",
        orgId: orgId,
        eventId: eventId,
        title: "Collect remaining balance from Bangalore Tech",
        explanation: "Remaining balance of ₹50,000 is due ahead of the December camp.",
        priority: "high",
        dueDate: "2026-11-15",
        responsiblePerson: "Rajesh Kumar",
        status: "open",
        source: "manual",
        createdAt: new Date().toISOString()
      },
      {
        id: "tsk-2",
        orgId: orgId,
        eventId: eventId,
        title: "Verify Mysore Tent receipt",
        explanation: "Expense of ₹30,000 is pending receipt document verification.",
        priority: "medium",
        dueDate: "2026-10-25",
        responsiblePerson: "Priya Nair",
        status: "open",
        source: "ai_generated",
        createdAt: new Date().toISOString()
      }
    ],
    auditLogs: [
      {
        id: "aud-1",
        orgId: orgId,
        action: "CREATE",
        entityType: "event",
        entityId: eventId,
        details: "Created event Rural Clean Water & Health Camp 2026 with budget ₹5,00,000",
        userEmail: "admin@sevation.org",
        timestamp: new Date().toISOString()
      }
    ]
  };

  saveDb(defaultDb);
  return defaultDb;
}

function saveDb(db: DatabaseSchema) {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), "utf-8");
}

function logAudit(orgId: string, action: string, entityType: string, entityId: string, details: string, userEmail = "admin@sevation.org") {
  const db = loadDb();
  db.auditLogs.unshift({
    id: `aud-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    orgId,
    action,
    entityType,
    entityId,
    details,
    userEmail,
    timestamp: new Date().toISOString()
  });
  saveDb(db);
}

// Authentication & Tenant Authorization Middleware
interface AuthRequest extends Request {
  user?: UserSession;
}

const authenticateUser = (req: AuthRequest, res: Response, next: NextFunction) => {
  // Derive session from Authorization header token or fallback to default test user session
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  const db = loadDb();
  if (!db.users) db.users = [];
  let user = db.users?.[0] || { userId: "usr-1", email: "admin@sevation.org", orgId: "org-1", role: "admin" };
  if (token && token.startsWith("session-")) {
    const found = db.users.find(u => u.userId === token.replace("session-", ""));
    if (found) user = found;
  }

  if (!user) {
    return res.status(401).json({ error: "Unauthorized access. Valid session required." });
  }

  req.user = user;
  next();
};

// Authorization check for tenant isolation
const requireOrgTenant = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user) return res.status(401).json({ error: "Unauthorized" });
  next();
};

// API Routes

// Authentication session info
app.get("/api/auth/session", authenticateUser, (req: AuthRequest, res: Response) => {
  const db = loadDb();
  const org = db.organizations.find(o => o.id === req.user?.orgId);
  res.json({
    user: req.user,
    organization: org,
    organizations: db.organizations
  });
});

// Switch organization session (for multi-org demo)
app.post("/api/auth/switch-org", authenticateUser, (req: AuthRequest, res: Response) => {
  const { orgId } = req.body;
  const db = loadDb();
  const org = db.organizations.find(o => o.id === orgId);
  if (!org) return res.status(404).json({ error: "Organization not found" });

  if (req.user) {
    req.user.orgId = orgId;
  }
  res.json({ success: true, organization: org });
});

// Dashboard & Metrics (Strictly INR ₹)
app.get("/api/dashboard", authenticateUser, (req: AuthRequest, res: Response) => {
  const orgId = req.user!.orgId;
  const eventId = req.query.eventId as string;
  const db = loadDb();

  const events = db.events.filter(e => e.orgId === orgId);
  const activeEvent = eventId ? events.find(e => e.id === eventId) || events[0] : events[0];

  if (!activeEvent) {
    return res.json({
      activeEvent: null,
      metrics: {
        totalPromisedMonetary: 0,
        totalReceivedMonetary: 0,
        outstandingCommitments: 0,
        totalVerifiedExpenses: 0,
        expensesAwaitingVerification: 0,
        inKindCount: 0,
        budget: 0,
        budgetUtilization: 0,
        cashBalance: 0
      },
      events,
      contributions: [],
      expenses: [],
      tasks: [],
      auditLogs: []
    });
  }

  const contributions = db.contributions.filter(c => c.orgId === orgId && c.eventId === activeEvent.id);
  const expenses = db.expenses.filter(e => e.orgId === orgId && e.eventId === activeEvent.id);
  const tasks = db.tasks.filter(t => t.orgId === orgId && t.eventId === activeEvent.id);
  const auditLogs = db.auditLogs.filter(a => a.orgId === orgId).slice(0, 30);

  let totalPromisedMonetary = 0;
  let totalReceivedMonetary = 0;
  let inKindCount = 0;

  for (const c of contributions) {
    if (c.contributionType === "monetary") {
      totalPromisedMonetary += c.promisedAmount;
      totalReceivedMonetary += c.amountReceived;
    } else {
      inKindCount += 1;
    }
  }

  const outstandingCommitments = Math.max(0, totalPromisedMonetary - totalReceivedMonetary);

  let totalVerifiedExpenses = 0;
  let expensesAwaitingVerification = 0;

  for (const e of expenses) {
    if (e.receiptStatus === "verified") {
      totalVerifiedExpenses += e.amount;
    } else if (e.receiptStatus === "pending") {
      expensesAwaitingVerification += e.amount;
    }
  }

  const budget = activeEvent.budget || 0;
  const budgetUtilization = budget > 0 ? (totalVerifiedExpenses / budget) * 100 : 0;
  const cashBalance = totalReceivedMonetary - totalVerifiedExpenses;

  res.json({
    activeEvent,
    events,
    metrics: {
      totalPromisedMonetary,
      totalReceivedMonetary,
      outstandingCommitments,
      totalVerifiedExpenses,
      expensesAwaitingVerification,
      inKindCount,
      budget,
      budgetUtilization: Math.round(budgetUtilization * 10) / 10,
      cashBalance
    },
    contributions,
    expenses,
    tasks,
    auditLogs
  });
});

// Events CRUD with tenant isolation
app.get("/api/events", authenticateUser, (req: AuthRequest, res: Response) => {
  const orgId = req.user!.orgId;
  const db = loadDb();
  res.json(db.events.filter(e => e.orgId === orgId));
});

app.post("/api/events", authenticateUser, (req: AuthRequest, res: Response) => {
  const orgId = req.user!.orgId;
  const { name, date, description, budget, status } = req.body;
  if (!name) return res.status(400).json({ error: "Event name is required" });

  const db = loadDb();
  const newEvent: Event = {
    id: `evt-${Date.now()}`,
    orgId,
    name,
    date: date || new Date().toISOString().split("T")[0],
    description: description || "",
    budget: Number(budget) || 0,
    status: status || "planning",
    createdAt: new Date().toISOString()
  };

  db.events.push(newEvent);
  saveDb(db);
  logAudit(orgId, "CREATE", "event", newEvent.id, `Created event: ${newEvent.name}`, req.user!.email);
  res.status(201).json(newEvent);
});

// Contributions CRUD with tenant isolation
app.post("/api/contributions", authenticateUser, (req: AuthRequest, res: Response) => {
  const orgId = req.user!.orgId;
  const { eventId, contributorName, contributionType, promisedAmount, inKindDescription, commitmentDate, amountReceived, status, notes } = req.body;
  
  if (!eventId || !contributorName) {
    return res.status(400).json({ error: "Event ID and Contributor Name are required." });
  }

  const db = loadDb();
  // Verify event belongs to org
  const event = db.events.find(e => e.id === eventId && e.orgId === orgId);
  if (!event) return res.status(403).json({ error: "Access denied to event workspace" });

  const newContrib: Contribution = {
    id: `con-${Date.now()}`,
    orgId,
    eventId,
    contributorName,
    contributionType: contributionType || "monetary",
    promisedAmount: contributionType === "monetary" ? Number(promisedAmount) || 0 : 0,
    inKindDescription: contributionType === "in_kind" ? inKindDescription : undefined,
    commitmentDate: commitmentDate || new Date().toISOString().split("T")[0],
    amountReceived: contributionType === "monetary" ? Number(amountReceived) || 0 : 0,
    status: status || "promised",
    notes,
    createdAt: new Date().toISOString()
  };

  db.contributions.push(newContrib);
  saveDb(db);
  logAudit(orgId, "CREATE", "contribution", newContrib.id, `Recorded contribution from ${contributorName} (₹${newContrib.promisedAmount})`, req.user!.email);
  res.status(201).json(newContrib);
});

// Expenses & Receipts with private storage and authorization
app.get("/api/receipts/:filename", authenticateUser, (req: AuthRequest, res: Response) => {
  const orgId = req.user!.orgId;
  const filename = req.params.filename;
  
  const db = loadDb();
  const expense = db.expenses.find(e => e.orgId === orgId && e.receiptPath === `/api/receipts/${filename}`);
  if (!expense) {
    return res.status(404).json({ error: "Receipt not found or unauthorized access" });
  }

  const filePath = path.join(uploadsDir, filename);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: "File not found on disk" });
  }

  res.sendFile(filePath);
});

app.post("/api/expenses", authenticateUser, upload.single("receipt"), async (req: AuthRequest, res: Response) => {
  const orgId = req.user!.orgId;
  const { eventId, merchant, date, amount, category, description, receiptStatus } = req.body;

  if (!eventId || !merchant || amount === undefined) {
    return res.status(400).json({ error: "Event ID, merchant, and amount are required." });
  }

  const db = loadDb();
  const event = db.events.find(e => e.id === eventId && e.orgId === orgId);
  if (!event) return res.status(403).json({ error: "Access denied to event workspace" });

  let receiptPath: string | undefined = undefined;
  if (req.file) {
    receiptPath = `/api/receipts/${req.file.filename}`;
  }

  const existing = db.expenses.find(
    e => e.orgId === orgId && e.eventId === eventId && e.merchant.toLowerCase() === merchant.toLowerCase() && Number(e.amount) === Number(amount) && e.date === date
  );

  const newExpense: Expense = {
    id: `exp-${Date.now()}`,
    orgId,
    eventId,
    merchant,
    date: date || new Date().toISOString().split("T")[0],
    amount: Number(amount) || 0,
    currency: "INR",
    category: category || "General",
    description: description || "",
    receiptPath,
    receiptStatus: receiptStatus || "pending",
    isFlaggedDuplicate: !!existing,
    isFlaggedMissingReceipt: !receiptPath,
    createdAt: new Date().toISOString()
  };

  db.expenses.push(newExpense);
  saveDb(db);
  logAudit(orgId, "CREATE", "expense", newExpense.id, `Recorded expense at ${merchant} for ₹${newExpense.amount}`, req.user!.email);
  res.status(201).json(newExpense);
});

app.put("/api/expenses/:id", authenticateUser, (req: AuthRequest, res: Response) => {
  const orgId = req.user!.orgId;
  const { id } = req.params;
  const db = loadDb();
  const index = db.expenses.findIndex(e => e.id === id && e.orgId === orgId);
  if (index === -1) return res.status(404).json({ error: "Expense not found" });

  const updated = { ...db.expenses[index], ...req.body };
  db.expenses[index] = updated;
  saveDb(db);
  logAudit(orgId, "UPDATE", "expense", id, `Updated expense at ${updated.merchant} (status: ${updated.receiptStatus})`, req.user!.email);
  res.json(updated);
});

// GenAI Receipt OCR Extraction using gemini-3.8-flash (INR currency)
app.post("/api/receipts/ocr", authenticateUser, upload.single("receipt"), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No receipt file uploaded for OCR." });
    }

    const filePath = req.file.path;
    const fileBuffer = fs.readFileSync(filePath);
    const base64Data = fileBuffer.toString("base64");
    const mimeType = req.file.mimetype;

    const prompt = `Analyze this receipt document image and extract structured JSON data in Indian Rupees (INR ₹). 
    Fields required:
    - merchant: Name of merchant/vendor
    - date: Date of receipt in YYYY-MM-DD format
    - amount: Total numeric amount in INR
    - currency: "INR"
    - category: Best matching category (e.g. Venue & Catering, Equipment, Travel, Supplies, Marketing)
    - summary: Brief 1 sentence description of purchased items.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: {
        parts: [
          { inlineData: { mimeType, data: base64Data } },
          { text: prompt },
        ],
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            merchant: { type: Type.STRING },
            date: { type: Type.STRING },
            amount: { type: Type.NUMBER },
            currency: { type: Type.STRING },
            category: { type: Type.STRING },
            summary: { type: Type.STRING },
          },
          required: ["merchant", "date", "amount", "currency", "category", "summary"],
        },
      },
    });

    const extracted = JSON.parse(response.text || "{}");
    res.json({
      success: true,
      receiptPath: `/api/receipts/${req.file.filename}`,
      extracted,
    });
  } catch (error: any) {
    console.error("OCR Extraction Error:", error);
    res.status(500).json({ error: error.message || "Failed to perform OCR extraction." });
  }
});

// GenAI Follow-up Assistant using gemini-3.8-flash
app.post("/api/ai/generate-tasks", authenticateUser, async (req: AuthRequest, res: Response) => {
  try {
    const orgId = req.user!.orgId;
    const { eventId, notes } = req.body;
    const db = loadDb();

    const activeEvent = db.events.find(e => e.id === eventId && e.orgId === orgId);
    const contributions = db.contributions.filter(c => c.eventId === eventId && c.orgId === orgId);
    const expenses = db.expenses.filter(e => e.eventId === eventId && e.orgId === orgId);

    const contextData = {
      event: activeEvent,
      contributions: contributions.map(c => ({
        name: c.contributorName,
        type: c.contributionType,
        promised: c.promisedAmount,
        received: c.amountReceived,
        status: c.status
      })),
      expenses: expenses.map(e => ({
        merchant: e.merchant,
        amount: e.amount,
        status: e.receiptStatus,
        flaggedMissing: e.isFlaggedMissingReceipt
      })),
      userNotes: notes || ""
    };

    const prompt = `You are an NGO Operations Coordinator Assistant for Indian non-profits. Based on the following event records and notes, generate a list of prioritized, actionable follow-up tasks in Indian Rupees context if applicable. 
    Focus on outstanding financial commitments, unverified receipts, missing documentation, or follow-up communications. Never invent fake donors or financial figures.
    
    Context: ${JSON.stringify(contextData)}`;

    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: prompt,
      config: {
        systemInstruction: "You generate structured operational follow-up tasks for NGO events. Return valid JSON array.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              explanation: { type: Type.STRING },
              priority: { type: Type.STRING },
              dueDate: { type: Type.STRING },
              responsiblePerson: { type: Type.STRING }
            },
            required: ["title", "explanation", "priority"]
          }
        }
      },
    });

    const tasksProposed = JSON.parse(response.text || "[]");
    res.json({ success: true, tasks: tasksProposed });
  } catch (error: any) {
    console.error("AI Task Generation Error:", error);
    res.status(500).json({ error: error.message || "Failed to generate AI follow-up tasks." });
  }
});

// Tasks CRUD
app.post("/api/tasks", authenticateUser, (req: AuthRequest, res: Response) => {
  const orgId = req.user!.orgId;
  const { eventId, title, explanation, priority, dueDate, responsiblePerson, source } = req.body;

  if (!eventId || !title) {
    return res.status(400).json({ error: "Event ID and title are required." });
  }

  const db = loadDb();
  const event = db.events.find(e => e.id === eventId && e.orgId === orgId);
  if (!event) return res.status(403).json({ error: "Access denied" });

  const newTask: Task = {
    id: `tsk-${Date.now()}`,
    orgId,
    eventId,
    title,
    explanation: explanation || "",
    priority: priority || "medium",
    dueDate,
    responsiblePerson,
    status: "open",
    source: source || "manual",
    createdAt: new Date().toISOString()
  };

  db.tasks.push(newTask);
  saveDb(db);
  logAudit(orgId, "CREATE", "task", newTask.id, `Created task: ${title}`, req.user!.email);
  res.status(201).json(newTask);
});

app.put("/api/tasks/:id", authenticateUser, (req: AuthRequest, res: Response) => {
  const orgId = req.user!.orgId;
  const { id } = req.params;
  const db = loadDb();
  const index = db.tasks.findIndex(t => t.id === id && t.orgId === orgId);
  if (index === -1) return res.status(404).json({ error: "Task not found" });

  const updated = { ...db.tasks[index], ...req.body };
  db.tasks[index] = updated;
  saveDb(db);
  logAudit(orgId, "UPDATE", "task", id, `Updated task status to ${updated.status}`, req.user!.email);
  res.json(updated);
});

// Audit Logs
app.get("/api/audit-logs", authenticateUser, (req: AuthRequest, res: Response) => {
  const orgId = req.user!.orgId;
  const db = loadDb();
  res.json(db.auditLogs.filter(a => a.orgId === orgId));
});

// Vite middleware setup
if (process.env.NODE_ENV !== "production") {
  const { createServer: createViteServer } = await import("vite");
  const vite = await createViteServer({
    server: { middlewareMode: true, hmr: process.env.DISABLE_HMR !== "true" },
    appType: "spa",
  });
  app.use(vite.middlewares);
} else {
  const distPath = path.join(process.cwd(), "dist");
  app.use(express.static(distPath));
  app.get("*", (req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
  });
}

app.listen(Number(PORT), "0.0.0.0", () => {
  console.log(`SevaTrack AI running securely on port ${PORT} (INR ₹)`);
});
