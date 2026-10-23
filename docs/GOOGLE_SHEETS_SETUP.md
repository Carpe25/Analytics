# Google Sheets Integration Setup Guide

## Overview

Project Time Analytics uses the **Google Sheets API v4** server-side to read developer work logs directly from your spreadsheets.

> **Key Rule:** The integration is strictly **read-only**. The application never edits, deletes, sorts, or modifies your Google Sheets in any way.

---

## 1. Creating Google Cloud Credentials (Service Account)

To grant server-side access to read your spreadsheets:

### Step 1: Open Google Cloud Console
1. Go to [Google Cloud Console](https://console.cloud.google.com/).
2. Create a new project (e.g. `Time-Analytics-Sync`) or select an existing one.

### Step 2: Enable Google Sheets API
1. Navigate to **APIs & Services** > **Library**.
2. Search for **Google Sheets API**.
3. Click **Enable**.

### Step 3: Create a Service Account
1. Go to **APIs & Services** > **Credentials**.
2. Click **Create Credentials** > **Service Account**.
3. Fill in the details:
   - **Service account name**: `time-analytics-sync-sa`
   - **Service account ID**: `time-analytics-sync-sa`
4. Click **Create and Continue**. (No specific project roles are needed as access is controlled per-sheet).
5. Click **Done**.
6. Copy the generated email address, which looks like:
   ```
   time-analytics-sync-sa@your-project-id.iam.gserviceaccount.com
   ```

### Step 4: Generate Private Key
1. In the **Credentials** list, click on your newly created Service Account.
2. Go to the **Keys** tab.
3. Click **Add Key** > **Create new key**.
4. Choose **JSON** and click **Create**. A `.json` key file will download to your computer.
5. Open this file in a text editor. You will need:
   - `client_email` -> Maps to `GOOGLE_SERVICE_ACCOUNT_EMAIL`
   - `private_key` -> Maps to `GOOGLE_PRIVATE_KEY`

---

## 2. Sharing Spreadsheets with the Service Account

In Google Sheets:
1. Open the spreadsheet where developers log their time.
2. Click the **Share** button in the top right.
3. Paste your Service Account email address (`time-analytics-sync-sa@...iam.gserviceaccount.com`).
4. Set permission to **Viewer** (Read-only).
5. Uncheck "Notify people" and click **Share**.

---

## 3. Finding Your Spreadsheet ID

The Spreadsheet ID is the string between `/d/` and `/edit` in your spreadsheet URL:
```
https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit
                                        ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
                                                    SPREADSHEET ID
```

---

## 4. Configuring Sheets & Column Mappings in the UI

1. Start the app and open `http://localhost:3000/settings`.
2. Under **Google Sheets Configuration**:
   - Paste your **Spreadsheet ID**.
   - Click **Test Sheet Access** to verify the service account can connect and read available tabs.
   - Add/edit **Developer Tab Mappings**: Each developer should have their tab name specified (e.g., Tab: `Jay`, Developer Name: `Jay`, ID: `dev-jay`).
   - Customize **Column Header Names** to match your sheet (e.g., `Date`, `Hours`, `Project`, `Category`, `Description`, `Ticket ID`).
3. Click **Save Changes**.
4. Click **Sync Google Sheets now** to test your first sync run!
