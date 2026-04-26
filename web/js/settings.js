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

  if (models.length === 0) {
    container.innerHTML = '<div style="color: var(--text-muted);">No models available</div>';
    return;
  }

  container.innerHTML = models.map(model => `
    <div style="
      padding: 12px 16px;
      background: var(--bg-tertiary);
      border: 1px solid var(--border);
      border-radius: 8px;
      font-family: 'Courier New', monospace;
      font-size: 13px;
      color: var(--text-primary);
    ">
      ${model}
    </div>
  `).join('');
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
