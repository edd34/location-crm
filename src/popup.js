const browserAPI = typeof browser !== 'undefined' ? browser : chrome;
let existingPageId = null;
let cachedDbProperties = null;

document.addEventListener('DOMContentLoaded', async () => {
  const form = document.getElementById('rent-form');
  const settingsBtn = document.getElementById('settings-btn');
  const configSection = document.getElementById('config-section');
  const saveConfigBtn = document.getElementById('save-config');
  const statusDiv = document.getElementById('status');
  const urlInput = document.getElementById('url');
  const addressInput = document.getElementById('address');
  const titleInput = document.getElementById('title');
  const referenceInput = document.getElementById('reference');
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
        getDatabaseProperties(savedConfig.apiKey, savedConfig.databaseId).catch(() => {});
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
      reference (unique reference of the rental offer, often found at the bottom of the page or near the price),
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
        if (extracted.reference) referenceInput.value = extracted.reference;
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

  document.getElementById('analyze-neighborhood').addEventListener('click', async () => {
    const address = addressInput.value.trim();
    const city = document.getElementById('city').value.trim();
    const postalCode = document.getElementById('postal_code').value.trim();
    const neighborhood = document.getElementById('neighborhood').value.trim();

    const fullAddress = [address, neighborhood, city, postalCode].filter(Boolean).join(', ');
    if (!fullAddress) {
      statusDiv.textContent = 'Please enter an address first.';
      statusDiv.style.color = 'red';
      return;
    }

    const { googleApiKey } = await browserAPI.storage.local.get(['googleApiKey']);
    if (!googleApiKey) {
      statusDiv.textContent = 'Google API Key required for geocoding.';
      statusDiv.style.color = 'red';
      configSection.classList.remove('hidden');
      return;
    }

    analyzeNeighborhood(googleApiKey, fullAddress);
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());

    // Include neighborhood analysis if results are visible
    const resultsDiv = document.getElementById('neighborhood-results');
    if (!resultsDiv.classList.contains('hidden')) {
      const counts = {
        metro: document.getElementById('count-metro').textContent,
        bus: document.getElementById('count-bus').textContent,
        rer: document.getElementById('count-rer').textContent,
        tram: document.getElementById('count-tram').textContent,
        shops: document.getElementById('count-shops').textContent,
        supermarket: document.getElementById('count-supermarket').textContent,
        school: document.getElementById('count-school').textContent,
        sports: document.getElementById('count-sports').textContent
      };
      data.neighborhood_analysis = `🚇:${counts.metro}, 🚌:${counts.bus}, 🚆:${counts.rer}, 🚋:${counts.tram}, 🛍️:${counts.shops}, 🛒:${counts.supermarket}, 🎓:${counts.school}, 🏋️:${counts.sports}`;
    }

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
        result = await updateInNotion(apiKey, existingPageId, data, databaseId);
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
  const getPropCheckbox = (p) => (p && p.checkbox) ? p.checkbox : false;

  if (props['Title']) document.getElementById('title').value = getPropText(props['Title']);
  if (props['Top Pick']) document.getElementById('is_favorite').checked = getPropCheckbox(props['Top Pick']);
  if (props['Reference']) document.getElementById('reference').value = getPropText(props['Reference']);
  if (props['Address']) document.getElementById('address').value = getPropText(props['Address']);
  if (props['City']) document.getElementById('city').value = getPropText(props['City']);
  if (props['Postal Code']) document.getElementById('postal_code').value = getPropText(props['Postal Code']);
  if (props['Neighborhood']) document.getElementById('neighborhood').value = getPropText(props['Neighborhood']);

  // Handle Neighborhood Analysis parsing
  if (props['Neighborhood Analysis']) {
    const analysisText = getPropText(props['Neighborhood Analysis']);
    if (analysisText) {
      const parts = analysisText.split(', ');
      const resultsDiv = document.getElementById('neighborhood-results');
      resultsDiv.classList.remove('hidden');

      const mapping = {
        '🚇': 'count-metro',
        '🚌': 'count-bus',
        '🚆': 'count-rer',
        '🚋': 'count-tram',
        '🛍️': 'count-shops',
        '🛒': 'count-supermarket',
        '🎓': 'count-school',
        '🏋️': 'count-sports'
      };

      parts.forEach(part => {
        const [emoji, countStr] = part.split(':');
        const elementId = mapping[emoji];
        if (elementId) {
          document.getElementById(elementId).textContent = countStr || '0';
        }
      });
    }
  }

  if (props['Price']) document.getElementById('price').value = getPropNumber(props['Price']);
  if (props['Area']) document.getElementById('area').value = getPropNumber(props['Area']);
  if (props['Time to Work']) document.getElementById('time_to_work').value = getPropNumber(props['Time to Work']);
  if (props['Transit Lines']) document.getElementById('transit_lines').value = getPropMultiSelect(props['Transit Lines']);

  const carTimeProp = props['Time to Work (Car)'] || props['Car Time to Work'];
  if (carTimeProp) document.getElementById('time_to_work_car').value = getPropNumber(carTimeProp);

  const distanceProp = props['Distance to Work'] || props['Distance to Work (km)'] || props['Distance'];
  if (distanceProp) document.getElementById('distance_to_work').value = getPropNumber(distanceProp);

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

async function getDatabaseProperties(apiKey, databaseId) {
  if (cachedDbProperties) return cachedDbProperties;
  return new Promise((resolve) => {
    browserAPI.runtime.sendMessage({
      type: 'FETCH_NOTION',
      url: `https://api.notion.com/v1/databases/${databaseId}`,
      method: 'GET',
      apiKey: apiKey
    }, (response) => {
      if (response && response.success && response.data && response.data.properties) {
        cachedDbProperties = response.data.properties;
        resolve(cachedDbProperties);
      } else {
        resolve(null);
      }
    });
  });
}

async function updateInNotion(apiKey, pageId, data, databaseId) {
  const dbProps = databaseId ? await getDatabaseProperties(apiKey, databaseId) : cachedDbProperties;
  const body = {
    properties: buildNotionProperties(data, dbProps)
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

function buildNotionProperties(data, dbProperties = null) {
  const props = {
    'Title': {
      title: [{ text: { content: data.title } }]
    },
    'Top Pick': {
      checkbox: data.is_favorite === 'on'
    },
    'Reference': {
      rich_text: data.reference ? [{ text: { content: data.reference } }] : []
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
    },
    'Neighborhood Analysis': {
      rich_text: data.neighborhood_analysis ? [{ text: { content: data.neighborhood_analysis } }] : []
    }
  };

  // Safe addition of car travel time & distance based on DB schema
  const carPropName = dbProperties
    ? Object.keys(dbProperties).find(k => k.toLowerCase() === 'time to work (car)' || k.toLowerCase() === 'car time to work')
    : 'Time to Work (Car)';
  if (carPropName && (!dbProperties || dbProperties[carPropName])) {
    props[carPropName] = {
      number: data.time_to_work_car ? parseFloat(data.time_to_work_car) : null
    };
  }

  const distPropName = dbProperties
    ? Object.keys(dbProperties).find(k => k.toLowerCase() === 'distance to work' || k.toLowerCase() === 'distance to work (km)' || k.toLowerCase() === 'distance')
    : 'Distance to Work';
  if (distPropName && (!dbProperties || dbProperties[distPropName])) {
    props[distPropName] = {
      number: data.distance_to_work ? parseFloat(data.distance_to_work) : null
    };
  }

  return props;
}

async function addToNotion(apiKey, databaseId, data) {
  const dbProps = await getDatabaseProperties(apiKey, databaseId);
  const properties = buildNotionProperties(data, dbProps);
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

  // Find next Tuesday morning at 9am to avoid weekends and get consistent transit/driving times
  const nextTuesday = new Date();
  nextTuesday.setDate(nextTuesday.getDate() + (7 - nextTuesday.getDay() + 2) % 7);
  nextTuesday.setHours(9, 0, 0, 0);

  // If next Tuesday is already today or in the past (e.g., it's already past 9am Tuesday), move to the following week
  if (nextTuesday <= new Date()) {
    nextTuesday.setDate(nextTuesday.getDate() + 7);
  }

  const targetTime = Math.floor(nextTuesday.getTime() / 1000);
  const transitUrl = `https://maps.googleapis.com/maps/api/directions/json?origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&arrival_time=${targetTime}&mode=transit&language=fr&key=${apiKey}&transit_mode=rail`;
  const drivingUrl = `https://maps.googleapis.com/maps/api/directions/json?origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&departure_time=${targetTime}&mode=driving&language=fr&key=${apiKey}`;

  const fetchPromise = (url) => new Promise((resolve) => {
    browserAPI.runtime.sendMessage({
      type: 'FETCH_MAPS',
      url: url
    }, (response) => {
      resolve(response);
    });
  });

  try {
    const [transitResponse, drivingResponse] = await Promise.all([
      fetchPromise(transitUrl),
      fetchPromise(drivingUrl)
    ]);

    let transitSummary = null;
    let drivingSummary = null;

    // Handle Transit Result
    if (transitResponse && transitResponse.success && transitResponse.data.status === 'OK' && transitResponse.data.routes.length > 0) {
      const leg = transitResponse.data.routes[0].legs[0];
      const minutes = Math.round(leg.duration.value / 60);
      document.getElementById('time_to_work').value = minutes;

      const transitLines = [];
      leg.steps.forEach(step => {
        if (step.travel_mode === 'TRANSIT' && step.transit_details) {
          const line = step.transit_details.line;
          const vehicleName = line.vehicle ? line.vehicle.name : '';
          const shortName = line.short_name || line.name;

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
      transitSummary = `${minutes} min${transitLinesStr ? ` (${transitLinesStr})` : ''}`;
    } else {
      console.warn('Transit Directions failed or not available:', transitResponse);
    }

    // Handle Driving Result
    if (drivingResponse && drivingResponse.success && drivingResponse.data.status === 'OK' && drivingResponse.data.routes.length > 0) {
      const leg = drivingResponse.data.routes[0].legs[0];
      const durationVal = (leg.duration_in_traffic && leg.duration_in_traffic.value) || leg.duration.value;
      const carMinutes = Math.round(durationVal / 60);
      const distanceKm = Math.round((leg.distance.value / 1000) * 10) / 10;

      document.getElementById('time_to_work_car').value = carMinutes;
      document.getElementById('distance_to_work').value = distanceKm;
      drivingSummary = `${carMinutes} min (${distanceKm} km)`;
    } else {
      console.warn('Driving Directions failed or not available:', drivingResponse);
    }

    if (transitSummary && drivingSummary) {
      statusDiv.textContent = `Transit: ${transitSummary} | Car: ${drivingSummary}`;
      statusDiv.style.color = 'green';
    } else if (transitSummary) {
      statusDiv.textContent = `Transit: ${transitSummary}`;
      statusDiv.style.color = 'green';
    } else if (drivingSummary) {
      statusDiv.textContent = `Car: ${drivingSummary}`;
      statusDiv.style.color = 'green';
    } else {
      statusDiv.textContent = 'Maps calculation failed. Check API key/Address.';
      statusDiv.style.color = 'orange';
    }
  } catch (err) {
    console.error('Error calculating travel time:', err);
    statusDiv.textContent = 'Error calculating travel time.';
    statusDiv.style.color = 'red';
  }
}

async function analyzeNeighborhood(googleApiKey, address) {
  const statusDiv = document.getElementById('status');
  const resultsDiv = document.getElementById('neighborhood-results');
  statusDiv.textContent = 'Geocoding address...';
  statusDiv.style.color = 'blue';

  try {
    // 1. Geocode address to get coordinates
    const geoUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${googleApiKey}`;
    const geoResponse = await new Promise(resolve => {
      browserAPI.runtime.sendMessage({ type: 'FETCH_MAPS', url: geoUrl }, resolve);
    });

    if (!geoResponse || !geoResponse.success || geoResponse.data.status !== 'OK') {
      throw new Error('Geocoding failed');
    }

    const location = geoResponse.data.results[0].geometry.location;
    const lat = location.lat;
    const lon = location.lng;
    console.log(`Geocoding result for "${address}": Lat: ${lat}, Lon: ${lon}`);

    statusDiv.textContent = 'Querying Overpass API (1500m)...';

    // 2. Query Overpass
    // Use nwr (node, way, relation) to catch areas, and out tags center to get data for ways/relations
    const query = `
      [out:json][timeout:60];
      (
        // Transport
        nwr["railway"~"station|tram_stop|halt"](around:1500, ${lat}, ${lon});
        nwr["highway"="bus_stop"](around:1500, ${lat}, ${lon});
        nwr["public_transport"~"stop_position|platform"](around:1500, ${lat}, ${lon});
        
        // Education
        nwr["amenity"~"school|kindergarten|college|university"](around:1500, ${lat}, ${lon});
        
        // Sports & Leisure
        nwr["leisure"~"fitness_centre|sports_centre|stadium|pitch|swimming_pool"](around:1500, ${lat}, ${lon});
        
        // Shopping
        nwr["shop"~"supermarket|convenience|bakery|butcher|mall|department_store"](around:1500, ${lat}, ${lon});
      );
      out tags center;
    `;

    const overpassUrl = 'https://overpass-api.de/api/interpreter';
    const overpassResponse = await new Promise(resolve => {
      browserAPI.runtime.sendMessage({
        type: 'FETCH_OVERPASS',
        url: overpassUrl,
        body: 'data=' + encodeURIComponent(query)
      }, resolve);
    });

    if (!overpassResponse || !overpassResponse.success) {
      throw new Error(overpassResponse ? overpassResponse.error : 'Overpass query failed');
    }

    const elements = overpassResponse.data.elements;

    // 3. Process results with deduplication for stations
    const uniqueMetro = new Set();
    const uniqueRer = new Set();
    const uniqueTram = new Set();
    const uniqueBus = new Set();
    const uniqueSchools = new Set();
    const uniqueSports = new Set();
    const uniqueSupermarkets = new Set();
    const uniqueShops = new Set();

    elements.forEach(el => {
      const tags = el.tags || {};
      const name = tags.name || `id_${el.id}`;

      // Metro logic
      if ((tags.railway === 'station' && (tags.station === 'subway' || tags.subway === 'yes')) || (tags.subway === 'yes' && tags.public_transport === 'stop_position')) {
        uniqueMetro.add(name);
      }
      // RER / Train logic
      else if (tags.railway === 'station' && (tags.station === 'train' || tags.train === 'yes')) {
        uniqueRer.add(name);
      }
      // Tram logic
      else if (tags.railway === 'tram_stop' || tags.tram === 'yes') {
        uniqueTram.add(name);
      }
      // Bus logic
      else if (tags.highway === 'bus_stop' || tags.bus === 'yes') {
        uniqueBus.add(name);
      }

      // Education
      if (['school', 'kindergarten', 'college', 'university'].includes(tags.amenity)) {
        uniqueSchools.add(name);
      }

      // Sports
      if (['fitness_centre', 'sports_centre', 'stadium', 'pitch', 'swimming_pool'].includes(tags.leisure)) {
        uniqueSports.add(name);
      }

      // Shops
      if (tags.shop === 'supermarket') {
        uniqueSupermarkets.add(name);
        uniqueShops.add(name);
      } else if (tags.shop) {
        uniqueShops.add(name);
      }
    });

    // Update UI
    document.getElementById('count-metro').textContent = uniqueMetro.size;
    document.getElementById('count-bus').textContent = uniqueBus.size;
    document.getElementById('count-rer').textContent = uniqueRer.size;
    document.getElementById('count-tram').textContent = uniqueTram.size;
    document.getElementById('count-school').textContent = uniqueSchools.size;
    document.getElementById('count-sports').textContent = uniqueSports.size;
    document.getElementById('count-supermarket').textContent = uniqueSupermarkets.size;
    document.getElementById('count-shops').textContent = uniqueShops.size;

    resultsDiv.classList.remove('hidden');
    statusDiv.textContent = 'Neighborhood analysis complete!';
    statusDiv.style.color = 'green';

  } catch (error) {
    statusDiv.textContent = 'Analysis error: ' + error.message;
    statusDiv.style.color = 'red';
    console.error(error);
  }
}
