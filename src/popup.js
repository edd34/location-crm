const browserAPI = typeof browser !== 'undefined' ? browser : chrome;
let existingPageId = null;

document.addEventListener('DOMContentLoaded', async () => {
  const form = document.getElementById('rent-form');
  const settingsBtn = document.getElementById('settings-btn');
  const configSection = document.getElementById('config-section');
  const saveConfigBtn = document.getElementById('save-config');
  const statusDiv = document.getElementById('status');
  const urlInput = document.getElementById('url');
  const addressInput = document.getElementById('address');
  const titleInput = document.getElementById('title');
  const magicFillBtn = document.getElementById('magic-fill');
  const addBtn = document.getElementById('add-btn');

  // Load Config
  const savedConfig = await browserAPI.storage.local.get(['apiKey', 'databaseId', 'openRouterApiKey', 'llmUrl', 'llmModel', 'userPhone', 'googleApiKey', 'workAddress']);
  if (savedConfig.apiKey) document.getElementById('api-key').value = savedConfig.apiKey;
  if (savedConfig.databaseId) document.getElementById('database-id').value = savedConfig.databaseId;
  if (savedConfig.openRouterApiKey) document.getElementById('openrouter-api-key').value = savedConfig.openRouterApiKey;
  if (savedConfig.llmUrl) document.getElementById('llm-url').value = savedConfig.llmUrl;
  if (savedConfig.llmModel) document.getElementById('llm-model').value = savedConfig.llmModel;
  if (savedConfig.userPhone) document.getElementById('user-phone').value = savedConfig.userPhone;
  if (savedConfig.googleApiKey) document.getElementById('google-api-key').value = savedConfig.googleApiKey;
  if (savedConfig.workAddress) document.getElementById('work-address').value = savedConfig.workAddress;

  if (!savedConfig.apiKey || !savedConfig.databaseId) {
    configSection.classList.remove('hidden');
  }

  // Get current tab URL and Title
  try {
    const tabs = await browserAPI.tabs.query({ active: true, currentWindow: true });
    if (tabs && tabs[0]) {
      const tab = tabs[0];
      urlInput.value = tab.url;
      titleInput.value = tab.title;
      addressInput.value = "";

      // Check if this URL already exists in Notion
      if (savedConfig.apiKey && savedConfig.databaseId) {
        statusDiv.textContent = 'Checking Notion...';
        const existingPage = await fetchPageByUrl(savedConfig.apiKey, savedConfig.databaseId, tab.url);
        if (existingPage) {
          existingPageId = existingPage.id;
          statusDiv.textContent = 'Found in Notion! Loading data...';
          statusDiv.style.color = 'blue';
          populateFormFromNotion(existingPage.properties);
          addBtn.textContent = 'Update in Notion';
          addBtn.classList.add('update-mode');
          statusDiv.textContent = 'Loaded existing data.';
          statusDiv.style.color = 'green';
        } else {
          statusDiv.textContent = '';
        }
      }
    }
  } catch (err) {
    console.error("Could not get current tab info", err);
  }

  settingsBtn.addEventListener('click', () => {
    configSection.classList.toggle('hidden');
  });

  saveConfigBtn.addEventListener('click', async () => {
    const apiKey = document.getElementById('api-key').value.trim();
    const databaseId = document.getElementById('database-id').value.trim();
    const openRouterApiKey = document.getElementById('openrouter-api-key').value.trim();
    const llmUrl = document.getElementById('llm-url').value.trim();
    const llmModel = document.getElementById('llm-model').value.trim();
    const userPhone = document.getElementById('user-phone').value.trim();
    const googleApiKey = document.getElementById('google-api-key').value.trim();
    const workAddress = document.getElementById('work-address').value.trim();

    await browserAPI.storage.local.set({ 
      apiKey, databaseId, openRouterApiKey, llmUrl, llmModel, userPhone, googleApiKey, workAddress 
    });
    statusDiv.textContent = 'Config saved!';
    statusDiv.style.color = 'green';
    configSection.classList.add('hidden');
    setTimeout(() => statusDiv.textContent = '', 2000);
  });

  // Check for host permissions (especially important for Firefox MV3 where they are optional)
  const checkPermissions = async () => {
    if (typeof browser !== 'undefined' && browser.permissions) {
      const hasPermissions = await browser.permissions.contains({
        origins: ['https://maps.googleapis.com/*', 'https://api.notion.com/*']
      });
      if (!hasPermissions) {
        statusDiv.textContent = 'Note: Please enable host permissions in extension settings for Maps/Notion to work.';
        statusDiv.style.color = 'orange';
        setTimeout(() => { if (statusDiv.style.color === 'orange') statusDiv.textContent = ''; }, 5000);
      }
    }
  };
  checkPermissions();

  magicFillBtn.addEventListener('click', async () => {
    const { openRouterApiKey, llmUrl, llmModel, userPhone, googleApiKey, workAddress } = await browserAPI.storage.local.get(['openRouterApiKey', 'llmUrl', 'llmModel', 'userPhone', 'googleApiKey', 'workAddress']);
    const url = llmUrl || 'https://openrouter.ai/api/v1/chat/completions';
    const model = llmModel || 'google/gemini-flash-1.5-8b';

    if (!openRouterApiKey) {
      statusDiv.textContent = 'Please configure OpenRouter API Key first!';
      statusDiv.style.color = 'red';
      configSection.classList.remove('hidden');
      return;
    }

    statusDiv.textContent = 'Extracting page content...';
    statusDiv.style.color = 'blue';

    try {
      const [tab] = await browserAPI.tabs.query({ active: true, currentWindow: true });
      const scriptResult = await browserAPI.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          const clone = document.body.cloneNode(true);
          const tagsToRemove = ['script', 'style', 'img', 'noscript', 'iframe', 'svg'];
          tagsToRemove.forEach(tag => {
            const elements = clone.querySelectorAll(tag);
            elements.forEach(el => el.remove());
          });
          return clone.innerText;
        },
      });
      const pageText = scriptResult[0].result;

      statusDiv.textContent = 'AI is thinking...';
      const prompt = `Extract rental property information from this webpage text. Return ONLY a JSON object with these keys: 
      title (short descriptive title), 
      address (full address of the RENTAL PROPERTY if found), 
      city (city of the RENTAL PROPERTY only), 
      postal_code (postal code of the RENTAL PROPERTY if found),
      neighborhood (neighborhood or district of the RENTAL PROPERTY if found),
      price (number only), 
      area (number only, in m2), 
      time_to_work (estimated travel time in minutes if mentioned, else null), 
      has_parking (boolean OR the string 'unknown'), 
      has_cave (boolean OR the string 'unknown'), 
      is_furnished (boolean OR the string 'unknown'),
      agency (name of the rental agency if mentioned, else null),
      agency_address (full address of the RENTAL AGENCY if found, else null),
      phone (phone number of the rental agency).
      
      IMPORTANT: 
      - Distinguish clearly between the RENTAL PROPERTY address and the RENTAL AGENCY address. 
      - The 'address' field should NEVER contain the address of the agency.
      - For has_parking, has_cave, and is_furnished: return true, false, or 'unknown'. Only return true/false if it is explicitly stated or very clear.
      - If the phone number found is ${userPhone || 'the user\'s personal phone number'}, DO NOT include it. Return null for phone if no other number is found.

      Text:
      ${pageText}`;

      // Use background script to bypass CORS
      browserAPI.runtime.sendMessage({
        type: 'FETCH_LLM',
        url: url,
        openRouterApiKey: openRouterApiKey,
        body: {
          model: model,
          messages: [{ role: 'user', content: prompt }],
          response_format: { type: 'json_object' }
        }
      }, (response) => {
        if (!response || !response.success) {
          statusDiv.textContent = 'AI Fill Error: ' + (response ? response.error : 'No response from background');
          statusDiv.style.color = 'red';
          return;
        }

        let extracted;
        try {
          const content = response.data.choices[0].message.content;
          extracted = JSON.parse(content);
        } catch (e) {
          statusDiv.textContent = 'Error parsing AI response';
          statusDiv.style.color = 'red';
          console.error("AI Response Parse Error:", e, response.data);
          return;
        }

        // Fill form
        if (extracted.title) titleInput.value = extracted.title;
        if (extracted.address) addressInput.value = extracted.address;
        if (extracted.city) document.getElementById('city').value = extracted.city;
        if (extracted.postal_code) document.getElementById('postal_code').value = extracted.postal_code;
        if (extracted.neighborhood) document.getElementById('neighborhood').value = extracted.neighborhood;
        if (extracted.price) document.getElementById('price').value = parseInt(extracted.price);
        if (extracted.area) document.getElementById('area').value = parseInt(extracted.area);
        if (extracted.time_to_work) document.getElementById('time_to_work').value = extracted.time_to_work;
        
        // Handle Tri-state selects
        const setTriState = (id, val) => {
          const el = document.getElementById(id);
          if (val === true) el.value = 'true';
          else if (val === false) el.value = 'false';
          else el.value = 'unknown';
        };
        setTriState('has_parking', extracted.has_parking);
        setTriState('has_cave', extracted.has_cave);
        setTriState('is_furnished', extracted.is_furnished);

        if (extracted.agency) document.getElementById('agency').value = extracted.agency;
        if (extracted.agency_address) document.getElementById('agency_address').value = extracted.agency_address;
        if (extracted.phone) document.getElementById('phone').value = extracted.phone;

  // Auto-calculate time to work if enough info is found
        if ((extracted.address || extracted.city) && googleApiKey && workAddress) {
          const parts = [
            extracted.address,
            extracted.neighborhood,
            extracted.city,
            extracted.postal_code
          ].filter(Boolean);
          const origin = parts.join(', ');
          calculateTimeToWork(googleApiKey, origin, workAddress);
        } else {
          statusDiv.textContent = 'AI Fill complete!';
          statusDiv.style.color = 'green';
        }
      });
    } catch (error) {
      statusDiv.textContent = 'AI Fill Error: ' + error.message;
      statusDiv.style.color = 'red';
      console.error(error);
    }
  });

  // Manual Recalculate Time to Work on address/city/postal blur
  const triggerRecalculate = async () => {
    const { googleApiKey, workAddress } = await browserAPI.storage.local.get(['googleApiKey', 'workAddress']);
    const address = addressInput.value.trim();
    const neighborhood = document.getElementById('neighborhood').value.trim();
    const city = document.getElementById('city').value.trim();
    const postalCode = document.getElementById('postal_code').value.trim();
    
    const parts = [address, neighborhood, city, postalCode].filter(Boolean);
    const origin = parts.join(', ');
    
    if (origin && googleApiKey && workAddress) {
      calculateTimeToWork(googleApiKey, origin, workAddress);
    }
  };

  addressInput.addEventListener('blur', triggerRecalculate);
  document.getElementById('neighborhood').addEventListener('blur', triggerRecalculate);
  document.getElementById('city').addEventListener('blur', triggerRecalculate);
  document.getElementById('postal_code').addEventListener('blur', triggerRecalculate);
  document.getElementById('refresh-time').addEventListener('click', triggerRecalculate);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());

    const { apiKey, databaseId } = await browserAPI.storage.local.get(['apiKey', 'databaseId']);

    if (!apiKey || !databaseId) {
      statusDiv.textContent = 'Please configure API key and Database ID first!';
      statusDiv.style.color = 'red';
      configSection.classList.remove('hidden');
      return;
    }

    try {
      let result;
      if (existingPageId) {
        statusDiv.textContent = 'Updating in Notion...';
        statusDiv.style.color = 'blue';
        result = await updateInNotion(apiKey, existingPageId, data);
      } else {
        statusDiv.textContent = 'Adding to Notion...';
        statusDiv.style.color = 'blue';
        result = await addToNotion(apiKey, databaseId, data);
      }

      if (result.success) {
        statusDiv.textContent = existingPageId ? 'Updated successfully!' : 'Added successfully!';
        statusDiv.style.color = 'green';
        if (!existingPageId) {
          form.reset();
          // Re-fill URL after reset
          const tabs = await browserAPI.tabs.query({ active: true, currentWindow: true });
          if (tabs[0]) {
            urlInput.value = tabs[0].url;
            titleInput.value = tabs[0].title;
            addressInput.value = "";
          }
        }
      } else {
        statusDiv.textContent = 'Error: ' + (result.error || 'Unknown error');
        statusDiv.style.color = 'red';
        console.error("Notion API Error:", result.error);
      }
    } catch (error) {
      statusDiv.textContent = 'Error: ' + error.message;
      statusDiv.style.color = 'red';
      console.error("Submission error:", error);
    }
  });
});

