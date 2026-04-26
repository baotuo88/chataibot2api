// Playground 页面逻辑
let currentImageUrl = '';

// 读取文件为 Base64
function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// 表单提交
document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('generate-form');
  const promptInput = document.getElementById('prompt-input');
  const modelSelect = document.getElementById('model-select');
  const sizeSelect = document.getElementById('size-select');
  const imageInput = document.getElementById('image-input');
  const generateBtn = document.getElementById('generate-btn');
  const resultContainer = document.getElementById('result-container');
  const resultActions = document.getElementById('result-actions');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const prompt = promptInput.value.trim();
    const model = modelSelect.value;
    const size = sizeSelect.value;
    const files = Array.from(imageInput.files);

    if (!prompt) {
      alert('Please enter a prompt');
      return;
    }

    // 禁用按钮
    generateBtn.disabled = true;
    const originalText = generateBtn.querySelector('span').textContent;
    generateBtn.querySelector('span').textContent = t('playground.generating');

    // 显示加载状态
    resultContainer.innerHTML = `
      <div style="text-align: center;">
        <div style="
          width: 48px;
          height: 48px;
          border: 4px solid var(--border);
          border-top-color: var(--primary);
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin: 0 auto 16px;
        "></div>
        <p style="color: var(--text-muted);">${t('playground.generating')}</p>
      </div>
    `;

    try {
      let image = null;
      let images = null;

      // 处理上传的图片
      if (files.length > 0) {
        const base64Images = await Promise.all(files.map(readFileAsBase64));
        if (base64Images.length === 1) {
          image = base64Images[0];
        } else {
          images = base64Images;
        }
      }

      // 调用 API
      const result = await api.generateImage(prompt, model, size, image, images);

      if (result.data && result.data[0] && result.data[0].url) {
        currentImageUrl = result.data[0].url;
        showResult(currentImageUrl);
      } else {
        throw new Error('No image URL in response');
      }
    } catch (error) {
      console.error('Generation failed:', error);
      resultContainer.innerHTML = `
        <div style="text-align: center; color: var(--danger);">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-bottom: 16px;">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="15" y1="9" x2="9" y2="15"></line>
            <line x1="9" y1="9" x2="15" y2="15"></line>
          </svg>
          <p>${t('playground.failed')}${error.message}</p>
        </div>
      `;
      resultActions.style.display = 'none';
    } finally {
      // 恢复按钮
      generateBtn.disabled = false;
      generateBtn.querySelector('span').textContent = originalText;
    }
  });
});

function showResult(imageUrl) {
  const resultContainer = document.getElementById('result-container');
  const resultActions = document.getElementById('result-actions');

  resultContainer.innerHTML = `
    <img
      src="${imageUrl}"
      alt="Generated Image"
      style="
        max-width: 100%;
        max-height: 600px;
        border-radius: 8px;
        display: block;
        margin: 0 auto;
      "
    />
  `;

  resultActions.style.display = 'flex';
}

function copyImageUrl() {
  if (!currentImageUrl) return;

  navigator.clipboard.writeText(currentImageUrl).then(() => {
    alert(t('playground.success'));
  }).catch(err => {
    console.error('Failed to copy:', err);
    alert('Failed to copy URL');
  });
}

function downloadImage() {
  if (!currentImageUrl) return;

  const a = document.createElement('a');
  a.href = currentImageUrl;
  a.download = 'generated-image.png';
  a.target = '_blank';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

// 添加旋转动画
const style = document.createElement('style');
style.textContent = `
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
`;
document.head.appendChild(style);
