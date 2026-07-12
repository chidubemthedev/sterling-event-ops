"use client";

import React, { useEffect, useState } from "react";
import { collection, onSnapshot, query, where, doc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { useWorkspaceStore } from "@/store/useWorkspaceStore";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { 
  Plus, 
  Search, 
  Calendar, 
  MapPin, 
  Layers, 
  CheckCircle, 
  AlertTriangle, 
  ArrowRight,
  Sparkles,
  X,
  Clock,
  RefreshCw,
  Building
} from "lucide-react";

interface EventItem {
  id: string;
  name: string;
  location: string;
  startDate: string;
  endDate: string;
  status: "active" | "archived";
  itemsAllocated: Record<string, { qtyCheckedOut: number; qtyReturned: number }>;
  workspaceId: string;
  createdAt: string;
}

export default function EventsPage() {
  const { workspaceId, loading: authLoading } = useWorkspaceStore();

  const [events, setEvents] = useState<EventItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loadingEvents, setLoadingEvents] = useState(true);

  // Form Modals state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // New Event Form state
  const [eventName, setEventName] = useState("");
  const [location, setLocation] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");

  // Real-time subscription to events collection, strictly filtered by workspaceId
  useEffect(() => {
    if (authLoading || !workspaceId) return;

    setLoadingEvents(true);
    const q = query(
      collection(db, "events"),
      where("workspaceId", "==", workspaceId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: EventItem[] = [];
      snapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() } as EventItem);
      });
      // Sort client-side by creation timestamp descending
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setEvents(list);
      setLoadingEvents(false);
    }, (err) => {
      console.error("Firestore query error on events collection:", err);
      setLoadingEvents(false);
    });

    return () => unsubscribe();
  }, [workspaceId, authLoading]);

  // Create Event Form submit handler
  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    setFormSuccess("");

    if (!workspaceId) {
      setFormError("Error: Active workspace session not detected.");
      return;
    }

    if (!eventName.trim() || !location.trim() || !startDate || !endDate) {
      setFormError("Please populate all required fields.");
      return;
    }

    if (new Date(startDate) > new Date(endDate)) {
      setFormError("Date mismatch: Start Date cannot be after End Date.");
      return;
    }

    setSubmitting(true);

    try {
      const docId = `evt_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      const eventRef = doc(db, "events", docId);

      const newEvent: Omit<EventItem, "id"> = {
        name: eventName.trim(),
        location: location.trim(),
        startDate,
        endDate,
        status: "active",
        itemsAllocated: {}, // Default initialize empty allocated items mapping
        workspaceId,        // Strict multi-tenant enforcement
        createdAt: new Date().toISOString()
      };

      await setDoc(eventRef, newEvent);

      setFormSuccess(`Successfully scheduled event: ${eventName.trim()}`);
      
      // Reset state
      setEventName("");
      setLocation("");
      setStartDate("");
      setEndDate("");

      setTimeout(() => {
        setIsModalOpen(false);
        setFormSuccess("");
      }, 1500);

    } catch (err: any) {
      console.error("Event registration failed:", err);
      setFormError(err.message || "An error occurred while scheduling the event.");
    } finally {
      setSubmitting(false);
    }
  };

  // Filter events list
  const filteredEvents = events.filter(evt => 
    evt.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    evt.location.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (authLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-20 text-zinc-400 text-sm gap-2">
        <RefreshCw className="size-6 animate-spin text-indigo-500" />
        <span>Loading active session...</span>
      </div>
    );
  }

  if (!workspaceId) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center min-h-[400px]">
        <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center mb-4">
          <AlertTriangle className="size-6" />
        </div>
        <h3 className="text-lg font-bold text-white font-heading">No Workspace Session Active</h3>
        <p className="text-xs text-zinc-400 mt-1 max-w-sm">
          Please log out and sign in with an account associated with a workspace tenant to query events.
        </p>
      </div>
    );
  }

  // Active status counts
  const totalEvents = events.length;
  const activeEventsCount = events.filter(e => e.status === "active").length;

  return (
    <div className="flex-1 flex flex-col space-y-8 p-6 md:p-8 bg-zinc-950/20 relative">
      
      {/* SECTION HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-800/60 pb-6">
        <div>
          <div className="flex items-center gap-2">
            <Calendar className="size-5 text-indigo-400" />
            <h2 className="text-xl font-bold tracking-tight text-white font-heading uppercase">
              Event Management
            </h2>
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            Schedule active events, manage allocations, and orchestrate real-time deployment folders for workspace: <code className="px-1 py-0.5 rounded bg-zinc-900 text-indigo-300 font-mono text-[10px]">{workspaceId}</code>.
          </p>
        </div>
        <Button 
          onClick={() => setIsModalOpen(true)}
          className="bg-gradient-to-r from-indigo-600 to-cyan-500 text-white font-bold hover:opacity-90 shadow-lg shadow-indigo-600/15 h-10 border-none"
        >
          <Plus className="size-4 mr-2" />
          Create New Event
        </Button>
      </div>

      {/* METRICS ROW */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        {/* STAT 1 */}
        <div className="bg-zinc-900/40 border border-zinc-850 rounded-xl p-5 backdrop-blur-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs text-zinc-400 font-medium">Total Folders</span>
            <h3 className="text-3xl font-black font-heading tracking-tight text-white">
              {totalEvents}
            </h3>
          </div>
          <div className="w-11 h-11 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center">
            <Layers className="size-5" />
          </div>
        </div>

        {/* STAT 2 */}
        <div className="bg-zinc-900/40 border border-zinc-850 rounded-xl p-5 backdrop-blur-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs text-zinc-400 font-medium">Active Pipelines</span>
            <h3 className="text-3xl font-black font-heading tracking-tight text-emerald-400">
              {activeEventsCount}
            </h3>
          </div>
          <div className="w-11 h-11 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
            <CheckCircle className="size-5 animate-pulse" />
          </div>
        </div>

        {/* STAT 3 */}
        <div className="bg-zinc-900/40 border border-zinc-850 rounded-xl p-5 backdrop-blur-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs text-zinc-400 font-medium">Archived Projects</span>
            <h3 className="text-3xl font-black font-heading tracking-tight text-zinc-500">
              {totalEvents - activeEventsCount}
            </h3>
          </div>
          <div className="w-11 h-11 rounded-lg bg-zinc-800/10 border border-zinc-800/20 text-zinc-400 flex items-center justify-center">
            <Clock className="size-5" />
          </div>
        </div>
      </div>

      {/* SEARCH AND FILTER BAR */}
      <div className="bg-zinc-900/20 border border-zinc-850 rounded-xl overflow-hidden shadow-xl">
        <div className="px-6 py-4 border-b border-zinc-850 bg-zinc-900/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Building className="size-4.5 text-indigo-400" />
            <h3 className="text-sm font-bold text-white font-heading">Event Operation Logs</h3>
          </div>
          {/* Search */}
          <div className="relative max-w-xs w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-zinc-500" />
            <input 
              type="text" 
              placeholder="Search event name or location..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg py-1.5 pl-9 pr-4 text-xs text-white placeholder-zinc-500 outline-none focus:border-indigo-500 transition-colors"
            />
          </div>
        </div>

        {/* EVENTS LIST GRID */}
        {loadingEvents ? (
          <div className="flex flex-col items-center justify-center py-20 text-zinc-500 text-sm gap-2">
            <RefreshCw className="size-5 animate-spin text-indigo-500" />
            <span>Syncing events directory...</span>
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-zinc-500 text-sm gap-2">
            <Calendar className="size-8 text-zinc-700 mb-1" />
            <span>No events matches found in this workspace tenant directory.</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-6">
            {filteredEvents.map((evt) => {
              const allocatedItemsCount = Object.keys(evt.itemsAllocated).length;
              return (
                <Link 
                  href={`/dashboard/events/${evt.id}`}
                  key={evt.id}
                  className="group bg-zinc-900/40 hover:bg-zinc-900/80 border border-zinc-850 hover:border-zinc-800 rounded-2xl p-5 transition-all duration-300 flex flex-col justify-between shadow-lg relative overflow-hidden cursor-pointer"
                >
                  {/* Neon Top Accent Line on hover */}
                  <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-indigo-500 to-cyan-400 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  
                  {/* Card Header */}
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="font-extrabold text-white text-base group-hover:text-indigo-300 transition-colors font-heading tracking-tight uppercase line-clamp-1">
                        {evt.name}
                      </h4>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[9px] font-extrabold uppercase border tracking-wider shrink-0 ${
                        evt.status === "active" 
                          ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400 animate-pulse"
                          : "bg-zinc-500/10 border-zinc-500/20 text-zinc-400"
                      }`}>
                        {evt.status}
                      </span>
                    </div>

                    {/* Metadata Items */}
                    <div className="space-y-2 text-xs text-zinc-400">
                      <div className="flex items-center gap-2">
                        <MapPin className="size-3.5 text-zinc-500 shrink-0" />
                        <span className="line-clamp-1">{evt.location}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Calendar className="size-3.5 text-zinc-500 shrink-0" />
                        <span>{evt.startDate} — {evt.endDate}</span>
                      </div>
                    </div>
                  </div>

                  {/* Card Footer */}
                  <div className="mt-5 pt-4 border-t border-zinc-850/60 flex items-center justify-between text-xs text-zinc-400">
                    <div className="flex items-center gap-1">
                      <Layers className="size-3.5 text-indigo-400" />
                      <span>Allocated: <strong className="text-white">{allocatedItemsCount} SKUs</strong></span>
                    </div>
                    <span className="group-hover:text-indigo-300 transition-colors flex items-center gap-1 font-bold text-[10px] uppercase tracking-wider">
                      Open Control
                      <ArrowRight className="size-3.5 transition-transform duration-200 group-hover:translate-x-1" />
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* CREATE NEW EVENT GLASSMORPHIC MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-xl bg-zinc-950/80 transition-all duration-300 animate-in fade-in">
          <div className="relative max-w-md w-full bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            {/* Ambient Line */}
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-indigo-500 to-cyan-400" />

            {/* Modal Header */}
            <div className="px-6 py-5 border-b border-zinc-800 bg-zinc-900/50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="size-5 text-indigo-400" />
                <h3 className="text-sm font-bold text-white font-heading uppercase">
                  Schedule Operation Folder
                </h3>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="text-zinc-500 hover:text-white transition-colors cursor-pointer"
              >
                <X className="size-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleCreateEvent} className="p-6 space-y-4">
              
              {/* Event Name */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                  <Calendar className="size-3.5 text-zinc-500" />
                  Event / Project Name <span className="text-red-400">*</span>
                </label>
                <input 
                  type="text" 
                  required
                  placeholder="e.g. Lagos Jazz Festival 2026"
                  value={eventName}
                  onChange={(e) => setEventName(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2.5 text-xs text-white placeholder-zinc-650 outline-none focus:border-indigo-500 transition-colors"
                />
              </div>

              {/* Location */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                  <MapPin className="size-3.5 text-zinc-500" />
                  Deployment Location <span className="text-red-400">*</span>
                </label>
                <input 
                  type="text" 
                  required
                  placeholder="e.g. Eko Atlantic Club Grounds, Lagos"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2.5 text-xs text-white placeholder-zinc-650 outline-none focus:border-indigo-500 transition-colors"
                />
              </div>

              {/* Start Date & End Date */}
              <div className="grid grid-cols-2 gap-4">
                {/* Start Date */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                    <Clock className="size-3.5 text-zinc-500" />
                    Start Date <span className="text-red-400">*</span>
                  </label>
                  <input 
                    type="date" 
                    required
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2.5 text-xs text-white outline-none focus:border-indigo-500 transition-colors cursor-pointer"
                  />
                </div>

                {/* End Date */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                    <Clock className="size-3.5 text-zinc-500" />
                    End Date <span className="text-red-400">*</span>
                  </label>
                  <input 
                    type="date" 
                    required
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2.5 text-xs text-white outline-none focus:border-indigo-500 transition-colors cursor-pointer"
                  />
                </div>
              </div>

              {/* Status Feedbacks */}
              {formError && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg p-3 text-xs flex items-start gap-2.5 animate-in slide-in-from-top-2">
                  <AlertTriangle className="size-4 shrink-0 mt-0.5" />
                  <span>{formError}</span>
                </div>
              )}

              {formSuccess && (
                <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-lg p-3 text-xs flex items-start gap-2.5 animate-in slide-in-from-top-2">
                  <CheckCircle className="size-4 shrink-0 mt-0.5 animate-pulse" />
                  <span>{formSuccess}</span>
                </div>
              )}

              {/* Action buttons */}
              <div className="pt-4 flex gap-3 border-t border-zinc-800">
                <Button 
                  type="button"
                  variant="outline"
                  onClick={() => setIsModalOpen(false)}
                  disabled={submitting}
                  className="flex-1 border-zinc-800 text-zinc-400 hover:bg-zinc-800 hover:text-white h-11"
                >
                  Cancel
                </Button>
                <Button 
                  type="submit"
                  disabled={submitting}
                  className="flex-1 bg-gradient-to-r from-indigo-600 to-cyan-500 text-white font-bold hover:opacity-95 shadow-lg shadow-indigo-600/10 h-11 border-none"
                >
                  {submitting ? (
                    <div className="flex items-center justify-center gap-2">
                      <RefreshCw className="size-4 animate-spin text-white" />
                      Registering...
                    </div>
                  ) : (
                    <div className="flex items-center justify-center gap-1">
                      Schedule Event
                      <ArrowRight className="size-4" />
                    </div>
                  )}
                </Button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}
