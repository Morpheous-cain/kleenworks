# CLAUDE.md - Kleenworks Platform & Development Blueprint

## 🤖 1. AI Assistant Core Directives
When generating code, analyzing architecture, or debugging in this workspace, strictly adhere to the following rules:
- **No Fragmented Snippets:** Provide the full, updated version of files in their entirety so they can be immediately copy-pasted without manual merging (e.g., if modifying a complex hook like `usePlatform`, output the entire hook).
- **Tooling Awareness:** Assume the environment relies heavily on Claude CLI (Claude Code), OpenRouter, and custom 9Router Proxy configurations.
- **MCP Utilization:** Be prepared to interact with MCP plugins for extended local environment capabilities, dependency management, and file system operations.
- **Role-Based Context:** Always ask yourself *which* portal (Manager, Customer, Agent, SaaS Admin) your code affects before suggesting shared changes.

---

## 🏗️ 2. Monorepo Architecture & Routing
The application is a Next.js App Router monorepo divided into highly specialized, role-specific portals.

### The Portals
1. **`/src/app/manager/` (Manager Portal)**
   - **Scope:** Complete business oversight.
   - **Features:** Analytics, Bays & CCTV monitoring, Inventory/Logistics, Payroll, Rollcalls, Marketing, Sales, and Staff management.
   - **AI Integration:** Houses the `manager-operational-insights-flow` (powered by Firebase Genkit) for operational intelligence.
2. **`/src/app/customer/` (Customer Portal)**
   - **Scope:** Client-facing booking and tracking.
   - **Focus:** Must maintain a pristine, mobile-first UI/UX. Handles service selection and payment gateways (M-Pesa).
3. **`/src/app/agent/` (Agent/Staff Portal)**
   - **Scope:** Ground-level operational execution.
   - **Features:** Task management, live rollcall submission, and real-time bay updates.
4. **`/src/app/saas-admin/` (Global Infrastructure)**
   - **Scope:** Multi-tenant infrastructure management and overarching platform controls.

### Authentication & Redirection Routing
- **Strict Role Routing:** When provisioning new staff accounts or security roles (similar to patterns established in previous modules like the Hawks codebase), newly created accounts must seamlessly and securely redirect to their designated screens upon login. Do not leak manager views to agents.

---

## 💻 3. Frontend UI/UX & React Standards
As a system prioritizing top-tier UI/UX, frontend code must be exceptionally clean and responsive.
- **Framework:** Next.js App Router, React.
- **Styling:** Tailwind CSS exclusively. Use the `cn()` utility from `clsx` and `tailwind-merge` for all dynamic class conditions.
- **Components:** Rely on `shadcn/ui` for foundational elements (buttons, forms, dialogs, tables). Do not invent custom UI primitives if a shadcn equivalent exists.
- **Server vs. Client:** Default to React Server Components (RSC) to minimize bundle size. Only append `'use client'` when browser APIs, `useState`/`useEffect`, or complex user interactivity are strictly necessary.

### State Management & Hooks
- **Complex State:** Encapsulate heavy state logic and API integrations within dedicated custom hooks (e.g., `usePlatform.ts`). These hooks should handle their own loading states, error catching, and data formatting.
- **URL State:** Prefer URL query parameters for search, filtering, and pagination over `useState` to maintain shareable links and clean navigation.

---

## ⚙️ 4. API Layer & External Integrations
The `src/app/api/` directory is the backbone of the platform and must remain compartmentalized.

- **Financials (`/api/payments/mpesa/`):** Handles Daraja API interactions (STK Push, Callbacks). Requires robust, fail-safe error handling and strict environment variable security.
- **Human Resources:** Endpoints for `/staff/`, `/payroll/`, and `/rollcall/` must accurately sync with the Supabase database and validate against current manager/agent shifts.
- **AI Integration (`src/ai/`):** Firebase Genkit functions remain isolated here. API routes should trigger these flows, returning structured JSON to the frontend.

---

## 🗄️ 5. Database, Auth, and Supabase Rules
Supabase serves as the primary PostgreSQL relational database and authentication provider.

### Schema & Migrations (`/supabase/migrations/`)
- **Immutability in Production:** NEVER modify the database schema directly via the Supabase Studio UI.
- **Migration Files:** All schema changes, new tables, or column updates must be written as sequential `.sql` migration files (e.g., `011_add_inventory_alerts.sql`).
- **Data Integrity:** Use PostgreSQL constraints, foreign keys, and cascading deletes where appropriate to maintain data integrity across bookings, users, and inventory.

### Security & Access Control
- **Row Level Security (RLS):** Every single table MUST have RLS enabled. Write explicit policies for `SELECT`, `INSERT`, `UPDATE`, and `DELETE` that respect the multi-tenant architecture and user roles.
- **Complex Transactions:** For multi-table operations (e.g., creating a booking, updating inventory, and logging a transaction simultaneously), write custom Remote Procedure Calls (RPCs) within your migration files to ensure ACID compliance. Do not handle complex multi-table transaction fallbacks purely on the client side.

---

## 🛠️ 6. Dependency & Setup Instructions
- **Package Manager:** Assume `npm` (or `pnpm`/`yarn` depending on the active lockfile) for all dependency installations.
- **Checking Before Installing:** Before adding a new npm package, verify if existing libraries in the `package.json` (like `date-fns`, `zod`, `react-hook-form`, or existing Firebase utilities) can achieve the desired outcome.