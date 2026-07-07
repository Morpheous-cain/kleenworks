"use client"

// src/app/customer/page.tsx
//
// v2 — adds a real Book-a-Wash flow (service picker → branch → time
// slot → confirm) backed by POST /api/bookings, on top of the existing
// vehicle tracker and history tabs. Visual pass: sticky header with
// avatar initial, bottom tab bar instead of the old in-page TabsList,
// and an "Upcoming" card so a customer immediately sees their next
// booking without digging into a tab.

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useToast } from "@/hooks/use-toast"
import {
  Search,
  Car,
  MapPin,
  User,
  Star,
  History,
  CalendarPlus,
  RefreshCw,
  Check,
  ChevronRight,
  Clock,
  Droplets,
} from "lucide-react"

interface AuthCtx {
  userId: string
  email: string
  role: string
  branch_id: string
}

interface Bay { id: string; name: string }
interface AttendantRef { id: string; name: string }

interface Vehicle {
  id: string
  plate: string
  status: "Queue" | "In-Bay" | "Ready" | "Completed"
  progress: number
  services: string[]
  arrival_time: string
  bay: Bay | null
  attendant: AttendantRef | null
}

interface Transaction {
  id: string
  date: string
  plate: string
  services: string[]
  amount: number | string
  status: "Paid" | "Pending"
  payment_method: string
  mpesa_receipt: string | null
}

interface Customer {
  id: string
  name: string
  loyalty_points: number
  subscription_tier: string
  total_spent: number
  total_visits: number
}

interface Service {
  id: string
  name: string
  category: string
  price: number
  duration: number
  usp: string
}

interface Branch {
  id: string
  name: string
  location: string | null
  status: string
}

interface Booking {
  id: string
  plate: string
  status: string
  services: string[]
  total_amount: number
  scheduled_for: string
  created_at: string
}

type TabKey = "track" | "book" | "history"

function txStatusClass(status: string) {
  return status === "Paid"
    ? "bg-emerald-100 text-emerald-700"
    : "bg-amber-100 text-amber-700"
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("en-KE", {
      day: "numeric", month: "short", year: "numeric",
    })
  } catch { return iso }
}

function formatDateTime(iso: string) {
  try {
    return new Date(iso).toLocaleString("en-KE", {
      day: "numeric", month: "short", hour: "numeric", minute: "2-digit",
    })
  } catch { return iso }
}

const STATUS_STEPS = ["Queue", "In-Bay", "Ready"]
function stepIndex(status: string) { return STATUS_STEPS.indexOf(status) }

function generateSlots() {
  const days: { date: Date; label: string }[] = []
  for (let i = 0; i < 7; i++) {
    const d = new Date()
    d.setDate(d.getDate() + i)
    days.push({
      date: d,
      label: i === 0 ? "Today" : i === 1 ? "Tomorrow" : d.toLocaleDateString("en-KE", { weekday: "short", day: "numeric" }),
    })
  }
  return days
}
const TIME_SLOTS = ["09:00", "11:00", "13:00", "15:00", "17:00"]

