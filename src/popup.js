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
  const savedConfig = await browserAPI.storage.local.get(['apiKey', 'databaseId', 'llmUrl', 'llmModel']);
  if (savedConfig.apiKey) document.getElementById('api-key').value = savedConfig.apiKey;
  if (savedConfig.databaseId) document.getElementById('database-id').value = savedConfig.databaseId;
  if (savedConfig.llmUrl) document.getElementById('llm-url').value = savedConfig.llmUrl;
  if (savedConfig.llmModel) document.getElementById('llm-model').value = savedConfig.llmModel;

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
    const llmUrl = document.getElementById('llm-url').value.trim();
    const llmModel = document.getElementById('llm-model').value.trim();
    await browserAPI.storage.local.set({ apiKey, databaseId, llmUrl, llmModel });
    statusDiv.textContent = 'Config saved!';
    statusDiv.style.color = 'green';
    configSection.classList.add('hidden');
    setTimeout(() => statusDiv.textContent = '', 2000);
  });

  magicFillBtn.addEventListener('click', async () => {
    const { llmUrl, llmModel } = await browserAPI.storage.local.get(['llmUrl', 'llmModel']);
    const url = llmUrl || 'http://localhost:11434/api/generate';
    const model = llmModel || 'hf.co/LiquidAI/LFM2.5-1.2B-Instruct-GGUF:F16';

    statusDiv.textContent = 'Extracting page content...';
    statusDiv.style.color = 'blue';

    try {
      const [tab] = await browserAPI.tabs.query({ active: true, currentWindow: true });
      const scriptResult = await browserAPI.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => document.body.innerText,
      });
      const pageText = scriptResult[0].result;

      statusDiv.textContent = 'AI is thinking...';
      const prompt = `Extract rental property information from this webpage text. Return ONLY a JSON object with these keys: 
      title (short descriptive title), 
      address (full address if found), 
      city (city only), 
      price (number only), 
      area (number only, in m2), 
      time_to_work (estimated travel time in minutes if mentioned, else null), 
      has_parking (boolean), 
      has_cave (boolean), 
      phone (phone number).
      
      Text:
      ${pageText.substring(0, 4000)}`;

      // Use background script to bypass CORS
      browserAPI.runtime.sendMessage({
        type: 'FETCH_LLM',
        url: url,
        body: {
          model: model,
          prompt: prompt,
          stream: false,
          format: 'json'
        }
      }, (response) => {
        if (!response || !response.success) {
          statusDiv.textContent = 'AI Fill Error: ' + (response ? response.error : 'No response from background');
          statusDiv.style.color = 'red';
          return;
        }

        const extracted = JSON.parse(response.data.response);

        // Fill form
        if (extracted.title) titleInput.value = extracted.title;
        if (extracted.address) addressInput.value = extracted.address;
        if (extracted.city) document.getElementById('city').value = extracted.city;
        if (extracted.price) document.getElementById('price').value = extracted.price;
        if (extracted.area) document.getElementById('area').value = extracted.area;
        if (extracted.time_to_work) document.getElementById('time_to_work').value = extracted.time_to_work;
        if (extracted.has_parking !== undefined) document.getElementById('has_parking').checked = extracted.has_parking;
        if (extracted.has_cave !== undefined) document.getElementById('has_cave').checked = extracted.has_cave;
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
      'State': {
        status: { name: data.state }
      },
      'Phone': {
        phone_number: data.phone || null
      },
      'URL': {
        url: data.url
      },
      'City': {
        rich_text: [{ text: { content: data.city } }]
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
