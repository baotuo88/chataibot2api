// 请求历史页面逻辑
let historyInterval;

async function loadHistory() {
  try {
    const response = await fetch('/api/history', {
      headers: api.getHeaders()
    });

    if (!response.ok) {
      throw new Error(`Failed to load history: ${response.status}`);
    }

    const data = await response.json();
    renderHistory(data.history || []);
  } catch (error) {
    console.error('Failed to load history:', error);
  }
}

function renderHistory(history) {
  const tbody = document.getElementById('history-table-body');
  tbody.replaceChildren();

  if (history.length === 0) {
    const row = document.createElement('tr');
    const cell = document.createElement('td');
    cell.colSpan = 7;
    cell.className = 'table-empty-cell';
    cell.textContent = '暂无请求历史';
    row.appendChild(cell);
    tbody.appendChild(row);
    return;
  }

  history.forEach((item) => {
    const statusColor = item.success ? 'var(--success)' : 'var(--danger)';
    const statusBg = item.success ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)';
    const statusText = item.success ? '成功' : '失败';
    const row = document.createElement('tr');

    const timeCell = document.createElement('td');
    timeCell.className = 'cell-mono-xs-muted';
    timeCell.textContent = formatTime(item.time);
    row.appendChild(timeCell);

    const statusCell = document.createElement('td');
    const statusBadge = document.createElement('span');
    statusBadge.className = `badge-compact ${item.success ? 'status-success' : 'status-failure'}`;
    statusBadge.textContent = statusText;
    statusCell.appendChild(statusBadge);
    row.appendChild(statusCell);

    const modelCell = document.createElement('td');
    modelCell.className = 'cell-mono-sm';
    modelCell.textContent = item.model || '';
    row.appendChild(modelCell);

    const promptCell = document.createElement('td');
    promptCell.className = 'cell-truncate';
    promptCell.title = item.prompt || '';
    promptCell.textContent = item.prompt || '';
    row.appendChild(promptCell);

    const sizeCell = document.createElement('td');
    sizeCell.className = 'cell-mono-xs';
    sizeCell.textContent = item.size || '';
    row.appendChild(sizeCell);

    const durationCell = document.createElement('td');
    durationCell.className = 'cell-mono-xs';
    durationCell.textContent = `${item.duration}ms`;
    row.appendChild(durationCell);

    const actionCell = document.createElement('td');
    if (item.success && item.imageUrl) {
      const button = document.createElement('button');
      button.className = 'btn btn-secondary action-btn-compact';
      button.textContent = '查看';
      button.addEventListener('click', () => viewImage(item.imageUrl));
      actionCell.appendChild(button);
    } else {
      const errorText = document.createElement('span');
      errorText.className = 'text-muted-xs';
      errorText.title = item.error || '';
      errorText.textContent = item.error ? '错误' : '-';
      actionCell.appendChild(errorText);
    }
    row.appendChild(actionCell);

    tbody.appendChild(row);
  });
}

function formatTime(timeStr) {
  try {
    const date = new Date(timeStr);
    return date.toLocaleString('zh-CN', {
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

function viewImage(url) {
  const modal = document.getElementById('image-modal');
  const img = document.getElementById('modal-image');
  img.src = url;
  modal.classList.add('open');
}

function closeImageModal() {
  const modal = document.getElementById('image-modal');
  modal.classList.remove('open');
}

function refreshHistory() {
  loadHistory();
}

// 初始化
document.addEventListener('DOMContentLoaded', () => {
  const refreshButton = document.getElementById('refresh-history-btn');
  const modal = document.getElementById('image-modal');
  const closeModalButton = document.getElementById('close-image-modal-btn');

  if (refreshButton) {
    refreshButton.addEventListener('click', refreshHistory);
  }
  if (modal) {
    modal.addEventListener('click', (event) => {
      if (event.target === modal) {
        closeImageModal();
      }
    });
  }
  if (closeModalButton) {
    closeModalButton.addEventListener('click', closeImageModal);
  }

  loadHistory();
  historyInterval = setInterval(loadHistory, 10000);
});

// 页面卸载时清理
window.addEventListener('beforeunload', () => {
  if (historyInterval) {
    clearInterval(historyInterval);
  }
});