export default function CustomerPage() {
  const { toast } = useToast()

  const [ctx, setCtx] = useState<AuthCtx | null>(null)
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [activeTab, setActiveTab] = useState<TabKey>("track")

  const [searchPlate, setSearchPlate] = useState("")
  const [vehicle, setVehicle] = useState<Vehicle | null>(null)
  const [trackLoading, setTrackLoading] = useState(false)

  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [txLoading, setTxLoading] = useState(true)

  const [services, setServices] = useState<Service[]>([])
  const [branches, setBranches] = useState<Branch[]>([])
  const [bookings, setBookings] = useState<Booking[]>([])
  const [bookStep, setBookStep] = useState<1 | 2 | 3 | 4>(1)
  const [selectedServices, setSelectedServices] = useState<Service[]>([])
  const [selectedBranch, setSelectedBranch] = useState<Branch | null>(null)
  const [selectedDay, setSelectedDay] = useState(0)
  const [selectedTime, setSelectedTime] = useState<string | null>(null)
  const [bookingPlate, setBookingPlate] = useState("")
  const [submittingBooking, setSubmittingBooking] = useState(false)

  const days = generateSlots()

  useEffect(() => {
    fetch("/api/auth/me", { credentials: "include" })
      .then((r) => r.json())
      .then((me: AuthCtx) => {
        setCtx(me)
        if (me.role === "customer" && me.userId) {
          fetch(`/api/customers?user_id=${me.userId}`, { credentials: "include" })
            .then((r) => r.json())
            .then((data) => {
              const c = Array.isArray(data) ? data[0] : data
              if (c) setCustomer(c)
            }).catch(() => {})
        }
      })
      .catch(() => {})

    fetch("/api/transactions?limit=20", { credentials: "include" })
      .then((r) => r.json())
      .then((data) => { setTransactions(data.data ?? []); setTxLoading(false) })
      .catch(() => setTxLoading(false))

    fetch("/api/services").then((r) => r.json()).then((d) => setServices(Array.isArray(d) ? d : [])).catch(() => {})
    fetch("/api/branches", { credentials: "include" }).then((r) => r.json()).then((d) => setBranches(Array.isArray(d) ? d : [])).catch(() => {})
    refreshBookings()
  }, [])

  function refreshBookings() {
    fetch("/api/bookings", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => setBookings(Array.isArray(d) ? d : []))
      .catch(() => {})
  }

  async function handleSearch(plateParam?: string) {
    const plate = (plateParam ?? searchPlate).toUpperCase().trim()
    if (!plate) return
    setTrackLoading(true); setVehicle(null)
    try {
      const res = await fetch(`/api/vehicles?plate=${encodeURIComponent(plate)}`, { credentials: "include" })
      if (!res.ok) {
        toast({ title: "Search failed", description: `HTTP ${res.status}`, variant: "destructive" })
        return
      }
      const data = await res.json()
      const match: Vehicle | null = Array.isArray(data)
        ? data.find((v: Vehicle) => v.plate === plate && v.status !== "Completed") ?? null
        : null
      setVehicle(match)
      if (!match) toast({ title: "Not found", description: "No active vehicle with that plate number" })
    } catch {
      toast({ title: "Network error", variant: "destructive" })
    } finally {
      setTrackLoading(false)
    }
  }

  function toggleService(svc: Service) {
    setSelectedServices((prev) =>
      prev.some((s) => s.id === svc.id) ? prev.filter((s) => s.id !== svc.id) : [...prev, svc]
    )
  }
  const bookingTotal = selectedServices.reduce((sum, s) => sum + s.price, 0)

  function resetBookingFlow() {
    setBookStep(1); setSelectedServices([]); setSelectedBranch(null)
    setSelectedDay(0); setSelectedTime(null); setBookingPlate("")
  }

  async function submitBooking() {
    if (!selectedBranch || !selectedTime || !bookingPlate.trim() || selectedServices.length === 0) return
    setSubmittingBooking(true)
    try {
      const scheduledDate = days[selectedDay].date
      const [hh, mm] = selectedTime.split(":").map(Number)
      scheduledDate.setHours(hh, mm, 0, 0)

      const res = await fetch("/api/bookings", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plate:          bookingPlate,
          branch_id:      selectedBranch.id,
          service_ids:    selectedServices.map((s) => s.id),
          service_names:  selectedServices.map((s) => s.name),
          total_amount:   bookingTotal,
          scheduled_for:  scheduledDate.toISOString(),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast({ title: "Couldn't book", description: data.error ?? "Please try again", variant: "destructive" })
        return
      }
      toast({ title: "Booking confirmed!", description: `${selectedBranch.name} - ${formatDateTime(scheduledDate.toISOString())}` })
      refreshBookings()
      resetBookingFlow()
      setActiveTab("track")
    } catch {
      toast({ title: "Network error", variant: "destructive" })
    } finally {
      setSubmittingBooking(false)
    }
  }

  const loyaltyPoints = customer?.loyalty_points ?? 0
  const loyaltyProgress = Math.min(100, (loyaltyPoints / 2000) * 100)
  const nextBooking = bookings.find((b) => b.status !== "Completed" && new Date(b.scheduled_for) >= new Date())

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <div className="sticky top-0 z-30 bg-white border-b border-slate-100 px-4 sm:px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-slate-900 text-white flex items-center justify-center font-semibold text-sm">
            {(customer?.name ?? ctx?.email ?? "C").charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="text-sm font-semibold leading-tight">{customer?.name ?? "Welcome"}</p>
            <p className="text-xs text-muted-foreground leading-tight">{customer?.subscription_tier ?? "None"} Member</p>
          </div>
        </div>
        <Badge variant="outline" className="gap-1.5 border-amber-200 bg-amber-50 text-amber-700">
          <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
          {loyaltyPoints.toLocaleString("en-KE")}
        </Badge>
      </div>

      <div className="p-4 sm:p-6 space-y-5 max-w-3xl mx-auto">

        <Card className="rounded-3xl bg-gradient-to-br from-slate-900 to-slate-700 text-white border-0">
          <CardContent className="pt-6 pb-6 space-y-3">
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-bold">{loyaltyPoints.toLocaleString("en-KE")} <span className="text-sm font-normal text-slate-400">pts</span></span>
              <span className="text-xs text-slate-400">{loyaltyPoints}/2,000 to next tier</span>
            </div>
            <div className="h-2 bg-slate-600 rounded-full overflow-hidden">
              <div className="h-full bg-amber-400 rounded-full transition-all duration-500" style={{ width: `${loyaltyProgress}%` }} />
            </div>
          </CardContent>
        </Card>

        {nextBooking && (
          <Card className="rounded-3xl border-emerald-200 bg-emerald-50/60">
            <CardContent className="py-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500 text-white flex items-center justify-center shrink-0">
                <CalendarPlus className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-emerald-900">Upcoming wash - {nextBooking.plate}</p>
                <p className="text-xs text-emerald-700">{formatDateTime(nextBooking.scheduled_for)} - {nextBooking.services.join(", ")}</p>
              </div>
              <ChevronRight className="w-4 h-4 text-emerald-600 shrink-0" />
            </CardContent>
          </Card>
        )}

        {activeTab === "track" && (
          <Card className="rounded-3xl">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Track Your Vehicle</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <Input
                  placeholder="e.g. KDG 123A"
                  value={searchPlate}
                  onChange={(e) => setSearchPlate(e.target.value.toUpperCase())}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  className="font-mono uppercase"
                />
                <Button onClick={() => handleSearch()} disabled={trackLoading || !searchPlate.trim()}>
                  {trackLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                </Button>
              </div>

              {vehicle && (
                <div className="space-y-4 pt-2">
                  <div className="flex items-center gap-0">
                    {STATUS_STEPS.map((step, i) => {
                      const active = stepIndex(vehicle.status) >= i
                      const current = vehicle.status === step
                      return (
                        <div key={step} className="flex items-center flex-1">
                          <div className="flex flex-col items-center gap-1 flex-1">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                              active ? (current ? "bg-blue-500 text-white ring-2 ring-blue-200" : "bg-emerald-500 text-white") : "bg-slate-100 text-slate-400"
                            }`}>{i + 1}</div>
                            <span className={`text-xs ${active ? "font-medium" : "text-muted-foreground"}`}>{step}</span>
                          </div>
                          {i < STATUS_STEPS.length - 1 && (
                            <div className={`h-0.5 w-full mb-5 transition-colors ${stepIndex(vehicle.status) > i ? "bg-emerald-400" : "bg-slate-100"}`} />
                          )}
                        </div>
                      )
                    })}
                  </div>

                  <div className="bg-slate-50 rounded-2xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-lg">{vehicle.plate}</span>
                      <Badge className={vehicle.status === "Ready" ? "bg-emerald-100 text-emerald-700" : "bg-blue-100 text-blue-700"}>
                        {vehicle.status === "Ready" ? "Ready!" : `${vehicle.progress ?? 0}% complete`}
                      </Badge>
                    </div>
                    <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${vehicle.status === "Ready" ? "bg-emerald-400" : "bg-blue-400"}`}
                        style={{ width: vehicle.status === "Ready" ? "100%" : `${vehicle.progress ?? 0}%` }} />
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <MapPin className="w-3.5 h-3.5" />{vehicle.bay?.name ?? "Assigned"}
                      </div>
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <User className="w-3.5 h-3.5" />{vehicle.attendant?.name ?? "Assigned"}
                      </div>
                    </div>
                    <div className="text-sm">
                      <span className="text-muted-foreground">Services: </span>
                      {Array.isArray(vehicle.services) ? vehicle.services.join(", ") : vehicle.services}
                    </div>
                    {vehicle.status === "Ready" && (
                      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-sm text-emerald-800 font-medium text-center">
                        Your vehicle is ready for collection!
                      </div>
                    )}
                  </div>
                </div>
              )}

              {!vehicle && (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  <Car className="w-8 h-8 mx-auto mb-2 opacity-20" />
                  Enter a plate number to see live status
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {activeTab === "book" && (
          <Card className="rounded-3xl">
            <CardHeader className="pb-2 flex-row items-center justify-between">
              <CardTitle className="text-base">Book a Wash</CardTitle>
              {bookStep > 1 && (
                <button onClick={resetBookingFlow} className="text-xs text-muted-foreground underline">Start over</button>
              )}
            </CardHeader>
            <CardContent className="space-y-4">

              <div className="flex items-center gap-1.5">
                {[1, 2, 3, 4].map((s) => (
                  <div key={s} className={`h-1 flex-1 rounded-full ${bookStep >= s ? "bg-slate-900" : "bg-slate-100"}`} />
                ))}
              </div>

              {bookStep === 1 && (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">Choose one or more services</p>
                  <div className="space-y-2">
                    {services.map((svc) => {
                      const checked = selectedServices.some((s) => s.id === svc.id)
                      return (
                        <button
                          key={svc.id}
                          onClick={() => toggleService(svc)}
                          className={`w-full flex items-center justify-between p-3 rounded-2xl border text-left transition-colors ${
                            checked ? "border-slate-900 bg-slate-50" : "border-slate-100"
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-5 h-5 rounded-full flex items-center justify-center border ${checked ? "bg-slate-900 border-slate-900" : "border-slate-300"}`}>
                              {checked && <Check className="w-3 h-3 text-white" />}
                            </div>
                            <div>
                              <p className="text-sm font-medium">{svc.name}</p>
                              <p className="text-xs text-muted-foreground">{svc.usp}</p>
                            </div>
                          </div>
                          <span className="text-sm font-semibold whitespace-nowrap">KSh {svc.price.toLocaleString("en-KE")}</span>
                        </button>
                      )
                    })}
                  </div>
                  <Button className="w-full" disabled={selectedServices.length === 0} onClick={() => setBookStep(2)}>
                    Continue ({selectedServices.length} selected - KSh {bookingTotal.toLocaleString("en-KE")})
                  </Button>
                </div>
              )}

              {bookStep === 2 && (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">Choose a location</p>
                  <div className="space-y-2">
                    {branches.map((b) => (
                      <button
                        key={b.id}
                        onClick={() => setSelectedBranch(b)}
                        className={`w-full flex items-center gap-3 p-3 rounded-2xl border text-left ${
                          selectedBranch?.id === b.id ? "border-slate-900 bg-slate-50" : "border-slate-100"
                        }`}
                      >
                        <MapPin className="w-4 h-4 text-muted-foreground shrink-0" />
                        <div>
                          <p className="text-sm font-medium">{b.name}</p>
                          {b.location && <p className="text-xs text-muted-foreground">{b.location}</p>}
                        </div>
                      </button>
                    ))}
                    {branches.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-4">No locations available right now.</p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" className="flex-1" onClick={() => setBookStep(1)}>Back</Button>
                    <Button className="flex-1" disabled={!selectedBranch} onClick={() => setBookStep(3)}>Continue</Button>
                  </div>
                </div>
              )}

              {bookStep === 3 && (
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Choose a day</p>
                    <div className="flex gap-2 overflow-x-auto pb-1">
                      {days.map((d, i) => (
                        <button
                          key={i}
                          onClick={() => setSelectedDay(i)}
                          className={`shrink-0 px-3 py-2 rounded-xl text-xs font-medium border ${
                            selectedDay === i ? "bg-slate-900 text-white border-slate-900" : "border-slate-200 text-slate-600"
                          }`}
                        >
                          {d.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Choose a time</p>
                    <div className="grid grid-cols-3 gap-2">
                      {TIME_SLOTS.map((t) => (
                        <button
                          key={t}
                          onClick={() => setSelectedTime(t)}
                          className={`flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-medium border ${
                            selectedTime === t ? "bg-slate-900 text-white border-slate-900" : "border-slate-200 text-slate-600"
                          }`}
                        >
                          <Clock className="w-3.5 h-3.5" />{t}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" className="flex-1" onClick={() => setBookStep(2)}>Back</Button>
                    <Button className="flex-1" disabled={!selectedTime} onClick={() => setBookStep(4)}>Continue</Button>
                  </div>
                </div>
              )}

              {bookStep === 4 && (
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Your vehicle plate</p>
                    <Input
                      placeholder="e.g. KDG 123A"
                      value={bookingPlate}
                      onChange={(e) => setBookingPlate(e.target.value.toUpperCase())}
                      className="font-mono uppercase"
                    />
                  </div>

                  <div className="bg-slate-50 rounded-2xl p-4 space-y-2 text-sm">
                    <div className="flex justify-between"><span className="text-muted-foreground">Services</span><span className="font-medium text-right">{selectedServices.map((s) => s.name).join(", ")}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Location</span><span className="font-medium">{selectedBranch?.name}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Time</span><span className="font-medium">{days[selectedDay].label}, {selectedTime}</span></div>
                    <div className="flex justify-between pt-2 border-t border-slate-200"><span className="font-semibold">Total</span><span className="font-semibold">KSh {bookingTotal.toLocaleString("en-KE")}</span></div>
                  </div>

                  <div className="flex gap-2">
                    <Button variant="outline" className="flex-1" onClick={() => setBookStep(3)}>Back</Button>
                    <Button className="flex-1" disabled={!bookingPlate.trim() || submittingBooking} onClick={submitBooking}>
                      {submittingBooking ? <RefreshCw className="w-4 h-4 animate-spin" /> : "Confirm Booking"}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {activeTab === "history" && (
          <div className="space-y-4">
            {bookings.filter((b) => b.status !== "Completed").length > 0 && (
              <Card className="rounded-3xl">
                <CardHeader className="pb-2"><CardTitle className="text-base">Upcoming Bookings</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {bookings.filter((b) => b.status !== "Completed").map((b) => (
                    <div key={b.id} className="flex items-center justify-between p-3 rounded-2xl bg-slate-50">
                      <div>
                        <p className="text-sm font-medium font-mono">{b.plate}</p>
                        <p className="text-xs text-muted-foreground">{formatDateTime(b.scheduled_for)} - {b.services.join(", ")}</p>
                      </div>
                      <Badge variant="outline">{b.status}</Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            <Card className="rounded-3xl overflow-hidden">
              <CardHeader className="pb-2"><CardTitle className="text-base">Wash History</CardTitle></CardHeader>
              <CardContent className="p-0">
                {txLoading ? (
                  <div className="p-6 space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="h-10 bg-slate-100 rounded-xl animate-pulse" />)}</div>
                ) : transactions.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground text-sm">No transaction history yet.</div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead><TableHead>Plate</TableHead><TableHead>Services</TableHead>
                        <TableHead>Receipt</TableHead><TableHead className="text-right">Amount</TableHead><TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {transactions.map((tx) => (
                        <TableRow key={tx.id}>
                          <TableCell className="text-sm whitespace-nowrap">{formatDate(tx.date)}</TableCell>
                          <TableCell className="font-mono text-sm font-medium">{tx.plate}</TableCell>
                          <TableCell className="text-sm max-w-[140px]"><span className="line-clamp-1">{Array.isArray(tx.services) ? tx.services.join(", ") : tx.services}</span></TableCell>
                          <TableCell className="text-xs font-mono text-muted-foreground">{tx.mpesa_receipt ?? "CASH"}</TableCell>
                          <TableCell className="text-right text-sm font-medium">KSh {Number(tx.amount).toLocaleString("en-KE")}</TableCell>
                          <TableCell><Badge className={`${txStatusClass(tx.status)} text-xs`}>{tx.status}</Badge></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      <div className="fixed bottom-0 inset-x-0 z-30 bg-white border-t border-slate-100 px-2 py-2 flex items-center justify-around max-w-3xl mx-auto">
        {([
          { key: "track", label: "Track", icon: Droplets },
          { key: "book", label: "Book", icon: CalendarPlus },
          { key: "history", label: "History", icon: History },
        ] as const).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex flex-col items-center gap-1 px-6 py-1.5 rounded-xl transition-colors ${
              activeTab === key ? "text-slate-900" : "text-slate-400"
            }`}
          >
            <Icon className={`w-5 h-5 ${activeTab === key ? "fill-slate-900/10" : ""}`} />
            <span className="text-[11px] font-medium">{label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
