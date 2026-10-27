"use client";

import React, { useState, useEffect } from "react";
import { FolderGit2, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
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
import { notifySyncCompleted } from "@/lib/events/sync-bus";

interface ProjectOption {
  id: string;
  name: string;
  code?: string;
  client?: string;
}

interface ConnectRepoDialogProps {
  isOpen: boolean;
  onClose: () => void;
  defaultProjectId?: string;
  onSuccess?: () => void;
}

export function ConnectRepoDialog({
  isOpen,
  onClose,
  defaultProjectId,
  onSuccess,
}: ConnectRepoDialogProps) {
  const [projectsList, setProjectsList] = useState<ProjectOption[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>(defaultProjectId || "");
  const [owner, setOwner] = useState("");
  const [repo, setRepo] = useState("");
  const [branch, setBranch] = useState("main");
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (defaultProjectId) {
      setSelectedProjectId(defaultProjectId);
    }
  }, [defaultProjectId]);

  useEffect(() => {
    if (isOpen) {
      fetch("/api/projects")
        .then((res) => res.json())
        .then((data) => {
          if (data?.projects && Array.isArray(data.projects)) {
            setProjectsList(data.projects);
            if (!selectedProjectId && !defaultProjectId && data.projects.length > 0) {
              setSelectedProjectId(data.projects[0].id);
            }
          }
        })
        .catch(() => {});
    }
  }, [isOpen, defaultProjectId, selectedProjectId]);

  const handleTestConnection = async () => {
    if (!owner.trim() || !repo.trim()) {
      setTestResult({ success: false, message: "Please provide both GitHub Owner and Repository name." });
      return;
    }

    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/integrations/github/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ owner: owner.trim(), repo: repo.trim() }),
      });
      const data = await res.json();
      setTestResult({ success: data.success, message: data.message });
      if (data.defaultBranch && !branch) {
        setBranch(data.defaultBranch);
      }
    } catch (err: any) {
      setTestResult({ success: false, message: err.message || "Network error while testing connection." });
    } finally {
      setTesting(false);
    }
  };

  const handleSaveConnection = async () => {
    const targetId = selectedProjectId || defaultProjectId;
    if (!targetId) {
      setSaveError("Please select a project to connect.");
      return;
    }
    if (!owner.trim() || !repo.trim()) {
      setSaveError("Owner and Repository names are required.");
      return;
    }

    setSaving(true);
    setSaveError(null);

    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(targetId)}/repos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          owner: owner.trim(),
          repo: repo.trim(),
          defaultBranch: branch.trim() || "main",
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to save repository connection.");
      }

      notifySyncCompleted({ timestamp: new Date().toISOString() });
      setOwner("");
      setRepo("");
      setTestResult(null);
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      setSaveError(err.message || "An unexpected error occurred while saving.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <FolderGit2 className="h-5 w-5 text-[#17212B]" />
            <DialogTitle>Connect GitHub Repository</DialogTitle>
          </div>
          <DialogDescription>
            Link a GitHub repository to a project. Commits will be synchronized and associated with project activity.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Project Selection */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#17212B]">Project</label>
            <Select
              value={selectedProjectId || defaultProjectId || ""}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              disabled={Boolean(defaultProjectId)}
            >
              {projectsList.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.client ? `[${p.client}] ` : ""}{p.name} {p.code ? `(${p.code})` : ""}
                </option>
              ))}
            </Select>
          </div>

          {/* GitHub Owner / Org */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#17212B]">GitHub Owner / Organization</label>
            <Input
              placeholder="e.g. vercel or octocat or your-company"
              value={owner}
              onChange={(e) => setOwner(e.target.value)}
            />
          </div>

          {/* Repository Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#17212B]">Repository Name</label>
            <Input
              placeholder="e.g. next.js or api-service"
              value={repo}
              onChange={(e) => setRepo(e.target.value)}
            />
          </div>

          {/* Default Branch */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#17212B]">Default Branch</label>
            <Input
              placeholder="main or master"
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
            />
          </div>

          {/* Test Status Feedback */}
          {testResult && (
            <div
              className={`p-3 rounded text-xs border ${
                testResult.success
                  ? "border-[#17212B]/40 bg-[#17212B]/10"
                  : "border-[#17212B]/30 bg-[#17212B]/5"
              }`}
            >
              <div className="flex items-center gap-1.5 font-semibold text-[#17212B]">
                {testResult.success ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <AlertCircle className="h-4 w-4" />
                )}
                <span>{testResult.success ? "Connection Verified" : "Verification Notice"}</span>
              </div>
              <p className="mt-1 text-[11px] text-[#17212B]/85 font-mono">{testResult.message}</p>
            </div>
          )}

          {saveError && (
            <div className="p-3 rounded text-xs border border-[#17212B]/40 bg-[#17212B]/10 text-[#17212B]">
              <div className="flex items-center gap-1.5 font-semibold">
                <AlertCircle className="h-4 w-4" />
                <span>Error Saving</span>
              </div>
              <p className="mt-1 text-[11px] text-[#17212B]/85">{saveError}</p>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleTestConnection}
            disabled={testing || !owner || !repo}
            className="gap-1.5"
          >
            {testing && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            <span>Test Connection</span>
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={handleSaveConnection}
            disabled={saving || !owner || !repo}
            className="gap-1.5"
          >
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            <span>Save & Connect</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
