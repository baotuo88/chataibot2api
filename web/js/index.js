const form = document.getElementById("image-form");
const fileInput = document.getElementById("images");
const modelSelect = document.getElementById("model");
const apiKeyInput = document.getElementById("api-key");
const modePill = document.getElementById("mode-pill");
const requestStatus = document.getElementById("request-status");
const refreshPill = document.getElementById("refresh-pill");
const submitButton = document.getElementById("submit");
const resultBox = document.getElementById("result-box");
const message = document.getElementById("message");

const textFields = {
  uptime: document.getElementById("uptime-pill"),
  cfgPort: document.getElementById("cfg-port"),
  poolMax: document.getElementById("pool-max"),
  poolReady: document.getElementById("pool-ready"),
  requestsTotal: document.getElementById("requests-total"),
  successRatio: document.getElementById("success-ratio"),
  textRequests: document.getElementById("text-requests"),
  editRequests: document.getElementById("edit-requests"),
  mergeRequests: document.getElementById("merge-requests"),
  lastModel: document.getElementById("last-model-pill"),
  lastMode: document.getElementById("last-mode-pill"),
  runtimeSummary: document.getElementById("runtime-summary")
};

const quotaList = document.getElementById("quota-list");
const modelList = document.getElementById("model-list");
const logBox = document.getElementById("log-box");

let modelsHydrated = false;

const API_KEY_STORAGE_KEY = "chataibot_api_key";

function getAPIKey() {
  return apiKeyInput.value.trim();
}

function buildAuthHeaders(baseHeaders = {}) {
  const headers = { ...baseHeaders };
  const apiKey = getAPIKey();
  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }
  return headers;
}

function setMode() {
  const count = fileInput.files.length;
  let mode = "text-to-image";
  if (count === 1) {
    mode = "image-edit";
  } else if (count > 1) {
    mode = "image-merge";
  }
  modePill.textContent = `Mode: ${mode}`;
}

function setBusy(isBusy) {
  submitButton.disabled = isBusy;
  requestStatus.textContent = isBusy ? "Working" : "Ready";
  requestStatus.className = isBusy ? "tag warn" : "tag success";
}

function setMessage(text, isError = false) {
  message.textContent = text;
  message.className = isError ? "message error" : "message";
}

function showImage(url) {
  resultBox.classList.remove("empty");
  const img = document.createElement("img");
  img.src = url;
  img.alt = "Generated result";
  resultBox.replaceChildren(img);
}

function readAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error(`Failed to read file: ${file.name}`));
    reader.readAsDataURL(file);
  });
}

function renderModels(models) {
  if (!modelsHydrated) {
    const options = models.map((model) => {
      const option = document.createElement("option");
      option.value = model;
      option.textContent = model;
      return option;
    });
    modelSelect.replaceChildren(...options);
    modelsHydrated = true;
  }

  const chips = models.map((model) => {
    const chip = document.createElement("span");
    chip.className = "model-chip";
    chip.textContent = model;
    return chip;
  });
  modelList.replaceChildren(...chips);
}

function renderQuotas(quotas) {
  if (!quotas || quotas.length === 0) {
    const chip = document.createElement("span");
    chip.className = "quota-chip";
    chip.textContent = "No used-pool accounts yet";
    quotaList.replaceChildren(chip);
    return;
  }

  const chips = quotas.map((quota) => {
    const chip = document.createElement("span");
    chip.className = "quota-chip";
    chip.textContent = `quota=${quota}`;
    return chip;
  });
  quotaList.replaceChildren(...chips);
}

function renderLogs(logs) {
  if (!logs || logs.length === 0) {
    const wrapper = document.createElement("div");
    wrapper.className = "log-entry";

    const meta = document.createElement("div");
    meta.className = "log-meta";

    const level = document.createElement("span");
    level.className = "log-level";
    level.textContent = "INFO";

    const time = document.createElement("span");
    time.textContent = "--";

    const body = document.createElement("div");
    body.textContent = "暂无日志。";

    meta.appendChild(level);
    meta.appendChild(time);
    wrapper.appendChild(meta);
    wrapper.appendChild(body);
    logBox.replaceChildren(wrapper);
    return;
  }

  const entries = logs.slice().reverse().map((entry) => {
    const wrapper = document.createElement("div");
    wrapper.className = "log-entry";

    const meta = document.createElement("div");
    meta.className = "log-meta";

    const level = document.createElement("span");
    level.className = `log-level ${String(entry.level || "").toLowerCase()}`;
    level.textContent = entry.level || "INFO";

    const time = document.createElement("span");
    time.textContent = entry.time || "--";

    meta.appendChild(level);
    meta.appendChild(time);

    const body = document.createElement("div");
    body.textContent = entry.message || "";

    wrapper.appendChild(meta);
    wrapper.appendChild(body);
    return wrapper;
  });
  logBox.replaceChildren(...entries);
}

