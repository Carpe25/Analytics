"use client";

import React, { useEffect, useState, useCallback } from "react";
import {
  Ticket as TicketIcon,
  CheckCircle2,
  Clock,
  User,
  ExternalLink,
  RefreshCw,
  Eye,
  Check,
  Building2,
  FolderGit2,
  AlertCircle,
  FileText,
  X,
  Share2,
} from "lucide-react";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Ticket, AuthUser } from "@/types";

export default function TicketsPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [userRole, setUserRole] = useState<"manager" | "developer">("developer");
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>("");
  const [previewPhoto, setPreviewPhoto] = useState<string | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  // Fetch tickets and current user
  const loadData = useCallback(() => {
    setLoading(true);
    fetch("/api/tickets")
      .then((res) => res.json())
      .then((data) => {
        if (data.tickets) setTickets(data.tickets);
        if (data.user) {
          setCurrentUser(data.user);
          setUserRole(data.user.role);
          // Set initial default tab if not set
          if (!activeTab) {
            setActiveTab(data.user.role === "manager" ? "under_review" : "my_tickets");
          }
        }
      })
      .catch((err) => console.error("Failed to load tickets:", err))
      .finally(() => setLoading(false));
  }, [activeTab]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle ticket action
  const handleAction = async (ticketId: string, action: string) => {
    setActionLoadingId(ticketId);
    try {
      const res = await fetch(`/api/tickets/${ticketId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });

      if (!res.ok) {
        const err = await res.json();
        alert(err.error || "Action failed");
        return;
      }

      // Reload tickets
      loadData();
    } catch (err: any) {
      alert(err.message || "Action failed");
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleCopyRaiseTicketLink = () => {
    const url = `${window.location.origin}/raise-ticket`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  // Filtered lists
  const underReviewTickets = tickets.filter((t) => t.status === "under_review");
  const openTickets = tickets.filter((t) => t.status === "open");
  const myTickets = tickets.filter(
    (t) =>
      t.status === "assigned" &&
      currentUser &&
      (t.assignedToDeveloperId === currentUser.developerId ||
        t.assignedToDeveloperName?.toLowerCase() === currentUser.name.toLowerCase() ||
        t.assignedToDeveloperName?.toLowerCase() === currentUser.username.toLowerCase())
  );
  const allAssignedTickets = tickets.filter((t) => t.status === "assigned");

  // Determine which list to show based on active tab
  let displayedTickets: Ticket[] = [];
  if (activeTab === "under_review") {
    displayedTickets = underReviewTickets;
  } else if (activeTab === "my_tickets") {
    displayedTickets = myTickets;
  } else if (activeTab === "open_tickets") {
    displayedTickets = openTickets;
  } else if (activeTab === "all_tickets") {
    displayedTickets = tickets.filter((t) => t.status !== "under_review");
  }

  return (
    <div className="flex-1 flex flex-col font-sans">
      <Header
        title="Tickets & Tasks"
        description={
          userRole === "manager"
            ? "Review incoming client tickets, release them to developers, and monitor assignments"
            : "Pick up open tickets and manage tasks assigned to you"
        }
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyRaiseTicketLink}
              className="gap-1.5 text-xs bg-white border-[#17212B]/20"
            >
              <Share2 className="h-3.5 w-3.5" />
              <span>{copiedLink ? "Link Copied!" : "Copy Ticket Form URL"}</span>
            </Button>
          </div>
        }
      />

      <div className="w-full max-w-none px-8 py-6 space-y-6">
        {/* Navigation Tabs based on Role */}
        <div className="border-b border-[#17212B]/15 pb-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            {userRole === "manager" ? (
              <>
                <button
                  onClick={() => setActiveTab("under_review")}
                  className={`px-4 py-2 rounded-full text-xs font-semibold transition-all flex items-center gap-2 ${
                    activeTab === "under_review"
                      ? "bg-[#17212B] text-white shadow-sm"
                      : "bg-white text-[#17212B]/75 hover:bg-white/80 border border-[#17212B]/15"
                  }`}
                >
                  <Clock className="h-3.5 w-3.5" />
                  <span>Under Review</span>
                  <span className="ml-1 px-1.5 py-0.2 rounded-full bg-white/20 text-[10px]">
                    {underReviewTickets.length}
                  </span>
                </button>

                <button
                  onClick={() => setActiveTab("open_tickets")}
                  className={`px-4 py-2 rounded-full text-xs font-semibold transition-all flex items-center gap-2 ${
                    activeTab === "open_tickets"
                      ? "bg-[#17212B] text-white shadow-sm"
                      : "bg-white text-[#17212B]/75 hover:bg-white/80 border border-[#17212B]/15"
                  }`}
                >
                  <TicketIcon className="h-3.5 w-3.5" />
                  <span>Open Tickets</span>
                  <span className="ml-1 px-1.5 py-0.2 rounded-full bg-white/20 text-[10px]">
                    {openTickets.length}
                  </span>
                </button>

                <button
                  onClick={() => setActiveTab("all_tickets")}
                  className={`px-4 py-2 rounded-full text-xs font-semibold transition-all flex items-center gap-2 ${
                    activeTab === "all_tickets"
                      ? "bg-[#17212B] text-white shadow-sm"
                      : "bg-white text-[#17212B]/75 hover:bg-white/80 border border-[#17212B]/15"
                  }`}
                >
                  <User className="h-3.5 w-3.5" />
                  <span>All Tasks & Assignments</span>
                  <span className="ml-1 px-1.5 py-0.2 rounded-full bg-white/20 text-[10px]">
                    {allAssignedTickets.length}
                  </span>
                </button>
              </>
            ) : (
              /* Developer Navigation */
              <>
                <button
                  onClick={() => setActiveTab("my_tickets")}
                  className={`px-4 py-2 rounded-full text-xs font-semibold transition-all flex items-center gap-2 ${
                    activeTab === "my_tickets"
                      ? "bg-[#17212B] text-white shadow-sm"
                      : "bg-white text-[#17212B]/75 hover:bg-white/80 border border-[#17212B]/15"
                  }`}
                >
                  <User className="h-3.5 w-3.5" />
                  <span>My Assigned Tickets</span>
                  <span className="ml-1 px-1.5 py-0.2 rounded-full bg-white/20 text-[10px]">
                    {myTickets.length}
                  </span>
                </button>

                <button
                  onClick={() => setActiveTab("open_tickets")}
                  className={`px-4 py-2 rounded-full text-xs font-semibold transition-all flex items-center gap-2 ${
                    activeTab === "open_tickets"
                      ? "bg-[#17212B] text-white shadow-sm"
                      : "bg-white text-[#17212B]/75 hover:bg-white/80 border border-[#17212B]/15"
                  }`}
                >
                  <TicketIcon className="h-3.5 w-3.5" />
                  <span>Open Tickets (Available to Pick Up)</span>
                  <span className="ml-1 px-1.5 py-0.2 rounded-full bg-white/20 text-[10px]">
                    {openTickets.length}
                  </span>
                </button>
              </>
            )}
          </div>

          <div className="text-xs text-[#17212B]/70 flex items-center gap-2">
            <span>Logged in as:</span>
            <span className="font-bold text-[#17212B]">{currentUser?.name || "Developer"}</span>
            <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-[#17212B]/10">
              {userRole}
            </span>
          </div>
        </div>

        {/* Content Feed */}
        {loading ? (
          <div className="py-16 text-center text-xs text-[#17212B]/60 flex items-center justify-center gap-2">
            <RefreshCw className="h-4 w-4 animate-spin" />
            <span>Loading tickets...</span>
          </div>
        ) : displayedTickets.length === 0 ? (
          <div className="py-16 text-center bg-white border border-[#17212B]/15 rounded-3xl p-8 max-w-lg mx-auto">
            <TicketIcon className="h-8 w-8 text-[#17212B]/40 mx-auto mb-2" />
            <h3 className="text-sm font-semibold text-[#17212B]">No Tickets Found</h3>
            <p className="text-xs text-[#17212B]/70 mt-1">
              {activeTab === "under_review"
                ? "No tickets currently pending review."
                : activeTab === "my_tickets"
                ? "You currently have no assigned tickets. Check the 'Open Tickets' tab to pick one up!"
                : "No open tickets available at the moment."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {displayedTickets.map((ticket) => (
              <div
                key={ticket.id}
                className="bg-white border border-[#17212B]/15 rounded-3xl p-5 shadow-sm flex flex-col justify-between space-y-4 hover:border-[#17212B]/30 transition-all"
              >
                <div className="space-y-3">
                  {/* Top Bar: Ticket Number & Status Badge */}
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold px-2.5 py-1 rounded-full bg-[#17212B]/10 text-[#17212B]">
                      {ticket.ticketNumber}
                    </span>

                    {ticket.status === "under_review" && (
                      <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700 border-amber-200">
                        Under Review
                      </Badge>
                    )}
                    {ticket.status === "open" && (
                      <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700 border-blue-200">
                        Open
                      </Badge>
                    )}
                    {ticket.status === "assigned" && (
                      <Badge variant="outline" className="text-[10px] bg-purple-50 text-purple-700 border-purple-200">
                        Assigned to {ticket.assignedToDeveloperName}
                      </Badge>
                    )}
                    {ticket.status === "resolved" && (
                      <Badge variant="outline" className="text-[10px] bg-green-50 text-green-700 border-green-200">
                        Resolved
                      </Badge>
                    )}
                  </div>

                  {/* Client & Project */}
                  <div className="flex items-center gap-2 text-xs">
                    <span className="flex items-center gap-1 font-semibold text-[#17212B]">
                      <Building2 className="h-3 w-3 text-[#17212B]/60" />
                      {ticket.client}
                    </span>
                    <span className="text-[#17212B]/30">•</span>
                    <span className="flex items-center gap-1 text-[#17212B]/80 font-medium">
                      <FolderGit2 className="h-3 w-3 text-[#17212B]/60" />
                      {ticket.projectName}
                    </span>
                  </div>

                  {/* Issue Text */}
                  <div className="p-3 bg-[#F5F7F8] rounded-2xl text-xs text-[#17212B] whitespace-pre-wrap leading-relaxed max-h-36 overflow-y-auto">
                    {ticket.issue}
                  </div>

                  {/* Photo Preview if attached */}
                  {ticket.photoUrl && (
                    <div className="pt-1">
                      <button
                        type="button"
                        onClick={() => setPreviewPhoto(ticket.photoUrl || null)}
                        className="w-full h-24 rounded-2xl border border-[#17212B]/15 overflow-hidden relative group text-left"
                      >
                        <img
                          src={ticket.photoUrl}
                          alt="Ticket photo"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                        <div className="absolute inset-0 bg-[#17212B]/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-semibold gap-1.5">
                          <Eye className="h-4 w-4" />
                          <span>View Full Photo</span>
                        </div>
                      </button>
                    </div>
                  )}

                  {/* Meta / Reporter */}
                  <div className="text-[11px] text-[#17212B]/60 pt-1 flex items-center justify-between">
                    <span>By: {ticket.raisedByName || "Client"}</span>
                    <span>{new Date(ticket.createdAtUtc).toLocaleDateString()}</span>
                  </div>
                </div>

                {/* Actions Footer */}
                <div className="pt-3 border-t border-[#17212B]/10 flex items-center justify-between gap-2">
                  {/* Manager Action: Make Live */}
                  {userRole === "manager" && ticket.status === "under_review" && (
                    <Button
                      size="sm"
                      disabled={actionLoadingId === ticket.id}
                      onClick={() => handleAction(ticket.id, "make_live")}
                      className="w-full rounded-xl text-xs font-semibold gap-1.5 bg-green-700 hover:bg-green-800 text-white"
                    >
                      <Check className="h-3.5 w-3.5" />
                      <span>Approve & Make Live</span>
                    </Button>
                  )}

                  {/* Developer/User Action: Assign To Me */}
                  {ticket.status === "open" && (
                    <Button
                      size="sm"
                      disabled={actionLoadingId === ticket.id}
                      onClick={() => handleAction(ticket.id, "assign_to_me")}
                      className="w-full rounded-xl text-xs font-semibold gap-1.5"
                    >
                      <User className="h-3.5 w-3.5" />
                      <span>Assign to me</span>
                    </Button>
                  )}

                  {/* Assigned Ticket Actions */}
                  {ticket.status === "assigned" && (
                    <div className="w-full flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={actionLoadingId === ticket.id}
                        onClick={() => handleAction(ticket.id, "unassign")}
                        className="flex-1 rounded-xl text-xs text-[#17212B]/75 hover:text-red-700"
                      >
                        Unassign
                      </Button>
                      <Button
                        size="sm"
                        disabled={actionLoadingId === ticket.id}
                        onClick={() => handleAction(ticket.id, "resolve")}
                        className="flex-1 rounded-xl text-xs font-semibold bg-green-700 hover:bg-green-800 text-white"
                      >
                        Mark Done
                      </Button>
                    </div>
                  )}

                  {ticket.status === "resolved" && (
                    <div className="w-full text-center text-xs font-medium text-green-700 flex items-center justify-center gap-1 py-1">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      <span>Task Completed</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Full Photo Modal Preview */}
      {previewPhoto && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setPreviewPhoto(null)}
        >
          <div
            className="relative max-w-4xl max-h-[90vh] bg-white rounded-3xl p-3 overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setPreviewPhoto(null)}
              className="absolute top-4 right-4 h-9 w-9 rounded-full bg-white/90 text-[#17212B] flex items-center justify-center hover:bg-white shadow-md z-10"
            >
              <X className="h-5 w-5" />
            </button>
            <img
              src={previewPhoto}
              alt="Full size screenshot"
              className="max-h-[82vh] w-auto object-contain rounded-2xl mx-auto"
            />
          </div>
        </div>
      )}
    </div>
  );
}
