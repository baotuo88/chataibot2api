// 账号管理页面逻辑
let accountsInterval;
const QUOTA_WARNING_THRESHOLD = 10; // 额度预警阈值

async function loadAccounts() {
  try {
    const data = await api.getAccounts();
    renderAccounts(data.accounts || []);
    updateAccountCount(data.total || 0);
    checkQuotaWarnings(data.accounts || []);
  } catch (error) {
    console.error('Failed to load accounts:', error);
    showError(t('accounts.load_failed'));
  }
}

function renderAccounts(accounts) {
  const tbody = document.getElementById('accounts-table-body');

  if (accounts.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center; color: var(--text-muted);">
          <span data-i18n="accounts.no_accounts">${t('accounts.no_accounts')}</span>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = accounts.map((acc, idx) => {
    const isLowQuota = acc.quota < QUOTA_WARNING_THRESHOLD;
    const quotaColor = acc.quota > 30 ? 'var(--success)' : (isLowQuota ? 'var(--danger)' : 'var(--warning)');
    const quotaBg = acc.quota > 30 ? 'rgba(16, 185, 129, 0.1)' : (isLowQuota ? 'rgba(239, 68, 68, 0.1)' : 'rgba(245, 158, 11, 0.1)');
    const email = acc.email || '-';
    const note = acc.note || '-';
    const jwtMasked = acc.jwtMasked || '***';
    const updatedAt = acc.updatedAt || '-';

    return `
      <tr ${isLowQuota ? 'style="background: rgba(239, 68, 68, 0.05);"' : ''}>
        <td>
          <strong>#${acc.index}</strong>
          ${isLowQuota ? '<span style="color: var(--danger); margin-left: 8px;">⚠️</span>' : ''}
        </td>
        <td>
          <code style="font-size: 12px; color: var(--text-muted);">
            ${jwtMasked}
          </code>
        </td>
        <td>${email}</td>
        <td>${note}</td>
        <td>
          <span style="
            padding: 4px 12px;
            background: ${quotaBg};
            color: ${quotaColor};
            border-radius: 12px;
            font-weight: 600;
            font-size: 14px;
          ">
            ${acc.quota}
          </span>
        </td>
        <td><code style="font-size: 12px; color: var(--text-muted);">${updatedAt}</code></td>
        <td>
          <button class="btn btn-danger" onclick="deleteAccount(${acc.index})" style="padding: 6px 16px; font-size: 13px;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
            <span data-i18n="accounts.delete">${t('accounts.delete')}</span>
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

function checkQuotaWarnings(accounts) {
  const lowQuotaAccounts = accounts.filter(acc => acc.quota < QUOTA_WARNING_THRESHOLD);

  if (lowQuotaAccounts.length > 0) {
    const message = `⚠️ 警告：有 ${lowQuotaAccounts.length} 个账号额度低于 ${QUOTA_WARNING_THRESHOLD}！`;
    showWarningNotification(message);
  }
}

function showWarningNotification(message) {
  // 创建通知元素
  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 16px 20px;
    background: var(--warning);
    color: white;
    border-radius: 8px;
    box-shadow: var(--shadow-lg);
    z-index: 9999;
    animation: slideIn 0.3s ease-out;
  `;
  notification.textContent = message;
  document.body.appendChild(notification);

  // 3秒后自动消失
  setTimeout(() => {
    notification.style.animation = 'slideOut 0.3s ease-out';
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

// 批量导入账号
async function importAccounts(event) {
  const file = event.target.files[0];
  if (!file) return;

  try {
    const text = await file.text();
    const accounts = JSON.parse(text);

    if (!Array.isArray(accounts)) {
      throw new Error('Invalid JSON format. Expected an array.');
    }

    let successCount = 0;
    let failCount = 0;

    for (const acc of accounts) {
      if (!acc.jwt) {
        failCount++;
        continue;
      }

      try {
        await api.addAccount(acc.jwt, acc.email || '', acc.note || '');
        successCount++;
      } catch (error) {
        console.error('Failed to add account:', error);
        failCount++;
      }
    }

    alert(`导入完成！\n成功：${successCount} 个\n失败：${failCount} 个`);
    await loadAccounts();
  } catch (error) {
    showError('导入失败：' + error.message);
  }

  // 清空文件输入
  event.target.value = '';
}

// 导出账号
async function exportAccounts() {
  try {
    const accounts = await api.exportAccounts();

    const blob = new Blob([JSON.stringify(accounts, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `accounts_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showSuccess('账号导出成功！');
  } catch (error) {
    showError('导出失败：' + error.message);
  }
}

function updateAccountCount(count) {
  const badge = document.getElementById('account-count');
  badge.innerHTML = `<span data-i18n="accounts.title">${t('accounts.title')}</span>: <strong>${count}</strong>`;
}

async function deleteAccount(index) {
  if (!confirm(t('accounts.confirm_delete'))) {
    return;
  }

  try {
    await api.deleteAccount(index);
    showSuccess(t('accounts.delete_success'));
    await loadAccounts();
  } catch (error) {
    showError(t('accounts.delete_failed') + error.message);
  }
}

function showSuccess(message) {
  alert(message);
}

function showError(message) {
  alert(message);
}

// 表单提交
document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('add-account-form');
  const jwtInput = document.getElementById('jwt-input');
  const emailInput = document.getElementById('email-input');
  const noteInput = document.getElementById('note-input');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const jwt = jwtInput.value.trim();
    const email = emailInput.value.trim();
    const note = noteInput.value.trim();

    if (!jwt) {
      showError('JWT Token is required');
      return;
    }

    try {
      const result = await api.addAccount(jwt, email, note);
      showSuccess(t('accounts.add_success') + result.quota);

      // 清空表单
      jwtInput.value = '';
      emailInput.value = '';
      noteInput.value = '';

      // 重新加载账号列表
      await loadAccounts();
    } catch (error) {
      showError(t('accounts.add_failed') + error.message);
    }
  });

  // 初始加载
  loadAccounts();
  accountsInterval = setInterval(loadAccounts, 10000);
});

// 页面卸载时清理
window.addEventListener('beforeunload', () => {
  if (accountsInterval) {
    clearInterval(accountsInterval);
  }
});
