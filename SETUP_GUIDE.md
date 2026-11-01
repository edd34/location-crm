# 🏠 Notion Rent Tracker - Setup Guide

This browser extension helps you quickly save rental property listings from websites like SeLoger, Bien'Ici, or LeBonCoin directly into your Notion database. It uses AI to extract information and Google Maps to calculate your commute time.

---

## 🛠 1. Installation

### For Firefox
1. Open Firefox and type `about:debugging` in the address bar.
2. Click on **"This Firefox"** in the left sidebar.
3. Click **"Load Temporary Add-on..."**.
4. Select the `manifest.json` file inside the `src/` folder of this project.

### For Chrome/Edge
1. Open `chrome://extensions`.
2. Enable **"Developer mode"** (top right).
3. Click **"Load unpacked"** and select the `src/` folder.

---

## 📊 2. Notion Database Setup

Your Notion database **must** have the following properties (columns) with the exact names and types listed below:

| Property Name | Type | Description |
| :--- | :--- | :--- |
| **Title** | Title | Name of the listing |
| **Top Pick** | Checkbox | For your favorite listings ❤️ |
| **Reference** | Text | Unique ID of the offer |
| **URL** | URL | Link to the original listing |
| **Price** | Number | Monthly rent in € |
| **Area** | Number | Surface in m² |
| **Address** | Text | Full address |
| **City** | Text | |
| **Postal Code** | Text | |
| **Neighborhood** | Text | |
| **Time to Work** | Number | Commute time in minutes (Transit) |
| **Transit Lines** | Multi-select | List of lines (e.g., RER A, Bus 123) |
| **Time to Work (Car)** | Number | Commute time by car in minutes |
| **Distance to Work** | Number | Commute distance in km |
| **Agency** | Text | Name of the agency |
| **Agency Address** | Text | |
| **Phone** | Phone | Contact number |
| **State** | Status | (Interested, Applied, Contacted, Visited, Offer made, On Hold, To follow up, Rejected, etc.) |
| **Has Parking** | Status | (Yes, No, Unknown) |
| **Has Cave** | Status | (Yes, No, Unknown) |
| **Furnished** | Status | (Yes, No, Unknown) |
| **Neighborhood Analysis**| Text | Summary of nearby amenities (1.5km & 10min car) |
| **Date Added** | Date | Automatically set when created |

---

## 🔑 3. Configuration

Click the **Settings (⚙️)** icon in the extension popup to enter your keys:

1.  **Notion API Key**: Create one at [developers.notion.com](https://developers.notion.com/).
2.  **Notion Database ID**: The string of characters in your database URL after the workspace name and before the `?`.
3.  **OpenRouter API Key**: (For AI Fill) Get one at [openrouter.ai](https://openrouter.ai/).
4.  **Google Maps API Key**: (For Travel Time) Required to calculate commute. Ensure "Directions API" is enabled.
5.  **Work Address**: Your destination address for travel time calculations.

---

## 🚀 4. How to Use

1.  **Go to a listing**: Open any rental property page.
2.  **Open the extension**: Click the extension icon.
3.  **✨ AI Fill**: Click this button. The AI will read the page and automatically fill in the price, area, address, reference, etc.
4.  **Top Pick (❤️)**: Click the heart if it's a property you really love.
5.  **Check travel time**: It calculates the commute to your "Work Address" automatically (transit time & lines, car travel time, and distance in km).
6.  **🔍 Analyze Neighborhood**: Click the magnifying glass to analyze points of interest within **1.5km (walking)** and **10 minutes by car** (powered by IGN isochrone & OpenStreetMap). Detailed lists and radii are automatically added to the Notion page description upon saving.
7.  **Add to Notion**: Click the blue button. If the property was already saved, the button will turn green and say **"Update in Notion"**.

---

## 💡 Pro Tips
- If you use Firefox and see a yellow permission warning in the popup, click **"Grant"** to authorize external API connections in one click.
- The extension checks the URL automatically. If you've already saved a listing, it will load your existing notes from Notion so you don't create duplicates.
- You can manually edit any field before saving.
- For AI Fill to work best, wait for the webpage to be fully loaded.
