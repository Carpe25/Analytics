# GitHub Integration & Repository Connection Guide

## Overview

Project Time Analytics integrates with the GitHub REST API to fetch commits across your organization's repositories and map them to projects and developers.

> **Important Rule:** GitHub commit activity is kept **strictly separate from work hours**. Commits are never converted into time or used to infer hours worked.

---

## 1. Creating a GitHub Personal Access Token (PAT)

### Fine-Grained Personal Access Token (Recommended)
1. Go to [GitHub Settings > Developer Settings > Fine-grained tokens](https://github.com/settings/tokens?type=beta).
2. Click **Generate new token**.
3. Fill in the details:
   - **Token name**: `Time Analytics Sync`
   - **Expiration**: Select 90 days, 1 year, or custom.
   - **Resource owner**: Choose your organization or personal account.
   - **Repository access**: Choose *All repositories* or *Only select repositories* that you want to track.
4. Under **Permissions** > **Repository permissions**:
   - Set **Contents** to **Read-only** (this grants commit and branch read access).
   - Set **Metadata** to **Read-only** (automatically set).
5. Click **Generate token**.
6. Copy the token (starts with `github_pat_...`).
7. Paste it into your `.env` or `.env.local`:
   ```bash
   GITHUB_AUTH_MODE=token
   GITHUB_TOKEN=github_pat_yourTokenHere
   ```

### Classic Personal Access Token (Alternative)
1. Go to [GitHub Settings > Developer Settings > Personal access tokens (classic)](https://github.com/settings/tokens).
2. Click **Generate new token (classic)**.
3. Select scope:
   - `repo` (Full control of private repositories) or `public_repo` (if tracking public repos only).
4. Generate and save token in `GITHUB_TOKEN`.

---

## 2. Where & How to Connect GitHub Repositories from the UI

You can connect GitHub repositories to each project from two places in the user interface:

### Option A: From the Settings & Integrations Page (`/settings`)
1. Open the application and click **Settings / Integrations** in the left sidebar.
2. Scroll to the **Project & GitHub Repositories** section.
3. Click the **Connect GitHub Repository** button (or click **Link Repo** next to any specific project).
4. An interactive dialog will open:
   - **Project**: Select the target project (e.g. `Core Platform`, `Analytics UI`, or `Mobile App`).
   - **GitHub Owner / Organization**: Enter the org name or user handle (e.g. `facebook`, `vercel`, or your company name).
   - **Repository Name**: Enter the repository slug (e.g. `react`, `next.js`, `api-server`).
   - **Default Branch**: Enter `main` (or `master`).
5. Click **Test Connection**: The backend validates that your `GITHUB_TOKEN` has read access to that repository and returns immediate feedback.
6. Click **Save & Connect**: The repository is linked to the project and saved into durable storage (`settings.json`).

### Option B: Directly from Project Details (`/projects/[projectId]`)
1. Click **Projects** in the sidebar.
2. Select any project from the table to open its detail view.
3. In the top right header, click **Connect GitHub** (or click the **Sync / Source Details** tab and click **Connect Repository**).
4. Enter the repository details and verify the connection.
5. All future nightly syncs and manual syncs will now include commits for this project!

---

## 3. How Commit Authors are Matched to Developers

- The system matches commit author logins (`commit.author.login`) and commit names (`commit.author.name`) against the developer canonical names and mapped GitHub usernames configured in Settings.
- Unmatched commits remain visible under the project with their raw author name and login.
