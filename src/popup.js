const browserAPI = typeof browser !== 'undefined' ? browser : chrome;

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

  // Load Config
  const savedConfig = await browserAPI.storage.local.get(['apiKey', 'databaseId', 'openRouterApiKey', 'llmUrl', 'llmModel', 'userPhone']);
  if (savedConfig.apiKey) document.getElementById('api-key').value = savedConfig.apiKey;
  if (savedConfig.databaseId) document.getElementById('database-id').value = savedConfig.databaseId;
  if (savedConfig.openRouterApiKey) document.getElementById('openrouter-api-key').value = savedConfig.openRouterApiKey;
  if (savedConfig.llmUrl) document.getElementById('llm-url').value = savedConfig.llmUrl;
  if (savedConfig.llmModel) document.getElementById('llm-model').value = savedConfig.llmModel;
  if (savedConfig.userPhone) document.getElementById('user-phone').value = savedConfig.userPhone;

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
    await browserAPI.storage.local.set({ apiKey, databaseId, openRouterApiKey, llmUrl, llmModel, userPhone });
    statusDiv.textContent = 'Config saved!';
    statusDiv.style.color = 'green';
    configSection.classList.add('hidden');
    setTimeout(() => statusDiv.textContent = '', 2000);
  });

  magicFillBtn.addEventListener('click', async () => {
    const { openRouterApiKey, llmUrl, llmModel, userPhone } = await browserAPI.storage.local.get(['openRouterApiKey', 'llmUrl', 'llmModel', 'userPhone']);
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
      address (full address if found), 
      city (city only), 
      postal_code (postal code if found),
      neighborhood (neighborhood or district if found),
      price (number only), 
      area (number only, in m2), 
      time_to_work (estimated travel time in minutes if mentioned, else null), 
      has_parking (boolean), 
      has_cave (boolean), 
      is_furnished (boolean),
      agency (name of the rental agency if mentioned, else null),
      phone (phone number).
      
      IMPORTANT: If the phone number found is ${userPhone || 'the user\'s personal phone number'}, DO NOT include it. Return null for phone if no other number is found.

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
        if (extracted.has_parking !== undefined) document.getElementById('has_parking').checked = extracted.has_parking;
        if (extracted.has_cave !== undefined) document.getElementById('has_cave').checked = extracted.has_cave;
        if (extracted.is_furnished !== undefined) document.getElementById('is_furnished').checked = extracted.is_furnished;
        if (extracted.agency) document.getElementById('agency').value = extracted.agency;
        if (extracted.phone) document.getElementById('phone').value = extracted.phone;

        statusDiv.textContent = 'AI Fill complete!';
        statusDiv.style.color = 'green';
      });
    } catch (error) {
      statusDiv.textContent = 'AI Fill Error: ' + error.message;
      statusDiv.style.color = 'red';
      console.error(error);
    }
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());
    data.has_parking = document.getElementById('has_parking').checked;
    data.has_cave = document.getElementById('has_cave').checked;
    data.is_furnished = document.getElementById('is_furnished').checked;

    const { apiKey, databaseId } = await browserAPI.storage.local.get(['apiKey', 'databaseId']);

    if (!apiKey || !databaseId) {
      statusDiv.textContent = 'Please configure API key and Database ID first!';
      statusDiv.style.color = 'red';
      configSection.classList.remove('hidden');
      return;
    }

    statusDiv.textContent = 'Checking if exists...';
    statusDiv.style.color = 'blue';

    try {
      const exists = await checkIfExists(apiKey, databaseId, data.url);
      if (exists) {
        statusDiv.textContent = 'Error: This URL already exists in Notion!';
        statusDiv.style.color = 'red';
        return;
      }

      statusDiv.textContent = 'Adding to Notion...';
      const response = await addToNotion(apiKey, databaseId, data);

      if (response.ok) {
        statusDiv.textContent = 'Added successfully!';
        statusDiv.style.color = 'green';
        form.reset();
        // Re-fill URL after reset
        const tabs = await browserAPI.tabs.query({ active: true, currentWindow: true });
        if (tabs[0]) {
          urlInput.value = tabs[0].url;
          titleInput.value = tabs[0].title;
          addressInput.value = "";
        }
      } else {
        const errData = await response.json();
        statusDiv.textContent = 'Error: ' + (errData.message || 'Check database property names');
        statusDiv.style.color = 'red';
        console.error("Notion API Error:", errData);
      }
    } catch (error) {
      statusDiv.textContent = 'Error: ' + error.message;
      statusDiv.style.color = 'red';
      console.error("Submission error:", error);
    }
  });
});

async function checkIfExists(apiKey, databaseId, url) {
  try {
    const response = await fetch(`https://api.notion.com/v1/databases/${databaseId}/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        filter: {
          property: 'URL',
          url: {
            equals: url
          }
        }
      })
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error('Query failed: ' + err.message);
    }

    const result = await response.json();
    return result.results.length > 0;
  } catch (error) {
    console.error("CheckIfExists error:", error);
    throw error;
  }
}

async function addToNotion(apiKey, databaseId, data) {
  const body = {
    parent: { database_id: databaseId },
    properties: {
      'Title': {
        title: [{ text: { content: data.title } }]
      },
      'Address': {
        rich_text: data.address ? [{ text: { content: data.address } }] : []
      },
      'Price': {
        number: parseFloat(data.price)
      },
      'Time to Work': {
        number: data.time_to_work ? parseFloat(data.time_to_work) : null
      },
      'Area': {
        number: data.area ? parseFloat(data.area) : null
      },
      'Has Parking': {
        checkbox: data.has_parking
      },
      'Has Cave': {
        checkbox: data.has_cave
      },
      'Furnished': {
        checkbox: data.is_furnished
      },
      'State': {
        status: { name: data.state }
      },
      'Agency': {
        rich_text: data.agency ? [{ text: { content: data.agency } }] : []
      },
      'Phone': {
        phone_number: data.phone || null
      },
      'URL': {
        url: data.url
      },
      'City': {
        rich_text: [{ text: { content: data.city } }]
      },
      'Postal Code': {
        rich_text: data.postal_code ? [{ text: { content: data.postal_code } }] : []
      },
      'Neighborhood': {
        rich_text: data.neighborhood ? [{ text: { content: data.neighborhood } }] : []
      },
      'Date Added': {
        date: { start: new Date().toISOString() }
      }
    }
  };

  return await fetch('https://api.notion.com/v1/pages', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Notion-Version': '2022-06-28',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
}
