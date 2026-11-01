const browserAPI = typeof browser !== 'undefined' ? browser : chrome;

const FIELDS = [
  'apiKey',
  'databaseId',
  'openRouterApiKey',
  'llmUrl',
  'llmModel',
  'userPhone',
  'googleApiKey',
  'workAddress'
];

const ELEMENT_MAP = {
  apiKey: 'api-key',
  databaseId: 'database-id',
  openRouterApiKey: 'openrouter-api-key',
  llmUrl: 'llm-url',
  llmModel: 'llm-model',
  userPhone: 'user-phone',
  googleApiKey: 'google-api-key',
  workAddress: 'work-address'
};

document.addEventListener('DOMContentLoaded', async () => {
  const saveBtn = document.getElementById('save-btn');
  const statusBar = document.getElementById('status-bar');

  // 1. Load saved config
  try {
    const saved = await browserAPI.storage.local.get(FIELDS);
    for (const key of FIELDS) {
      const elId = ELEMENT_MAP[key];
      const el = document.getElementById(elId);
      if (el && saved[key] !== undefined && saved[key] !== '') {
        el.value = saved[key];
      }
    }
  } catch (err) {
    console.error("Error loading settings:", err);
  }

  // 2. Password toggle visibility
  document.querySelectorAll('.toggle-password').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-target');
      const input = document.getElementById(targetId);
      if (input) {
        input.type = input.type === 'password' ? 'text' : 'password';
      }
    });
  });

  // 3. Helper to collect and save config
  const saveConfig = async (isAutoSave = false) => {
    const dataToSave = {};
    for (const key of FIELDS) {
      const elId = ELEMENT_MAP[key];
      const el = document.getElementById(elId);
      if (el) {
        dataToSave[key] = el.value.trim();
      }
    }

    try {
      await browserAPI.storage.local.set(dataToSave);
      if (!isAutoSave && statusBar) {
        statusBar.textContent = '✅ Configuration enregistrée avec succès !';
        statusBar.className = 'status-bar success';
        setTimeout(() => {
          statusBar.className = 'status-bar hidden';
        }, 3000);
      }
    } catch (err) {
      console.error("Error saving settings:", err);
      if (statusBar) {
        statusBar.textContent = '❌ Erreur de sauvegarde : ' + err.message;
        statusBar.className = 'status-bar';
        statusBar.style.backgroundColor = '#fee2e2';
        statusBar.style.color = '#991b1b';
      }
    }
  };

  // 4. Manual save button
  saveBtn.addEventListener('click', () => saveConfig(false));

  // 5. Auto-save on change / debounced input so nothing is ever lost
  let debounceTimeout = null;
  for (const key of FIELDS) {
    const elId = ELEMENT_MAP[key];
    const el = document.getElementById(elId);
    if (el) {
      el.addEventListener('change', () => saveConfig(true));
      el.addEventListener('input', () => {
        clearTimeout(debounceTimeout);
        debounceTimeout = setTimeout(() => saveConfig(true), 600);
      });
    }
  }
});

