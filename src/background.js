const browserAPI = typeof browser !== 'undefined' ? browser : chrome;

// Listen for messages from the popup
browserAPI.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'FETCH_LLM') {
    // Perform the fetch in the background script context
    fetch(message.url, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${message.openRouterApiKey}`,
        'HTTP-Referer': 'https://github.com/location-crm', // Optional but recommended by OpenRouter
        'X-Title': 'Location CRM Extension' // Optional but recommended by OpenRouter
      },
      body: JSON.stringify(message.body)
    })
      .then(async response => {
        if (!response.ok) {
          const errText = await response.text();
          let errorMsg = `HTTP ${response.status}`;
          try {
            const errJson = JSON.parse(errText);
            errorMsg = errJson.error?.message || errJson.error || errorMsg;
          } catch (e) {
            errorMsg = errText || errorMsg;
          }
          throw new Error('LLM Error: ' + errorMsg);
        }
        return response.json();
      })
      .then(data => sendResponse({ success: true, data }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    
    return true; // Keep the message channel open for async response
  }
});
