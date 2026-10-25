import React, { useState, useEffect } from "react";
import {
  HeartHandshake,
  DollarSign,
  Receipt,
  CheckCircle2,
  AlertCircle,
  Clock,
  Plus,
  Upload,
  Sparkles,
  FileText,
  Building2,
  Calendar,
  ArrowUpRight,
  Check,
  X,
  AlertTriangle,
  ShieldCheck,
  TrendingUp,
  Lock
} from "lucide-react";

interface DashboardData {
  activeEvent: {
    id: string;
    orgId: string;
    name: string;
    date: string;
    description: string;
    budget: number;
    status: string;
  } | null;
  events: Array<{
    id: string;
    name: string;
    date: string;
    budget: number;
    status: string;
  }>;
  metrics: {
    totalPromisedMonetary: number;
    totalReceivedMonetary: number;
    outstandingCommitments: number;
    totalVerifiedExpenses: number;
    expensesAwaitingVerification: number;
    inKindCount: number;
    budget: number;
    budgetUtilization: number;
    cashBalance: number;
  };
  contributions: Array<{
    id: string;
    contributorName: string;
    contributionType: "monetary" | "in_kind";
    promisedAmount: number;
    inKindDescription?: string;
    commitmentDate: string;
    amountReceived: number;
    status: "promised" | "partial" | "received" | "cancelled";
    notes?: string;
  }>;
  expenses: Array<{
    id: string;
    merchant: string;
    date: string;
    amount: number;
    currency: string;
    category: string;
    description: string;
    receiptPath?: string;
    receiptStatus: "pending" | "verified" | "rejected";
    isFlaggedDuplicate?: boolean;
    isFlaggedMissingReceipt?: boolean;
  }>;
  tasks: Array<{
    id: string;
    title: string;
    explanation: string;
    priority: "low" | "medium" | "high" | "urgent";
    dueDate?: string;
    responsiblePerson?: string;
    status: "open" | "in_progress" | "completed";
    source: "manual" | "ai_generated";
  }>;
  auditLogs: Array<{
    id: string;
    action: string;
    entityType: string;
    details: string;
    userEmail: string;
    timestamp: string;
  }>;
}

// Helper to format currency in Indian Rupees (INR ₹)
const formatINR = (amount: number) => {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  }).format(amount);
};

