# Kleenworks Platform Architecture & Blueprint

## 📌 Project Overview
The Kleenworks Platform is a comprehensive, multi-tenant enterprise management system built with Next.js. It handles end-to-end business operations, including customer bookings, staff rollcalls, inventory logistics, and payment processing, split across dedicated user portals.

## 🏗️ System Architecture

### Tech Stack
* **Frontend:** Next.js (App Router), React, Tailwind CSS, shadcn/ui
* **Backend:** Next.js API Routes, Supabase (PostgreSQL), Firebase
* **AI Integration:** Firebase Genkit (`src/ai/`)
* **Payments:** M-Pesa Daraja API (`src/lib/mpesa/`)

---

## 📱 Application Portals (The 3+ Apps)

The system is compartmentalized into dedicated user experiences:

### 1. Manager Portal (`src/app/manager/`)
The core administrative dashboard for business operations.
* **Key Features:** Accounts, Analytics, Bays & CCTV monitoring, Inventory & Logistics tracking, Payroll & Rollcall management, Marketing, Sales, Staff management, and Task delegation.
* **AI Integration:** Features a specialized `manager-operational-insights-flow` powered by Genkit.

### 2. Customer Portal (`src/app/customer/`)
The client-facing application for booking and tracking services.
* **Key Features:** Service selection, booking management, and payment processing.

### 3. Agent/Staff Portal (`src/app/agent/`)
The operational interface for on-the-ground staff and agents.
* **Key Features:** Task execution, rollcall submission, and real-time bay/service updates.

*(Note: There is also a foundational `saas-admin` portal for managing the global system infrastructure and tenants).*

---

## ⚙️ Underlying Functions & API Layer (`src/app/api/`)

The platform's logic is powered by a robust set of underlying API endpoints, managing everything from basic CRUD to complex external integrations.

* **Authentication & Auth:** `/api/auth/` (Login, Signup, Session management).
* **Booking & Services:** `/api/bookings/`, `/api/services/`, `/api/bays/`, `/api/vehicles/`
* **Financials & Payments:** 
  * `/api/payments/mpesa/` (Handles STK Push, Callbacks, and Status checking via Daraja).
  * `/api/expenses/`, `/api/transactions/`
* **Operations & Logistics:** `/api/inventory/` (including `/restock`), `/api/logistics/`
* **Human Resources:** `/api/staff/`, `/api/payroll/`, `/api/rollcall/`
* **Business Intelligence:** `/api/dashboard/`, `/api/reports/export/`

---

## 🗄️ Database & Migrations (Supabase)

The relational database is managed via Supabase with strict Row Level Security (RLS) and custom Remote Procedure Calls (RPCs). 

**Key Migration Phases (`supabase/migrations/`):**
1. `001_schema.sql` - Core database initialization
2. `002_rls_policies.sql` - Security and tenant isolation
3. `003_transaction_rpc.sql` - Secure financial transactions
4. `004_phase3_tables.sql` - Expanded feature sets
5. `005_login_attempts.sql` - Security tracking
6. `006_mpesa_columns.sql` - Payment gateway schemas
7. `007_customer_bookings.sql` - Scheduling logic
8. `008_kleenworks_tenant.sql` - Multi-tenancy structures
9. `009_vehicle_car_model.sql` - Automotive categorizations
10. `010_rollcall.sql` - Staff attendance tracking

---

## 🧩 Shared Components & Libraries

* **UI Components (`src/components/ui/`):** A highly reusable, accessible component library (buttons, dialogs, forms, charts, tables, etc.).
* **Firebase Ecosystem (`src/firebase/`):** Handles non-blocking updates, realtime listeners, and specialized client providers.
* **Hooks (`src/hooks/`):** Custom React hooks for authentication (`useAuth`), toast notifications, and realtime data fetching (`useRealtime`).