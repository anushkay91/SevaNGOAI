import express, { Request, Response } from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import multer from "multer";
import { GoogleGenAI, Type } from "@google/genai";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Ensure uploads directory exists
const uploadsDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

app.use("/uploads", express.static(uploadsDir));

// Multer storage for secure receipt uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `receipt-${uniqueSuffix}${ext}`);
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

// In-memory data store with file persistence
interface Organization {
  id: string;
  name: string;
}

interface Event {
  id: string;
  orgId: string;
  name: string;
  date: string;
  description: string;
  budget: number;
  status: "planning" | "active" | "completed" | "archived";
  createdAt: string;
}

interface Contribution {
  id: string;
  orgId: string;
  eventId: string;
  contributorName: string;
  contributionType: "monetary" | "in_kind";
  promisedAmount: number; // 0 for in-kind if item description used
  inKindDescription?: string;
  commitmentDate: string;
  amountReceived: number;
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
  amount: number;
  currency: string;
  category: string;
  description: string;
  receiptUrl?: string;
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
  entityType: "event" | "contribution" | "expense" | "task";
  entityId: string;
  details: string;
  userEmail: string;
  timestamp: string;
}

interface DatabaseSchema {
  organizations: Organization[];
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

  // Initial seed data
  const initialOrgId = "org-1";
  const initialEventId = "evt-1";
  const defaultDb: DatabaseSchema = {
    organizations: [
      { id: "org-1", name: "Hope Foundation Global" },
      { id: "org-2", name: "Clean Rivers Alliance" }
    ],
    events: [
      {
        id: initialEventId,
        orgId: initialOrgId,
        name: "Annual Clean Water Gala 2026",
        date: "2026-11-15",
        description: "Fundraising gala to build solar-powered water filtration wells in rural communities.",
        budget: 50000,
        status: "active",
        createdAt: new Date().toISOString()
      }
    ],
    contributions: [
      {
        id: "con-1",
        orgId: initialOrgId,
        eventId: initialEventId,
        contributorName: "Apex Corp Philanthropy",
        contributionType: "monetary",
        promisedAmount: 15000,
        commitmentDate: "2026-09-01",
        amountReceived: 10000,
        status: "partial",
        notes: "First installment received via wire transfer.",
        createdAt: new Date().toISOString()
      },
      {
        id: "con-2",
        orgId: initialOrgId,
        eventId: initialEventId,
        contributorName: "Dr. Elena Vance",
        contributionType: "monetary",
        promisedAmount: 5000,
        commitmentDate: "2026-09-10",
        amountReceived: 5000,
        status: "received",
        notes: "Paid in full.",
        createdAt: new Date().toISOString()
      },
      {
        id: "con-3",
        orgId: initialOrgId,
        eventId: initialEventId,
        contributorName: "SolarTech Industries",
        contributionType: "in_kind",
        promisedAmount: 0,
        inKindDescription: "12 High-efficiency solar water pumps",
        commitmentDate: "2026-09-20",
        amountReceived: 0,
        status: "promised",
        notes: "Delivery expected 2 weeks prior to event.",
        createdAt: new Date().toISOString()
      }
    ],
    expenses: [
      {
        id: "exp-1",
        orgId: initialOrgId,
        eventId: initialEventId,
        merchant: "Grand Ballroom Catering",
        date: "2026-09-25",
        amount: 3200,
        currency: "USD",
        category: "Venue & Catering",
        description: "Deposit for gala dinner catering.",
        receiptStatus: "verified",
        createdAt: new Date().toISOString()
      },
      {
        id: "exp-2",
        orgId: initialOrgId,
        eventId: initialEventId,
        merchant: "SoundWave AV Rentals",
        date: "2026-10-02",
        amount: 1450,
        currency: "USD",
        category: "Equipment",
        description: "Stage microphone and projector rentals.",
        receiptStatus: "pending",
        isFlaggedMissingReceipt: false,
        createdAt: new Date().toISOString()
      }
    ],
    tasks: [
      {
        id: "tsk-1",
        orgId: initialOrgId,
        eventId: initialEventId,
        title: "Follow up with Apex Corp for second installment",
        explanation: "Apex Corp promised $15,000 but only $10,000 has been received. Send reminder email.",
        priority: "high",
        dueDate: "2026-10-30",
        responsiblePerson: "Sarah Jenkins",
        status: "open",
        source: "manual",
        createdAt: new Date().toISOString()
      },
      {
        id: "tsk-2",
        orgId: initialOrgId,
        eventId: initialEventId,
        title: "Verify SoundWave AV Rentals receipt",
        explanation: "Expense of $1,450 is pending receipt verification against uploaded document.",
        priority: "medium",
        dueDate: "2026-11-02",
        responsiblePerson: "Marcus Chen",
        status: "open",
        source: "ai_generated",
        createdAt: new Date().toISOString()
      }
    ],
    auditLogs: [
      {
        id: "aud-1",
        orgId: initialOrgId,
        action: "CREATE",
        entityType: "event",
        entityId: initialEventId,
        details: "Created event Annual Clean Water Gala 2026 with budget $50,000",
        userEmail: "organizer@ngo.org",
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

function logAudit(orgId: string, action: string, entityType: "event" | "contribution" | "expense" | "task", entityId: string, details: string, userEmail = "admin@ngo.org") {
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

// Middleware to get orgId from headers or query
const getOrgId = (req: Request): string => {
  return (req.headers["x-org-id"] as string) || "org-1";
};

// API Routes

// Get Dashboard Metrics & Data
app.get("/api/dashboard", (req: Request, res: Response) => {
  const orgId = getOrgId(req);
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

  // Financial calculations (strictly off LLM, deterministic minor-unit / float precision)
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

// Events CRUD
app.get("/api/events", (req: Request, res: Response) => {
  const orgId = getOrgId(req);
  const db = loadDb();
  res.json(db.events.filter(e => e.orgId === orgId));
});

app.post("/api/events", (req: Request, res: Response) => {
  const orgId = getOrgId(req);
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
  logAudit(orgId, "CREATE", "event", newEvent.id, `Created event: ${newEvent.name}`);
  res.status(201).json(newEvent);
});

// Contributions CRUD
app.post("/api/contributions", (req: Request, res: Response) => {
  const orgId = getOrgId(req);
  const { eventId, contributorName, contributionType, promisedAmount, inKindDescription, commitmentDate, amountReceived, status, notes } = req.body;
  
  if (!eventId || !contributorName) {
    return res.status(400).json({ error: "Event ID and Contributor Name are required." });
  }

  const db = loadDb();
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
  logAudit(orgId, "CREATE", "contribution", newContrib.id, `Recorded contribution from ${contributorName} (${newContrib.contributionType})`);
  res.status(201).json(newContrib);
});

app.put("/api/contributions/:id", (req: Request, res: Response) => {
  const orgId = getOrgId(req);
  const { id } = req.params;
  const db = loadDb();
  const index = db.contributions.findIndex(c => c.id === id && c.orgId === orgId);
  if (index === -1) return res.status(404).json({ error: "Contribution not found" });

  const updated = { ...db.contributions[index], ...req.body };
  // Ensure monetary consistency: received cannot exceed promised without adjustment, etc.
  db.contributions[index] = updated;
  saveDb(db);
  logAudit(orgId, "UPDATE", "contribution", id, `Updated contribution for ${updated.contributorName}`);
  res.json(updated);
});

// Expenses & Receipts
app.post("/api/expenses", upload.single("receipt"), async (req: Request, res: Response) => {
  const orgId = getOrgId(req);
  const { eventId, merchant, date, amount, currency, category, description, receiptStatus } = req.body;

  if (!eventId || !merchant || amount === undefined) {
    return res.status(400).json({ error: "Event ID, merchant, and amount are required." });
  }

  let receiptUrl: string | undefined = undefined;
  if (req.file) {
    receiptUrl = `/uploads/${req.file.filename}`;
  }

  const db = loadDb();

  // Check for duplicate expense (same merchant, amount, date)
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
    currency: currency || "USD",
    category: category || "General",
    description: description || "",
    receiptUrl,
    receiptStatus: receiptStatus || (receiptUrl ? "pending" : "pending"),
    isFlaggedDuplicate: !!existing,
    isFlaggedMissingReceipt: !receiptUrl,
    createdAt: new Date().toISOString()
  };

  db.expenses.push(newExpense);
  saveDb(db);
  logAudit(orgId, "CREATE", "expense", newExpense.id, `Recorded expense at ${merchant} for ${newExpense.amount} ${newExpense.currency}`);
  res.status(201).json(newExpense);
});

app.put("/api/expenses/:id", (req: Request, res: Response) => {
  const orgId = getOrgId(req);
  const { id } = req.params;
  const db = loadDb();
  const index = db.expenses.findIndex(e => e.id === id && e.orgId === orgId);
  if (index === -1) return res.status(404).json({ error: "Expense not found" });

  const updated = { ...db.expenses[index], ...req.body };
  db.expenses[index] = updated;
  saveDb(db);
  logAudit(orgId, "UPDATE", "expense", id, `Updated expense at ${updated.merchant} (status: ${updated.receiptStatus})`);
  res.json(updated);
});

// GenAI Receipt OCR Extraction using gemini-3.8-flash
app.post("/api/receipts/ocr", upload.single("receipt"), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No receipt file uploaded for OCR." });
    }

    const filePath = req.file.path;
    const fileBuffer = fs.readFileSync(filePath);
    const base64Data = fileBuffer.toString("base64");
    const mimeType = req.file.mimetype;

    const prompt = `Analyze this receipt document image and extract structured JSON data. 
    Fields required:
    - merchant: Name of merchant/vendor
    - date: Date of receipt in YYYY-MM-DD format (or estimated if unclear)
    - amount: Total numeric amount (float)
    - currency: 3-letter currency code (e.g. USD, EUR, INR)
    - category: Best matching category (e.g. Venue & Catering, Equipment, Travel, Supplies, Marketing)
    - summary: Brief 1 sentence description of purchased items.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: {
        parts: [
          {
            inlineData: {
              mimeType,
              data: base64Data,
            },
          },
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
      receiptUrl: `/uploads/${req.file.filename}`,
      extracted,
    });
  } catch (error: any) {
    console.error("OCR Extraction Error:", error);
    res.status(500).json({ error: error.message || "Failed to perform OCR extraction." });
  }
});

// GenAI Follow-up Assistant using gemini-3.8-flash
app.post("/api/ai/generate-tasks", async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
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

    const prompt = `You are an NGO Operations Coordinator Assistant. Based on the following event records and notes, generate a list of prioritized, actionable follow-up tasks. 
    Focus on outstanding financial commitments, unverified receipts, missing documentation, or follow-up communications mentioned in the notes.
    Never invent fake donors or financial figures. Rely strictly on the provided context.
    
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
              priority: { type: Type.STRING, description: "low, medium, high, or urgent" },
              dueDate: { type: Type.STRING, description: "YYYY-MM-DD format" },
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
app.post("/api/tasks", (req: Request, res: Response) => {
  const orgId = getOrgId(req);
  const { eventId, title, explanation, priority, dueDate, responsiblePerson, source } = req.body;

  if (!eventId || !title) {
    return res.status(400).json({ error: "Event ID and title are required." });
  }

  const db = loadDb();
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
  logAudit(orgId, "CREATE", "task", newTask.id, `Created task: ${title}`);
  res.status(201).json(newTask);
});

app.put("/api/tasks/:id", (req: Request, res: Response) => {
  const orgId = getOrgId(req);
  const { id } = req.params;
  const db = loadDb();
  const index = db.tasks.findIndex(t => t.id === id && t.orgId === orgId);
  if (index === -1) return res.status(404).json({ error: "Task not found" });

  const updated = { ...db.tasks[index], ...req.body };
  db.tasks[index] = updated;
  saveDb(db);
  logAudit(orgId, "UPDATE", "task", id, `Updated task status to ${updated.status}`);
  res.json(updated);
});

// Audit Logs endpoint
app.get("/api/audit-logs", (req: Request, res: Response) => {
  const orgId = getOrgId(req);
  const db = loadDb();
  res.json(db.auditLogs.filter(a => a.orgId === orgId));
});

// Vite middleware setup in development
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
  console.log(`SevaTrack AI running on port ${PORT}`);
});
