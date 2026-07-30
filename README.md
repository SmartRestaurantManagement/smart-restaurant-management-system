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

# ⚡ Core Features

### 1. 🧠 AI-Powered Allergen Safety Guard
- **Personalized Allergy Detection:** Customers can declare allergies (e.g., Dairy, Gluten, Peanuts, Soy), and every dish is automatically checked against its recipe ingredients.
- **AI-Powered Safe Alternatives:** If an allergen conflict is detected, checkout is blocked and AI (Groq Llama-3.3 with Gemini 2.0 fallback) explains the issue while recommending safe menu alternatives.

---

### 2. 🌦️ Weather-Aware Demand Forecasting & Smart Offers
- **AI Demand Forecasting:** Combines historical order trends with live weather forecasts from the **Open-Meteo API** to predict next-day demand and identify potential overstock.
- **Smart Discount Recommendations:** Automatically suggests margin-safe discounts for low-demand dishes to reduce ingredient waste while maintaining profitability.
- **Human Approval Workflow:** All generated Smart Offers require staff approval before appearing on the customer menu.

---

### 3. 📊 Business Intelligence Dashboard
- **Menu Engineering Matrix:** Automatically classifies menu items into **Stars, Plowhorses, Puzzles,** and **Dogs** based on popularity and profitability to support pricing and marketing decisions.
- **Waste Savings Analytics:** Tracks estimated food waste prevented and ingredient costs saved through AI-driven Smart Offers.

---

### 4. ⏱️ Intelligent Kitchen ETA
- **Dynamic Wait Time Prediction:** Continuously estimates order preparation times using active kitchen workload, historical preparation data, and live order queues.
- **Real-Time Order Tracking:** Keeps customers informed with accurate preparation progress and updated delivery estimates.

---

### 5. 🪑 Smart Table Management
- **Mandatory Table Association:** Orders can only be placed after joining a table, preventing orphan orders from reaching the kitchen.
- **Context-Aware Service:** Table-specific ordering and service requests ensure staff always know where assistance is required.

### 6. 💳 Smart Bill Splitting
- **Seamless Group Payments:** Split the final bill among multiple diners through a dedicated post-checkout modal for a faster payment experience.

---

# 🌟 Customer Experience

### 1. 🤖 Ask Kaizen — AI Dining Assistant
- **Natural Language Recommendations:** Customers can ask for dishes based on dietary preferences, budget, nutrition goals, or cuisine (e.g., *"High-protein Jain meal under ₹300"*).
- **Smart Pairing Suggestions:** Recommends complementary dishes and beverages while explaining the reasoning behind each suggestion.
- **Interactive Navigation:** Selecting a recommendation automatically scrolls to and highlights the corresponding menu item.

---

### 2. 🥗 Automatic Nutritional Insights
- **Ingredient-Based Nutrition Analysis:** Calculates approximate calories and protein directly from recipe ingredients.
- **Always Visible:** Nutritional information is displayed beneath every menu item without requiring user interaction.

---

### 3. 🏷️ AI Smart Offer Experience
- **Premium Offer Banner:** Displays staff-approved AI Smart Offers prominently on the landing and menu pages.
- **One-Click Ordering:** Customers can instantly add discounted dishes to their cart directly from the Smart Offer banner.

---

### 4. 🔍 Intelligent Menu Explorer
- **Advanced Discovery:** Browse dishes using live search, Veg/Non-Veg filters, price filters, and sorting by price or popularity for a personalized ordering experience.

---

### 5. 🔔 Real-Time Table Service Requests
- **Instant Service Requests:** Customers can request **Water**, **Call a Server**, or **Request the Bill** directly from the menu.
- **Smart Staff Alerts:** Requests appear instantly on the staff dashboard with a live response timer. Delayed requests automatically turn **red**, helping staff prioritize tables requiring immediate attention.

---

# 🚀 Performance & Optimization

### 1. ⚡ High-Speed Menu Caching
- **Sub-50ms Menu Loading:** Uses Next.js `unstable_cache` with optimized public database queries to deliver fast and responsive menu browsing.

---

### 2. 📲 Mobile-First Experience
- **Responsive Design:** Optimized layouts and components for seamless usage across mobile, tablet, and desktop devices.
- **Performance Improvements:** Eliminated unnecessary re-renders using optimized React hooks, resulting in a smoother and more stable user experience.

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
* This clears all transaction tables and recreates standard dining tables (1-6), default categories, dynamic allergens, and sample historical transactions for the past 90 days. It also inserts a default active Smart Offer on **Paneer Butter Masala** so that your promotional banners display immediately!
