"use client";

import React, { useEffect, useState } from "react";
import {
  FolderGit2,
  FileSpreadsheet,
  Database,
  Clock,
  CheckCircle2,
  AlertCircle,
  Plus,
  Trash2,
  ExternalLink,
  ShieldCheck,
  Loader2,
  Save,
} from "lucide-react";
import { Header } from "@/components/layout/header";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ConnectRepoDialog } from "@/components/github/connect-repo-dialog";
import { IntegrationSettings } from "@/types";

export default function SettingsPage() {
  const [settings, setSettings] = useState<IntegrationSettings | null>(null);
  const [envStatus, setEnvStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  // Google Sheets Test state
  const [testingGoogle, setTestingGoogle] = useState(false);
  const [googleTestResult, setGoogleTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // GitHub dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string | undefined>();

  const loadData = () => {
    setLoading(true);
    Promise.all([
      fetch("/api/settings").then((r) => r.json()),
      fetch("/api/integrations/status").then((r) => r.json()),
    ])
      .then(([settingsData, statusData]) => {
        if (settingsData?.settings) setSettings(settingsData.settings);
        if (statusData?.status) setEnvStatus(statusData.status);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSaveSettings = async () => {
    if (!settings) return;
    setSaving(true);
    setSaveStatus(null);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to save settings");
      }
      setSaveStatus("Settings saved successfully.");
      setTimeout(() => setSaveStatus(null), 4000);
    } catch (err: any) {
      setSaveStatus(`Error saving: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleTestGoogleSheets = async () => {
    if (!settings?.googleSheets?.spreadsheetId) {
      setGoogleTestResult({
        success: false,
        message: "Please enter a Spreadsheet ID below before testing.",
      });
      return;
    }

    setTestingGoogle(true);
    setGoogleTestResult(null);
    try {
      const res = await fetch("/api/integrations/google/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ spreadsheetId: settings.googleSheets.spreadsheetId }),
      });
      const data = await res.json();
      setGoogleTestResult({ success: data.success, message: data.message });
    } catch (err: any) {
      setGoogleTestResult({ success: false, message: err.message || "Failed to test connection." });
    } finally {
      setTestingGoogle(false);
    }
  };

  const handleAddProject = () => {
    if (!settings) return;
    const newId = `proj-${Date.now().toString().slice(-4)}`;
    setSettings({
      ...settings,
      projects: [
        ...settings.projects,
        {
          id: newId,
          name: "New Project",
          code: "NP",
          client: "Carpe Diem",
          aliases: [],
          githubRepos: [],
        },
      ],
    });
  };

  const handleRemoveProject = (id: string) => {
    if (!settings) return;
    if (!confirm("Are you sure you want to remove this project?")) return;
    setSettings({
      ...settings,
      projects: settings.projects.filter((p) => p.id !== id),
    });
  };

  const handleAddSheetTab = () => {
    if (!settings) return;
    setSettings({
      ...settings,
      googleSheets: {
        ...settings.googleSheets,
        tabs: [
          ...settings.googleSheets.tabs,
          {
            tabName: `DevTab${settings.googleSheets.tabs.length + 1}`,
            developerName: `Developer ${settings.googleSheets.tabs.length + 1}`,
            developerId: `dev-${settings.googleSheets.tabs.length + 1}`,
          },
        ],
      },
    });
  };

  const handleRemoveSheetTab = (index: number) => {
    if (!settings) return;
    const newTabs = [...settings.googleSheets.tabs];
    newTabs.splice(index, 1);
    setSettings({
      ...settings,
      googleSheets: {
        ...settings.googleSheets,
        tabs: newTabs,
      },
    });
  };

  const handleDisconnectRepo = (projectId: string, owner: string, repo: string) => {
    if (!settings) return;
    const updated = settings.projects.map((p) => {
      if (p.id === projectId) {
        return {
          ...p,
          githubRepos: (p.githubRepos || []).filter(
            (r) => !(r.owner.toLowerCase() === owner.toLowerCase() && r.repo.toLowerCase() === repo.toLowerCase())
          ),
        };
      }
      return p;
    });
    setSettings({ ...settings, projects: updated });
  };

  if (loading && !settings) {
    return (
      <div className="flex-1 p-12 text-center text-xs text-[#17212B]/60">
        <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2 opacity-50" />
        Loading settings...
      </div>
    );
  }

  if (!settings) return null;

  return (
    <div className="flex-1 flex flex-col pb-12">
      <Header
        title="Settings & Integrations"
        description="Configure Google Sheets sources, GitHub repositories, and synchronization rules without a database"
        actions={
          <Button
            size="sm"
            onClick={handleSaveSettings}
            disabled={saving}
            className="gap-1.5 text-xs font-medium"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            <span>Save Settings</span>
          </Button>
        }
      />

      <div className="w-full max-w-none px-8 py-6 space-y-8 font-sans">
        {saveStatus && (
          <div className="p-3 rounded border border-[#17212B]/30 bg-[#17212B]/10 text-xs font-mono text-[#17212B]">
            {saveStatus}
          </div>
        )}

        {/* SECTION 1: CREDENTIALS & SYSTEM STATUS */}
        <div className="pb-8 border-b border-[#17212B]/15 space-y-4">
          <div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-[#17212B]" />
              <h3 className="text-sm font-bold text-[#17212B]">Server Credentials & Storage Status</h3>
            </div>
            <p className="text-xs text-[#17212B]/70 mt-1">
              Secrets are loaded securely server-side from environment variables and never exposed to the browser.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-mono">
            {/* Google Sheets Status */}
            <div className="p-3 border-l-2 border-[#17212B] bg-[#17212B]/5">
              <div className="font-semibold text-[#17212B] flex items-center gap-1.5">
                <FileSpreadsheet className="h-3.5 w-3.5" />
                <span>Google Sheets API</span>
              </div>
              <div className="mt-2 text-[11px] text-[#17212B]/80 space-y-1">
                <div>Status: {envStatus?.google?.configured ? "Configured" : "Not configured"}</div>
                <div>Mode: {envStatus?.google?.mode || "service_account"}</div>
                {envStatus?.google?.serviceAccount && (
                  <div className="truncate">Account: {envStatus.google.serviceAccount}</div>
                )}
              </div>
            </div>

            {/* GitHub API Status */}
            <div className="p-3 border-l-2 border-[#17212B] bg-[#17212B]/5">
              <div className="font-semibold text-[#17212B] flex items-center gap-1.5">
                <FolderGit2 className="h-3.5 w-3.5" />
                <span>GitHub API</span>
              </div>
              <div className="mt-2 text-[11px] text-[#17212B]/80 space-y-1">
                <div>Status: {envStatus?.github?.configured ? "Configured" : "Not configured"}</div>
                <div>Mode: {envStatus?.github?.mode || "token"}</div>
                <div>Token Present: {envStatus?.github?.tokenPresent ? "Yes" : "No"}</div>
              </div>
            </div>

            {/* Artifact Storage Status */}
            <div className="p-3 border-l-2 border-[#17212B] bg-[#17212B]/5">
              <div className="font-semibold text-[#17212B] flex items-center gap-1.5">
                <Database className="h-3.5 w-3.5" />
                <span>Artifact Storage</span>
              </div>
              <div className="mt-2 text-[11px] text-[#17212B]/80 space-y-1">
                <div>Provider: {envStatus?.storage?.provider || "local"}</div>
                <div>Durable S3: {envStatus?.storage?.isLocal ? "No (Local adapter)" : "Yes"}</div>
                <div>Timezone: {envStatus?.appTimezone || "Asia/Kolkata"}</div>
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 2: GITHUB REPOSITORIES CONNECTED TO EACH PROJECT */}
        <div className="pb-8 border-b border-[#17212B]/15 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <FolderGit2 className="h-4 w-4 text-[#17212B]" />
                <h3 className="text-sm font-bold text-[#17212B]">Project & GitHub Repositories</h3>
              </div>
              <p className="text-xs text-[#17212B]/70 mt-0.5">
                Connect one or more GitHub repositories to each project. Commit history will be fetched during sync.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleAddProject}
                className="gap-1 text-xs"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add Project</span>
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  setSelectedProjectId(undefined);
                  setDialogOpen(true);
                }}
                className="gap-1.5 text-xs"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Connect GitHub Repository</span>
              </Button>
            </div>
          </div>

          <div className="space-y-4 pt-2">
            {settings.projects.map((proj, pIndex) => (
              <div
                key={proj.id}
                className="py-3 border-b border-[#17212B]/10 space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Input
                      value={proj.name}
                      onChange={(e) => {
                        const updated = [...settings.projects];
                        updated[pIndex].name = e.target.value;
                        setSettings({ ...settings, projects: updated });
                      }}
                      className="font-semibold text-xs h-8 w-48"
                      placeholder="Project Name"
                    />
                    <Input
                      value={proj.code || ""}
                      onChange={(e) => {
                        const updated = [...settings.projects];
                        updated[pIndex].code = e.target.value;
                        setSettings({ ...settings, projects: updated });
                      }}
                      className="font-mono text-xs h-8 w-20"
                      placeholder="Code"
                    />
                    <Input
                      value={proj.client || ""}
                      onChange={(e) => {
                        const updated = [...settings.projects];
                        updated[pIndex].client = e.target.value;
                        setSettings({ ...settings, projects: updated });
                      }}
                      className="text-xs h-8 w-36"
                      placeholder="Client (e.g. Carpe Diem)"
                    />
                    <span className="text-[10px] text-[#17212B]/60 font-mono">ID: {proj.id}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedProjectId(proj.id);
                        setDialogOpen(true);
                      }}
                      className="h-7 text-xs gap-1"
                    >
                      <Plus className="h-3 w-3" />
                      <span>Link Repo</span>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveProject(proj.id)}
                      className="h-7 w-7 p-0 text-[#17212B]"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                {/* Connected Repositories List for this project */}
                <div className="text-xs">
                  <span className="font-semibold text-[#17212B] text-[11px]">Connected Repositories:</span>
                  {(!proj.githubRepos || proj.githubRepos.length === 0) ? (
                    <div className="text-[11px] text-[#17212B]/60 italic mt-1">
                      No repositories linked to this project yet. Click "Link Repo" to connect one.
                    </div>
                  ) : (
                    <div className="mt-1.5 space-y-1.5">
                      {proj.githubRepos.map((repo) => (
                        <div
                          key={`${repo.owner}/${repo.repo}`}
                          className="flex items-center justify-between p-2 border-l-2 border-[#17212B] bg-[#17212B]/5 text-xs font-mono"
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-[#17212B]">
                              {repo.owner}/{repo.repo}
                            </span>
                            <Badge variant="outline" className="text-[10px]">
                              Branch: {repo.defaultBranch || "main"}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-1">
                            <a
                              href={`https://github.com/${repo.owner}/${repo.repo}`}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1 hover:opacity-75"
                            >
                              <ExternalLink className="h-3 w-3" />
                            </a>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDisconnectRepo(proj.id, repo.owner, repo.repo)}
                              className="h-6 w-6 p-0 text-[#17212B]"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* SECTION 3: GOOGLE SHEETS SOURCES & COLUMN MAPPING */}
        <div className="pb-8 border-b border-[#17212B]/15 space-y-5">
          <div>
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="h-4 w-4 text-[#17212B]" />
              <h3 className="text-sm font-bold text-[#17212B]">Google Sheets Configuration</h3>
            </div>
            <p className="text-xs text-[#17212B]/70 mt-0.5">
              Specify your Google Spreadsheet ID, tab names for each developer, and column header names.
            </p>
          </div>

          <div className="space-y-5">
            {/* Spreadsheet ID & Connection Test */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#17212B]">Spreadsheet ID or URL</label>
              <div className="flex gap-2">
                <Input
                  placeholder="e.g. 1W2ost-DV0kjDOahoAkwEbX-c5-BhPWzuAQbxxHiaXkk or full Google Sheets URL"
                  value={settings.googleSheets.spreadsheetId}
                  onChange={(e) => {
                    const raw = e.target.value;
                    const cleanId = raw.includes("/spreadsheets/d/")
                      ? raw.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)?.[1] || raw
                      : raw.trim();
                    setSettings({
                      ...settings,
                      googleSheets: {
                        ...settings.googleSheets,
                        spreadsheetId: cleanId,
                      },
                    });
                  }}
                  className="font-mono text-xs"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleTestGoogleSheets}
                  disabled={testingGoogle}
                  className="gap-1.5 text-xs whitespace-nowrap"
                >
                  {testingGoogle && <Loader2 className="h-3 w-3 animate-spin" />}
                  <span>Test Sheet Access</span>
                </Button>
              </div>
              <p className="text-[10px] text-[#17212B]/60">
                Found in the Google Sheet URL: https://docs.google.com/spreadsheets/d/
                <strong>[SPREADSHEET_ID]</strong>/edit
              </p>
            </div>

            {googleTestResult && (
              <div
                className={`p-3 text-xs border-l-2 ${
                  googleTestResult.success
                    ? "border-[#17212B] bg-[#17212B]/10"
                    : "border-[#17212B]/50 bg-[#17212B]/5"
                }`}
              >
                <div className="flex items-center gap-1.5 font-semibold text-[#17212B]">
                  {googleTestResult.success ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : (
                    <AlertCircle className="h-4 w-4" />
                  )}
                  <span>{googleTestResult.success ? "Success" : "Connection Notice"}</span>
                </div>
                <p className="mt-1 text-[11px] text-[#17212B]/85 font-mono">{googleTestResult.message}</p>
              </div>
            )}

            {/* Developer Tabs */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-semibold text-[#17212B]">Developer Tab Mappings</h4>
                  <p className="text-[11px] text-[#17212B]/60">
                    Each tab represents a developer's individual log sheet.
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAddSheetTab}
                  className="h-7 text-xs gap-1"
                >
                  <Plus className="h-3 w-3" />
                  <span>Add Tab</span>
                </Button>
              </div>

              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-b border-[#17212B]/15">
                      <TableHead className="text-xs">Worksheet / Tab Name</TableHead>
                      <TableHead className="text-xs">Developer Display Name</TableHead>
                      <TableHead className="text-xs">Developer ID</TableHead>
                      <TableHead className="w-16"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {settings.googleSheets.tabs.map((tab, idx) => (
                      <TableRow key={idx} className="border-b border-[#17212B]/10">
                        <TableCell>
                          <Input
                            value={tab.tabName}
                            onChange={(e) => {
                              const updated = [...settings.googleSheets.tabs];
                              updated[idx].tabName = e.target.value;
                              setSettings({
                                ...settings,
                                googleSheets: { ...settings.googleSheets, tabs: updated },
                              });
                            }}
                            className="h-8 text-xs font-mono"
                            placeholder="Tab Name"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            value={tab.developerName}
                            onChange={(e) => {
                              const updated = [...settings.googleSheets.tabs];
                              updated[idx].developerName = e.target.value;
                              setSettings({
                                ...settings,
                                googleSheets: { ...settings.googleSheets, tabs: updated },
                              });
                            }}
                            className="h-8 text-xs"
                            placeholder="Developer Name"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            value={tab.developerId}
                            onChange={(e) => {
                              const updated = [...settings.googleSheets.tabs];
                              updated[idx].developerId = e.target.value;
                              setSettings({
                                ...settings,
                                googleSheets: { ...settings.googleSheets, tabs: updated },
                              });
                            }}
                            className="h-8 text-xs font-mono"
                            placeholder="dev-id"
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveSheetTab(idx)}
                            className="h-7 w-7 p-0"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* Column Headers Mapping */}
            <div className="space-y-3 pt-3 border-t border-[#17212B]/10">
              <h4 className="text-xs font-semibold text-[#17212B]">Column Header Names in Sheet</h4>
              <p className="text-[11px] text-[#17212B]/60">
                Matches the column title row in the spreadsheet. Case-insensitive substring matching is used.
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-[#17212B]/75">Date Column</label>
                  <Input
                    value={settings.googleSheets.columnMapping.date}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        googleSheets: {
                          ...settings.googleSheets,
                          columnMapping: {
                            ...settings.googleSheets.columnMapping,
                            date: e.target.value,
                          },
                        },
                      })
                    }
                    className="h-8 text-xs font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-[#17212B]/75">Duration/Hours Column</label>
                  <Input
                    value={settings.googleSheets.columnMapping.duration}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        googleSheets: {
                          ...settings.googleSheets,
                          columnMapping: {
                            ...settings.googleSheets.columnMapping,
                            duration: e.target.value,
                          },
                        },
                      })
                    }
                    className="h-8 text-xs font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-[#17212B]/75">Project Column</label>
                  <Input
                    value={settings.googleSheets.columnMapping.project}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        googleSheets: {
                          ...settings.googleSheets,
                          columnMapping: {
                            ...settings.googleSheets.columnMapping,
                            project: e.target.value,
                          },
                        },
                      })
                    }
                    className="h-8 text-xs font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-[#17212B]/75">Category Column</label>
                  <Input
                    value={settings.googleSheets.columnMapping.category}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        googleSheets: {
                          ...settings.googleSheets,
                          columnMapping: {
                            ...settings.googleSheets.columnMapping,
                            category: e.target.value,
                          },
                        },
                      })
                    }
                    className="h-8 text-xs font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-[#17212B]/75">Description Column</label>
                  <Input
                    value={settings.googleSheets.columnMapping.description}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        googleSheets: {
                          ...settings.googleSheets,
                          columnMapping: {
                            ...settings.googleSheets.columnMapping,
                            description: e.target.value,
                          },
                        },
                      })
                    }
                    className="h-8 text-xs font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-[#17212B]/75">Ticket ID (Optional)</label>
                  <Input
                    value={settings.googleSheets.columnMapping.taskTicketId || ""}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        googleSheets: {
                          ...settings.googleSheets,
                          columnMapping: {
                            ...settings.googleSheets.columnMapping,
                            taskTicketId: e.target.value,
                          },
                        },
                      })
                    }
                    className="h-8 text-xs font-mono"
                  />
                </div>
              </div>
            </div>
          </div>
          <div className="pt-2 flex justify-end">
            <Button size="sm" onClick={handleSaveSettings} disabled={saving} className="gap-1.5 text-xs">
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              <span>Save Changes</span>
            </Button>
          </div>
        </div>

        {/* SECTION 4: NIGHTLY CRON SYNCHRONIZATION GUIDE */}
        <div className="pb-8 space-y-3">
          <div>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-[#17212B]" />
              <h3 className="text-sm font-bold text-[#17212B]">Nightly Scheduled Job Setup</h3>
            </div>
            <p className="text-xs text-[#17212B]/70 mt-0.5">
              Configured schedule: 11:59 PM Asia/Kolkata (18:29 UTC) daily.
            </p>
          </div>
          <div className="text-xs text-[#17212B]/85 space-y-2 font-mono p-4 border-l-2 border-[#17212B] bg-[#17212B]/5">
            <div>Endpoint: <strong>POST /api/cron/sync</strong></div>
            <div>
              Authentication Header: <strong>Authorization: Bearer [CRON_SECRET]</strong>
            </div>
            <div>Cron Expression (UTC): <strong>29 18 * * *</strong></div>
            <p className="font-sans text-[11px] text-[#17212B]/70 pt-1">
              Trigger this endpoint via system crontab, GitHub Actions, Vercel Cron, or Cloudflare Workers.
            </p>
          </div>
        </div>
      </div>

      <ConnectRepoDialog
        isOpen={dialogOpen}
        onClose={() => setDialogOpen(false)}
        defaultProjectId={selectedProjectId}
        onSuccess={loadData}
      />
    </div>
  );
}
