# 🏠 Location CRM

> **Turn your apartment hunt into a structured Notion CRM pipeline.**  
> *An open-source browser extension (Chrome, Firefox, Edge & Brave) that centralizes and automates rental property tracking in one click.*

---

## 💡 Why Location CRM?

Searching for an apartment in a high-demand area often feels like a full-time job: **40 open browser tabs, forgotten listings, and zero visibility on the applications you've sent.**

**Location CRM** was built to solve this exact headache. It transforms chaotic apartment hunting into a **structured commercial pipeline (Kanban view) directly inside Notion**.

Combined with a strong tenant application file (such as *DossierFacile* in France), this workflow delivers immediate results:
- ✅ **90 listings applied to** in 1 week
- 🗓️ **10 visits scheduled** in 10 days
- 🔑 **1 apartment signed** right after

🌍 **Works everywhere:** Compatible with **any real estate listing website**—both in France (SeLoger, LeBonCoin, Bien'ici, Jinka, PAP, Fonseca, etc.) and **internationally** (Zillow, Idealista, Rightmove, ImmoScout24, StreetEasy, etc.).

---

## ⚡ Features (In 1 Click & Under 10 Seconds)

When you open a rental listing and click the extension, **Location CRM** handles the heavy lifting under the hood:

- ✨ **AI-Powered Autofill (LLM)**: Analyzes the webpage's DOM/HTML text to automatically extract key listing details and map them into Notion—rent price, surface area ($\text{m}^2$), address, city, postal code, neighborhood, listing reference, furnished or unfurnished status, cellar/cave, parking, agency name, agency address, and contact phone number. **No more manual copy-pasting.**
- ⏱️ **Automated Commute Calculation (Google Maps API)**: Automatically estimates travel time to your workplace by **public transit** (including the specific metro/RER/train/bus lines) and by **car** (including driving distance in km), normalized for a typical weekday morning commute.
- 📍 **Neighborhood & Points of Interest Mapping (Google Maps, IGN Géoplateforme & Overpass Turbo / OSM)**: Detects nearby public transport stations, shops, supermarkets, schools, gyms, and sports/leisure facilities across two radii:
  - **📍 1.5 km walking radius**
  - **🚗 Under 10 minutes by car** (true road isochrone polygon)
  - Automatically logs summary counts into the `Neighborhood Analysis` column **and** writes a full structured breakdown (with exact station, store, and school names) directly into the **Notion page body**.
- 🗂️ **Notion Kanban Pipeline & Duplicate Detection**: Automatically checks whether the listing URL already exists in your Notion database. If it does, it loads your existing notes and status so you can update the card in one click without creating duplicates.
- 🌐 **Cross-Browser Manifest V3**: Works seamlessly on **Chrome**, **Firefox**, **Edge**, and **Brave**.

---

## 🔑 Complete Guide to API & Configuration Fields

To open the configuration page without losing focus when switching tabs:
- Click the **⚙️ (Settings)** icon in the extension popup, **or**
- Right-click the extension icon in your toolbar and select **Options**.

All credentials are stored **100% locally** in your browser (`storage.local`). Below is the complete guide on how to fill out each of the **8 configuration fields**:

| Section | Field Name in UI | Storage Key | Status | Example / Format |
| :--- | :--- | :--- | :--- | :--- |
| **1. Notion** | **Clé d'API Notion** *(Notion API Key)* | `apiKey` | **Required** | `ntn_...` or `secret_...` |
| **1. Notion** | **ID de la base de données Notion** *(Database ID)* | `databaseId` | **Required** | `30c7c195af838065abf7cfa4a8214a5e` |
| **2. OpenRouter (AI)** | **Clé d'API OpenRouter** *(OpenRouter API Key)* | `openRouterApiKey` | Optional *(Required for ✨ AI Fill)* | `sk-or-v1-...` |
| **2. OpenRouter (AI)** | **Modèle IA** *(AI Model)* | `llmModel` | Optional *(Has default)* | `google/gemini-flash-1.5-8b` or `minimax/minimax-m2.5` |
| **2. OpenRouter (AI)** | **Mon téléphone** *(My Phone Number)* | `userPhone` | Optional *(Recommended)* | `+33612345678` |
| **2. OpenRouter (AI)** | **URL de l'API LLM** *(LLM API URL)* | `llmUrl` | Optional *(Has default)* | `https://openrouter.ai/api/v1/chat/completions` |
| **3. Google Maps** | **Clé d'API Google Maps** *(Google Maps API Key)* | `googleApiKey` | Optional *(Required for Commute & POIs)* | `AIzaSy...` |
| **3. Google Maps** | **Adresse de destination / Travail** *(Work Address)* | `workAddress` | Optional *(Required for Commute)* | `123 Rue de Rivoli, 75001 Paris` |

---

### 📊 Section 1: Notion (`Required`)

#### 1. Notion API Key (`Clé d'API Notion / Internal Integration Secret`)
- **What it does:** Grants the extension permission to query your database (for duplicate checks), create new property cards, and write neighborhood POI breakdowns into the page body.
- **How to get it:**
  1. Go to [Notion Developers — My Integrations](https://www.notion.so/my-integrations).
  2. Click **"New integration"**, give it a name (e.g., `Location CRM`), select your workspace, and save.
  3. Copy the **Internal Integration Secret** (starts with `ntn_` or `secret_`).
- **⚠️ Crucial Step — Connect the integration to your database:**
  1. Open your rental tracking database in Notion.
  2. Click the **`...`** menu in the top-right corner of the page.
  3. Go to **Connections** (or **Add connections**), search for your integration name (`Location CRM`), and confirm.

#### 2. Notion Database ID (`ID de la base de données Notion`)
- **What it does:** Tells the extension which specific Notion database to read from and write to.
- **How to get it:**
  1. Open your Notion database as a full page in your browser.
  2. Look at the URL in your browser's address bar:
     ```text
     https://www.notion.so/myworkspace/30c7c195af838065abf7cfa4a8214a5e?v=9a8b7c...
                                       ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
                                            This is your Database ID
     ```
  3. Copy the **32-character hexadecimal string** located right after your workspace name (or last slash `/`) and right before `?v=`.

---

### ✨ Section 2: Artificial Intelligence / OpenRouter (`Required for ✨ AI Fill`)

#### 3. OpenRouter API Key (`Clé d'API OpenRouter`)
- **What it does:** Authenticates requests to the LLM when you click **✨ AI Fill** to extract structured listing details from the webpage text.
- **How to get it:**
  1. Create an account at [OpenRouter](https://openrouter.ai/).
  2. Go to [openrouter.ai/keys](https://openrouter.ai/keys) and click **"Create Key"**.
  3. Copy the key (starts with `sk-or-v1-`).

#### 4. AI Model (`Modèle IA`)
- **What it does:** Specifies which LLM model extracts the JSON data from the listing page.
- **What to enter:**
  - Default value: `google/gemini-flash-1.5-8b`
  - Recommended fast & cost-effective models on OpenRouter:
    - `google/gemini-flash-1.5-8b` *(fast, near-zero cost)*
    - `google/gemini-2.0-flash-001` *(high accuracy, very fast)*
    - `minimax/minimax-m2.5` *(great reasoning & extraction quality)*
    - `openai/gpt-4o-mini` *(reliable JSON formatting)*
  - *Note:* Ensure the chosen model supports JSON output (`response_format: { type: "json_object" }`).

#### 5. My Phone Number (`Mon téléphone — à ignorer dans l'annonce`)
- **What it does:** When you browse listing platforms while logged into your personal account (e.g., LeBonCoin, SeLoger), your own phone number often appears in the page DOM/header. Providing your number here instructs the AI prompt to **ignore your personal number** so it never confuses it with the real estate agency's phone number.
- **What to enter:** Your phone number in international or local format (e.g., `+33612345678` or `0612345678`).

#### 6. LLM API URL (`URL de l'API LLM`)
- **What it does:** Endpoint used for chat completion requests.
- **What to enter:**
  - Leave as default for OpenRouter: `https://openrouter.ai/api/v1/chat/completions`
  - Advanced users can replace this with any OpenAI-compatible chat completions endpoint (e.g., OpenAI `https://api.openai.com/v1/chat/completions`, Groq, Mistral, or a local LLM server).

---

### 🗺️ Section 3: Google Maps (`Required for Commute & Neighborhood POIs`)

#### 7. Google Maps API Key (`Clé d'API Google Maps`)
- **What it does:** Powers address geocoding, commute time calculations (public transit + car), and nearby POI discovery.
- **How to get it:**
  1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
  2. Create or select a project and enable billing (Google provides a generous free monthly credit tier for Maps APIs).
  3. Go to **APIs & Services > Library** and enable these **3 APIs**:
     - **Directions API** *(required to calculate public transit and driving commute times & distances)*
     - **Geocoding API** *(required to convert the property's postal address into GPS coordinates for POI mapping)*
     - **Places API** *(used for fast nearby POI search via `nearbysearch`; if unavailable, the extension automatically falls back to the free OpenStreetMap Overpass API)*
  4. Go to **APIs & Services > Credentials**, click **"Create Credentials" > "API Key"**, and copy your key (starts with `AIzaSy`).

#### 8. Work / Destination Address (`Adresse de destination / Travail`)
- **What it does:** Serves as the destination point for calculating your daily commute from each apartment listing.
- **What to enter:** Enter a complete, unambiguous postal address including street, postal code, and city (e.g., `123 Rue de Rivoli, 75001 Paris, France`).

---

## 📊 Notion Database Setup & Kanban View

Create a new database in Notion and configure the following properties with the **exact names and types** below:

| Property Name | Notion Type | Required Options / Description |
| :--- | :--- | :--- |
| `Title` | **Title** | Title of the listing |
| `Top Pick` | **Checkbox** | Favorite listings (`❤️` toggle in the popup) |
| `State` | **Status** | Pipeline stage. Add options: `Interested`, `Applied`, `Contacted`, `To follow up`, `On Hold`, `Planned Visit`, `Visited`, `Offer made`, `Rejected`, `RejectedNotApplied`, `RejectedNotContacted`, `RejectedVisited`, `RejectedNotVisited` |
| `Price` | **Number** | Monthly rent |
| `Area` | **Number** | Surface area in $\text{m}^2$ |
| `Address` | **Text** *(Rich Text)* | Street address of the property |
| `City` | **Text** *(Rich Text)* | City of the property |
| `Postal Code` | **Text** *(Rich Text)* | Postal / ZIP code |
| `Neighborhood` | **Text** *(Rich Text)* | District / neighborhood |
| `Time to Work` | **Number** | Public transit commute time in minutes |
| `Transit Lines` | **Multi-select** | Transit lines used (e.g., `Métro 1`, `RER A`, `Bus 72`) |
| `Time to Work (Car)` | **Number** | Driving commute time in minutes |
| `Distance to Work` | **Number** | Driving distance to work in km |
| `Has Parking` | **Status** | Options: `Yes`, `No`, `Unknown` |
| `Has Cave` | **Status** | Options: `Yes`, `No`, `Unknown` |
| `Furnished` | **Status** | Options: `Yes`, `No`, `Unknown` |
| `Reference` | **Text** *(Rich Text)* | Unique listing reference code |
| `Agency` | **Text** *(Rich Text)* | Name of the real estate agency |
| `Agency Address` | **Text** *(Rich Text)* | Address of the agency |
| `Phone` | **Phone** | Contact phone number of the agency/landlord |
| `URL` | **URL** | Direct link to the listing (used for duplicate detection) |
| `Neighborhood Analysis` | **Text** *(Rich Text)* | Compact POI summary for both 1.5 km & 10-min car radii |
| `Date Added` | **Date** | Automatically populated when a listing is added |

> [!TIP]
> **Set up your Kanban Pipeline:** In Notion, add a **Board view** to your database and set **Group by** to `State`. You can also add a **Formula** property (e.g., `Price / m²` with `round(prop("Price") / prop("Area"))`) to instantly compare value across listings!

---

## 🛠️ Installation

### Chrome / Edge / Brave
1. Clone or download this repository to your computer.
2. Open `chrome://extensions` (or `edge://extensions` / `brave://extensions`).
3. Enable **"Developer mode"** using the toggle in the top-right corner.
4. Click **"Load unpacked"** and select the `src/` folder inside this project.
5. Pin the **Location CRM / Notion Rent Tracker** icon to your toolbar, click **⚙️**, and enter your API keys.

### Firefox
1. Open Firefox and navigate to `about:debugging`.
2. Click **"This Firefox"** in the left sidebar.
3. Click **"Load Temporary Add-on..."**.
4. Select the `src/manifest.json` file inside this project.
5. Click the extension icon, open **⚙️ Settings**, and configure your API keys.

---

## 🔒 Browser Host Permissions

- **Chrome / Edge / Brave**: Host permissions are granted automatically when loading the extension.
- **Firefox (Manifest V3)**: Firefox treats host permissions as optional by default.
  - Simply click the **"Grant"** button on the yellow warning banner inside the extension popup, **or**
  - Go to `about:addons` > **Notion Rent Tracker** > **Permissions** and enable access for:
    - `https://api.notion.com/*`
    - `https://openrouter.ai/*`
    - `https://maps.googleapis.com/*`
    - `https://overpass-api.de/*`
    - `https://data.geopf.fr/*`

---

## 🚀 Usage Workflow

1. **Open any rental listing** on your favorite real estate website.
2. **Click the extension icon** in your browser toolbar:
   - If the listing URL is already in your Notion database, the extension automatically loads its existing data and switches the button to **Update in Notion**.
3. **Click `✨ AI Fill`**:
   - The LLM extracts the listing details from the page.
   - If a Google Maps API key is configured, it automatically triggers the **commute calculation** (transit & car) and **neighborhood POI analysis** (1.5 km walking & 10-min driving).
4. **Review or tweak any field** (mark as ❤️ **Top Pick**, adjust the **State** column, or click 🔄 / 🔍 to re-run calculations manually).
5. **Click `Add to Notion` (or `Update in Notion`)**:
   - All properties are saved to your Notion database, and the detailed list of nearby stations, shops, schools, and sports facilities is appended directly to the Notion page body.

---

## 🏗️ Technical Architecture

- **CORS-Free Background Service Worker (`src/background.js`)**: All external API requests (Notion, OpenRouter LLM, Google Maps, IGN Géoplateforme, Overpass OSM) are routed through a privileged background script to avoid browser CORS restrictions.
- **Dual-Radius Spatial Analysis (`src/popup.js`)**:
  1. Geocodes the property address via **Google Maps Geocoding API**.
  2. Computes a **10-minute driving isochrone polygon** using the French public **IGN Géoplateforme API** (`data.geopf.fr/navigation/isochrone`), with an automatic 5 km bounding-box fallback for international listings outside France.
  3. Queries nearby points of interest via **Google Places API** (with automatic fallback to **OpenStreetMap Overpass Turbo API**).
  4. Classifies every amenity using Haversine distance ($\le 1.5\text{ km}$) and ray-casting point-in-polygon detection (10-min car isochrone).

---

## 🤝 Contributing & Feedback

This project is 100% open-source and free. Contributions, issues, feature suggestions, and stars ⭐ on the repository are very welcome!