export default function App() {
  const [session, setSession] = useState<{ user: any; organization: any; organizations: any[] } | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"dashboard" | "contributions" | "expenses" | "tasks" | "audit">("dashboard");
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modals
  const [showNewEventModal, setShowNewEventModal] = useState(false);
  const [showNewContributionModal, setShowNewContributionModal] = useState(false);
  const [showNewExpenseModal, setShowNewExpenseModal] = useState(false);
  const [showOcrModal, setShowOcrModal] = useState(false);
  const [showAiTaskModal, setShowAiTaskModal] = useState(false);

  // Form states
  const [newEventForm, setNewEventForm] = useState({ name: "", date: "", description: "", budget: 200000 });
  const [newContribForm, setNewContribForm] = useState({
    contributorName: "",
    contributionType: "monetary" as "monetary" | "in_kind",
    promisedAmount: 25000,
    inKindDescription: "",
    commitmentDate: new Date().toISOString().split("T")[0],
    amountReceived: 0,
    status: "promised" as const,
    notes: ""
  });

  const [newExpenseForm, setNewExpenseForm] = useState({
    merchant: "",
    date: new Date().toISOString().split("T")[0],
    amount: 10000,
    category: "Supplies",
    description: "",
    receiptStatus: "pending" as const
  });
  const [expenseFile, setExpenseFile] = useState<File | null>(null);

  // OCR state
  const [ocrFile, setOcrFile] = useState<File | null>(null);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrResult, setOcrResult] = useState<any>(null);

  // AI Task Generation state
  const [aiNotes, setAiNotes] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [proposedTasks, setProposedTasks] = useState<any[]>([]);

  // Fetch Session & Auth
  const fetchSession = async () => {
    try {
      const res = await fetch("/api/auth/session");
      if (!res.ok) throw new Error("Failed to load session");
      const json = await res.json();
      setSession(json);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const url = selectedEventId ? `/api/dashboard?eventId=${selectedEventId}` : `/api/dashboard`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch dashboard data");
      const json = await res.json();
      setData(json);
      if (json.activeEvent && !selectedEventId) {
        setSelectedEventId(json.activeEvent.id);
      }
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSession();
  }, []);

  useEffect(() => {
    if (session) {
      fetchData();
    }
  }, [session, selectedEventId]);

  const handleSwitchOrg = async (orgId: string) => {
    try {
      await fetch("/api/auth/switch-org", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId })
      });
      setSelectedEventId("");
      await fetchSession();
      await fetchData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newEventForm)
      });
      if (!res.ok) throw new Error("Failed to create event");
      const created = await res.json();
      setSelectedEventId(created.id);
      setShowNewEventModal(false);
      setNewEventForm({ name: "", date: "", description: "", budget: 200000 });
      fetchData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleCreateContribution = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!data?.activeEvent) return;
    try {
      const res = await fetch("/api/contributions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...newContribForm, eventId: data.activeEvent.id })
      });
      if (!res.ok) throw new Error("Failed to record contribution");
      setShowNewContributionModal(false);
      setNewContribForm({
        contributorName: "",
        contributionType: "monetary",
        promisedAmount: 25000,
        inKindDescription: "",
        commitmentDate: new Date().toISOString().split("T")[0],
        amountReceived: 0,
        status: "promised",
        notes: ""
      });
      fetchData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleCreateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!data?.activeEvent) return;
    try {
      const formData = new FormData();
      formData.append("eventId", data.activeEvent.id);
      formData.append("merchant", newExpenseForm.merchant);
      formData.append("date", newExpenseForm.date);
      formData.append("amount", newExpenseForm.amount.toString());
      formData.append("category", newExpenseForm.category);
      formData.append("description", newExpenseForm.description);
      formData.append("receiptStatus", newExpenseForm.receiptStatus);
      if (expenseFile) {
        formData.append("receipt", expenseFile);
      }

      const res = await fetch("/api/expenses", {
        method: "POST",
        body: formData
      });
      if (!res.ok) throw new Error("Failed to record expense");
      setShowNewExpenseModal(false);
      setNewExpenseForm({
        merchant: "",
        date: new Date().toISOString().split("T")[0],
        amount: 10000,
        category: "Supplies",
        description: "",
        receiptStatus: "pending"
      });
      setExpenseFile(null);
      fetchData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleRunOcr = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ocrFile) return;
    try {
      setOcrLoading(true);
      const formData = new FormData();
      formData.append("receipt", ocrFile);

      const res = await fetch("/api/receipts/ocr", {
        method: "POST",
        body: formData
      });
      if (!res.ok) throw new Error("OCR extraction failed");
      const json = await res.json();
      setOcrResult(json);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setOcrLoading(false);
    }
  };

  const handleSaveOcrExpense = async () => {
    if (!ocrResult || !data?.activeEvent) return;
    try {
      const { merchant, date, amount, category, summary } = ocrResult.extracted;
      const res = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId: data.activeEvent.id,
          merchant,
          date,
          amount,
          category,
          description: summary,
          receiptStatus: "pending"
        })
      });
      if (!res.ok) throw new Error("Failed to save extracted expense");
      setShowOcrModal(false);
      setOcrFile(null);
      setOcrResult(null);
      fetchData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleGenerateAiTasks = async () => {
    if (!data?.activeEvent) return;
    try {
      setAiLoading(true);
      const res = await fetch("/api/ai/generate-tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId: data.activeEvent.id, notes: aiNotes })
      });
      if (!res.ok) throw new Error("Failed to generate tasks");
      const json = await res.json();
      setProposedTasks(json.tasks || []);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setAiLoading(false);
    }
  };

  const handleApproveTask = async (task: any) => {
    if (!data?.activeEvent) return;
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId: data.activeEvent.id,
          title: task.title,
          explanation: task.explanation,
          priority: task.priority,
          dueDate: task.dueDate,
          responsiblePerson: task.responsiblePerson,
          source: "ai_generated"
        })
      });
      if (!res.ok) throw new Error("Failed to save task");
      setProposedTasks(prev => prev.filter(t => t.title !== task.title));
      fetchData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleUpdateExpenseStatus = async (expenseId: string, receiptStatus: "verified" | "rejected" | "pending") => {
    try {
      const res = await fetch(`/api/expenses/${expenseId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ receiptStatus })
      });
      if (!res.ok) throw new Error("Failed to update expense status");
      fetchData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleUpdateTaskStatus = async (taskId: string, status: "open" | "in_progress" | "completed") => {
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status })
      });
      if (!res.ok) throw new Error("Failed to update task");
      fetchData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans antialiased">
      {/* Top Bar Contract: 3 Zones */}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between gap-8 shadow-xs">
        {/* Zone 1: Brand wordmark */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-sm">
            <HeartHandshake className="w-5 h-5" />
          </div>
          <div>
            <span className="text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap">
              SevaTrack AI
            </span>
            <div className="text-xs text-slate-500 font-medium">NGO Coordinator (₹ INR)</div>
          </div>
        </div>

        {/* Zone 2: Navigation Links */}
        <nav className="hidden lg:flex items-center gap-6 text-sm font-medium text-slate-600" aria-label="Main Navigation">
          <button
            onClick={() => setActiveTab("dashboard")}
            className={`transition-colors whitespace-nowrap py-1 ${activeTab === "dashboard" ? "text-indigo-600 font-semibold border-b-2 border-indigo-600" : "hover:text-slate-900"}`}
          >
            Dashboard
          </button>
          <button
            onClick={() => setActiveTab("contributions")}
            className={`transition-colors whitespace-nowrap py-1 ${activeTab === "contributions" ? "text-indigo-600 font-semibold border-b-2 border-indigo-600" : "hover:text-slate-900"}`}
          >
            Contributions
          </button>
          <button
            onClick={() => setActiveTab("expenses")}
            className={`transition-colors whitespace-nowrap py-1 ${activeTab === "expenses" ? "text-indigo-600 font-semibold border-b-2 border-indigo-600" : "hover:text-slate-900"}`}
          >
            Expenses & Receipts
          </button>
          <button
            onClick={() => setActiveTab("tasks")}
            className={`transition-colors whitespace-nowrap py-1 ${activeTab === "tasks" ? "text-indigo-600 font-semibold border-b-2 border-indigo-600" : "hover:text-slate-900"}`}
          >
            AI Follow-ups
          </button>
          <button
            onClick={() => setActiveTab("audit")}
            className={`transition-colors whitespace-nowrap py-1 ${activeTab === "audit" ? "text-indigo-600 font-semibold border-b-2 border-indigo-600" : "hover:text-slate-900"}`}
          >
            Audit Trail
          </button>
        </nav>

        {/* Zone 3: Primary Action & Secure Org Switcher */}
        <div className="flex items-center gap-3 shrink-0">
          {session && (
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-slate-400" />
              <select
                value={session.organization.id}
                onChange={(e) => handleSwitchOrg(e.target.value)}
                className="text-xs font-semibold bg-slate-100 border border-slate-200 rounded-lg px-3 py-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                aria-label="Organization Tenant"
              >
                {session.organizations.map((org: any) => (
                  <option key={org.id} value={org.id}>
                    {org.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <button
            onClick={() => setShowNewEventModal(true)}
            className="px-4 py-2 text-xs font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors whitespace-nowrap shadow-sm flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>New Event</span>
          </button>
        </div>
      </header>

      {/* Event Toolbar */}
      {data && data.events.length > 0 && (
        <div className="bg-white border-b border-slate-200 px-6 py-3 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Active Event:</span>
            <select
              value={selectedEventId}
              onChange={(e) => setSelectedEventId(e.target.value)}
              className="text-sm font-semibold text-slate-800 bg-transparent border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              aria-label="Active Event Selection"
            >
              {data.events.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {ev.name} ({ev.date})
                </option>
              ))}
            </select>
          </div>

          {data.activeEvent && (
            <div className="flex items-center gap-6 text-xs text-slate-600">
              <div>
                Budget: <span className="font-mono font-semibold text-slate-900">{formatINR(data.activeEvent.budget)}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500" aria-hidden="true"></span>
                <span className="capitalize">{data.activeEvent.status}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {loading ? (
          <div className="flex items-center justify-center py-24" aria-label="Loading content">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          </div>
        ) : error ? (
          <div className="p-6 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm" role="alert">
            Error loading data: {error}
          </div>
        ) : !data || !data.activeEvent ? (
          <div className="text-center py-24 bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">
            <h2 className="text-xl font-bold text-slate-800 mb-2">No Event Workspaces Found</h2>
            <p className="text-slate-500 text-sm mb-6">Create your first event workspace to start tracking INR contributions and expenses.</p>
            <button
              onClick={() => setShowNewEventModal(true)}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 shadow-sm"
            >
              Create Event Workspace
            </button>
          </div>
        ) : (
          <>
            {/* Dashboard Tab */}
            {activeTab === "dashboard" && (
              <div className="space-y-8">
                {/* Metrics Grid (INR) */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  {/* Card 1 */}
                  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                    <div className="flex items-center justify-between text-slate-500 mb-2">
                      <span className="text-xs font-semibold uppercase tracking-wider">Promised vs Received</span>
                      <DollarSign className="w-5 h-5 text-indigo-600" />
                    </div>
                    <div className="text-2xl font-bold font-mono tabular-nums text-slate-900">
                      {formatINR(data.metrics.totalReceivedMonetary)}
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                      of <span className="font-mono tabular-nums font-medium">{formatINR(data.metrics.totalPromisedMonetary)}</span> promised
                    </div>
                  </div>

                  {/* Card 2 */}
                  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                    <div className="flex items-center justify-between text-slate-500 mb-2">
                      <span className="text-xs font-semibold uppercase tracking-wider">Outstanding Pledges</span>
                      <Clock className="w-5 h-5 text-amber-600" />
                    </div>
                    <div className="text-2xl font-bold font-mono tabular-nums text-slate-900">
                      {formatINR(data.metrics.outstandingCommitments)}
                    </div>
                    <div className="text-xs text-amber-600 font-medium mt-1">
                      Pending donor payments
                    </div>
                  </div>

                  {/* Card 3 */}
                  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                    <div className="flex items-center justify-between text-slate-500 mb-2">
                      <span className="text-xs font-semibold uppercase tracking-wider">Verified Expenses</span>
                      <Receipt className="w-5 h-5 text-emerald-600" />
                    </div>
                    <div className="text-2xl font-bold font-mono tabular-nums text-slate-900">
                      {formatINR(data.metrics.totalVerifiedExpenses)}
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                      <span className="font-mono tabular-nums font-medium">{formatINR(data.metrics.expensesAwaitingVerification)}</span> awaiting review
                    </div>
                  </div>

                  {/* Card 4 */}
                  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                    <div className="flex items-center justify-between text-slate-500 mb-2">
                      <span className="text-xs font-semibold uppercase tracking-wider">Budget Utilization</span>
                      <TrendingUp className="w-5 h-5 text-blue-600" />
                    </div>
                    <div className="text-2xl font-bold font-mono tabular-nums text-slate-900">
                      {data.metrics.budgetUtilization}%
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                      Budget: <span className="font-mono tabular-nums font-medium">{formatINR(data.metrics.budget)}</span>
                    </div>
                  </div>
                </div>

                {/* Content Sections */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  <div className="lg:col-span-2 space-y-8">
                    {/* Contributions Summary */}
                    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-base font-bold text-slate-900">Contributions & Pledges (₹ INR)</h3>
                        <button
                          onClick={() => setActiveTab("contributions")}
                          className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                        >
                          View All →
                        </button>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm" aria-label="Contributions Summary">
                          <thead>
                            <tr className="border-b border-slate-100 text-xs text-slate-400 font-semibold">
                              <th className="pb-3">Contributor</th>
                              <th className="pb-3">Type</th>
                              <th className="pb-3 text-right">Promised</th>
                              <th className="pb-3 text-right">Received</th>
                              <th className="pb-3 text-center">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {data.contributions.slice(0, 5).map((c) => (
                              <tr key={c.id} className="hover:bg-slate-50/50">
                                <td className="py-3 font-medium text-slate-800">{c.contributorName}</td>
                                <td className="py-3 text-slate-500 capitalize">{c.contributionType.replace("_", " ")}</td>
                                <td className="py-3 text-right font-mono tabular-nums text-slate-800">
                                  {c.contributionType === "monetary" ? formatINR(c.promisedAmount) : "—"}
                                </td>
                                <td className="py-3 text-right font-mono tabular-nums font-semibold text-slate-900">
                                  {c.contributionType === "monetary" ? formatINR(c.amountReceived) : c.inKindDescription}
                                </td>
                                <td className="py-3 text-center">
                                  <span className={`inline-block px-2.5 py-0.5 text-xs font-medium rounded-full capitalize ${
                                    c.status === "received" ? "bg-emerald-50 text-emerald-700" :
                                    c.status === "partial" ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-600"
                                  }`}>
                                    {c.status}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Expenses Summary */}
                    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-base font-bold text-slate-900">Expenses & Receipts (₹ INR)</h3>
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => setShowOcrModal(true)}
                            className="px-3 py-1.5 text-xs font-medium text-indigo-700 bg-indigo-50 rounded-lg hover:bg-indigo-100 flex items-center gap-1.5"
                          >
                            <Sparkles className="w-3.5 h-3.5" />
                            <span>AI Receipt OCR</span>
                          </button>
                          <button
                            onClick={() => setActiveTab("expenses")}
                            className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                          >
                            View All →
                          </button>
                        </div>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm" aria-label="Expenses Summary">
                          <thead>
                            <tr className="border-b border-slate-100 text-xs text-slate-400 font-semibold">
                              <th className="pb-3">Merchant</th>
                              <th className="pb-3">Category</th>
                              <th className="pb-3 text-right">Amount</th>
                              <th className="pb-3 text-center">Receipt Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {data.expenses.slice(0, 5).map((e) => (
                              <tr key={e.id} className="hover:bg-slate-50/50">
                                <td className="py-3 font-medium text-slate-800">{e.merchant}</td>
                                <td className="py-3 text-slate-500">{e.category}</td>
                                <td className="py-3 text-right font-mono tabular-nums font-semibold text-slate-900">
                                  {formatINR(e.amount)}
                                </td>
                                <td className="py-3 text-center">
                                  <span className={`inline-block px-2.5 py-0.5 text-xs font-medium rounded-full capitalize ${
                                    e.receiptStatus === "verified" ? "bg-emerald-50 text-emerald-700" :
                                    e.receiptStatus === "rejected" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700"
                                  }`}>
                                    {e.receiptStatus}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: AI Assistant & Tasks */}
                  <div className="space-y-6">
                    <div className="bg-gradient-to-br from-indigo-900 to-slate-900 rounded-2xl p-6 text-white shadow-sm">
                      <div className="flex items-center gap-2 mb-3">
                        <Sparkles className="w-5 h-5 text-indigo-300" />
                        <h3 className="text-base font-bold">GenAI Follow-up Assistant</h3>
                      </div>
                      <p className="text-xs text-indigo-200 mb-4 leading-relaxed">
                        Generate intelligent operational follow-up tasks for outstanding INR commitments and unverified receipts securely.
                      </p>
                      <button
                        onClick={() => { setActiveTab("tasks"); setShowAiTaskModal(true); }}
                        className="w-full py-2.5 bg-white text-indigo-900 rounded-xl text-xs font-semibold hover:bg-indigo-50 transition-colors shadow-sm"
                      >
                        Launch AI Assistant
                      </button>
                    </div>

                    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-base font-bold text-slate-900">Priority Tasks</h3>
                        <span className="text-xs font-semibold px-2 py-0.5 bg-slate-100 text-slate-700 rounded-full">
                          {data.tasks.filter(t => t.status !== "completed").length} Open
                        </span>
                      </div>
                      <div className="space-y-3">
                        {data.tasks.filter(t => t.status !== "completed").slice(0, 4).map(t => (
                          <div key={t.id} className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                            <div className="flex items-start justify-between gap-2">
                              <span className="text-xs font-semibold text-slate-800">{t.title}</span>
                              <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${
                                t.priority === "high" || t.priority === "urgent" ? "bg-red-50 text-red-700" : "bg-slate-200 text-slate-700"
                              }`}>
                                {t.priority}
                              </span>
                            </div>
                            <p className="text-xs text-slate-500 mt-1 line-clamp-2">{t.explanation}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Contributions Tab */}
            {activeTab === "contributions" && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">Contribution & Pledge Management (₹ INR)</h2>
                    <p className="text-xs text-slate-500 mt-0.5">Track monetary commitments, partial payments, and in-kind donations securely.</p>
                  </div>
                  <button
                    onClick={() => setShowNewContributionModal(true)}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-medium hover:bg-indigo-700 shadow-sm flex items-center gap-1.5"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Record Contribution</span>
                  </button>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                  <table className="w-full text-left text-sm" aria-label="Contributions Table">
                    <thead className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500 font-semibold uppercase tracking-wider">
                      <tr>
                        <th className="px-6 py-4">Contributor</th>
                        <th className="px-6 py-4">Type</th>
                        <th className="px-6 py-4 text-right">Promised</th>
                        <th className="px-6 py-4 text-right">Received</th>
                        <th className="px-6 py-4 text-center">Status</th>
                        <th className="px-6 py-4">Commitment Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {data.contributions.map((c) => (
                        <tr key={c.id} className="hover:bg-slate-50/50">
                          <td className="px-6 py-4 font-medium text-slate-900">
                            {c.contributorName}
                            {c.notes && <div className="text-xs text-slate-400 font-normal mt-0.5">{c.notes}</div>}
                          </td>
                          <td className="px-6 py-4 text-slate-600 capitalize">{c.contributionType.replace("_", " ")}</td>
                          <td className="px-6 py-4 text-right font-mono tabular-nums text-slate-800">
                            {c.contributionType === "monetary" ? formatINR(c.promisedAmount) : "—"}
                          </td>
                          <td className="px-6 py-4 text-right font-mono tabular-nums font-semibold text-slate-900">
                            {c.contributionType === "monetary" ? formatINR(c.amountReceived) : c.inKindDescription}
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span className={`inline-block px-2.5 py-1 text-xs font-medium rounded-full capitalize ${
                              c.status === "received" ? "bg-emerald-50 text-emerald-700" :
                              c.status === "partial" ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-600"
                            }`}>
                              {c.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-slate-500 text-xs font-mono">{c.commitmentDate}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Expenses Tab */}
            {activeTab === "expenses" && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">Expense & Receipt Management (₹ INR)</h2>
                    <p className="text-xs text-slate-500 mt-0.5">Upload supporting receipts, verify extracted values, and maintain clean audit records.</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setShowOcrModal(true)}
                      className="px-4 py-2 bg-indigo-50 text-indigo-700 rounded-lg text-xs font-semibold hover:bg-indigo-100 flex items-center gap-1.5 shadow-sm"
                    >
                      <Sparkles className="w-4 h-4" />
                      <span>AI Receipt OCR</span>
                    </button>
                    <button
                      onClick={() => setShowNewExpenseModal(true)}
                      className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-medium hover:bg-indigo-700 shadow-sm flex items-center gap-1.5"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Manual Expense</span>
                    </button>
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                  <table className="w-full text-left text-sm" aria-label="Expenses Table">
                    <thead className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500 font-semibold uppercase tracking-wider">
                      <tr>
                        <th className="px-6 py-4">Merchant</th>
                        <th className="px-6 py-4">Category</th>
                        <th className="px-6 py-4 text-right">Amount</th>
                        <th className="px-6 py-4 text-center">Receipt Status</th>
                        <th className="px-6 py-4 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {data.expenses.map((e) => (
                        <tr key={e.id} className="hover:bg-slate-50/50">
                          <td className="px-6 py-4 font-medium text-slate-900">
                            {e.merchant}
                            <div className="text-xs text-slate-400 font-normal mt-0.5">{e.description} ({e.date})</div>
                            {e.isFlaggedMissingReceipt && (
                              <div className="text-xs text-amber-600 font-medium flex items-center gap-1 mt-1">
                                <AlertTriangle className="w-3.5 h-3.5" /> Missing receipt document
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4 text-slate-600">{e.category}</td>
                          <td className="px-6 py-4 text-right font-mono tabular-nums font-semibold text-slate-900">
                            {formatINR(e.amount)}
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span className={`inline-block px-2.5 py-1 text-xs font-medium rounded-full capitalize ${
                              e.receiptStatus === "verified" ? "bg-emerald-50 text-emerald-700" :
                              e.receiptStatus === "rejected" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700"
                            }`}>
                              {e.receiptStatus}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <div className="flex items-center justify-center gap-2">
                              {e.receiptPath && (
                                <a
                                  href={e.receiptPath}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-xs text-indigo-600 hover:underline font-medium"
                                >
                                  View Receipt
                                </a>
                              )}
                              {e.receiptStatus !== "verified" && (
                                <button
                                  onClick={() => handleUpdateExpenseStatus(e.id, "verified")}
                                  className="px-2.5 py-1 bg-emerald-50 text-emerald-700 text-xs font-semibold rounded hover:bg-emerald-100"
                                >
                                  Verify
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Tasks Tab */}
            {activeTab === "tasks" && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">AI Follow-up Assistant & Tasks</h2>
                    <p className="text-xs text-slate-500 mt-0.5">Generate reviewable action items from event records and notes.</p>
                  </div>
                  <button
                    onClick={() => setShowAiTaskModal(true)}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-medium hover:bg-indigo-700 shadow-sm flex items-center gap-1.5"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>Generate AI Tasks</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {data.tasks.map((t) => (
                    <div key={t.id} className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-3">
                          <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${
                            t.priority === "high" || t.priority === "urgent" ? "bg-red-50 text-red-700" : "bg-slate-100 text-slate-700"
                          }`}>
                            {t.priority}
                          </span>
                          <span className="text-xs text-slate-400 font-mono">
                            {t.source === "ai_generated" ? "✨ AI Generated" : "Manual"}
                          </span>
                        </div>
                        <h3 className="text-base font-bold text-slate-900 mb-2">{t.title}</h3>
                        <p className="text-xs text-slate-600 leading-relaxed mb-4">{t.explanation}</p>
                      </div>

                      <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                        <span className="text-xs text-slate-500">
                          {t.responsiblePerson || "Unassigned"}
                        </span>
                        <select
                          value={t.status}
                          onChange={(e) => handleUpdateTaskStatus(t.id, e.target.value as any)}
                          className="text-xs font-medium bg-slate-100 border border-slate-200 rounded px-2 py-1 text-slate-700"
                          aria-label="Task Status"
                        >
                          <option value="open">Open</option>
                          <option value="in_progress">In Progress</option>
                          <option value="completed">Completed</option>
                        </select>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Audit Trail Tab */}
            {activeTab === "audit" && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">Immutable Audit Trail</h2>
                  <p className="text-xs text-slate-500 mt-0.5">Complete chronological log of financial record changes and workspace mutations.</p>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                  <table className="w-full text-left text-sm" aria-label="Audit Logs Table">
                    <thead className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500 font-semibold uppercase tracking-wider">
                      <tr>
                        <th className="px-6 py-4">Timestamp</th>
                        <th className="px-6 py-4">Action</th>
                        <th className="px-6 py-4">Entity</th>
                        <th className="px-6 py-4">Details</th>
                        <th className="px-6 py-4">User</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {data.auditLogs.map((log) => (
                        <tr key={log.id} className="hover:bg-slate-50/50">
                          <td className="px-6 py-4 font-mono text-xs text-slate-500 tabular-nums">
                            {new Date(log.timestamp).toLocaleString("en-IN")}
                          </td>
                          <td className="px-6 py-4 font-semibold text-slate-800">{log.action}</td>
                          <td className="px-6 py-4 text-slate-600 capitalize">{log.entityType}</td>
                          <td className="px-6 py-4 text-slate-800">{log.details}</td>
                          <td className="px-6 py-4 text-xs text-slate-500 font-mono">{log.userEmail}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* New Event Modal */}
      {showNewEventModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl" role="dialog" aria-modal="true">
            <h3 className="text-lg font-bold text-slate-900 mb-4">Create Event Workspace</h3>
            <form onSubmit={handleCreateEvent} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Event Name</label>
                <input
                  type="text"
                  required
                  value={newEventForm.name}
                  onChange={(e) => setNewEventForm({ ...newEventForm, name: e.target.value })}
                  className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  placeholder="e.g. Rural Health Camp 2026"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Date</label>
                  <input
                    type="date"
                    required
                    value={newEventForm.date}
                    onChange={(e) => setNewEventForm({ ...newEventForm, date: e.target.value })}
                    className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Budget (₹ INR)</label>
                  <input
                    type="number"
                    required
                    value={newEventForm.budget}
                    onChange={(e) => setNewEventForm({ ...newEventForm, budget: Number(e.target.value) })}
                    className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Description</label>
                <textarea
                  rows={3}
                  value={newEventForm.description}
                  onChange={(e) => setNewEventForm({ ...newEventForm, description: e.target.value })}
                  className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  placeholder="Brief description of event goals..."
                />
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowNewEventModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700 shadow-sm"
                >
                  Create Event
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New Contribution Modal */}
      {showNewContributionModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl" role="dialog" aria-modal="true">
            <h3 className="text-lg font-bold text-slate-900 mb-4">Record Contribution (₹ INR)</h3>
            <form onSubmit={handleCreateContribution} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Contributor Name / Organization</label>
                <input
                  type="text"
                  required
                  value={newContribForm.contributorName}
                  onChange={(e) => setNewContribForm({ ...newContribForm, contributorName: e.target.value })}
                  className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  placeholder="e.g. Karnataka Philanthropy"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Type</label>
                  <select
                    value={newContribForm.contributionType}
                    onChange={(e) => setNewContribForm({ ...newContribForm, contributionType: e.target.value as any })}
                    className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  >
                    <option value="monetary">Monetary</option>
                    <option value="in_kind">In-Kind</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Status</label>
                  <select
                    value={newContribForm.status}
                    onChange={(e) => setNewContribForm({ ...newContribForm, status: e.target.value as any })}
                    className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  >
                    <option value="promised">Promised</option>
                    <option value="partial">Partial</option>
                    <option value="received">Received</option>
                  </select>
                </div>
              </div>

              {newContribForm.contributionType === "monetary" ? (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Promised Amount (₹)</label>
                    <input
                      type="number"
                      required
                      value={newContribForm.promisedAmount}
                      onChange={(e) => setNewContribForm({ ...newContribForm, promisedAmount: Number(e.target.value) })}
                      className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Amount Received (₹)</label>
                    <input
                      type="number"
                      required
                      value={newContribForm.amountReceived}
                      onChange={(e) => setNewContribForm({ ...newContribForm, amountReceived: Number(e.target.value) })}
                      className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">In-Kind Item Description</label>
                  <input
                    type="text"
                    required
                    value={newContribForm.inKindDescription}
                    onChange={(e) => setNewContribForm({ ...newContribForm, inKindDescription: e.target.value })}
                    className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    placeholder="e.g. 50 Medical Kits"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Commitment Date</label>
                <input
                  type="date"
                  required
                  value={newContribForm.commitmentDate}
                  onChange={(e) => setNewContribForm({ ...newContribForm, commitmentDate: e.target.value })}
                  className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Notes</label>
                <input
                  type="text"
                  value={newContribForm.notes}
                  onChange={(e) => setNewContribForm({ ...newContribForm, notes: e.target.value })}
                  className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  placeholder="UPI ref or bank transfer details"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowNewContributionModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700 shadow-sm"
                >
                  Save Contribution
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Manual Expense Modal */}
      {showNewExpenseModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl" role="dialog" aria-modal="true">
            <h3 className="text-lg font-bold text-slate-900 mb-4">Record Expense & Receipt (₹ INR)</h3>
            <form onSubmit={handleCreateExpense} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Merchant / Vendor Name</label>
                <input
                  type="text"
                  required
                  value={newExpenseForm.merchant}
                  onChange={(e) => setNewExpenseForm({ ...newExpenseForm, merchant: e.target.value })}
                  className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  placeholder="e.g. Apex Pharma"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Amount (₹)</label>
                  <input
                    type="number"
                    required
                    value={newExpenseForm.amount}
                    onChange={(e) => setNewExpenseForm({ ...newExpenseForm, amount: Number(e.target.value) })}
                    className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Category</label>
                  <select
                    value={newExpenseForm.category}
                    onChange={(e) => setNewExpenseForm({ ...newExpenseForm, category: e.target.value })}
                    className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  >
                    <option value="Supplies">Supplies</option>
                    <option value="Venue & Catering">Venue & Catering</option>
                    <option value="Travel">Travel</option>
                    <option value="Marketing">Marketing</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Date</label>
                <input
                  type="date"
                  required
                  value={newExpenseForm.date}
                  onChange={(e) => setNewExpenseForm({ ...newExpenseForm, date: e.target.value })}
                  className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Description</label>
                <input
                  type="text"
                  value={newExpenseForm.description}
                  onChange={(e) => setNewExpenseForm({ ...newExpenseForm, description: e.target.value })}
                  className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  placeholder="What was purchased?"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Upload Receipt (PDF or Image)</label>
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={(e) => setExpenseFile(e.target.files?.[0] || null)}
                  className="w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowNewExpenseModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700 shadow-sm"
                >
                  Save Expense
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* AI Receipt OCR Modal */}
      {showOcrModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl" role="dialog" aria-modal="true">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="w-5 h-5 text-indigo-600" />
              <h3 className="text-lg font-bold text-slate-900">AI Receipt OCR & Extraction (₹ INR)</h3>
            </div>
            <p className="text-xs text-slate-500 mb-4">
              Upload a receipt image or PDF. Gemini will extract merchant, date, and amount in INR for your verification before saving.
            </p>

            {!ocrResult ? (
              <form onSubmit={handleRunOcr} className="space-y-4">
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  required
                  onChange={(e) => setOcrFile(e.target.files?.[0] || null)}
                  className="w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                />
                <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowOcrModal(false)}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={ocrLoading}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700 shadow-sm disabled:opacity-50 flex items-center gap-2"
                  >
                    {ocrLoading && <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>}
                    <span>Extract with AI</span>
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-4">
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2 text-xs">
                  <div className="font-semibold text-slate-800 text-sm mb-2">Extracted Values (Review Before Saving):</div>
                  <div className="grid grid-cols-2 gap-2">
                    <div><span className="text-slate-400">Merchant:</span> <span className="font-medium text-slate-900">{ocrResult.extracted.merchant}</span></div>
                    <div><span className="text-slate-400">Date:</span> <span className="font-medium text-slate-900">{ocrResult.extracted.date}</span></div>
                    <div><span className="text-slate-400">Amount:</span> <span className="font-medium font-mono tabular-nums text-slate-900">{formatINR(ocrResult.extracted.amount)}</span></div>
                    <div><span className="text-slate-400">Category:</span> <span className="font-medium text-slate-900">{ocrResult.extracted.category}</span></div>
                  </div>
                  <div className="pt-2"><span className="text-slate-400">Summary:</span> <span className="text-slate-700">{ocrResult.extracted.summary}</span></div>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setOcrResult(null)}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                  >
                    Upload Another
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveOcrExpense}
                    className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700 shadow-sm"
                  >
                    Confirm & Save Expense
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* AI Task Generator Modal */}
      {showAiTaskModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-xl max-h-[90vh] overflow-y-auto" role="dialog" aria-modal="true">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="w-5 h-5 text-indigo-600" />
              <h3 className="text-lg font-bold text-slate-900">GenAI Follow-up Task Assistant</h3>
            </div>
            <p className="text-xs text-slate-500 mb-4">
              Provide optional notes or meeting minutes. Gemini will analyze current INR commitments and receipts to propose reviewable action items.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Event Notes / Meeting Minutes</label>
                <textarea
                  rows={3}
                  value={aiNotes}
                  onChange={(e) => setAiNotes(e.target.value)}
                  className="w-full text-sm border border-slate-300 rounded-lg p-3 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  placeholder="e.g. Discussed follow-up with Bangalore Tech for remaining ₹50,000 balance."
                />
              </div>

              <button
                onClick={handleGenerateAiTasks}
                disabled={aiLoading}
                className="w-full py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-semibold hover:bg-indigo-700 shadow-sm disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {aiLoading && <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>}
                <span>Generate Proposed Tasks</span>
              </button>

              {proposedTasks.length > 0 && (
                <div className="space-y-3 pt-4 border-t border-slate-100">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Proposed Tasks (Review & Approve):</h4>
                  {proposedTasks.map((t, idx) => (
                    <div key={idx} className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-bold text-slate-900">{t.title}</span>
                          <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${
                            t.priority === "high" || t.priority === "urgent" ? "bg-red-50 text-red-700" : "bg-slate-200 text-slate-700"
                          }`}>
                            {t.priority}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 mb-2">{t.explanation}</p>
                        {t.responsiblePerson && (
                          <div className="text-xs text-indigo-600 font-medium">Assignee: {t.responsiblePerson}</div>
                        )}
                      </div>
                      <button
                        onClick={() => handleApproveTask(t)}
                        className="px-3 py-1.5 bg-emerald-600 text-white text-xs font-semibold rounded-lg hover:bg-emerald-700 whitespace-nowrap shadow-sm shrink-0"
                      >
                        Approve & Save
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex justify-end pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => { setShowAiTaskModal(false); setProposedTasks([]); }}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