function renderAccountsPlaceholder(className, text) {
  const placeholder = document.createElement("div");
  placeholder.className = className;
  placeholder.textContent = text;
  accountsList.replaceChildren(placeholder);
}

function renderStatus(data) {
  const stats = data.stats || {};
  const config = data.config || {};
  const pool = data.pool || {};

  const successRatio = stats.requestsTotal
    ? `${Math.round((stats.requestsSuccess / stats.requestsTotal) * 100)}%`
    : "0%";

  textFields.uptime.textContent = `Uptime: ${data.uptimeSec || 0}s`;
  textFields.cfgPort.textContent = config.port ?? "--";
  textFields.poolMax.textContent = pool.maxSize ?? "--";
  textFields.poolReady.textContent = pool.readyAccounts ?? "--";
  textFields.requestsTotal.textContent = stats.requestsTotal ?? 0;
  textFields.successRatio.textContent = successRatio;
  textFields.textRequests.textContent = stats.textRequests ?? 0;
  textFields.editRequests.textContent = stats.editRequests ?? 0;
  textFields.mergeRequests.textContent = stats.mergeRequests ?? 0;
  textFields.lastModel.textContent = `Last Model: ${stats.lastModel || "--"}`;
  textFields.lastMode.textContent = `Last Mode: ${stats.lastMode || "--"}`;

  const summaryParts = [
    `Requests: ${stats.requestsSuccess || 0} success / ${stats.requestsFailed || 0} failed`,
    `Auth enabled: ${config.authEnabled ? "yes" : "no"}`,
    `Last error: ${stats.lastError || "none"}`,
    `Last result URL: ${stats.lastResultUrl || "none"}`
  ];
  textFields.runtimeSummary.textContent = summaryParts.join("\n");

  renderQuotas(pool.quotas || []);
  renderModels(config.models || []);
  renderLogs(data.logs || []);
}

async function syncStatus() {
  refreshPill.textContent = "Sync: loading";
  refreshPill.className = "tag warn";

  try {
    const response = await fetch("/api/status", {
      headers: buildAuthHeaders()
    });
    if (!response.ok) {
      throw new Error(`Status request failed: ${response.status}`);
    }
    const data = await response.json();
    renderStatus(data);
    refreshPill.textContent = "Sync: live";
    refreshPill.className = "tag success";
  } catch (error) {
    refreshPill.textContent = "Sync: error";
    refreshPill.className = "tag warn";
    textFields.runtimeSummary.textContent = error.message || String(error);
  }
}

fileInput.addEventListener("change", setMode);
apiKeyInput.value = localStorage.getItem(API_KEY_STORAGE_KEY) || "";
apiKeyInput.addEventListener("input", () => {
  localStorage.setItem(API_KEY_STORAGE_KEY, apiKeyInput.value);
  syncStatus();
});
setMode();

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  setBusy(true);
  setMessage("正在准备请求...");

  try {
    const files = Array.from(fileInput.files);
    const images = await Promise.all(files.map(readAsDataURL));

    const payload = {
      prompt: document.getElementById("prompt").value.trim(),
      model: modelSelect.value,
      size: document.getElementById("size").value
    };

    if (images.length === 1) {
      payload.image = images[0];
    } else if (images.length > 1) {
      payload.images = images;
    }

    setMessage("正在调用后端，这一步可能需要几十秒到几分钟。");

    const response = await fetch("/v1/images/generations", {
      method: "POST",
      headers: buildAuthHeaders({
        "Content-Type": "application/json"
      }),
      body: JSON.stringify(payload)
    });

    const rawText = await response.text();
    if (!response.ok) {
      throw new Error(rawText || `Request failed with status ${response.status}`);
    }

    const data = JSON.parse(rawText);
    const imageUrl = data && data.data && data.data[0] && data.data[0].url;
    if (!imageUrl) {
      throw new Error("Backend response did not include an image URL.");
    }

    showImage(imageUrl);
    setMessage(`生成完成。\n\nResult URL:\n${imageUrl}`);
    await syncStatus();
  } catch (error) {
    setMessage(error.message || String(error), true);
    await syncStatus();
  } finally {
    setBusy(false);
  }
});

