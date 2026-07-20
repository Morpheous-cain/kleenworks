"use client";

// src/app/manager/inventory/page.tsx
// Was missing — caused 404. Full wired inventory page below.

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Package, AlertTriangle, CheckCircle2, Plus, Loader2, RefreshCw, Trash2, PlusCircle, Check, ChevronDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

type InventoryItem = {
  id: string;
  name: string;
  stock: number;
  low_stock_threshold: number;
  unit: string;
  is_low_stock: boolean;
  updated_at: string;
};

export default function InventoryPage() {
  const { toast } = useToast();
  const [items, setItems]             = useState<InventoryItem[]>([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState<string | null>(null);
  const [restockItem, setRestockItem] = useState<InventoryItem | null>(null);
  const [restockQty, setRestockQty]   = useState("10");
  const [restocking, setRestocking]   = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [addItemName, setAddItemName] = useState("");
  const [addItemStock, setAddItemStock] = useState("0");
  const [addItemThreshold, setAddItemThreshold] = useState("5");
  const [addItemUnit, setAddItemUnit] = useState("units");
  const [adding, setAdding] = useState(false);
  const [removeIds, setRemoveIds] = useState<string[]>([]);
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false);
  const [removing, setRemoving] = useState(false);

  async function fetchInventory() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/inventory", { credentials: "include" });
      if (!res.ok) throw new Error((await res.json()).error ?? `HTTP ${res.status}`);
      setItems(await res.json());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load inventory");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchInventory(); }, []);

  async function handleRestock() {
    if (!restockItem) return;
    const qty = parseInt(restockQty);
    if (!qty || qty < 1) { toast({ title: "Enter a valid quantity", variant: "destructive" }); return; }
    setRestocking(true);
    try {
      const res = await fetch(`/api/inventory/${restockItem.id}/restock`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quantity: qty }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Restock failed");
      const updated = await res.json();
      toast({ title: "Restocked ✓", description: `${restockItem.name}: ${updated.previous_stock} → ${updated.stock} units` });
      setRestockItem(null);
      setRestockQty("10");
      fetchInventory();
    } catch (e: unknown) {
      toast({ title: "Restock failed", description: e instanceof Error ? e.message : "", variant: "destructive" });
    } finally {
      setRestocking(false);
    }
  }

  async function handleAddItem() {
    const name = addItemName.trim();
    if (!name) { toast({ title: "Enter item name", variant: "destructive" }); return; }
    setAdding(true);
    try {
      const res = await fetch("/api/inventory", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          quantity: parseInt(addItemStock) || 0,
          unit: addItemUnit,
          reorder_level: parseInt(addItemThreshold) || 5,
          cost_per_unit: 0,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Add failed");
      toast({ title: "Item added ✓", description: name });
      setAddDialogOpen(false);
      setAddItemName("");
      setAddItemStock("0");
      setAddItemThreshold("5");
      setAddItemUnit("units");
      fetchInventory();
    } catch (e: unknown) {
      toast({ title: "Add failed", description: e instanceof Error ? e.message : "", variant: "destructive" });
    } finally {
      setAdding(false);
    }
  }

  async function handleRemoveItems() {
    if (removeIds.length === 0) return;
    setRemoving(true);
    try {
      for (const id of removeIds) {
        const res = await fetch(`/api/inventory/${id}`, {
          method: "DELETE",
          credentials: "include",
        });
        if (!res.ok) throw new Error((await res.json()).error ?? `Failed to delete ${id}`);
      }
      toast({ title: "Removed ✓", description: `${removeIds.length} item(s) deleted` });
      setRemoveIds([]);
      setRemoveDialogOpen(false);
      fetchInventory();
    } catch (e: unknown) {
      toast({ title: "Remove failed", description: e instanceof Error ? e.message : "", variant: "destructive" });
    } finally {
      setRemoving(false);
    }
  }

  function toggleRemoveId(id: string) {
    setRemoveIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  }

  function handleSelectAll() {
    if (removeIds.length === items.length) {
      setRemoveIds([]);
    } else {
      setRemoveIds(items.map(i => i.id));
    }
  }

  const lowCount = items.filter((i) => i.is_low_stock).length;
  const okCount  = items.filter((i) => !i.is_low_stock).length;

  return (
    <div className="p-8 space-y-8 bg-background min-h-screen">
      <header className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Inventory</h1>
          <p className="text-muted-foreground">Stock levels and restock management</p>
        </div>
        <div className="flex gap-3">
          <Button onClick={fetchInventory} variant="outline" className="rounded-xl h-12 gap-2 bg-background">
            <RefreshCw className="size-4" /> Refresh
          </Button>
          <Button onClick={() => { setAddDialogOpen(true); }} className="rounded-xl h-12 gap-2">
            <PlusCircle className="size-4" /> Add Item
          </Button>
        </div>
      </header>

      {error && (
        <div className="bg-destructive/10 border-2 border-dashed border-destructive/20 rounded-3xl p-6 flex items-center gap-4">
          <AlertTriangle className="size-6 text-destructive" />
          <p className="text-destructive font-bold">{error}</p>
          <Button onClick={fetchInventory} className="ml-auto rounded-xl bg-destructive text-destructive-foreground border-none">Retry</Button>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { label: "Total Items",      value: loading ? "—" : items.length.toString(),  icon: Package,      color: "text-primary",    bg: "bg-primary/10"    },
          { label: "Low Stock",        value: loading ? "—" : lowCount.toString(),      icon: AlertTriangle,color: "text-destructive", bg: "bg-destructive/10" },
          { label: "Sufficient Stock", value: loading ? "—" : okCount.toString(),       icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-500/10" },
        ].map((kpi, i) => (
          <Card key={i} className="border-none shadow-sm rounded-[2rem]">
            <CardContent className="p-8">
              <div className={`size-12 ${kpi.bg} ${kpi.color} rounded-2xl flex items-center justify-center mb-6`}>
                <kpi.icon className="size-6" />
              </div>
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block">{kpi.label}</span>
              <div className="text-3xl font-black text-foreground">{kpi.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {!loading && lowCount > 0 && (
        <div className="bg-destructive/10 border-2 border-dashed border-destructive/20 rounded-[2rem] p-6 flex items-center gap-4">
          <AlertTriangle className="size-8 text-destructive shrink-0" />
          <div>
            <p className="font-black text-destructive uppercase">{lowCount} item{lowCount > 1 ? "s" : ""} running low</p>
            <p className="text-destructive/80 text-sm">Click the restock button on any item below to top up stock.</p>
          </div>
        </div>
      )}

      {/* Toolbar for bulk actions */}
      {removeIds.length > 0 && (
        <div className="bg-muted/50 border border-border rounded-2xl p-4 flex items-center justify-between">
          <span className="text-foreground font-medium">{removeIds.length} item(s) selected</span>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setRemoveIds([])} className="rounded-xl">Clear</Button>
            <Button variant="destructive" onClick={() => setRemoveDialogOpen(true)} disabled={removing} className="rounded-xl">
              <Trash2 className="size-4" /> Remove
            </Button>
          </div>
        </div>
      )}

      {/* Items grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => <div key={i} className="h-48 bg-card rounded-[2.5rem] animate-pulse" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {items.map((item) => {
            const pct = Math.min(100, Math.round((item.stock / Math.max(item.low_stock_threshold * 3, 1)) * 100));
            const selected = removeIds.includes(item.id);
            return (
              <Card key={item.id} className={cn("border-none shadow-sm rounded-[2.5rem] overflow-hidden transition-all", item.is_low_stock ? "ring-2 ring-destructive/20" : "", selected && "ring-2 ring-primary ring-offset-2")}>
                <CardContent className="p-8 space-y-6">
                  <div className="flex justify-between items-start">
                    <div className="size-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary">
                      <Package className="size-6" />
                    </div>
                    <Badge className={cn("border-none font-bold rounded-full px-3", item.is_low_stock ? "bg-destructive/10 text-destructive" : "bg-emerald-500/10 text-emerald-600")}>
                      {item.is_low_stock ? "Low Stock" : "OK"}
                    </Badge>
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-foreground uppercase">{item.name}</h3>
                    <p className="text-muted-foreground text-xs font-bold uppercase mt-1">Threshold: {item.low_stock_threshold} {item.unit ?? "units"}</p>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs font-bold text-muted-foreground uppercase">
                      <span>Stock Level</span>
                      <span className={item.is_low_stock ? "text-destructive" : "text-emerald-600"}>{item.stock} {item.unit ?? "units"}</span>
                    </div>
                    <Progress value={pct} className={cn("h-3 rounded-full bg-muted", item.is_low_stock ? "[&>div]:bg-destructive" : "[&>div]:bg-emerald-500")} />
                  </div>
                  <Button
                    onClick={() => { setRestockItem(item); setRestockQty("10"); }}
                    variant={item.is_low_stock ? "default" : "outline"}
                    className={cn("w-full rounded-2xl h-12 font-black uppercase text-xs tracking-widest gap-2", item.is_low_stock ? "shadow-lg shadow-primary/20" : "border-2 border-border")}
                  >
                    <Plus className="size-4" /> Restock
                  </Button>
                  <Button
                    variant={selected ? "default" : "outline"}
                    className="w-full rounded-2xl h-10 text-xs font-medium gap-2 border-border"
                    onClick={() => toggleRemoveId(item.id)}
                  >
                    {selected ? <Check className="size-3" /> : <Check className="size-3 opacity-0" />}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Restock dialog */}
      <Dialog open={!!restockItem} onOpenChange={(o) => !o && setRestockItem(null)}>
        <DialogContent className="rounded-[2rem] border-none shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-black uppercase">Restock — {restockItem?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-muted-foreground text-sm">Current stock: <strong>{restockItem?.stock} {restockItem?.unit ?? "units"}</strong></p>
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase text-muted-foreground">Quantity to add</label>
              <Input type="number" min="1" value={restockQty} onChange={(e) => setRestockQty(e.target.value)} className="rounded-xl h-12 border-2 text-lg font-black" />
            </div>
            <div className="bg-muted/50 rounded-2xl p-4">
              <p className="text-sm font-bold text-foreground">New stock will be: <span className="text-emerald-600 font-black text-lg">{(restockItem?.stock ?? 0) + (parseInt(restockQty) || 0)} {restockItem?.unit ?? "units"}</span></p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRestockItem(null)} className="rounded-xl">Cancel</Button>
            <Button onClick={handleRestock} disabled={restocking} className="rounded-xl gap-2">
              {restocking && <Loader2 className="size-4 animate-spin" />}
              {restocking ? "Restocking..." : "Confirm Restock"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add item dialog */}
      <Dialog open={addDialogOpen} onOpenChange={(o) => !o && setAddDialogOpen(false)}>
        <DialogContent className="rounded-[2rem] border-none shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-black uppercase">Add Inventory Item</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase text-muted-foreground">Item Name</label>
              <Input value={addItemName} onChange={(e) => setAddItemName(e.target.value)} placeholder="e.g. Shampoo, Wax, Microfiber" className="rounded-xl h-12 border-2 text-lg font-medium" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase text-muted-foreground">Initial Stock</label>
                <Input type="number" min="0" value={addItemStock} onChange={(e) => setAddItemStock(e.target.value)} className="rounded-xl h-12 border-2 text-lg font-black" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase text-muted-foreground">Low Stock Threshold</label>
                <Input type="number" min="1" value={addItemThreshold} onChange={(e) => setAddItemThreshold(e.target.value)} className="rounded-xl h-12 border-2 text-lg font-black" />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase text-muted-foreground">Unit</label>
              <Input value={addItemUnit} onChange={(e) => setAddItemUnit(e.target.value)} placeholder="units, liters, kg, etc." className="rounded-xl h-12 border-2 text-lg font-medium" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)} className="rounded-xl">Cancel</Button>
            <Button onClick={handleAddItem} disabled={adding} className="rounded-xl gap-2">
              {adding && <Loader2 className="size-4 animate-spin" />}
              {adding ? "Adding..." : "Add Item"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove confirmation dialog */}
      <Dialog open={removeDialogOpen} onOpenChange={(o) => !o && setRemoveDialogOpen(false)}>
        <DialogContent className="rounded-[2rem] border-none shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-black uppercase">Remove {removeIds.length} Item(s)?</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground py-4">This action cannot be undone. The selected inventory items will be permanently deleted.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemoveDialogOpen(false)} className="rounded-xl">Cancel</Button>
            <Button variant="destructive" onClick={handleRemoveItems} disabled={removing} className="rounded-xl gap-2">
              {removing && <Loader2 className="size-4 animate-spin" />}
              {removing ? "Removing..." : "Confirm Remove"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}