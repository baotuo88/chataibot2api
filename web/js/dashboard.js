// Dashboard 页面逻辑
let statusInterval;

function createQuotaChip(text) {
  const chip = document.createElement('span');
  chip.className = 'quota-chip';
  chip.textContent = text;
  return chip;
}

async function loadDashboard() {
  try {
    const data = await api.getStatus();
    updateDashboard(data);
    updateStatusBadge('online');
  } catch (error) {
    console.error('Failed to load dashboard:', error);
    updateStatusBadge('error');
  }
}

function updateDashboard(data) {
  const { config, stats, pool } = data;

  // 更新统计卡片
  document.getElementById('total-accounts').textContent = pool.readyAccounts || 0;
  document.getElementById('total-requests').textContent = stats.requestsTotal || 0;

  const successRate = stats.requestsTotal > 0
    ? Math.round((stats.requestsSuccess / stats.requestsTotal) * 100)
    : 0;
  document.getElementById('success-rate').textContent = successRate + '%';

  document.getElementById('uptime').textContent = formatUptime(data.uptimeSec || 0);

  // 更新请求类型
  document.getElementById('text-requests').textContent = stats.textRequests || 0;
  document.getElementById('edit-requests').textContent = stats.editRequests || 0;
  document.getElementById('merge-requests').textContent = stats.mergeRequests || 0;

  // 更新账号池状态
  document.getElementById('pool-max').textContent = pool.maxSize || '--';
  document.getElementById('pool-ready').textContent = pool.readyAccounts || '--';

  // 更新额度显示
  const quotaChips = document.getElementById('quota-chips');
  if (pool.quotas && pool.quotas.length > 0) {
    quotaChips.replaceChildren(...pool.quotas.map((q) => createQuotaChip(String(q))));
  } else {
    quotaChips.replaceChildren(createQuotaChip('--'));
  }

  // 更新系统信息
  document.getElementById('cfg-port').textContent = config.port || '--';
  document.getElementById('cfg-auth').textContent = config.authEnabled
    ? t('common.enabled') || '已启用'
    : t('common.disabled') || '未启用';
  document.getElementById('last-model').textContent = stats.lastModel || '--';
  document.getElementById('last-mode').textContent = stats.lastMode || '--';
}

function updateStatusBadge(status) {
  const badge = document.getElementById('status-badge');
  badge.className = 'status-badge ' + status;

  const statusText = badge.querySelector('span:last-child');
  statusText.textContent = t('status.' + status);
}

function formatUptime(seconds) {
  if (seconds < 60) return seconds + 's';
  if (seconds < 3600) return Math.floor(seconds / 60) + 'm';
  if (seconds < 86400) return Math.floor(seconds / 3600) + 'h';
  return Math.floor(seconds / 86400) + 'd';
}

// 初始化
document.addEventListener('DOMContentLoaded', () => {
  loadDashboard();
  statusInterval = setInterval(loadDashboard, 5000);
});

// 页面卸载时清理
window.addEventListener('beforeunload', () => {
  if (statusInterval) {
    clearInterval(statusInterval);
  }
});
