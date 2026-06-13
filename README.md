# AI Refund Customer Support Agent 🚀

A production-grade, end-to-end AI customer support agent designed for an e-commerce company. The agent evaluates refund requests by checking customer order parameters inside a SQLite CRM database, reading official refund policies, calculating transaction age, and deciding whether to approve, deny, or escalate the request to a manager. It features a complete React dashboard with real-time reasoning logs and interactive CRM editing.

---

## 🛠️ Tech Stack

- **Frontend**: React, Vite, Tailwind CSS, Lucide Icons
- **Backend**: FastAPI (Python), Uvicorn, SQLite3, LangGraph / LangChain, OpenAI API
- **Voice Pipeline**: Browser Web Speech API (Speech-to-Text & Text-to-Speech) with OpenAI Whisper & TTS backup.

---

## 📂 Repository Structure

```text
ai-refund-agent/
│
├── backend/
│   ├── main.py            # FastAPI REST API Server (runs on port 8000)
│   ├── agent.py           # LangGraph Agent flow & simulated rule fallback
│   ├── tools.py           # Database queries, policy reader, date tools
│   ├── database.py        # SQLite database setup and 15 mock profiles
│   ├── policy.txt         # Strict company refund policy document
│   └── requirements.txt   # Python packages
│
├── frontend/
│   ├── src/
│   │   ├── main.jsx       # React entrypoint
│   │   ├── App.jsx        # Complete chat, dashboard, voice, CRM editor UI
│   │   └── index.css      # Tailwind custom classes & scrollbars
│   ├── index.html         # HTML entrypoint
│   ├── vite.config.js     # Vite configuration and proxy setup (port 3000)
│   ├── tailwind.config.js # Custom dark theme, colors, and animations
│   ├── postcss.config.js  # Tailwind compiler setup
│   └── package.json       # Node modules and build scripts
│
└── README.md              # Project documentation
```

---

## 🛡️ Refund Policy Rules (`backend/policy.txt`)
The AI agent strictly applies the following rules:
1. **Refund Window**: Allowed only within **30 days** of purchase.
2. **Product Condition**: Product must **not** be damaged.
3. **Digital Exclusions**: Digital downloads, licenses, and e-books are **strictly non-refundable**.
4. **Customization Exclusions**: Custom-made/personalized products are **strictly non-refundable**.
5. **Approval Threshold**: Any refund above **$500.00 USD** cannot be auto-approved; it is flagged as **"Requires Manager Approval"**.

---

## 🗃️ CRM Database Schema & Mock Profiles (`database.db`)
The database is pre-seeded with 15 profiles to cover all edge cases:
- **C005 (David)**: Purchased 10 days ago, $450 Leather Jacket, physical, perfect condition. ➔ **Approved**
- **C010 (Isabella)**: Purchased 45 days ago, $650 Handbag, physical. ➔ **Denied** (exceeds 30-day window)
- **C007 (James)**: Purchased 4 days ago, $120 Earbuds, physical, but marked **damaged**. ➔ **Denied** (product damaged)
- **C003 (Mike)**: Purchased 3 days ago, $99 Software, **digital**. ➔ **Denied** (digital product)
- **C006 (Sophia)**: Purchased 8 days ago, $799 Tablet, physical, perfect condition. ➔ **Requires Manager Approval** (amount > $500)
- **C004 (Emma)**: Purchased 5 days ago, $300 Gold Ring, **custom-made**. ➔ **Denied** (custom product)

---

## 🚀 How to Run the Project

### Step 1: Clone and Configure Environment
1. In the `backend/` folder, create a `.env` file to configure your OpenAI API Key (optional but recommended for live LangGraph):
   ```env
   OPENAI_API_KEY=your_actual_openai_api_key
   ```
   *Note: If no API key is provided, the backend automatically runs in a highly sophisticated **Rule-Based Simulator mode** that executes the exact same tools and creates the exact same reasoning logs. This allows full testing out-of-the-box!*

### Step 2: Start the Backend (FastAPI)
1. Navigate to the `backend/` folder:
   ```bash
   cd backend
   ```
2. Install Python dependencies:
   ```bash
   pip install -r requirements.txt
   ```
3. Run the database initialization:
   ```bash
   python database.py
   ```
4. Start the FastAPI server:
   ```bash
   python main.py
   ```
   The backend will start running at `http://127.0.0.1:8000`.

### Step 3: Start the Frontend (Vite + React)
1. Open a new terminal and navigate to the `frontend/` folder:
   ```bash
   cd frontend
   ```
2. Install Node packages:
   ```bash
   npm install
   ```
3. Run the Vite development server:
   ```bash
   npm run dev
   ```
   The web application will open at `http://localhost:3000`. It automatically proxies `/api` calls to the FastAPI backend.

---

## 📽️ Loom Walkthrough / Demo Script

When recording your 7-10 minute video, walk through the following steps to maximize grading points:

1. **Approved Case**:
   - In Chat, click the `✅ Approved (C005)` test button.
   - Show that the agent successfully returns **Approved** because the item was purchased 10 days ago (within 30 days) and meets all policy rules.
   - Click the **Real-Time Reasoning Logs** tab on the right to show the trace:
     - `Tool Call: get_order_details` ➔ Found David (C005).
     - `Tool Call: read_refund_policy` ➔ Read policy.
     - `Tool Call: get_current_date` ➔ Calculated 10 days age.
     - `Decision` ➔ Approved.
2. **Denied Case (Window Violation)**:
   - Click the `❌ Denied: >30 Days (C010)` test button.
   - Show that the agent returns **Denied** because the purchase was 45 days ago. Show the corresponding reasoning log trace.
3. **Interactive Modification ("Holding the Line")**:
   - Go to the **CRM Database Viewer** tab.
   - Click the **Edit** icon next to **C010 (Isabella)**.
   - Change her purchase date from `2026-04-29` to a recent date (e.g. `2026-06-10`), and save.
   - Re-run the query `"Refund order C010"` in the chat.
   - Show that the agent now automatically **Approves** the refund because the database reflects the new date.
   - Now edit **C010** again, check **Mark Damaged**, and save.
   - Re-run the query and show that the agent strictly **Denies** the refund now because the item is damaged.
4. **Voice Demo**:
   - Click the Speaker icon to unmute.
   - Click the Microphone icon, speak: `"Refund order C012"`.
   - The browser will transcribe it, send it to the agent, update the logs, and read the approval response out loud.
5. **Code Walkthrough**:
   - Show the LangGraph State Graph structure in `backend/agent.py`.
   - Show how the tools are implemented in `backend/tools.py`.
   - Show how the database and schema are configured.
