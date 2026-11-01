# Notion Rent Tracker Browser Extension (Chrome & Firefox)

This extension allows you to quickly add rental property information to a Notion database from any tab on Chrome, Firefox, Edge, and Brave.

## Features
- Automatically grabs the current tab's URL and title.
- Checks if the URL already exists in your Notion database before adding.
- Auto-fills listing details using AI (OpenRouter LLM).
- Calculates commute times (both transit and driving) and driving distance to your workplace using Google Maps.
- Analyzes neighborhood points of interest across two radii: **1.5 km (walking)** and **10 minutes by car** (using IGN Géoplateforme isochrone and OpenStreetMap Overpass API).
- Automatically writes a detailed POI breakdown (with names of stations, supermarkets, schools, etc.) as a **comment attached to the Notion page**, and logs summary counts into the `Neighborhood Analysis` property.
- Full cross-browser compatibility for **Chrome**, **Firefox**, **Edge**, and **Brave** (Manifest V3).

## Notion Setup

1.  **Create a Notion Database:**
    - Create a new database in Notion (e.g., "Rental Searches").
    - Add the following properties with the EXACT names and types:
        - `Title` (Type: Title)
        - `Top Pick` (Type: Checkbox)
        - `Reference` (Type: Text/Rich Text)
        - `Address` (Type: Text/Rich Text)
        - `Price` (Type: Number)
        - `City` (Type: Text/Rich Text)
        - `Postal Code` (Type: Text/Rich Text)
        - `Neighborhood` (Type: Text/Rich Text)
        - `Time to Work` (Type: Number)
        - `Transit Lines` (Type: Multi-select)
        - `Time to Work (Car)` (Type: Number)
        - `Distance to Work` (Type: Number)
        - `Area` (Type: Number)
        - `Has Parking` (Type: Status) - Options: "Yes", "No", "Unknown"
        - `Has Cave` (Type: Status) - Options: "Yes", "No", "Unknown"
        - `Furnished` (Type: Status) - Options: "Yes", "No", "Unknown"
        - `State` (Type: Status) - Recommended options: "Interested", "Contacted", "Visited", "Applied", "Rejected", "To follow up", "On Hold", "Offer made"
        - `Agency` (Type: Text/Rich Text)
        - `Agency Address` (Type: Text/Rich Text)
        - `Phone` (Type: Phone Number)
        - `URL` (Type: URL)
        - `Neighborhood Analysis` (Type: Text/Rich Text)
        - `Date Added` (Type: Date)

2.  **Create a Notion Integration:**
    - Go to [Notion Developers - My Integrations](https://www.notion.so/my-integrations).
    - Create a new integration, ensure **"Insert comments"** capability is checked (under Capabilities), and copy the **Internal Integration Secret**.
    - Connect the integration to your database:
        - Open your database in Notion.
        - Click the "..." in the top right.
        - Click "Add connections" and search for your integration's name.

3.  **Get Database ID:**
    - The Database ID is the part of the URL after the workspace name and before the `?v=...`.
    - Example: `https://www.notion.so/myworkspace/a8aec43384f447ed84390e6e42c2e089?v=...` -> ID is `a8aec43384f447ed84390e6e42c2e089`.

## Installation

### Chrome / Chromium / Edge / Brave
1.  Open `chrome://extensions` (or `edge://extensions` / `brave://extensions`).
2.  Enable **"Developer mode"** (top right toggle).
3.  Click **"Load unpacked"** and select the `src/` folder of this project.
4.  The extension should now appear in your extensions list.
5.  Click the extension icon, go to Settings (gear icon), and enter your keys and database ID.

### Firefox
1.  Open Firefox and go to `about:debugging`.
2.  Click **"This Firefox"**.
3.  Click **"Load Temporary Add-on..."**.
4.  Navigate to this project's `src` folder and select `manifest.json`.
5.  The extension should now appear in your extensions list.
6.  Click the extension icon, go to Settings (gear icon), and enter your **Notion API Key** and **Database ID**.

## Permissions (Host Permissions)

- **Chrome / Edge / Brave**: Host permissions are automatically granted upon installation.
- **Firefox MV3**: Host permissions are optional by default. You can:
  - Click the **"Grant"** button on the yellow banner that appears in the extension popup when permissions are missing, OR
  - Go to `about:addons` > **Notion Rent Tracker** > **Permissions** tab and toggle them **ON** for:
    - `https://api.notion.com/*`
    - `https://openrouter.ai/*`
    - `https://maps.googleapis.com/*`
    - `https://overpass-api.de/*`
    - `https://data.geopf.fr/*`

## Architecture: CORS & Background Fetching

To comply with modern browser security and avoid CORS issues, this extension uses a **Background Script / Service Worker** architecture:
- All external API calls (Notion, Google Maps, OpenRouter, Overpass OSM, IGN Géoplateforme) are routed through `src/background.js`.
- The popup sends a message to the background script using the universal `sendMessage` helper.
- The background script performs the `fetch` from a privileged context and returns the data.
- This bypasses CORS restrictions that would otherwise block direct requests from the extension popup.

## Neighborhood Analysis & Points of Interest

When clicking the **🔍 (Analyze Neighborhood)** button:
1. The address is geocoded using Google Maps Geocoding API.
2. A **10-minute driving isochrone** polygon is calculated via the French public **IGN Géoplateforme** API (`data.geopf.fr/navigation/isochrone`).
3. Points of interest are retrieved via **OpenStreetMap Overpass API** within the combined bounding box.
4. Amenities are categorized and classified into:
   - **📍 1.5 km Walking Radius** (Haversine distance $\le 1.5\text{ km}$)
   - **🚗 10-Minute Driving Isochrone** (Point-in-polygon ray-casting)
5. Upon saving or updating in Notion:
   - The summary counts are stored in the `Neighborhood Analysis` column.
   - A structured breakdown detailing the categories, counts, and names of nearby stations, supermarkets, schools, and amenities is posted as a **comment directly attached to the Notion page**.
