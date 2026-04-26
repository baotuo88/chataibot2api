// API 工具类
const API_KEY_STORAGE_KEY = 'chataibot_api_key';

class API {
  constructor() {
    this.baseURL = '';
    this.apiKey = localStorage.getItem(API_KEY_STORAGE_KEY) || '';
  }

  setApiKey(key) {
    this.apiKey = key;
    localStorage.setItem(API_KEY_STORAGE_KEY, key);
  }

  getApiKey() {
    return this.apiKey;
  }

  getHeaders(additionalHeaders = {}) {
    const headers = {
      'Content-Type': 'application/json',
      ...additionalHeaders
    };

    if (this.apiKey) {
      headers['X-API-Key'] = this.apiKey;
    }

    return headers;
  }

  async request(url, options = {}) {
    const response = await fetch(url, {
      ...options,
      headers: this.getHeaders(options.headers)
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || `Request failed with status ${response.status}`);
    }

    return response.json();
  }

  // 获取状态
  async getStatus() {
    return this.request('/api/status');
  }

  // 获取账号列表
  async getAccounts() {
    return this.request('/api/accounts');
  }

  // 添加账号
  async addAccount(jwt, email = '', note = '') {
    return this.request('/api/accounts/add', {
      method: 'POST',
      body: JSON.stringify({ jwt, email, note })
    });
  }

  // 删除账号
  async deleteAccount(index) {
    return this.request('/api/accounts/delete', {
      method: 'POST',
      body: JSON.stringify({ index })
    });
  }

  // 生成图片
  async generateImage(prompt, model, size, image = null, images = null) {
    const payload = { prompt, model, size };

    if (image) {
      payload.image = image;
    } else if (images && images.length > 0) {
      payload.images = images;
    }

    return this.request('/v1/images/generations', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  // 健康检查
  async healthCheck() {
    const response = await fetch('/healthz');
    return response.json();
  }
}

// 创建全局 API 实例
const api = new API();
