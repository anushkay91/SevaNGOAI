# SevaTrack AI 🌟

**SevaTrack AI** is a modern, full-stack NGO Contribution & Expense Coordinator application equipped with GenAI receipt OCR analysis, multi-organization workspaces (such as *Seva Foundation India* and *Rural Education Trust*), event management, and intelligent financial tracking in INR (₹).

---

## 🚀 Key Features

- **Multi-Organization & Community Workspaces**: Switch effortlessly between official NGO and foundation workspaces like *Seva Foundation India* and *Rural Education Trust*.
- **Event & Expense Management**: Track fundraising events, donations, contributions, and itemized operational expenses with real-time totals and budget calculators.
- **GenAI Receipt OCR & Parsing**: Upload receipt images or PDFs to instantly extract vendor names, amounts, categories, and line items using Google's Gemini AI SDK.
- **AI Follow-up Assistant**: Generate intelligent donor thank-you notes, follow-up emails, and audit reports directly from workspace financial data.
- **Persistent Storage**: Robust JSON-backed backend persistence ensuring smooth record-keeping across sessions.
- **Sleek, Responsive UI**: Built with React 19, TypeScript, Tailwind CSS (v4), and Lucide icons for a clean, accessible, and professional experience.

---

## 🛠️ Tech Stack

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS (v4), Motion, Lucide React.
- **Backend**: Node.js, Express, Multer (for secure receipt uploads).
- **AI Integration**: `@google/genai` (Google GenAI SDK for receipt OCR and assistant features).
- **Testing**: Vitest, Supertest.

---

## 📦 Getting Started

### Prerequisites

- Node.js (v18 or higher recommended)
- npm, pnpm, or bun

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/your-username/sevatrack-ai.git
   cd sevatrack-ai
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure environment variables:
   Copy `.env.example` to `.env` and configure your API keys (including `GEMINI_API_KEY` if using GenAI features):
   ```bash
   cp .env.example .env
   ```

---

## 🏃 Running the Application

### Development Mode

Start the full-stack development server (Express backend + Vite middleware):
```bash
npm run dev
```
Open your browser at `http://localhost:3000`.

### Production Build

Build the application for production:
```bash
npm run build
```

Run tests:
```bash
npm test
```

---

## 📁 Project Structure

```
├── server.ts         # Express backend server (API routes, OCR, data persistence)
├── server.test.ts    # Backend test suite
├── src/
│   ├── App.tsx       # Main React application component
│   ├── main.tsx      # Application entry point
│   └── index.css     # Tailwind CSS import & global styles
├── public/           # Static assets and demo files
├── data.json         # Local persistent database for workspaces & events
├── package.json      # Project dependencies and scripts
└── tsconfig.json     # TypeScript configuration
```

---

## 🤝 Contributing

Contributions, issues, and feature requests are welcome! Feel free to check issues page or submit a pull request.

---

## 📄 License

This project is open-source and available under the [MIT License](LICENSE).
