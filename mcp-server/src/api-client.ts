export interface TrackerConfig {
  apiUrl: string;
  apiKey?: string;
  developerName?: string;
}

export function getTrackerConfig(): TrackerConfig {
  let apiUrl = process.env.TRACKER_API_URL?.trim() || "http://localhost:3000/api";
  apiUrl = apiUrl.replace(/\/+$/, "");
  if (!apiUrl.endsWith("/api")) {
    apiUrl = `${apiUrl}/api`;
  }

  return {
    apiUrl,
    apiKey: process.env.TRACKER_API_KEY?.trim(),
    developerName: process.env.DEVELOPER_NAME?.trim(),
  };
}

export class TrackerApiClient {
  private config: TrackerConfig;

  constructor(config?: Partial<TrackerConfig>) {
    const base = getTrackerConfig();
    this.config = {
      ...base,
      ...config,
    };
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
    };
    if (this.config.apiKey) {
      headers["Authorization"] = `Bearer ${this.config.apiKey}`;
      headers["x-api-key"] = this.config.apiKey;
    }
    return headers;
  }

  private async fetchWithFallback(endpoint: string, options: RequestInit): Promise<Response> {
    const urlsToTry = [this.config.apiUrl];
    if (this.config.apiUrl.includes("localhost:3000")) {
      urlsToTry.push(this.config.apiUrl.replace("localhost:3000", "localhost:3001"));
    } else if (this.config.apiUrl.includes("localhost:3001")) {
      urlsToTry.push(this.config.apiUrl.replace("localhost:3001", "localhost:3000"));
    }

    let lastError: any;
    for (const baseUrl of urlsToTry) {
      try {
        const path = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
        const fullUrl = `${baseUrl}${path}`;
        const res = await fetch(fullUrl, options);
        if (res.status === 503 && urlsToTry.length > 1) {
          continue;
        }
        return res;
      } catch (err) {
        lastError = err;
      }
    }
    throw lastError || new Error("Failed to connect to Analytics API");
  }

  async logWork(payload: {
    project: string;
    client?: string;
    duration: string | number;
    category: string;
    description: string;
    developerName?: string;
    taskTicketId?: string;
    date?: string;
  }) {
    const devName = payload.developerName || this.config.developerName;
    const body = {
      ...payload,
      developerName: devName,
    };

    const res = await this.fetchWithFallback("/work-logs", {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify(body),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const errDetails = data.details ? JSON.stringify(data.details) : "";
      throw new Error(data.error || `Failed to log work (HTTP ${res.status}): ${errDetails}`);
    }

    return data;
  }

  async listProjects() {
    const res = await this.fetchWithFallback("/projects", {
      method: "GET",
      headers: this.getHeaders(),
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch projects (HTTP ${res.status})`);
    }

    const data = await res.json();
    return (data.projects || []).map((p: any) => ({
      id: p.id,
      name: p.name,
      code: p.code || null,
      client: p.client || "Internal / Operations",
      totalHours: p.totalHours ?? 0,
    }));
  }

  async listCategories(): Promise<string[]> {
    const fallbackCategories = [
      "Frontend",
      "Backend",
      "Bug Fix",
      "Code Review",
      "Meeting",
      "DevOps",
      "Design",
      "Testing",
      "Docs/Proposal",
      "Deployment",
      "New Feature",
      "Development",
      "R&D",
    ];

    try {
      const res = await this.fetchWithFallback("/categories", {
        method: "GET",
        headers: this.getHeaders(),
      });

      if (!res.ok) return fallbackCategories;

      const data = await res.json();
      const activeCats: string[] = (data.categories || []).map((c: any) => c.name);
      return Array.from(new Set([...fallbackCategories, ...activeCats]));
    } catch {
      return fallbackCategories;
    }
  }

  async getMyLogs(developerName?: string, days: number = 1) {
    const dev = developerName || this.config.developerName;
    const params = new URLSearchParams();
    if (dev) params.set("developerName", dev);
    if (days) params.set("days", String(days));

    const res = await this.fetchWithFallback(`/work-logs?${params.toString()}`, {
      method: "GET",
      headers: this.getHeaders(),
    });

    if (!res.ok) {
      throw new Error(`Failed to query logs (HTTP ${res.status})`);
    }

    return await res.json();
  }
}
