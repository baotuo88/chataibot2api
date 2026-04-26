// 账号管理页面逻辑
let accountsInterval;
const QUOTA_WARNING_THRESHOLD = 10; // 额度预警阈值
const DEFAULT_PAGE_SIZE = 20;
let currentPage = 1;
let currentPageSize = DEFAULT_PAGE_SIZE;
let currentTotalPages = 0;
let lastLowQuotaCount = 0;

function createSvgElement(tagName, attributes = {}) {
  const element = document.createElementNS('http://www.w3.org/2000/svg', tagName);
  Object.entries(attributes).forEach(([key, value]) => {
    element.setAttribute(key, value);
  });
  return element;
}

async function loadAccounts(page = currentPage) {
  try {
    const data = await api.getAccounts(page, currentPageSize);
    currentPage = data.page || 1;
    currentPageSize = data.pageSize || currentPageSize;
    currentTotalPages = data.totalPages || 0;
    renderAccounts(data.accounts || []);
    updateAccountCount(data.total || 0);
    updatePagination(data.total || 0, currentPage, currentPageSize, currentTotalPages);
    syncPageSizeSelect(currentPageSize);
    checkQuotaWarnings(data.lowQuotaCount || 0);
  } catch (error) {
    console.error('Failed to load accounts:', error);
    showError(t('accounts.load_failed'));
  }
}

function renderAccounts(accounts) {
  const tbody = document.getElementById('accounts-table-body');
  tbody.replaceChildren();

  if (accounts.length === 0) {
    const row = document.createElement('tr');
    const cell = document.createElement('td');
    cell.colSpan = 7;
    cell.className = 'table-empty-cell';
    cell.textContent = t('accounts.no_accounts');
    row.appendChild(cell);
    tbody.appendChild(row);
    return;
  }

  accounts.forEach((acc) => {
    const isLowQuota = acc.quota < QUOTA_WARNING_THRESHOLD;
    const quotaColor = acc.quota > 30 ? 'var(--success)' : (isLowQuota ? 'var(--danger)' : 'var(--warning)');
    const quotaBg = acc.quota > 30 ? 'rgba(16, 185, 129, 0.1)' : (isLowQuota ? 'rgba(239, 68, 68, 0.1)' : 'rgba(245, 158, 11, 0.1)');
    const email = acc.email || '-';
    const note = acc.note || '-';
    const jwtMasked = acc.jwtMasked || '***';
    const updatedAt = acc.updatedAt || '-';
    const row = document.createElement('tr');
    if (isLowQuota) {
      row.className = 'warning-row';
    }

    const indexCell = document.createElement('td');
    const indexStrong = document.createElement('strong');
    indexStrong.textContent = `#${acc.index}`;
    indexCell.appendChild(indexStrong);
    if (isLowQuota) {
      const warning = document.createElement('span');
      warning.className = 'warning-mark';
      warning.textContent = '⚠️';
      indexCell.appendChild(warning);
    }
    row.appendChild(indexCell);

    const jwtCell = document.createElement('td');
    const jwtCode = document.createElement('code');
    jwtCode.className = 'jwt-preview-code';
    jwtCode.textContent = jwtMasked;
    jwtCell.appendChild(jwtCode);
    row.appendChild(jwtCell);

    const emailCell = document.createElement('td');
    emailCell.textContent = email;
    row.appendChild(emailCell);

    const noteCell = document.createElement('td');
    noteCell.textContent = note;
    row.appendChild(noteCell);

    const quotaCell = document.createElement('td');
    const quotaBadge = document.createElement('span');
    quotaBadge.className = `quota-badge ${acc.quota > 30 ? 'quota-high' : (isLowQuota ? 'quota-low' : 'quota-medium')}`;
    quotaBadge.textContent = String(acc.quota);
    quotaCell.appendChild(quotaBadge);
    row.appendChild(quotaCell);

    const updatedAtCell = document.createElement('td');
    const updatedAtCode = document.createElement('code');
    updatedAtCode.className = 'updated-code';
    updatedAtCode.textContent = updatedAt;
    updatedAtCell.appendChild(updatedAtCode);
    row.appendChild(updatedAtCell);

    const actionCell = document.createElement('td');
    const deleteButton = document.createElement('button');
    deleteButton.className = 'btn btn-danger btn-danger-compact';
    const deleteIcon = createSvgElement('svg', {
      width: '14',
      height: '14',
      viewBox: '0 0 24 24',
      fill: 'none',
      stroke: 'currentColor',
      'stroke-width': '2'
    });
    deleteIcon.appendChild(createSvgElement('polyline', { points: '3 6 5 6 21 6' }));
    deleteIcon.appendChild(createSvgElement('path', {
      d: 'M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2'
    }));
    const deleteLabel = document.createElement('span');
    deleteLabel.setAttribute('data-i18n', 'accounts.delete');
    deleteLabel.textContent = t('accounts.delete');
    deleteButton.replaceChildren(deleteIcon, deleteLabel);
    deleteButton.addEventListener('click', () => deleteAccount(acc.index));
    actionCell.appendChild(deleteButton);
    row.appendChild(actionCell);

    tbody.appendChild(row);
  });
}

