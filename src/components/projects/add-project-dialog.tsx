"use client";

import React, { useState, useEffect } from "react";
import { FolderGit2, Loader2, CheckCircle2, AlertCircle, Building2, Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Client } from "@/types";

interface AddProjectDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  onOpenAddClient?: () => void;
}

export function AddProjectDialog({
  isOpen,
  onClose,
  onSuccess,
  onOpenAddClient,
}: AddProjectDialogProps) {
  const [clients, setClients] = useState<Client[]>([]);
  const [loadingClients, setLoadingClients] = useState(false);

  const [name, setName] = useState("");
  const [selectedClientId, setSelectedClientId] = useState("");
  const [code, setCode] = useState("");
  const [aliases, setAliases] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const loadClients = async () => {
    setLoadingClients(true);
    try {
      const res = await fetch("/api/clients");
      const data = await res.json();
      if (data.clients) {
        setClients(data.clients);
        if (!selectedClientId && data.clients.length > 0) {
          setSelectedClientId(data.clients[0].id);
        }
      }
    } catch (err) {
      console.error("Failed to load clients:", err);
    } finally {
      setLoadingClients(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadClients();
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Please enter a project name.");
      return;
    }

    if (!selectedClientId) {
      setError("Please select a client for this project.");
      return;
    }

    const selectedClient = clients.find((c) => c.id === selectedClientId);

    setLoading(true);
    setError(null);

    try {
      const aliasesArray = aliases
        .split(",")
        .map((a) => a.trim())
        .filter(Boolean);

      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          clientId: selectedClientId,
          client: selectedClient?.name || "General",
          code: code.trim() || undefined,
          aliases: aliasesArray,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to create project");
      }

      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        setName("");
        setCode("");
        setAliases("");
        onClose();
        if (onSuccess) onSuccess();
      }, 800);
    } catch (err: any) {
      setError(err.message || "Failed to create project");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (loading) return;
    setError(null);
    setSuccess(false);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md p-6 bg-white rounded-3xl">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <div className="p-2 bg-[#17212B]/5 rounded-xl text-[#17212B]">
              <FolderGit2 className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-[#17212B]">
                Create New Project
              </DialogTitle>
              <DialogDescription className="text-xs text-[#17212B]/60">
                Add a project under a registered client to track time and receive tickets.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-xs text-red-700">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success ? (
          <div className="py-8 text-center space-y-2">
            <CheckCircle2 className="h-10 w-10 text-green-600 mx-auto" />
            <div className="text-sm font-semibold text-[#17212B]">
              Project Created Successfully!
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 pt-2">
            {/* Client Selection */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-[#17212B] flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5 text-[#17212B]/60" />
                  <span>Client *</span>
                </label>
                {onOpenAddClient && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenAddClient();
                    }}
                    className="text-[11px] text-[#17212B] hover:underline flex items-center gap-0.5 font-medium"
                  >
                    <Plus className="h-3 w-3" />
                    <span>New Client</span>
                  </button>
                )}
              </div>
              <Select
                value={selectedClientId}
                onChange={(e) => setSelectedClientId(e.target.value)}
                required
                disabled={loadingClients}
                className="text-xs h-9 bg-white border-[#17212B]/20"
              >
                {clients.length === 0 ? (
                  <option value="">Loading clients...</option>
                ) : (
                  clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.code ? `(${c.code})` : ""}
                    </option>
                  ))
                )}
              </Select>
            </div>

            {/* Project Name */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#17212B]">
                Project Name <span className="text-red-500">*</span>
              </label>
              <Input
                placeholder="e.g. Mobile App, E-Commerce Portal"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="text-xs h-9"
              />
            </div>

            {/* Project Code */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#17212B]">
                Project Code <span className="text-[#17212B]/40 font-normal">(Optional)</span>
              </label>
              <Input
                placeholder="e.g. MOB, ECOM"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                maxLength={8}
                className="text-xs h-9 uppercase font-mono"
              />
            </div>

            {/* Aliases */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#17212B]">
                Aliases / Alternative Names{" "}
                <span className="text-[#17212B]/40 font-normal">(Comma-separated, optional)</span>
              </label>
              <Input
                placeholder="e.g. iOS App, Android, Mobile"
                value={aliases}
                onChange={(e) => setAliases(e.target.value)}
                className="text-xs h-9"
              />
            </div>

            <DialogFooter className="pt-3 gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleClose}
                disabled={loading}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={loading || !name.trim() || !selectedClientId}
                className="text-xs gap-1.5"
              >
                {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                <span>Create Project</span>
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
