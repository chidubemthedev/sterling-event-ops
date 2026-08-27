"use client";

import React, { useEffect, useState } from "react";
import { collection, onSnapshot, query, where, doc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { useWorkspaceStore } from "@/store/useWorkspaceStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  X,
  Clock,
  RefreshCw,
  Building,
  Filter,
  ArrowUpRight
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

const ITEMS_PER_PAGE = 10;

export default function EventsPage() {
  const { workspaceId, loading: authLoading } = useWorkspaceStore();

  const [events, setEvents] = useState<EventItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All Events");
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);

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
      snapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() } as EventItem);
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

  // Reset pagination when search query or status filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter]);

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
      }, 1200);

    } catch (err: any) {
      console.error("Event registration failed:", err);
      setFormError(err.message || "An error occurred while scheduling the event.");
    } finally {
      setSubmitting(false);
    }
  };

  // Filter events list by search query and status filter
  const filteredEvents = events.filter(evt => {
    const matchesSearch = 
      evt.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      evt.location.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = 
      statusFilter === "All Events" ||
      (statusFilter === "Upcoming/Live" && evt.status === "active") ||
      (statusFilter === "Completed" && evt.status === "archived");

    return matchesSearch && matchesStatus;
  });

  // Client-side pagination calculations
  const totalPages = Math.max(1, Math.ceil(filteredEvents.length / ITEMS_PER_PAGE));
  const paginatedEvents = filteredEvents.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  // Active status counts
  const totalEvents = events.length;
  const activeEventsCount = events.filter(e => e.status === "active").length;
  const completedEventsCount = totalEvents - activeEventsCount;

  if (authLoading) {
    return (
      <div className="flex-1 h-full min-h-[50vh] flex flex-col items-center justify-center">
        <div className="size-10 rounded-full border-3 border-[#800080]/20 border-t-[#800080] animate-spin" />
        <p className="mt-4 text-xs font-semibold tracking-wide text-neutral-500 font-sans">
          Loading active session...
        </p>
      </div>
    );
  }

  if (!workspaceId) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center min-h-[400px]">
        <div className="size-12 rounded-full bg-rose-50 border border-rose-100 text-rose-600 flex items-center justify-center mb-4">
          <AlertTriangle className="size-6" />
        </div>
        <h3 className="text-lg font-bold text-neutral-900 font-sans">No Workspace Session Active</h3>
        <p className="text-xs text-neutral-500 mt-1 max-w-sm">
          Please sign in with an account associated with a workspace tenant to query events.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8 font-sans">
      
      {/* --- PAGE HEADER --- */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-purple-50 border border-purple-200/80 text-[#800080] uppercase tracking-wider">
              EVENT LOGISTICS
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900">
            Events & Equipment Allocations
          </h1>
          <p className="text-xs text-neutral-500 mt-1 max-w-2xl">
            Schedule upcoming productions, manage gear dispatches, track venue drop-offs, and monitor asset returns.
          </p>
        </div>

        <Button 
          onClick={() => setIsModalOpen(true)}
          className="bg-[#800080] hover:bg-[#660066] text-white font-medium rounded-xl shadow-xs py-2.5 px-4 h-10 cursor-pointer self-start md:self-auto"
        >
          <Plus className="size-4 mr-2" />
          + Schedule Event
        </Button>
      </div>

      {/* --- METRIC SUMMARY CARDS --- */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        
        {/* Metric 1: Total Events */}
        <div className="bg-white border border-neutral-200/80 rounded-xl p-5 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs text-neutral-500 font-medium">Total Events</span>
            <h4 className="text-3xl font-bold text-neutral-900 tracking-tight">
              {totalEvents}
            </h4>
          </div>
          <div className="size-11 rounded-xl bg-purple-50 border border-purple-100 text-[#800080] flex items-center justify-center shrink-0">
            <Layers className="size-5" />
          </div>
        </div>

        {/* Metric 2: Live / Upcoming Events */}
        <div className="bg-white border border-neutral-200/80 rounded-xl p-5 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs text-neutral-500 font-medium">Live / Upcoming Events</span>
            <h4 className="text-3xl font-bold text-neutral-900 tracking-tight">
              {activeEventsCount}
            </h4>
          </div>
          <div className="size-11 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
            <CheckCircle className="size-5" />
          </div>
        </div>

        {/* Metric 3: Completed Events */}
        <div className="bg-white border border-neutral-200/80 rounded-xl p-5 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs text-neutral-500 font-medium">Completed Events</span>
            <h4 className="text-3xl font-bold text-neutral-900 tracking-tight">
              {completedEventsCount}
            </h4>
          </div>
          <div className="size-11 rounded-xl bg-neutral-100 border border-neutral-200 text-neutral-600 flex items-center justify-center shrink-0">
            <Clock className="size-5" />
          </div>
        </div>
      </div>

      {/* --- SEARCH & STATUS FILTER BAR --- */}
      <div className="bg-white border border-neutral-200/80 rounded-xl p-4 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
        
        {/* Search Input */}
        <div className="relative w-full sm:max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-neutral-400" />
          <Input 
            type="text" 
            placeholder="Search event name or location..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-neutral-50/60 border-neutral-200 rounded-xl pl-10 pr-4 text-xs h-10 text-neutral-900 placeholder:text-neutral-400 focus-visible:ring-[#800080]"
          />
        </div>

        {/* Status Filter */}
        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <Filter className="size-4 text-neutral-400 shrink-0" />
          <div className="relative w-full sm:w-48">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full bg-neutral-50/60 border border-neutral-200 rounded-xl px-3 py-2 text-xs text-neutral-800 outline-none focus:border-[#800080] transition-colors cursor-pointer appearance-none"
              style={{
                backgroundImage: "url('data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%236b7280%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E')",
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right 10px center',
                backgroundSize: '16px'
              }}
            >
              <option value="All Events">All Events</option>
              <option value="Upcoming/Live">Upcoming/Live</option>
              <option value="Completed">Completed</option>
            </select>
          </div>
        </div>
      </div>

      {/* --- EVENT DIRECTORY TABLE CONTAINER --- */}
      <div className="bg-white border border-neutral-200/80 rounded-xl shadow-xs overflow-hidden">
        
        {/* Table Header / Title Bar */}
        <div className="px-6 py-4 border-b border-neutral-200/80 bg-neutral-50/70 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Building className="size-4 text-[#800080]" />
            <h3 className="text-sm font-bold text-neutral-900">
              Event Directory
            </h3>
            <span className="text-xs text-neutral-500 font-medium">
              ({filteredEvents.length} {filteredEvents.length === 1 ? "event" : "events"})
            </span>
          </div>

          {statusFilter !== "All Events" && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-50 border border-purple-200/80 text-[#800080]">
              Filtered: {statusFilter}
            </span>
          )}
        </div>

        {/* Table Body Outlet */}
        <div className="overflow-x-auto min-h-[300px]">
          {loadingEvents ? (
            <div className="flex flex-col items-center justify-center py-20 text-neutral-500 text-xs gap-3">
              <div className="size-8 rounded-full border-2 border-[#800080]/20 border-t-[#800080] animate-spin" />
              <span>Syncing events directory...</span>
            </div>
          ) : filteredEvents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
              <div className="size-12 rounded-full bg-purple-50 border border-purple-100 text-[#800080] flex items-center justify-center mb-3">
                <Calendar className="size-6" />
              </div>
              {events.length === 0 ? (
                <>
                  <h4 className="text-sm font-bold text-neutral-900">No events scheduled yet</h4>
                  <p className="text-xs text-neutral-500 mt-1 max-w-sm">
                    Click <strong>"+ Schedule Event"</strong> to register your first production.
                  </p>
                  <Button
                    onClick={() => setIsModalOpen(true)}
                    className="mt-4 bg-[#800080] hover:bg-[#660066] text-white text-xs rounded-xl shadow-xs"
                  >
                    <Plus className="size-3.5 mr-1.5" />
                    + Schedule Event
                  </Button>
                </>
              ) : (
                <>
                  <h4 className="text-sm font-bold text-neutral-900">No matching events found</h4>
                  <p className="text-xs text-neutral-500 mt-1 max-w-sm">
                    No productions match your search query or selected status filter.
                  </p>
                  <Button
                    onClick={() => {
                      setSearchQuery("");
                      setStatusFilter("All Events");
                    }}
                    variant="outline"
                    className="mt-4 border-neutral-200 text-xs rounded-xl"
                  >
                    Clear Filters
                  </Button>
                </>
              )}
            </div>
          ) : (
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-neutral-200 bg-neutral-50 text-neutral-600 font-semibold uppercase tracking-wider text-[11px]">
                  <th className="px-6 py-3.5">Event Name</th>
                  <th className="px-6 py-3.5">Venue / Location</th>
                  <th className="px-6 py-3.5">Start Date</th>
                  <th className="px-6 py-3.5">End Date</th>
                  <th className="px-6 py-3.5">Allocations</th>
                  <th className="px-6 py-3.5">Status</th>
                  <th className="px-6 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200/70 bg-white">
                {paginatedEvents.map((evt) => {
                  const allocatedItemsCount = Object.keys(evt.itemsAllocated || {}).length;
                  return (
                    <tr key={evt.id} className="hover:bg-neutral-50/60 transition-colors duration-150">
                      
                      {/* Event Name */}
                      <td className="px-6 py-4">
                        <Link 
                          href={`/dashboard/events/${evt.id}`}
                          className="font-semibold text-neutral-900 hover:text-[#800080] transition-colors inline-flex items-center gap-1.5 group"
                        >
                          <span>{evt.name}</span>
                          <ArrowUpRight className="size-3 text-neutral-400 group-hover:text-[#800080] transition-colors" />
                        </Link>
                      </td>

                      {/* Location */}
                      <td className="px-6 py-4 text-neutral-600">
                        <div className="flex items-center gap-1.5">
                          <MapPin className="size-3.5 text-neutral-400 shrink-0" />
                          <span className="line-clamp-1">{evt.location}</span>
                        </div>
                      </td>

                      {/* Start Date */}
                      <td className="px-6 py-4 text-neutral-700">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="size-3.5 text-neutral-400 shrink-0" />
                          <span>{evt.startDate}</span>
                        </div>
                      </td>

                      {/* End Date */}
                      <td className="px-6 py-4 text-neutral-700">
                        <div className="flex items-center gap-1.5">
                          <Clock className="size-3.5 text-neutral-400 shrink-0" />
                          <span>{evt.endDate}</span>
                        </div>
                      </td>

                      {/* Allocations */}
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-neutral-100 text-neutral-700 border border-neutral-200/60">
                          {allocatedItemsCount} SKUs
                        </span>
                      </td>

                      {/* Status Badge */}
                      <td className="px-6 py-4">
                        {evt.status === "active" ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Live / Upcoming
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-neutral-100 text-neutral-600 border border-neutral-200">
                            Completed
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-4 text-right">
                        <Link href={`/dashboard/events/${evt.id}`}>
                          <Button 
                            variant="outline"
                            size="xs"
                            className="border-neutral-200 text-neutral-700 hover:text-[#800080] hover:bg-neutral-100 h-8 px-2.5 rounded-lg text-xs font-medium cursor-pointer"
                          >
                            Manage
                            <ArrowRight className="size-3 ml-1" />
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination Footer */}
        {filteredEvents.length > 0 && (
          <div className="flex items-center justify-between border-t border-neutral-200/80 px-6 py-4 bg-white rounded-b-xl">
            {/* Entry counter */}
            <div className="text-xs text-neutral-500 font-medium">
              Showing{" "}
              <span className="font-semibold text-neutral-900">
                {(currentPage - 1) * ITEMS_PER_PAGE + 1}
              </span>
              –
              <span className="font-semibold text-neutral-900">
                {Math.min(currentPage * ITEMS_PER_PAGE, filteredEvents.length)}
              </span>{" "}
              of{" "}
              <span className="font-semibold text-neutral-900">
                {filteredEvents.length}
              </span>{" "}
              total events
            </div>

            {/* Navigation Controls */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="h-8 px-3 text-xs border-neutral-200 text-neutral-700 hover:bg-neutral-50 disabled:opacity-50 cursor-pointer"
              >
                Previous
              </Button>
              <span className="text-xs text-neutral-600 font-medium px-2">
                Page {currentPage} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages || totalPages === 0}
                className="h-8 px-3 text-xs border-neutral-200 text-neutral-700 hover:bg-neutral-50 disabled:opacity-50 cursor-pointer"
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* --- CREATE NEW EVENT MODAL --- */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-xs bg-black/40 transition-all duration-300 animate-in fade-in">
          <div className="relative max-w-lg w-full bg-white border border-neutral-200/80 rounded-2xl shadow-xl overflow-hidden animate-in zoom-in-95 duration-200">
            
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-neutral-200/80 bg-neutral-50/50 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="size-7 rounded-lg bg-purple-50 text-[#800080] border border-purple-100 flex items-center justify-center">
                  <Calendar className="size-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-neutral-900">
                    Schedule New Event
                  </h3>
                  <p className="text-[11px] text-neutral-500">
                    Enter project location and dispatch dates.
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="text-neutral-400 hover:text-neutral-700 transition-colors cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleCreateEvent} className="p-6 space-y-4 text-xs">
              
              {/* Event / Project Name */}
              <div className="space-y-1.5">
                <label className="font-semibold text-neutral-700 flex items-center gap-1.5">
                  <Calendar className="size-3.5 text-neutral-400" />
                  Event / Project Name <span className="text-rose-500">*</span>
                </label>
                <Input 
                  type="text" 
                  required
                  placeholder="e.g. Lagos Jazz Festival 2026"
                  value={eventName}
                  onChange={(e) => setEventName(e.target.value)}
                  className="bg-neutral-50/60 border-neutral-200 rounded-xl h-10 text-xs focus-visible:ring-[#800080]"
                />
              </div>

              {/* Deployment Location */}
              <div className="space-y-1.5">
                <label className="font-semibold text-neutral-700 flex items-center gap-1.5">
                  <MapPin className="size-3.5 text-neutral-400" />
                  Deployment Location <span className="text-rose-500">*</span>
                </label>
                <Input 
                  type="text" 
                  required
                  placeholder="e.g. Eko Atlantic Club Grounds, Lagos"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="bg-neutral-50/60 border-neutral-200 rounded-xl h-10 text-xs focus-visible:ring-[#800080]"
                />
              </div>

              {/* Start Date & End Date */}
              <div className="grid grid-cols-2 gap-4">
                {/* Start Date */}
                <div className="space-y-1.5">
                  <label className="font-semibold text-neutral-700 flex items-center gap-1.5">
                    <Clock className="size-3.5 text-neutral-400" />
                    Start Date <span className="text-rose-500">*</span>
                  </label>
                  <Input 
                    type="date" 
                    required
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="bg-neutral-50/60 border-neutral-200 rounded-xl h-10 text-xs focus-visible:ring-[#800080] cursor-pointer"
                  />
                </div>

                {/* End Date */}
                <div className="space-y-1.5">
                  <label className="font-semibold text-neutral-700 flex items-center gap-1.5">
                    <Clock className="size-3.5 text-neutral-400" />
                    End Date <span className="text-rose-500">*</span>
                  </label>
                  <Input 
                    type="date" 
                    required
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="bg-neutral-50/60 border-neutral-200 rounded-xl h-10 text-xs focus-visible:ring-[#800080] cursor-pointer"
                  />
                </div>
              </div>

              {/* Status Feedbacks */}
              {formError && (
                <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-xl p-3 text-xs flex items-start gap-2">
                  <AlertTriangle className="size-4 shrink-0 mt-0.5" />
                  <span>{formError}</span>
                </div>
              )}

              {formSuccess && (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl p-3 text-xs flex items-start gap-2">
                  <CheckCircle className="size-4 shrink-0 mt-0.5" />
                  <span>{formSuccess}</span>
                </div>
              )}

              {/* Action buttons */}
              <div className="pt-3 flex gap-3 border-t border-neutral-200/80">
                <Button 
                  type="button"
                  variant="outline"
                  onClick={() => setIsModalOpen(false)}
                  disabled={submitting}
                  className="flex-1 border-neutral-200 hover:bg-neutral-100 text-neutral-700 rounded-xl h-10 cursor-pointer"
                >
                  Cancel
                </Button>
                <Button 
                  type="submit"
                  disabled={submitting}
                  className="flex-1 bg-[#800080] hover:bg-[#660066] text-white font-medium rounded-xl py-2.5 px-5 h-10 shadow-sm cursor-pointer"
                >
                  {submitting ? (
                    <div className="flex items-center justify-center gap-2">
                      <div className="size-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                      Scheduling...
                    </div>
                  ) : (
                    "Schedule Event"
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