function checkQuotaWarnings(lowQuotaCount) {
  if (lowQuotaCount > 0 && lowQuotaCount !== lastLowQuotaCount) {
    const message = `⚠️ 警告：有 ${lowQuotaCount} 个账号额度低于 ${QUOTA_WARNING_THRESHOLD}！`;
    showWarningNotification(message);
  }
  lastLowQuotaCount = lowQuotaCount;
}

function showWarningNotification(message) {
  // 创建通知元素
  const notification = document.createElement('div');
  notification.className = 'toast-warning';
  notification.textContent = message;
  document.body.appendChild(notification);

  // 3秒后自动消失
  setTimeout(() => {
    notification.classList.add('hide');
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
  badge.replaceChildren();

  const label = document.createElement('span');
  label.setAttribute('data-i18n', 'accounts.title');
  label.textContent = t('accounts.title');

  const strong = document.createElement('strong');
  strong.textContent = String(count);

  badge.appendChild(label);
  badge.appendChild(document.createTextNode(': '));
  badge.appendChild(strong);
}

function getPageSummaryText(total, page, totalPages) {
  if (currentLang === 'en') {
    return `Page ${page} / ${totalPages || 1}, ${total} accounts`;
  }
  return `第 ${page} / ${totalPages || 1} 页，共 ${total} 个账号`;
}

function syncPageSizeSelect(pageSize) {
  const pageSizeSelect = document.getElementById('account-page-size');
  if (pageSizeSelect) {
    pageSizeSelect.value = String(pageSize);
  }
}

function updatePagination(total, page, pageSize, totalPages) {
  const summary = document.getElementById('account-page-summary');
  const prevButton = document.getElementById('account-prev-page');
  const nextButton = document.getElementById('account-next-page');

  if (summary) {
    summary.textContent = getPageSummaryText(total, page, totalPages);
  }
  if (prevButton) {
    prevButton.disabled = page <= 1;
  }
  if (nextButton) {
    nextButton.disabled = totalPages === 0 || page >= totalPages;
  }

  currentPage = page;
  currentPageSize = pageSize;
  currentTotalPages = totalPages;
}

async function deleteAccount(index) {
  if (!confirm(t('accounts.confirm_delete'))) {
    return;
  }

  try {
    await api.deleteAccount(index);
    showSuccess(t('accounts.delete_success'));
    await loadAccounts(currentPage);
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
  const importButton = document.getElementById('import-accounts-btn');
  const exportButton = document.getElementById('export-accounts-btn');
  const batchImportInput = document.getElementById('batch-import-input');
  const prevButton = document.getElementById('account-prev-page');
  const nextButton = document.getElementById('account-next-page');
  const pageSizeSelect = document.getElementById('account-page-size');

  if (importButton && batchImportInput) {
    importButton.addEventListener('click', () => batchImportInput.click());
    batchImportInput.addEventListener('change', importAccounts);
  }
  if (exportButton) {
    exportButton.addEventListener('click', exportAccounts);
  }
  if (prevButton) {
    prevButton.addEventListener('click', () => {
      if (currentPage > 1) {
        loadAccounts(currentPage - 1);
      }
    });
  }
  if (nextButton) {
    nextButton.addEventListener('click', () => {
      if (currentPage < currentTotalPages) {
        loadAccounts(currentPage + 1);
      }
    });
  }
  if (pageSizeSelect) {
    pageSizeSelect.addEventListener('change', () => {
      currentPageSize = Number(pageSizeSelect.value) || DEFAULT_PAGE_SIZE;
      currentPage = 1;
      loadAccounts(1);
    });
  }

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
      await loadAccounts(1);
    } catch (error) {
      showError(t('accounts.add_failed') + error.message);
    }
  });

  // 初始加载
  syncPageSizeSelect(currentPageSize);
  loadAccounts();
  accountsInterval = setInterval(loadAccounts, 10000);
});

// 页面卸载时清理
window.addEventListener('beforeunload', () => {
  if (accountsInterval) {
    clearInterval(accountsInterval);
  }
});
