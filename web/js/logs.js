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
  tbody.replaceChildren();

  if (logs.length === 0) {
    const row = document.createElement('tr');
    const cell = document.createElement('td');
    cell.colSpan = 3;
    cell.className = 'table-empty-cell';
    cell.textContent = t('logs.no_logs');
    row.appendChild(cell);
    tbody.appendChild(row);
    return;
  }

  // 反转日志顺序，最新的在上面
  const reversedLogs = [...logs].reverse();

  reversedLogs.forEach((log) => {
    const row = document.createElement('tr');
    const normalizedLevel = normalizeLevel(log.level);

    const timeCell = document.createElement('td');
    timeCell.className = 'cell-mono-sm';
    timeCell.textContent = formatLogTime(log.time);
    row.appendChild(timeCell);

    const levelCell = document.createElement('td');
    const levelBadge = document.createElement('span');
    levelBadge.className = `log-badge log-level-${normalizedLevel}`;
    levelBadge.textContent = log.level;
    levelCell.appendChild(levelBadge);
    row.appendChild(levelCell);

    const messageCell = document.createElement('td');
    messageCell.className = 'cell-mono-sm';
    messageCell.textContent = log.message || '';
    row.appendChild(messageCell);

    tbody.appendChild(row);
  });
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

function normalizeLevel(level) {
  const l = level.toLowerCase();
  if (l === 'warning') return 'warn';
  if (l === 'error' || l === 'warn' || l === 'success') return l;
  return 'info';
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

function refreshLogs() {
  loadLogs();
}

// 初始化
document.addEventListener('DOMContentLoaded', () => {
  const refreshButton = document.getElementById('refresh-logs-btn');
  if (refreshButton) {
    refreshButton.addEventListener('click', refreshLogs);
  }
  loadLogs();
  logsInterval = setInterval(loadLogs, 5000);
});

// 页面卸载时清理
window.addEventListener('beforeunload', () => {
  if (logsInterval) {
    clearInterval(logsInterval);
  }
});