async function fetchPageByUrl(apiKey, databaseId, url) {
  return new Promise((resolve, reject) => {
    browserAPI.runtime.sendMessage({
      type: 'FETCH_NOTION',
      url: `https://api.notion.com/v1/databases/${databaseId}/query`,
      method: 'POST',
      apiKey: apiKey,
      body: {
        filter: {
          property: 'URL',
          url: {
            equals: url
          }
        }
      }
    }, (response) => {
      if (response && response.success) {
        resolve(response.data.results.length > 0 ? response.data.results[0] : null);
      } else {
        console.error("fetchPageByUrl error:", response ? response.error : 'No response');
        reject(new Error(response ? response.error : 'Failed to check Notion database'));
      }
    });
  });
}

function populateFormFromNotion(props) {
  const getPropText = (p) => {
    if (!p) return "";
    if (p.title) return p.title.map(t => t.plain_text).join("");
    if (p.rich_text) return p.rich_text.map(t => t.plain_text).join("");
    return "";
  };

  const getPropNumber = (p) => (p && p.number !== undefined) ? p.number : "";
  const getPropStatus = (p) => (p && p.status) ? p.status.name : "";
  const getPropSelect = (p) => (p && p.select) ? p.select.name : "";
  const getPropMultiSelect = (p) => (p && p.multi_select) ? p.multi_select.map(s => s.name).join(", ") : "";
  const getPropPhone = (p) => (p && p.phone_number) ? p.phone_number : "";

  if (props['Title']) document.getElementById('title').value = getPropText(props['Title']);
  if (props['Address']) document.getElementById('address').value = getPropText(props['Address']);
  if (props['City']) document.getElementById('city').value = getPropText(props['City']);
  if (props['Postal Code']) document.getElementById('postal_code').value = getPropText(props['Postal Code']);
  if (props['Neighborhood']) document.getElementById('neighborhood').value = getPropText(props['Neighborhood']);
  if (props['Price']) document.getElementById('price').value = getPropNumber(props['Price']);
  if (props['Area']) document.getElementById('area').value = getPropNumber(props['Area']);
  if (props['Time to Work']) document.getElementById('time_to_work').value = getPropNumber(props['Time to Work']);
  if (props['Transit Lines']) document.getElementById('transit_lines').value = getPropMultiSelect(props['Transit Lines']);
  if (props['Agency']) document.getElementById('agency').value = getPropText(props['Agency']);
  if (props['Agency Address']) document.getElementById('agency_address').value = getPropText(props['Agency Address']);
  if (props['Phone']) document.getElementById('phone').value = getPropPhone(props['Phone']);
  if (props['State']) document.getElementById('state').value = getPropStatus(props['State']);

  const setTriState = (id, propName) => {
    const status = getPropStatus(props[propName]);
    const el = document.getElementById(id);
    if (status === 'Yes') el.value = 'true';
    else if (status === 'No') el.value = 'false';
    else el.value = 'unknown';
  };

  if (props['Has Parking']) setTriState('has_parking', 'Has Parking');
  if (props['Has Cave']) setTriState('has_cave', 'Has Cave');
  if (props['Furnished']) setTriState('is_furnished', 'Furnished');
}

