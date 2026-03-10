# Notion Rent Tracker Firefox Extension

This extension allows you to quickly add rental property information to a Notion database.

## Features
- Automatically grabs the current tab's URL and title.
- Checks if the URL already exists in your Notion database before adding.
- Allows inputting price, area, time to work, and other property details.

## Notion Setup

1.  **Create a Notion Database:**
    - Create a new database in Notion (e.g., "Rental Searches").
    - Add the following properties with the EXACT names and types:
        - `Title` (Type: Title)
        - `Address` (Type: Text/Rich Text)
        - `Price` (Type: Number)
        - `City` (Type: Text/Rich Text)
        - `Postal Code` (Type: Text/Rich Text)
        - `Neighborhood` (Type: Text/Rich Text)
        - `Time to Work` (Type: Number)
        - `Area` (Type: Number)
        - `Has Parking` (Type: Status) - Options: "Yes", "No", "Unknown"
        - `Has Cave` (Type: Status) - Options: "Yes", "No", "Unknown"
        - `Furnished` (Type: Status) - Options: "Yes", "No", "Unknown"
        - `State` (Type: Status) - Recommended options: "Interested", "Contacted", "Visited", "Applied", "Rejected"
        - `Agency` (Type: Text/Rich Text)
        - `Agency Address` (Type: Text/Rich Text)
        - `Phone` (Type: Phone Number)
        - `URL` (Type: URL)
        - `Date Added` (Type: Date)

2.  **Create a Notion Integration:**
    - Go to [Notion Developers - My Integrations](https://www.notion.so/my-integrations).
    - Create a new integration, give it a name, and copy the **Internal Integration Secret**.
    - Connect the integration to your database:
        - Open your database in Notion.
        - Click the "..." in the top right.
        - Click "Add connections" and search for your integration's name.

3.  **Get Database ID:**
    - The Database ID is the part of the URL after the workspace name and before the `?v=...`.
    - Example: `https://www.notion.so/myworkspace/a8aec43384f447ed84390e6e42c2e089?v=...` -> ID is `a8aec43384f447ed84390e6e42c2e089`.

## Installation (Firefox)

1.  Open Firefox and go to `about:debugging`.
2.  Click "This Firefox".
3.  Click "Load Temporary Add-on...".
4.  Navigate to this project's `src` folder and select `manifest.json`.
5.  The extension should now appear in your extensions list.
6.  Click the extension icon, go to Settings (gear icon), and enter your **Notion API Key** and **Database ID**.

## Permissions (CRITICAL for Firefox)

In Firefox Manifest V3, host permissions are **optional by default**. To avoid "Cross-Origin Request Blocked" (CORS) errors, you **must** manually enable them:

1.  Go to `about:addons` in Firefox.
2.  Find **Notion Rent Tracker** and click on it.
3.  Go to the **Permissions** tab.
4.  Toggle **ON** the permissions for:
    - `https://api.notion.com/*`
    - `https://maps.googleapis.com/*`
    - `https://openrouter.ai/*`

## Architecture: CORS & Background Fetching

To comply with modern browser security and avoid CORS issues, this extension uses a **Background Script** architecture:
- All external API calls (Notion, Google Maps, OpenRouter) are routed through `src/background.js`.
- The popup sends a message to the background script using `browser.runtime.sendMessage`.
- The background script performs the `fetch` from a privileged context and returns the data.
- This bypasses CORS restrictions that would otherwise block direct requests from the extension popup.
