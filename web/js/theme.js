// 主题管理
const THEME_STORAGE_KEY = 'chataibot_theme';

function getTheme() {
  return localStorage.getItem(THEME_STORAGE_KEY) || 'dark';
}

function setTheme(theme) {
  localStorage.setItem(THEME_STORAGE_KEY, theme);
  document.documentElement.setAttribute('data-theme', theme);
  updateThemeIcon(theme);
}

function toggleTheme() {
  const currentTheme = getTheme();
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
  setTheme(newTheme);
}

function updateThemeIcon(theme) {
  const themeSwitch = document.getElementById('theme-switch');
  if (!themeSwitch) return;

  const icon = themeSwitch.querySelector('svg');
  if (theme === 'light') {
    icon.innerHTML = `
      <circle cx="12" cy="12" r="5"></circle>
      <line x1="12" y1="1" x2="12" y2="3"></line>
      <line x1="12" y1="21" x2="12" y2="23"></line>
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
      <line x1="1" y1="12" x2="3" y2="12"></line>
      <line x1="21" y1="12" x2="23" y2="12"></line>
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
    `;
  } else {
    icon.innerHTML = `
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
    `;
  }
}

// 初始化主题
document.addEventListener('DOMContentLoaded', () => {
  const theme = getTheme();
  setTheme(theme);

  // 绑定主题切换按钮
  const themeSwitch = document.getElementById('theme-switch');
  if (themeSwitch) {
    themeSwitch.addEventListener('click', toggleTheme);
  }
});
