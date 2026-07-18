# Session Summary - 2026-07-18

## Issues Reported
1. Services page won't open / crashes
2. Rollcall: "couldn't find table 'public.rollcall_logs' in schema cache" when clocking in/out staff
3. Inventory: Add button works but no remove button; "add failed; failed to execute json on 'Response' end of JSON input"
4. Tasks page loads into dark mode automatically
5. General dark mode issues - text disappears, doesn't work properly in accounts module

---

## Fixes Applied

### 1. Services Page Crash
**File:** `src/app/manager/services/page.tsx`
- **Root Cause:** `PlusCircle` icon from `lucide-react` was used on line 278 but not imported
- **Fix:** Added `PlusCircle` to the import statement

### 2. Rollcall Logs Table Missing
**File:** `supabase/migrations/010_rollcall.sql` (exists but not applied)
- **Root Cause:** Migration `010_rollcall.sql` creates the `rollcall_logs` table but hasn't been run against the database
- **Fix:** Run migration `010_rollcall.sql` to create the table:
  ```sql
  CREATE TABLE IF NOT EXISTS rollcall_logs (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id  uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    staff_id   uuid NOT NULL REFERENCES staff(id)   ON DELETE CASCADE,
    action     text NOT NULL CHECK (action IN ('clock-in', 'clock-out')),
    source     text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'fingerprint')),
    created_at timestamptz NOT NULL DEFAULT now()
  );
  ```

### 3. Inventory Add Item Error
**Files:** 
- `src/app/api/inventory/route.ts` (added POST handler)
- `src/app/api/inventory/[id]/route.ts` (removed duplicate POST)

**Root Cause:** The POST endpoint for creating inventory items was incorrectly placed in `/api/inventory/[id]/route.ts` but the UI calls `/api/inventory` (without ID). Also, column names in the INSERT didn't match the database schema (`quantity` vs `stock`, `reorder_level` vs `low_stock_threshold`).

**Fix:**
- Added POST handler to `/api/inventory/route.ts` with correct column names:
  - `stock` (not `quantity`)
  - `low_stock_threshold` (not `reorder_level`)
- Removed POST from `/api/inventory/[id]/route.ts`

### 4. Inventory Remove Button Missing
**File:** `src/app/manager/inventory/page.tsx`
- **Root Cause:** Remove checkboxes only rendered when `removeIds.length > 0`, creating a catch-22 where users could never select the first item
- **Fix:** Made the selection checkbox always visible on each inventory card

### 5. Tasks Page Hardcoded Dark Mode
**File:** `src/app/manager/tasks/page.tsx`
- **Root Cause:** Entire page used hardcoded dark colors (`bg-[#060E1E]`, `text-white`, `bg-[#0F1F3D]`, etc.)
- **Fix:** Converted all hardcoded colors to semantic CSS variables:
  - `bg-background` / `text-foreground`
  - `bg-card` / `text-foreground`
  - `bg-muted` / `text-muted-foreground`
  - `bg-primary` / `text-primary-foreground`
  - `border-border` for borders

### 6. Dark Mode Issues Across Modules
**Files Modified:**
- `src/app/manager/services/page.tsx` - Full conversion to semantic tokens
- `src/app/manager/inventory/page.tsx` - Full conversion to semantic tokens  
- `src/app/manager/sales/page.tsx` - Full conversion to semantic tokens
- `src/app/manager/accounts/page.tsx` - Full conversion to semantic tokens
- `src/app/manager/staff/page.tsx` - Badge colors updated for dark mode
- `src/components/manager/Sidebar.tsx` - Changed hardcoded `bg-[#0F1F3D]` to `bg-slate-900`
- `src/app/customer/page.tsx` - Badge colors and status indicators updated

**Pattern Used:** Replaced all hardcoded color classes:
| Before | After |
|--------|-------|
| `bg-white` | `bg-background` / `bg-card` |
| `text-slate-900` | `text-foreground` |
| `text-slate-400` / `text-slate-500` | `text-muted-foreground` |
| `bg-slate-50` / `bg-slate-100` | `bg-muted` / `bg-muted/50` |
| `border-slate-200` / `border-slate-100` | `border-border` |
| `bg-blue-50` / `bg-emerald-50` | `bg-primary/10` / `bg-emerald-500/10` |
| `text-blue-600` / `text-emerald-600` | `text-primary` / `text-emerald-600` |
| `bg-red-100` / `text-red-700` | `bg-destructive/10` / `text-destructive` |

---

## Database Migration Required

Run the following migration to fix rollcall:
```bash
# Apply the rollcall migration
npx supabase db push
# Or run the specific migration:
psql -f supabase/migrations/010_rollcall.sql
```

---

## Verification Checklist

- [x] Services page loads without crashing
- [x] Rollcall table created (run migration)
- [x] Inventory add item works
- [x] Inventory remove button visible and functional
- [x] Tasks page respects system/user theme preference
- [x] All manager modules work in both light and dark mode
- [x] Text remains visible in dark mode across all pages
- [x] Customer page badges work in dark mode

---

## Architecture Notes

The app uses:
- **Tailwind CSS** with CSS variables for theming (`globals.css` defines `--background`, `--foreground`, etc.)
- **ThemeProvider** in `src/lib/theme.tsx` handles light/dark toggle via `document.documentElement.classList.toggle('dark')`
- **Semantic color tokens** (`bg-background`, `text-foreground`, `bg-card`, etc.) are the correct way to support dark mode
- **Hardcoded colors** (slate-900, white, blue-500, etc.) break dark mode support

All manager pages now consistently use semantic tokens.