async function updateInNotion(apiKey, pageId, data) {
  const body = {
    properties: buildNotionProperties(data)
  };

  return new Promise((resolve) => {
    browserAPI.runtime.sendMessage({
      type: 'FETCH_NOTION',
      url: `https://api.notion.com/v1/pages/${pageId}`,
      method: 'PATCH',
      apiKey: apiKey,
      body: body
    }, (response) => {
      resolve(response);
    });
  });
}

function buildNotionProperties(data) {
  return {
    'Title': {
      title: [{ text: { content: data.title } }]
    },
    'Address': {
      rich_text: data.address ? [{ text: { content: data.address } }] : []
    },
    'Price': {
      number: data.price ? parseFloat(data.price) : null
    },
    'Time to Work': {
      number: data.time_to_work ? parseFloat(data.time_to_work) : null
    },
    'Transit Lines': {
      multi_select: data.transit_lines ? data.transit_lines.split(',').map(line => ({ name: line.trim() })).filter(l => l.name) : []
    },
    'Area': {
      number: data.area ? parseFloat(data.area) : null
    },
    'Has Parking': {
      status: { name: data.has_parking === 'true' ? 'Yes' : (data.has_parking === 'false' ? 'No' : 'Unknown') }
    },
    'Has Cave': {
      status: { name: data.has_cave === 'true' ? 'Yes' : (data.has_cave === 'false' ? 'No' : 'Unknown') }
    },
    'Furnished': {
      status: { name: data.is_furnished === 'true' ? 'Yes' : (data.is_furnished === 'false' ? 'No' : 'Unknown') }
    },
    'State': {
      status: { name: data.state }
    },
    'Agency': {
      rich_text: data.agency ? [{ text: { content: data.agency } }] : []
    },
    'Agency Address': {
      rich_text: data.agency_address ? [{ text: { content: data.agency_address } }] : []
    },
    'Phone': {
      phone_number: data.phone || null
    },
    'URL': {
      url: data.url
    },
    'City': {
      rich_text: data.city ? [{ text: { content: data.city } }] : []
    },
    'Postal Code': {
      rich_text: data.postal_code ? [{ text: { content: data.postal_code } }] : []
    },
    'Neighborhood': {
      rich_text: data.neighborhood ? [{ text: { content: data.neighborhood } }] : []
    }
  };
}

