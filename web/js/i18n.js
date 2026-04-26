// 国际化翻译
const translations = {
  zh: {
    nav: {
      dashboard: '仪表盘',
      accounts: '账号管理',
      playground: 'API 测试',
      logs: '运行日志',
      settings: '系统设置'
    },
    dashboard: {
      title: '仪表盘',
      subtitle: '系统运行状态概览',
      accounts: '账号总数',
      requests: '总请求数',
      success_rate: '成功率',
      uptime: '运行时间',
      request_types: '请求类型分布',
      text_to_image: '文生图',
      image_edit: '图片编辑',
      image_merge: '图片合并',
      pool_status: '账号池状态',
      pool_max: '池容量',
      pool_ready: '可用账号',
      quotas: '账号额度',
      system_info: '系统信息',
      port: '端口',
      auth: '鉴权',
      last_model: '最近模型',
      last_mode: '最近模式'
    },
    accounts: {
      title: '账号管理',
      subtitle: '管理 API 账号和额度',
      add_account: '添加账号',
      jwt_token: 'JWT Token',
      jwt_preview: 'JWT 预览',
      jwt_placeholder: '粘贴完整的 JWT token',
      email: '邮箱（可选）',
      note: '备注（可选）',
      submit: '添加账号',
      account_list: '账号列表',
      index: '索引',
      quota: '额度',
      updated_at: '更新时间',
      actions: '操作',
      delete: '删除',
      confirm_delete: '确定要删除这个账号吗？',
      add_success: '账号添加成功！当前额度：',
      add_failed: '添加账号失败：',
      delete_success: '账号删除成功',
      delete_failed: '删除账号失败：',
      no_accounts: '暂无账号',
      load_failed: '加载失败',
      page_size: '每页',
      prev_page: '上一页',
      next_page: '下一页'
    },
    playground: {
      title: 'API 测试',
      subtitle: '测试图片生成接口',
      prompt: '提示词',
      prompt_placeholder: '描述你想生成的图片...',
      model: '模型',
      size: '尺寸',
      upload_image: '上传图片',
      generate: '生成图片',
      generating: '生成中...',
      result: '生成结果',
      no_result: '暂无结果',
      copy_url: '复制链接',
      download: '下载图片',
      success: '生成成功',
      failed: '生成失败：'
    },
    logs: {
      title: '运行日志',
      subtitle: '查看系统运行日志',
      time: '时间',
      level: '级别',
      message: '消息',
      no_logs: '暂无日志',
      clear: '清空日志'
    },
    settings: {
      title: '系统设置',
      subtitle: '配置系统参数',
      api_key: 'API Key',
      api_key_desc: '用于接口鉴权的密钥',
      save: '保存设置',
      saved: '设置已保存'
    },
    status: {
      loading: '加载中...',
      online: '运行中',
      offline: '离线',
      error: '错误'
    },
    common: {
      confirm: '确认',
      cancel: '取消',
      close: '关闭',
      save: '保存',
      delete: '删除',
      edit: '编辑',
      refresh: '刷新',
      search: '搜索',
      filter: '筛选',
      export: '导出',
      import: '导入'
    }
  },
  en: {
    nav: {
      dashboard: 'Dashboard',
      accounts: 'Accounts',
      playground: 'Playground',
      logs: 'Logs',
      settings: 'Settings'
    },
    dashboard: {
      title: 'Dashboard',
      subtitle: 'System status overview',
      accounts: 'Total Accounts',
      requests: 'Total Requests',
      success_rate: 'Success Rate',
      uptime: 'Uptime',
      request_types: 'Request Types',
      text_to_image: 'Text to Image',
      image_edit: 'Image Edit',
      image_merge: 'Image Merge',
      pool_status: 'Pool Status',
      pool_max: 'Max Size',
      pool_ready: 'Ready Accounts',
      quotas: 'Account Quotas',
      system_info: 'System Info',
      port: 'Port',
      auth: 'Auth',
      last_model: 'Last Model',
      last_mode: 'Last Mode'
    },
    accounts: {
      title: 'Account Management',
      subtitle: 'Manage API accounts and quotas',
      add_account: 'Add Account',
      jwt_token: 'JWT Token',
      jwt_preview: 'JWT Preview',
      jwt_placeholder: 'Paste your JWT token here',
      email: 'Email (Optional)',
      note: 'Note (Optional)',
      submit: 'Add Account',
      account_list: 'Account List',
      index: 'Index',
      quota: 'Quota',
      updated_at: 'Updated At',
      actions: 'Actions',
      delete: 'Delete',
      confirm_delete: 'Are you sure to delete this account?',
      add_success: 'Account added successfully! Quota: ',
      add_failed: 'Failed to add account: ',
      delete_success: 'Account deleted successfully',
      delete_failed: 'Failed to delete account: ',
      no_accounts: 'No accounts',
      load_failed: 'Failed to load',
      page_size: 'Per page',
      prev_page: 'Previous',
      next_page: 'Next'
    },
    playground: {
      title: 'API Playground',
      subtitle: 'Test image generation API',
      prompt: 'Prompt',
      prompt_placeholder: 'Describe the image you want to generate...',
      model: 'Model',
      size: 'Size',
      upload_image: 'Upload Image',
      generate: 'Generate',
      generating: 'Generating...',
      result: 'Result',
      no_result: 'No result yet',
      copy_url: 'Copy URL',
      download: 'Download',
      success: 'Generated successfully',
      failed: 'Generation failed: '
    },
    logs: {
      title: 'System Logs',
      subtitle: 'View system runtime logs',
      time: 'Time',
      level: 'Level',
      message: 'Message',
      no_logs: 'No logs',
      clear: 'Clear Logs'
    },
    settings: {
      title: 'Settings',
      subtitle: 'Configure system parameters',
      api_key: 'API Key',
      api_key_desc: 'API key for authentication',
      save: 'Save Settings',
      saved: 'Settings saved'
    },
    status: {
      loading: 'Loading...',
      online: 'Online',
      offline: 'Offline',
      error: 'Error'
    },
    common: {
      confirm: 'Confirm',
      cancel: 'Cancel',
      close: 'Close',
      save: 'Save',
      delete: 'Delete',
      edit: 'Edit',
      refresh: 'Refresh',
      search: 'Search',
      filter: 'Filter',
      export: 'Export',
      import: 'Import'
    }
  }
};

// 当前语言
let currentLang = localStorage.getItem('lang') || 'zh';

// 翻译函数
function t(key) {
  const keys = key.split('.');
  let value = translations[currentLang];

  for (const k of keys) {
    value = value?.[k];
  }

  return value || key;
}

// 更新页面文本
function updatePageText() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    el.textContent = t(key);
  });

  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    el.placeholder = t(key);
  });
}

// 切换语言
function switchLanguage(lang) {
  currentLang = lang;
  localStorage.setItem('lang', lang);
  updatePageText();

  // 更新按钮状态
  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.lang === lang);
  });
}

// 初始化
document.addEventListener('DOMContentLoaded', () => {
  updatePageText();

  // 设置语言按钮状态
  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.lang === currentLang);
    btn.addEventListener('click', () => switchLanguage(btn.dataset.lang));
  });
});
