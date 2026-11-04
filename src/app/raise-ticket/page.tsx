"use client";

import React, { useState, useEffect } from "react";
import {
  LifeBuoy,
  Upload,
  CheckCircle2,
  AlertCircle,
  X,
  FileImage,
  ArrowRight,
  Loader2,
  Building2,
  FolderGit2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

interface ProjectOption {
  id: string;
  name: string;
  code?: string;
  displayName?: string;
  client: string;
  clientId?: string;
}

export default function RaiseTicketPage() {
  const [clients, setClients] = useState<string[]>([]);
  const [allProjects, setAllProjects] = useState<ProjectOption[]>([]);
  const [loadingDirectory, setLoadingDirectory] = useState(true);

  // Form state
  const [selectedClient, setSelectedClient] = useState<string>("");
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [issue, setIssue] = useState<string>("");
  const [reporterName, setReporterName] = useState<string>("");

  // Photo upload state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  // Submission state
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submittedTicket, setSubmittedTicket] = useState<{
    ticketNumber: string;
    message: string;
  } | null>(null);

  // Load client and project options
  useEffect(() => {
    fetch("/api/projects/public-directory")
      .then((res) => res.json())
      .then((data) => {
        if (data.clients) setClients(data.clients);
        if (data.projects) setAllProjects(data.projects);
      })
      .catch((err) => {
        console.error("Failed to load project directory:", err);
      })
      .finally(() => setLoadingDirectory(false));
  }, []);

  // Filter projects by selected client (case-insensitive and ID-compatible)
  const availableProjects = selectedClient
    ? allProjects.filter(
        (p) =>
          p.client.toLowerCase() === selectedClient.toLowerCase() ||
          p.clientId === selectedClient
      )
    : [];

  // Handle photo selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setErrorMessage("Please select a valid image file (PNG, JPG, WEBP).");
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      setErrorMessage("Image file size must be less than 15MB.");
      return;
    }

    setErrorMessage(null);
    setSelectedFile(file);

    const reader = new FileReader();
    reader.onload = () => {
      setPhotoPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleClearPhoto = () => {
    setSelectedFile(null);
    setPhotoPreview(null);
  };

  // Upload image directly through server-side endpoint (zero CORS issues)
  const uploadImage = async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch("/api/tickets/upload", {
      method: "POST",
      body: formData,
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || "Failed to upload photo to storage");
    }

    const data = await res.json();
    return data.fileUrl;
  };

  // Submit Ticket
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!selectedClient) {
      setErrorMessage("Please select a Client.");
      return;
    }

    if (!selectedProjectId) {
      setErrorMessage("Please select a Project.");
      return;
    }

    if (!issue.trim() || issue.trim().length < 5) {
      setErrorMessage("Please describe the issue in at least 5 characters.");
      return;
    }

    setSubmitting(true);

    try {
      let photoUrl: string | undefined = undefined;

      // Upload photo if selected
      if (selectedFile) {
        setUploadingPhoto(true);
        photoUrl = await uploadImage(selectedFile);
        setUploadingPhoto(false);
      }

      const selectedProj = allProjects.find((p) => p.id === selectedProjectId);

      // Submit ticket
      const res = await fetch("/api/tickets/public", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client: selectedClient,
          projectId: selectedProjectId,
          projectName: selectedProj ? (selectedProj.displayName || selectedProj.name) : selectedProjectId,
          issue: issue.trim(),
          photoUrl,
          raisedByName: reporterName.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to submit ticket");
      }

      setSubmittedTicket({
        ticketNumber: data.ticketNumber,
        message: data.message,
      });
    } catch (err: any) {
      setErrorMessage(err.message || "An unexpected error occurred. Please try again.");
    } finally {
      setSubmitting(false);
      setUploadingPhoto(false);
    }
  };

  const handleResetForm = () => {
    setSelectedClient("");
    setSelectedProjectId("");
    setIssue("");
    setReporterName("");
    setSelectedFile(null);
    setPhotoPreview(null);
    setSubmittedTicket(null);
    setErrorMessage(null);
  };

  return (
    <div className="min-h-screen bg-[#F5F7F8] py-12 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center h-12 w-12 rounded-2xl bg-[#17212B] text-white shadow-sm mb-1">
            <LifeBuoy className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[#17212B]">
            Submit a Support Ticket
          </h1>
          <p className="text-xs text-[#17212B]/70 max-w-md mx-auto">
            Report an issue or task for our development team. Provide clear details and a screenshot to help us resolve it quickly.
          </p>
        </div>

        {/* Success View */}
        {submittedTicket ? (
          <div className="bg-white border border-[#17212B]/15 rounded-3xl p-8 shadow-sm text-center space-y-5 animate-in fade-in duration-300">
            <div className="h-16 w-16 bg-green-50 text-green-600 rounded-full flex items-center justify-center mx-auto border border-green-200">
              <CheckCircle2 className="h-8 w-8" />
            </div>

            <div>
              <span className="inline-block px-3 py-1 rounded-full text-xs font-mono font-bold bg-[#17212B]/10 text-[#17212B] mb-2">
                {submittedTicket.ticketNumber}
              </span>
              <h2 className="text-lg font-bold text-[#17212B]">
                Ticket Submitted Successfully!
              </h2>
              <p className="text-xs text-[#17212B]/75 mt-1 max-w-md mx-auto">
                {submittedTicket.message}
              </p>
            </div>

            <div className="pt-2">
              <Button
                onClick={handleResetForm}
                className="h-10 px-6 rounded-xl text-xs font-semibold gap-2"
              >
                <span>Submit Another Ticket</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        ) : (
          /* Form Card */
          <div className="bg-white border border-[#17212B]/15 rounded-3xl p-8 shadow-sm space-y-6">
            {errorMessage && (
              <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Client & Project Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Client Dropdown */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#17212B] flex items-center gap-1.5">
                    <Building2 className="h-3.5 w-3.5 text-[#17212B]/60" />
                    <span>Client *</span>
                  </label>
                  <Select
                    value={selectedClient}
                    onChange={(e) => {
                      setSelectedClient(e.target.value);
                      setSelectedProjectId(""); // reset project when client changes
                    }}
                    required
                    className="h-10 text-xs rounded-xl bg-white border-[#17212B]/20 font-medium"
                  >
                    <option value="">Select a Client...</option>
                    {clients.map((c, idx) => (
                      <option key={`client-${c}-${idx}`} value={c}>
                        {c}
                      </option>
                    ))}
                  </Select>
                </div>

                {/* Project Dropdown */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#17212B] flex items-center gap-1.5">
                    <FolderGit2 className="h-3.5 w-3.5 text-[#17212B]/60" />
                    <span>Project *</span>
                  </label>
                  <Select
                    value={selectedProjectId}
                    onChange={(e) => setSelectedProjectId(e.target.value)}
                    required
                    disabled={!selectedClient}
                    className="h-10 text-xs rounded-xl bg-white border-[#17212B]/20 font-medium disabled:opacity-50"
                  >
                    <option value="">
                      {selectedClient ? "Select a Project..." : "Select client first"}
                    </option>
                    {availableProjects.map((p, idx) => (
                      <option key={`proj-${p.client}-${p.id}-${idx}`} value={p.id}>
                        {p.displayName || p.name}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>

              {/* Your Name (Optional) */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#17212B]">
                  Your Name / Contact <span className="text-[#17212B]/50 font-normal">(Optional)</span>
                </label>
                <Input
                  type="text"
                  placeholder="e.g. John Doe, QA Lead, or Client Rep"
                  value={reporterName}
                  onChange={(e) => setReporterName(e.target.value)}
                  className="h-10 text-xs rounded-xl bg-white border-[#17212B]/20"
                />
              </div>

              {/* Issue Description */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#17212B]">
                  Issue Description *
                </label>
                <textarea
                  rows={5}
                  required
                  placeholder="Please describe the issue, bug, or requested task in detail. Include steps to reproduce if applicable..."
                  value={issue}
                  onChange={(e) => setIssue(e.target.value)}
                  className="w-full text-xs rounded-2xl bg-white border border-[#17212B]/20 p-3.5 focus:outline-none focus:ring-1 focus:ring-[#17212B] resize-y"
                />
                <div className="flex justify-between items-center text-[11px] text-[#17212B]/50 px-1">
                  <span>Minimum 5 characters</span>
                  <span>{issue.length} characters</span>
                </div>
              </div>

              {/* Photo Upload */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#17212B] flex items-center justify-between">
                  <span>Photo / Screenshot</span>
                  <span className="text-[11px] font-normal text-[#17212B]/60">
                    Direct upload to cloud storage
                  </span>
                </label>

                {photoPreview ? (
                  <div className="relative border border-[#17212B]/15 rounded-2xl p-3 bg-[#F5F7F8]/50 flex items-center gap-3">
                    <img
                      src={photoPreview}
                      alt="Upload preview"
                      className="h-20 w-20 object-cover rounded-xl border border-[#17212B]/10 shrink-0 shadow-sm"
                    />
                    <div className="flex-1 min-w-0 text-xs">
                      <div className="font-semibold text-[#17212B] truncate">
                        {selectedFile?.name}
                      </div>
                      <div className="text-[11px] text-[#17212B]/60">
                        {selectedFile ? `${(selectedFile.size / 1024).toFixed(1)} KB` : ""}
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleClearPhoto}
                      className="h-8 px-2.5 rounded-lg text-xs text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                    >
                      <X className="h-4 w-4 mr-1" />
                      Remove
                    </Button>
                  </div>
                ) : (
                  <label className="border-2 border-dashed border-[#17212B]/20 hover:border-[#17212B]/40 transition-colors rounded-2xl p-6 flex flex-col items-center justify-center cursor-pointer bg-white group">
                    <div className="h-10 w-10 rounded-full bg-[#F5F7F8] flex items-center justify-center text-[#17212B]/60 group-hover:text-[#17212B] transition-colors mb-2">
                      <Upload className="h-5 w-5" />
                    </div>
                    <div className="text-xs font-semibold text-[#17212B]">
                      Click to upload screenshot or drag and drop
                    </div>
                    <div className="text-[11px] text-[#17212B]/50 mt-0.5">
                      PNG, JPG, or WEBP (Max 15MB)
                    </div>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                  </label>
                )}
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                disabled={submitting || loadingDirectory || !selectedClient || !selectedProjectId || !issue.trim()}
                className="w-full h-11 rounded-2xl text-xs font-semibold gap-2 mt-4"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>{uploadingPhoto ? "Uploading photo to cloud..." : "Submitting ticket..."}</span>
                  </>
                ) : (
                  <>
                    <span>Submit Ticket</span>
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>
            </form>
          </div>
        )}

        {/* Footer info */}
        <div className="text-center text-[11px] text-[#17212B]/50">
          Support Portal • Internal Development Ticketing System
        </div>
      </div>
    </div>
  );
}
