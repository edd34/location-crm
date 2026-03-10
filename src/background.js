const browserAPI = typeof browser !== 'undefined' ? browser : chrome;

// Listen for messages from the popup or content scripts
browserAPI.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // We use a separate async function to handle the request to keep the listener synchronous
  // but return true to indicate we will respond asynchronously.
  handleMessage(message, sendResponse);
  return true; 
});

async function handleMessage(message, sendResponse) {
  try {
    if (message.type === 'FETCH_LLM') {
      const response = await fetch(message.url, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${message.openRouterApiKey}`,
          'HTTP-Referer': 'https://github.com/location-crm',
          'X-Title': 'Location CRM Extension'
        },
        body: JSON.stringify(message.body)
      });
      
      if (!response.ok) {
        const errText = await response.text();
        throw new Error('LLM Error: ' + errText);
      }
      
      const data = await response.json();
      sendResponse({ success: true, data });
    } 
    else if (message.type === 'FETCH_MAPS') {
      // For Google Maps API, we don't want to send an Origin header if possible,
      // as it's a web service API not meant for browsers.
      // In extensions, fetch from background script should bypass CORS if host permission is granted.
      const response = await fetch(message.url);
      
      if (!response.ok) {
        const errText = await response.text();
        throw new Error('Maps Error: ' + errText);
      }
      
      const data = await response.json();
      sendResponse({ success: true, data });
    }
    else if (message.type === 'FETCH_NOTION') {
      const response = await fetch(message.url, {
        method: message.method || 'GET',
        headers: {
          'Authorization': `Bearer ${message.apiKey}`,
          'Notion-Version': '2022-06-28',
          'Content-Type': 'application/json'
        },
        body: message.body ? JSON.stringify(message.body) : undefined
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error('Notion Error: ' + errText);
      }

      const data = await response.json();
      sendResponse({ success: true, data });
    }
  } catch (error) {
    console.error('Background fetch error:', error);
    sendResponse({ success: false, error: error.message });
  }
}
