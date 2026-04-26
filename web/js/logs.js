// 日志页面逻辑
let logsInterval;

async function loadLogs() {
  try {
    const data = await api.getStatus();
    renderLogs(data.logs || []);
    updateLogStats(data.logs || []);
  } catch (error) {
    console.error('Failed to load logs:', error);
  }
}

function renderLogs(logs) {
  const tbody = document.getElementById('logs-table-body');

  if (logs.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="3" style="text-align: center; color: var(--text-muted);">
          <span data-i18n="logs.no_logs">${t('logs.no_logs')}</span>
        </td>
      </tr>
    `;
    return;
  }

  // 反转日志顺序，最新的在上面
  const reversedLogs = [...logs].reverse();

  tbody.innerHTML = reversedLogs.map(log => {
    const levelColor = getLevelColor(log.level);
    const levelBg = getLevelBg(log.level);

    return `
      <tr>
        <td style="font-family: 'Courier New', monospace; font-size: 13px; color: var(--text-muted);">
          ${formatLogTime(log.time)}
        </td>
        <td>
          <span style="
            padding: 4px 10px;
            background: ${levelBg};
            color: ${levelColor};
            border-radius: 6px;
            font-weight: 600;
            font-size: 12px;
            text-transform: uppercase;
          ">
            ${log.level}
          </span>
        </td>
        <td style="font-family: 'Courier New', monospace; font-size: 13px;">
          ${escapeHtml(log.message)}
        </td>
      </tr>
    `;
  }).join('');
}

function updateLogStats(logs) {
  document.getElementById('total-logs').textContent = logs.length;

  const stats = {
    success: 0,
    warn: 0,
    info: 0
  };

  logs.forEach(log => {
    const level = log.level.toLowerCase();
    if (level === 'success') stats.success++;
    else if (level === 'warn' || level === 'warning') stats.warn++;
    else if (level === 'info') stats.info++;
  });

  document.getElementById('success-logs').textContent = stats.success;
  document.getElementById('warn-logs').textContent = stats.warn;
  document.getElementById('info-logs').textContent = stats.info;
}

function getLevelColor(level) {
  const l = level.toLowerCase();
  if (l === 'error') return 'var(--danger)';
  if (l === 'warn' || l === 'warning') return 'var(--warning)';
  if (l === 'success') return 'var(--success)';
  return 'var(--primary)';
}

function getLevelBg(level) {
  const l = level.toLowerCase();
  if (l === 'error') return 'rgba(239, 68, 68, 0.1)';
  if (l === 'warn' || l === 'warning') return 'rgba(245, 158, 11, 0.1)';
  if (l === 'success') return 'rgba(16, 185, 129, 0.1)';
  return 'rgba(59, 130, 246, 0.1)';
}

function formatLogTime(timeStr) {
  try {
    const date = new Date(timeStr);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  } catch (e) {
    return timeStr;
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function refreshLogs() {
  loadLogs();
}

// 初始化
document.addEventListener('DOMContentLoaded', () => {
  loadLogs();
  logsInterval = setInterval(loadLogs, 5000);
});

// 页面卸载时清理
window.addEventListener('beforeunload', () => {
  if (logsInterval) {
    clearInterval(logsInterval);
  }
});
