# 🍳 Kaizen — Smart Restaurant Platform

> One platform where your tables, kitchen, and guests move in perfect sync.

Kaizen is a next-generation, high-performance, real-time smart restaurant ecosystem designed to streamline ordering, prevent kitchen bottlenecking, minimize food waste, and provide actionable business intelligence (BI) with live weather-demand forecasting and generative AI.

---

## 🔑 Default Credentials
Use the following credentials to access the system during local testing and validation:

* **Admin Username / Email**: `admin`
* **Admin Password**: `admin123`
* **Demo PIN for Staff Dashboard**: `1234`

*(Pre-seeded demo manager account: `ananya.rao@kaizen.demo` with password `KaizenDemo123!`)*

---

## ⚡ Core Features

### 1. 👥 Real-Time Group Ordering
* **PostgreSQL Realtime Sync**: Guests at the same table can initiate a shared group ordering session. Multiple devices can scan the table QR code and add items to a shared basket.
* **Instant synchronization**: Cart changes, seat allocations, and item counts update instantly on all connected devices via Supabase Realtime Channels.

### 2. 🧠 AI-Powered Allergen Safety Guard
* **Recipe Check**: Customers can declare food allergies (e.g., *Dairy, Gluten, Peanuts, Soy*). The system performs an intersection check against the dish's raw ingredient profiles.
* **AI Alternatives**: If a conflict is found, the checkout is dynamically blocked, and a generative AI engine (using **Groq Llama-3.3** with a **Gemini 2.0** fallback) provides a polite explanation of the allergen conflict and suggests safe, relevant menu substitutes.

### 3. 🌦️ Weather-Integrated Demand Forecasting
* **Open-Meteo API**: Automatically retrieves live weather predictions for tomorrow.
* **Smart Baselines**: Classifies items (e.g., warm/comfort food like *Dal Makhani* vs. cold items like *Mango Lassi*) and predicts inventory needs based on weather parameters (rain, temperature highs, heat index).
* **Smart Offers & dynamic pricing**: If the system detects an overstock risk for tomorrow, it automatically suggests dynamic discounts to accelerate sales.

### 4. 📊 Business Intelligence & Menu Engineering
* **Menu Engineering Matrix**: Automatically groups menu items based on profitability and popularity into:
  * **Stars**: High popularity, high margin (maintain quality and feature prominently).
  * **Plowhorses**: High popularity, low margin (re-price or bundle).
  * **Puzzles**: Low popularity, high margin (promote heavily).
  * **Dogs**: Low popularity, low margin (consider removing).
* **Food Waste Avoided Counter**: Generates a dollar-value metric showing the cost of ingredients saved from spoilage thanks to dynamically cleared smart-discount sales.

### 5. ⏱️ Self-Calibrating Kitchen ETA & Alerts
* **Predictive Wait Times**: Predicts actual wait times dynamically based on active order queues, kitchen capacities, and historical food preparation data.
* **Instant Guest Services**: Guests can request service (e.g., extra napkins, water, check/bill) directly from their order-tracking screen, ringing up instantly on the staff dashboard.

---

## 🛠️ Technology Stack

| Category | Technology | Description |
| :--- | :--- | :--- |
| **Framework** | **Next.js 14.2 (App Router)** | Modern react framework using server components and route handlers |
| **Language** | **TypeScript** | Strict static typing for bug-free execution |
| **Styling** | **Tailwind CSS v4** | CSS-first configuration and utilities |
| **Database & Realtime** | **Supabase** | Backend-as-a-service providing PostgreSQL, Auth, and Realtime Listeners |
| **AI Models** | **Groq Llama 3.3-70b / Gemini 2.0 Flash** | Natural Language Processing for allergen analysis and dashboard insights |
| **Visual Effects** | **Three.js** | WebGL fluid gradient parallax background (`ColorBends`) for premium aesthetics |
| **Icons** | **Lucide React** | Consistent, modern vector iconography |

---

## 📁 Project Architecture
The project structure is organized by responsibilities inside the `app/` folder (Next.js route groups):

```
📂 root/
├── 📂 app/                       # Next.js App Router
│   ├── 📂 (auth)/                # OTP login, sign-up, and verification routes
│   ├── 📂 (customer)/            # Menus, cart, group ordering, and order tracking
│   ├── 📂 (staff)/               # PIN-gated dashboards, orders, inventory, analytics
│   ├── 📂 api/                   # Serverless endpoints (forecast, reset, status)
│   ├── 📄 layout.tsx             # Root layout and theme providers
│   └── 📄 globals.css            # Custom styling system and Tailwind v4 themes
├── 📂 components/                # Reusable UI React Components
│   ├── 📂 customer/              # Customer-specific components (shared cart, menus)
│   ├── 📂 staff/                 # Staff dashboard sidebar, pinpads, and dialogs
│   └── 📂 ui/                    # shadcn/ui components & Three.js canvas components
├── 📂 lib/                       # Core helper modules
│   ├── 📂 ai/                    # Gemini & Groq fetch APIs
│   ├── 📂 forecasting/           # Weather-demand prediction mathematical models
│   ├── 📂 pairing/               # Database-driven matching rules
│   └── 📂 supabase/              # Client & server database clients
└── 📂 supabase/                  # Supabase config, SQL migrations, and seeds
```

---

## 🚀 Quick Setup & Installation

### 1. Clone the repository and install dependencies
```bash
git clone https://github.com/your-username/smart-restaurant-management-system.git
cd smart-restaurant-management-system
npm install
```

### 2. Configure Environment Variables
Create a `.env.local` file in the root directory:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# LLM APIs for AI Allergen Safety & BI Recommendations
GROQ_API_KEY=your-groq-key
GEMINI_API_KEY=your-gemini-key
```

### 3. Database Migration & Seed
Run migrations to set up custom PostgreSQL types, views, functions, triggers, and the shared PIN table:
```bash
# Push migrations to Supabase
supabase migration up

# Seed initial test accounts (Admin, staff, and customers)
node supabase/create-test-accounts.mjs
```

### 4. Run the Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) with your browser to experience Kaizen.

---

## 🔄 Demo Database Reset
To reset and seed clean demo datasets instantly to view the forecasting engine and analytics in action:
* Send a **POST** request to: `/api/demo/reset`
* This clears all transaction tables and recreates standard dining tables (1-6), default categories, dynamic allergens, and sample historical transactions for the past 90 days.