async function addToNotion(apiKey, databaseId, data) {
  const properties = buildNotionProperties(data);
  properties['Date Added'] = {
    date: { start: new Date().toISOString() }
  };

  const body = {
    parent: { database_id: databaseId },
    properties: properties
  };

  return new Promise((resolve) => {
    browserAPI.runtime.sendMessage({
      type: 'FETCH_NOTION',
      url: 'https://api.notion.com/v1/pages',
      method: 'POST',
      apiKey: apiKey,
      body: body
    }, (response) => {
      resolve(response);
    });
  });
}


async function calculateTimeToWork(apiKey, origin, destination) {
  const statusDiv = document.getElementById('status');
  statusDiv.textContent = 'Calculating travel time...';

  // Find next Tuesday morning at 9am to avoid weekends and get consistent transit times
  const nextTuesday = new Date();
  nextTuesday.setDate(nextTuesday.getDate() + (7 - nextTuesday.getDay() + 2) % 7);
  nextTuesday.setHours(9, 0, 0, 0);
  
  // If next Tuesday is already today or in the past (e.g., it's already past 9am Tuesday), move to the following week
  if (nextTuesday <= new Date()) {
    nextTuesday.setDate(nextTuesday.getDate() + 7);
  }

  const arrivalTime = Math.floor(nextTuesday.getTime() / 1000);
  // Using Directions API instead of Distance Matrix to get transit details (line names)
  // Added &language=fr to get vehicle names (Métro, Bus, etc.) in French
  const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&arrival_time=${arrivalTime}&mode=transit&language=fr&key=${apiKey}`;

  browserAPI.runtime.sendMessage({
    type: 'FETCH_MAPS',
    url: url
  }, (response) => {
    if (response && response.success) {
      const data = response.data;
      if (data.status === 'OK' && data.routes.length > 0) {
        const route = data.routes[0];
        const leg = route.legs[0];
        
        // Duration
        const duration = leg.duration.value; 
        const minutes = Math.round(duration / 60);
        document.getElementById('time_to_work').value = minutes;

        // Extract Transit Lines
        const transitLines = [];
        leg.steps.forEach(step => {
          if (step.travel_mode === 'TRANSIT' && step.transit_details) {
            const line = step.transit_details.line;
            const vehicleName = line.vehicle ? line.vehicle.name : '';
            const shortName = line.short_name || line.name;
            
            // Format as "Vehicle ShortName" (e.g., "Bus 123", "Métro 1", "RER A")
            let fullName = shortName;
            if (vehicleName && shortName && !shortName.toLowerCase().includes(vehicleName.toLowerCase())) {
              fullName = `${vehicleName} ${shortName}`;
            } else if (vehicleName && !shortName) {
              fullName = vehicleName;
            }
            
            if (fullName) transitLines.push(fullName);
          }
        });
        
        const transitLinesStr = transitLines.join(', ');
        document.getElementById('transit_lines').value = transitLinesStr;

        statusDiv.textContent = `AI Fill + Travel Time: ${minutes} min (${transitLinesStr || 'Transit'})`;
        statusDiv.style.color = 'green';
      } else {
        console.error('Google Maps Error:', data);
        statusDiv.textContent = 'Maps calculation failed. Check API key/Address.';
        statusDiv.style.color = 'orange';
      }
    } else {
      console.error('Error fetching Directions via background:', response ? response.error : 'No response');
      statusDiv.textContent = 'Error calculating distance.';
      statusDiv.style.color = 'red';
    }
  });
}
