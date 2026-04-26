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

  if (history.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center; color: var(--text-muted);">
          暂无请求历史
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = history.map(item => {
    const statusColor = item.success ? 'var(--success)' : 'var(--danger)';
    const statusBg = item.success ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)';
    const statusText = item.success ? '成功' : '失败';

    return `
      <tr>
        <td style="font-family: 'Courier New', monospace; font-size: 12px; color: var(--text-muted);">
          ${formatTime(item.time)}
        </td>
        <td>
          <span style="
            padding: 4px 10px;
            background: ${statusBg};
            color: ${statusColor};
            border-radius: 6px;
            font-weight: 600;
            font-size: 12px;
          ">
            ${statusText}
          </span>
        </td>
        <td style="font-family: 'Courier New', monospace; font-size: 13px;">
          ${item.model}
        </td>
        <td style="max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${escapeHtml(item.prompt)}">
          ${escapeHtml(item.prompt)}
        </td>
        <td style="font-family: 'Courier New', monospace; font-size: 12px;">
          ${item.size}
        </td>
        <td style="font-family: 'Courier New', monospace; font-size: 12px;">
          ${item.duration}ms
        </td>
        <td>
          ${item.success && item.imageUrl ? `
            <button class="btn btn-secondary" onclick="viewImage('${item.imageUrl}')" style="padding: 4px 12px; font-size: 12px;">
              查看
            </button>
          ` : `
            <span style="color: var(--text-muted); font-size: 12px;" title="${escapeHtml(item.error || '')}">
              ${item.error ? '错误' : '-'}
            </span>
          `}
        </td>
      </tr>
    `;
  }).join('');
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

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function viewImage(url) {
  const modal = document.getElementById('image-modal');
  const img = document.getElementById('modal-image');
  img.src = url;
  modal.style.display = 'flex';
}

function closeImageModal() {
  const modal = document.getElementById('image-modal');
  modal.style.display = 'none';
}

function refreshHistory() {
  loadHistory();
}

// 初始化
document.addEventListener('DOMContentLoaded', () => {
  loadHistory();
  historyInterval = setInterval(loadHistory, 10000);
});

// 页面卸载时清理
window.addEventListener('beforeunload', () => {
  if (historyInterval) {
    clearInterval(historyInterval);
  }
});