syncStatus();
setInterval(syncStatus, 5000);

const addAccountForm = document.getElementById("add-account-form");
const jwtInput = document.getElementById("jwt-input");
const accountsList = document.getElementById("accounts-list");
const accountCountPill = document.getElementById("account-count-pill");

addAccountForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const payload = {
    jwt: jwtInput.value.trim()
  };

  try {
    const response = await fetch("/api/accounts/add", {
      method: "POST",
      headers: buildAuthHeaders({
        "Content-Type": "application/json"
      }),
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || `Failed with status ${response.status}`);
    }

    const data = await response.json();
    alert(`账号添加成功！当前额度: ${data.quota}`);

    jwtInput.value = "";
    await loadAccounts();
    await syncStatus();
  } catch (error) {
    alert(`添加账号失败: ${error.message}`);
  }
});

async function loadAccounts() {
  try {
    const response = await fetch("/api/accounts", {
      headers: buildAuthHeaders()
    });

    if (!response.ok) {
      throw new Error(`Failed to load accounts: ${response.status}`);
    }

    const data = await response.json();
    renderAccounts(data.accounts || []);
    accountCountPill.textContent = `Accounts: ${data.total || 0}`;
  } catch (error) {
    console.error("Failed to load accounts:", error);
    renderAccountsPlaceholder("accounts-error", "加载失败");
  }
}

function renderAccounts(accounts) {
  if (accounts.length === 0) {
    renderAccountsPlaceholder("accounts-empty", "暂无账号");
    return;
  }

  const items = accounts.map((acc, idx) => {
    const item = document.createElement("div");
    item.className = "account-row";

    const info = document.createElement("div");
    info.className = "account-info";

    const indexSpan = document.createElement("div");
    indexSpan.className = "account-meta";
    const emailPart = acc.email ? ` | ${acc.email}` : "";
    indexSpan.textContent = `#${idx} | Quota: ${acc.quota}${emailPart}`;

    const jwtSpan = document.createElement("div");
    jwtSpan.className = "account-jwt";
    jwtSpan.textContent = acc.jwtMasked || "***";

    const noteSpan = document.createElement("div");
    noteSpan.className = "account-note";
    noteSpan.textContent = acc.note ? `Note: ${acc.note}` : "Note: -";

    const updatedAtSpan = document.createElement("div");
    updatedAtSpan.className = "account-updated";
    updatedAtSpan.textContent = `Updated: ${acc.updatedAt || "-"}`;

    info.appendChild(indexSpan);
    info.appendChild(jwtSpan);
    info.appendChild(noteSpan);
    info.appendChild(updatedAtSpan);

    const deleteBtn = document.createElement("button");
    deleteBtn.textContent = "Delete";
    deleteBtn.className = "account-delete";
    deleteBtn.addEventListener("click", () => {
      deleteAccount(acc.index);
    });

    item.appendChild(info);
    item.appendChild(deleteBtn);
    return item;
  });
  accountsList.replaceChildren(...items);
}

async function deleteAccount(index) {
  if (!confirm(`确定要删除账号 #${index} 吗？`)) {
    return;
  }

  try {
    const response = await fetch("/api/accounts/delete", {
      method: "POST",
      headers: buildAuthHeaders({
        "Content-Type": "application/json"
      }),
      body: JSON.stringify({ index })
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || `Failed with status ${response.status}`);
    }

    alert("账号删除成功");
    await loadAccounts();
    await syncStatus();
  } catch (error) {
    alert(`删除账号失败: ${error.message}`);
  }
}

loadAccounts();
setInterval(loadAccounts, 10000);
