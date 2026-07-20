
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { PayrollRecord } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  CreditCard,
  Users,
  Banknote,
  ShieldCheck,
  Zap,
  Download,
  Send,
  AlertCircle,
  PlusCircle,
  Calculator,
  Check,
  ExternalLink,
  ShieldAlert,
  ArrowRight,
  X,
  Plus
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function PayrollPage() {
  const { toast } = useToast();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [records, setRecords] = useState<PayrollRecord[]>([]);
  const [staff, setStaff] = useState<{id: string, name: string, base_salary: number}[]>([]);

  // Modal States
  const [editingRecord, setEditingRecord] = useState<any>(null);
  const [confirmingDisburse, setConfirmingDisburse] = useState<any>(null);
  const [creatingRecord, setCreatingRecord] = useState(false);
  const [newRecordForm, setNewRecordForm] = useState({ staffId: '', month: '', baseAmount: '', commission: '0', deductions: '0' });

  // Form States
  const [advanceAmount, setAdvanceAmount] = useState<string>("0");
  const [adjustmentType, setAdjustmentType] = useState<'Advance' | 'Liability'>('Advance');

  useEffect(() => {
    setMounted(true);
    fetch('/api/payroll', { credentials: 'include' })
      .then(r => r.json())
      .then(data => setRecords(data))
      .catch(() => {});

    // Fetch staff for creating new payroll records
    fetch('/api/staff', { credentials: 'include' })
      .then(r => r.json())
      .then(data => setStaff(data.filter((s: any) => s.base_salary)))
      .catch(() => {});
  }, []);

  const totalPayroll = records.reduce((acc, r) => acc + r.netPay, 0);

  const handleApprove = async (id: string) => {
    await fetch(`/api/payroll/${id}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'Approved' }),
    });
    setRecords(prev => prev.map(r => r.id === id ? { ...r, status: 'Approved' as const } : r));
    toast({
      title: "Payroll Approved",
      description: "Record cleared for M-Pesa disbursement.",
    });
  };

  const handleDisburse = async () => {
    if (!confirmingDisburse) return;
    await fetch(`/api/payroll/${confirmingDisburse.id}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'Disbursed' }),
    });
    setRecords(prev => prev.map(r => r.id === confirmingDisburse.id ? { ...r, status: 'Disbursed' as const } : r));
    toast({
      title: "M-Pesa Push Successful",
      description: `KES ${confirmingDisburse.netPay.toLocaleString()} disbursed to ${confirmingDisburse.staffName}.`,
    });
    setConfirmingDisburse(null);
  };

  const handleUpdateDeductions = () => {
    if (!editingRecord) return;

    const amount = parseFloat(advanceAmount) || 0;
    const updatedRecords = records.map(r => {
      if (r.id === editingRecord.id) {
        const totalDeductions = r.deductions + amount;
        const newNetPay = (r.baseAmount + r.commission) - totalDeductions;
        return {
          ...r,
          deductions: totalDeductions,
          netPay: newNetPay,
          status: 'Draft' as const
        };
      }
      return r;
    });

    setRecords(updatedRecords);
    toast({
      title: adjustmentType === 'Advance' ? "Advance Ledgered" : "Liability Recorded",
      description: `KES ${amount.toLocaleString()} has been adjusted. New approval required.`,
    });
    setEditingRecord(null);
    setAdvanceAmount("0");
  };

  const handleCreatePayrollRecord = async () => {
    const staffMember = staff.find(s => s.id === newRecordForm.staffId);
    if (!staffMember) return;

    try {
      const res = await fetch('/api/payroll', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          staff_id: newRecordForm.staffId,
          month: newRecordForm.month,
          base_amount: Number(newRecordForm.baseAmount) || staffMember.base_salary,
          commission: Number(newRecordForm.commission) || 0,
          deductions: Number(newRecordForm.deductions) || 0,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? 'Create failed');
      }

      const data = await res.json();
      setRecords(prev => [...prev, data]);
      toast({ title: "Payroll Record Created", description: `Record for ${staffMember.name} added.` });
      setCreatingRecord(false);
      setNewRecordForm({ staffId: '', month: '', baseAmount: '', commission: '0', deductions: '0' });
    } catch (e: unknown) {
      toast({ title: "Failed", description: e instanceof Error ? e.message : 'Could not create', variant: "destructive" });
    }
  };

  if (!mounted) return null;

  return (
    <div className="p-8 space-y-8 bg-[#f1f5f9] min-h-screen font-body">
      <header className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tighter">Payroll Command</h1>
          <p className="text-slate-500 font-black uppercase text-[10px] tracking-[0.2em] mt-1">Salary Disbursement & M-Pesa Payouts</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" className="rounded-2xl h-14 gap-3 bg-white border-none shadow-xl font-black uppercase text-[11px] tracking-widest" onClick={() => toast({ title: "Export Engine", description: "Compiling payslips for all staff..."})}>
            <Download className="size-4" /> Export Payslips
          </Button>
          <Button
            className="rounded-2xl h-14 gap-3 shadow-2xl shadow-primary/30 px-8 font-black uppercase text-[11px] tracking-widest bg-primary hover:bg-blue-600 transition-all text-white border-none"
            onClick={() => toast({ title: "Batch Processing", description: "Disbursing all approved payments via Daraja..." })}
          >
            <Send className="size-4" /> Batch Disburse
          </Button>
          <Button
            variant="outline"
            className="rounded-2xl h-14 gap-3 border-2 border-primary text-primary hover:bg-primary/5 transition-all"
            onClick={() => setCreatingRecord(true)}
          >
            <Plus className="size-4" /> Add Payroll Record
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[
          { label: "Total Payroll (MTD)", value: `KES ${totalPayroll.toLocaleString()}`, icon: Banknote, color: "text-blue-600", bg: "bg-blue-50" },
          { label: "Employees Paid", value: `${records.filter(r => r.status === 'Disbursed').length}/${records.length}`, icon: Users, color: "text-emerald-600", bg: "bg-emerald-50" },
          { label: "Payout Limit", value: "92%", icon: Zap, color: "text-amber-600", bg: "bg-amber-50" },
        ].map((kpi, i) => (
          <Card key={i} className="border-none shadow-xl rounded-[2.5rem] overflow-hidden group bg-white">
            <CardContent className="p-8">
              <div className="flex justify-between items-start mb-6">
                <div className={cn(`size-14 ${kpi.bg} ${kpi.color} rounded-2xl flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform`)}>
                  <kpi.icon className="size-7" />
                </div>
                <Badge className="bg-slate-50 text-slate-400 border-none font-black text-[9px] uppercase tracking-widest rounded-full px-3 py-1">LIVE</Badge>
              </div>
              <div className="space-y-1">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{kpi.label}</span>
                <div className="text-3xl font-black text-slate-900 tracking-tighter leading-none">{kpi.value}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-none shadow-sm rounded-[2.5rem] bg-white overflow-hidden">
        <CardHeader className="p-8 border-b bg-slate-50/50">
          <div className="flex justify-between items-center">
            <div>
              <CardTitle className="text-xl font-black uppercase tracking-tight">Salary Disbursement Registry</CardTitle>
              <CardDescription className="text-[10px] font-black uppercase text-slate-400 tracking-widest">May 2024 Cycle • Real-time status</CardDescription>
            </div>
            <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100 flex items-center gap-3">
              <div className="size-8 bg-emerald-500 rounded-lg flex items-center justify-center text-white shadow-lg">
                <CreditCard className="size-4" />
              </div>
              <div className="flex flex-col">
                <span className="text-[8px] font-black text-emerald-600 uppercase">Daraja Gateway Balance</span>
                <span className="text-sm font-black text-emerald-700">KES 0</span>
              </div>
            </div>
          </div>
        </CardHeader>
        <Table>
          <TableHeader className="bg-slate-50/50 h-16">
            <TableRow className="border-none">
              <TableHead className="pl-8 uppercase text-[10px] font-black tracking-widest">Employee Profile</TableHead>
              <TableHead className="uppercase text-[10px] font-black tracking-widest">Base Salary</TableHead>
              <TableHead className="uppercase text-[10px] font-black tracking-widest">Comm. & Bonus</TableHead>
              <TableHead className="uppercase text-[10px] font-black tracking-widest text-red-500">Deductions</TableHead>
              <TableHead className="uppercase text-[10px] font-black tracking-widest">Net Pay</TableHead>
              <TableHead className="uppercase text-[10px] font-black tracking-widest">Auth Status</TableHead>
              <TableHead className="pr-8 text-right uppercase text-[10px] font-black tracking-widest">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {records.map((r) => (
              <TableRow key={r.id} className="h-20 border-slate-50 hover:bg-slate-50/80 transition-colors group">
                <TableCell className="pl-8">
                  <div 
                    className="flex flex-col cursor-pointer group/link"
                    onClick={() => router.push(`/manager/staff?id=${r.staffId}`)}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-black text-slate-900 uppercase group-hover/link:text-primary transition-colors">{r.staffName}</span>
                      <ExternalLink className="size-3 text-slate-300 opacity-0 group-hover/link:opacity-100 transition-opacity" />
                    </div>
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">ID: {r.staffId} • View Account</span>
                  </div>
                </TableCell>
                <TableCell className="font-bold text-slate-600">KES {r.baseAmount.toLocaleString()}</TableCell>
                <TableCell className="font-bold text-emerald-600 tracking-tight">+ {r.commission.toLocaleString()}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-red-400">- {r.deductions.toLocaleString()}</span>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="size-8 rounded-full text-slate-300 hover:text-red-500 hover:bg-red-50"
                      onClick={() => {
                        setEditingRecord(r);
                        setAdvanceAmount("0");
                      }}
                    >
                      <PlusCircle className="size-4" />
                    </Button>
                  </div>
                </TableCell>
                <TableCell className="font-black text-slate-900 tracking-tighter">KES {r.netPay.toLocaleString()}</TableCell>
                <TableCell>
                  <Badge className={cn(
                    "font-black text-[9px] uppercase border-none px-4 py-1.5 tracking-widest shadow-sm",
                    r.status === 'Disbursed' ? "bg-emerald-500 text-white" : 
                    r.status === 'Approved' ? "bg-blue-500 text-white" : "bg-slate-200 text-slate-500"
                  )}>
                    {r.status}
                  </Badge>
                </TableCell>
                <TableCell className="pr-8 text-right">
                  {r.status === 'Draft' ? (
                    <Button 
                      size="sm" 
                      className="rounded-xl h-10 font-black text-[9px] uppercase tracking-widest gap-2 bg-slate-900 text-white hover:bg-black border-none"
                      onClick={() => handleApprove(r.id)}
                    >
                      <ShieldCheck className="size-3" /> Approve
                    </Button>
                  ) : r.status === 'Approved' ? (
                    <Button 
                      size="sm" 
                      variant="outline"
                      className="rounded-xl h-10 font-black text-[9px] uppercase tracking-widest gap-2 border-2 border-emerald-500 text-emerald-600 hover:bg-emerald-50"
                      onClick={() => setConfirmingDisburse(r)}
                    >
                      <Send className="size-3" /> Disburse
                    </Button>
                  ) : (
                    <div className="inline-flex items-center h-10 px-4 text-[9px] font-black text-emerald-600 bg-emerald-50 rounded-xl tracking-[0.1em]">
                      <Check className="size-3 mr-2" /> PAID VIA DARJA
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {/* Deduction Management Modal */}
      <Dialog open={!!editingRecord} onOpenChange={(open) => !open && setEditingRecord(null)}>
        <DialogContent className="rounded-[2.5rem] p-0 overflow-hidden border-none shadow-2xl bg-white max-w-md">
          <div className="p-8 bg-slate-900 text-white relative">
            <button onClick={() => setEditingRecord(null)} className="absolute top-6 right-6 text-slate-400 hover:text-white transition-colors">
              <X className="size-5" />
            </button>
            <div className="flex items-center gap-4 mb-2">
              <div className="size-12 bg-primary rounded-2xl flex items-center justify-center">
                <Calculator className="size-6 text-white" />
              </div>
              <DialogTitle className="text-2xl font-black uppercase tracking-tight">Ledger Adjustment</DialogTitle>
            </div>
            <DialogDescription className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">
              Recording deductions for {editingRecord?.staffName}
            </DialogDescription>
          </div>
          <div className="p-8 space-y-6">
            <div className="space-y-3">
              <Label className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">Adjustment Type</Label>
              <div className="grid grid-cols-2 gap-2">
                <Button 
                  variant="outline" 
                  className={cn(
                    "h-12 rounded-xl font-black text-[9px] uppercase border-2 transition-all",
                    adjustmentType === 'Advance' ? "border-primary text-primary bg-primary/5" : "border-slate-100 text-slate-400"
                  )}
                  onClick={() => setAdjustmentType('Advance')}
                >
                  Salary Advance
                </Button>
                <Button 
                  variant="outline" 
                  className={cn(
                    "h-12 rounded-xl font-black text-[9px] uppercase border-2 transition-all",
                    adjustmentType === 'Liability' ? "border-red-500 text-red-500 bg-red-50" : "border-slate-100 text-slate-400"
                  )}
                  onClick={() => setAdjustmentType('Liability')}
                >
                  Liability / Loss
                </Button>
              </div>
            </div>
            <div className="space-y-3">
              <Label className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">Amount to Ledger (KES)</Label>
              <Input 
                type="number" 
                value={advanceAmount}
                onChange={(e) => setAdvanceAmount(e.target.value)}
                placeholder="0.00" 
                className="h-16 rounded-2xl border-4 border-slate-50 bg-slate-50 text-3xl font-black text-slate-900 focus:bg-white focus:border-primary transition-all text-center" 
              />
            </div>
            <div className="p-6 bg-slate-900 text-white rounded-[2rem] border border-white/5 flex items-center gap-4 shadow-2xl">
              <div className="size-12 bg-white/10 rounded-xl flex items-center justify-center">
                <ShieldAlert className="size-6 text-primary" />
              </div>
              <div className="flex-1">
                <span className="text-[8px] font-black text-slate-500 uppercase block mb-1 tracking-widest">Adjusted Net Pay</span>
                <span className="text-2xl font-black italic tracking-tighter">
                  KES {((editingRecord?.baseAmount || 0) + (editingRecord?.commission || 0) - (editingRecord?.deductions || 0) - (parseFloat(advanceAmount) || 0)).toLocaleString()}
                </span>
              </div>
            </div>
          </div>
          <DialogFooter className="p-8 bg-slate-50 gap-3">
            <Button 
              className="h-16 rounded-2xl flex-1 font-black uppercase text-xs tracking-widest shadow-2xl shadow-primary/30 bg-primary hover:bg-blue-600 transition-all text-white border-none" 
              onClick={handleUpdateDeductions}
            >
              <Check className="size-5 mr-3" /> Commit to Ledger
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* M-Pesa Disbursement Confirmation Modal */}
      <AlertDialog open={!!confirmingDisburse} onOpenChange={(open) => !open && setConfirmingDisburse(null)}>
        <AlertDialogContent className="rounded-[2.5rem] p-0 overflow-hidden border-none shadow-2xl bg-white max-w-md">
          <div className="p-8 bg-slate-900 text-white">
            <div className="flex items-center gap-4 mb-2">
              <div className="size-12 bg-emerald-500 rounded-2xl flex items-center justify-center shadow-xl shadow-emerald-500/20">
                <CreditCard className="size-6 text-white" />
              </div>
              <AlertDialogTitle className="text-2xl font-black uppercase tracking-tight leading-none">M-Pesa Gateway Confirmation</AlertDialogTitle>
            </div>
            <AlertDialogDescription className="text-slate-400 font-bold uppercase text-[10px] tracking-widest mt-1">
              Authorized Secure Disbursement Protocol
            </AlertDialogDescription>
          </div>
          <div className="p-8 space-y-6">
            <div className="space-y-4">
              <div className="flex justify-between items-center text-sm font-bold text-slate-500 uppercase">
                <span>Recipient</span>
                <span className="text-slate-900">{confirmingDisburse?.staffName}</span>
              </div>
              <div className="flex justify-between items-center text-sm font-bold text-slate-500 uppercase">
                <span>Mobile Wallet</span>
                <span className="text-slate-900 font-mono">+254 7XX XXX XXX</span>
              </div>
              <div className="pt-4 border-t-2 border-dashed border-slate-100 flex justify-between items-center">
                <span className="text-lg font-black text-slate-900 uppercase italic">Net Transfer</span>
                <span className="text-3xl font-black text-emerald-600 tracking-tighter">KES {confirmingDisburse?.netPay.toLocaleString()}</span>
              </div>
            </div>
            <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100 flex items-start gap-3">
              <AlertCircle className="size-5 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-[9px] font-bold text-amber-700 uppercase leading-relaxed">
                This action is IRREVERSIBLE. Funds will be pushed immediately to the employee's Daraja-linked account.
              </p>
            </div>
          </div>
          <AlertDialogFooter className="p-8 bg-slate-50 gap-3">
            <AlertDialogCancel className="h-14 rounded-2xl flex-1 font-black uppercase text-[10px] tracking-widest border-2 bg-white hover:bg-slate-100 border-slate-200">Abort</AlertDialogCancel>
            <AlertDialogAction 
              className="h-14 rounded-2xl flex-[2] font-black uppercase text-[10px] tracking-widest shadow-xl shadow-emerald-500/20 bg-emerald-600 hover:bg-emerald-700 text-white border-none"
              onClick={handleDisburse}
            >
              Confirm & Disburse <ArrowRight className="size-4 ml-2" />
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Create Payroll Record Modal */}
      <Dialog open={creatingRecord} onOpenChange={(open) => !open && setCreatingRecord(false)}>
        <DialogContent className="rounded-[2.5rem] p-0 overflow-hidden border-none shadow-2xl bg-white max-w-md">
          <div className="p-8 bg-slate-900 text-white relative">
            <button onClick={() => setCreatingRecord(false)} className="absolute top-6 right-6 text-slate-400 hover:text-white transition-colors">
              <X className="size-5" />
            </button>
            <div className="flex items-center gap-4 mb-2">
              <div className="size-12 bg-primary rounded-2xl flex items-center justify-center">
                <PlusCircle className="size-6 text-white" />
              </div>
              <DialogTitle className="text-2xl font-black uppercase tracking-tight">Create Payroll Record</DialogTitle>
            </div>
            <DialogDescription className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">
              Add new payroll entry for staff member
            </DialogDescription>
          </div>
          <div className="p-8 space-y-6">
            <div className="space-y-3">
              <Label className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">Staff Member</Label>
              <Select value={newRecordForm.staffId} onValueChange={(v) => setNewRecordForm({...newRecordForm, staffId: v})}>
                <SelectTrigger className="h-12 rounded-xl font-black text-lg border-2 bg-muted/50 focus:bg-background transition-all">
                  <SelectValue placeholder="Select staff" />
                </SelectTrigger>
                <SelectContent>
                  {staff.map((s) => (
                    <SelectItem key={s.id} value={s.id} className="capitalize text-sm">
                      {s.name} (KES {s.base_salary.toLocaleString()}/mo)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-3">
              <Label className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">Month</Label>
              <Input
                type="month"
                value={newRecordForm.month}
                onChange={(e) => setNewRecordForm({...newRecordForm, month: e.target.value})}
                className="h-12 rounded-xl font-black text-lg border-2 bg-muted/50 focus:bg-background transition-all"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-3">
                <Label className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">Base Amount (KES)</Label>
                <Input
                  type="number"
                  value={newRecordForm.baseAmount}
                  onChange={(e) => setNewRecordForm({...newRecordForm, baseAmount: e.target.value})}
                  placeholder="Auto-filled from staff"
                  className="h-12 rounded-xl font-black text-lg border-2 bg-muted/50 focus:bg-background transition-all text-center"
                />
              </div>
              <div className="space-y-3">
                <Label className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">Commission (KES)</Label>
                <Input
                  type="number"
                  value={newRecordForm.commission}
                  onChange={(e) => setNewRecordForm({...newRecordForm, commission: e.target.value})}
                  placeholder="0"
                  className="h-12 rounded-xl font-black text-lg border-2 bg-muted/50 focus:bg-background transition-all text-center"
                />
              </div>
            </div>
            <div className="space-y-3">
              <Label className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">Deductions (KES)</Label>
              <Input
                type="number"
                value={newRecordForm.deductions}
                onChange={(e) => setNewRecordForm({...newRecordForm, deductions: e.target.value})}
                placeholder="0"
                className="h-12 rounded-xl font-black text-lg border-2 bg-muted/50 focus:bg-background transition-all text-center"
              />
            </div>
            <div className="p-6 bg-slate-900 text-white rounded-[2rem] border border-white/5 flex items-center gap-4 shadow-2xl">
              <div className="size-12 bg-white/10 rounded-xl flex items-center justify-center">
                <Calculator className="size-6 text-primary" />
              </div>
              <div className="flex-1">
                <span className="text-[8px] font-black text-slate-500 uppercase block mb-1 tracking-widest">Estimated Net Pay</span>
                <span className="text-2xl font-black italic tracking-tighter">
                  KES {((parseFloat(newRecordForm.baseAmount) || 0) + (parseFloat(newRecordForm.commission) || 0) - (parseFloat(newRecordForm.deductions) || 0)).toLocaleString()}
                </span>
              </div>
            </div>
          </div>
          <DialogFooter className="p-8 bg-slate-50 gap-3">
            <Button variant="outline" className="h-16 rounded-2xl flex-1 font-black uppercase text-xs tracking-widest border-2" onClick={() => { setCreatingRecord(false); setNewRecordForm({ staffId: '', month: '', baseAmount: '', commission: '0', deductions: '0' }); }}>Cancel</Button>
            <Button className="h-16 rounded-2xl flex-[2] font-black uppercase text-xs tracking-widest shadow-2xl shadow-primary/30 bg-primary hover:bg-blue-600 transition-all text-white border-none" onClick={handleCreatePayrollRecord}>
              <Check className="size-5 mr-3" /> Create Record
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
