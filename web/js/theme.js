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

function createThemeSvgElement(tagName, attributes = {}) {
  const element = document.createElementNS('http://www.w3.org/2000/svg', tagName);
  Object.entries(attributes).forEach(([key, value]) => {
    element.setAttribute(key, value);
  });
  return element;
}

function updateThemeIcon(theme) {
  const themeSwitch = document.getElementById('theme-switch');
  if (!themeSwitch) return;

  const icon = themeSwitch.querySelector('svg');
  if (!icon) return;

  const nodes = [];
  if (theme === 'light') {
    nodes.push(createThemeSvgElement('circle', { cx: '12', cy: '12', r: '5' }));
    [
      ['12', '1', '12', '3'],
      ['12', '21', '12', '23'],
      ['4.22', '4.22', '5.64', '5.64'],
      ['18.36', '18.36', '19.78', '19.78'],
      ['1', '12', '3', '12'],
      ['21', '12', '23', '12'],
      ['4.22', '19.78', '5.64', '18.36'],
      ['18.36', '5.64', '19.78', '4.22']
    ].forEach(([x1, y1, x2, y2]) => {
      nodes.push(createThemeSvgElement('line', { x1, y1, x2, y2 }));
    });
  } else {
    nodes.push(createThemeSvgElement('path', {
      d: 'M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z'
    }));
  }

  icon.replaceChildren(...nodes);
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
