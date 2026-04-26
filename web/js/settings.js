// 设置页面逻辑

async function loadSettings() {
  try {
    const data = await api.getStatus();
    updateSystemInfo(data.config);
    renderModels(data.config.models || []);
  } catch (error) {
    console.error('Failed to load settings:', error);
  }
}

function updateSystemInfo(config) {
  document.getElementById('sys-port').textContent = config.port || '--';
  document.getElementById('sys-auth').textContent = config.authEnabled ? 'Yes' : 'No';
  document.getElementById('sys-pool').textContent = config.poolSize || '--';
}

function renderModels(models) {
  const container = document.getElementById('models-list');
  container.replaceChildren();

  if (models.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'model-empty';
    empty.textContent = 'No models available';
    container.appendChild(empty);
    return;
  }

  models.forEach((model) => {
    const card = document.createElement('div');
    card.className = 'model-card';
    card.textContent = model;
    container.appendChild(card);
  });
}

// 表单提交
document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('api-key-form');
  const apiKeyInput = document.getElementById('api-key-input');

  // 加载已保存的 API Key
  apiKeyInput.value = api.getApiKey();

  form.addEventListener('submit', (e) => {
    e.preventDefault();

    const apiKey = apiKeyInput.value.trim();
    api.setApiKey(apiKey);

    alert(t('settings.saved'));
  });

  // 初始加载
  loadSettings();
});
