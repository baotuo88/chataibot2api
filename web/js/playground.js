// Playground 页面逻辑
let currentImageUrl = '';

function createSvgElement(tagName, attributes = {}) {
  const element = document.createElementNS('http://www.w3.org/2000/svg', tagName);
  Object.entries(attributes).forEach(([key, value]) => {
    element.setAttribute(key, value);
  });
  return element;
}

function renderLoadingState(container) {
  const panel = document.createElement('div');
  panel.className = 'loading-panel';

  const spinner = document.createElement('div');
  spinner.className = 'loading-spinner';

  const text = document.createElement('p');
  text.className = 'text-muted';
  text.textContent = t('playground.generating');

  panel.appendChild(spinner);
  panel.appendChild(text);
  container.replaceChildren(panel);
}

function renderErrorState(container, error) {
  const panel = document.createElement('div');
  panel.className = 'error-panel';

  const icon = createSvgElement('svg', {
    width: '48',
    height: '48',
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    'stroke-width': '2',
    class: 'error-icon'
  });
  icon.appendChild(createSvgElement('circle', { cx: '12', cy: '12', r: '10' }));
  icon.appendChild(createSvgElement('line', { x1: '15', y1: '9', x2: '9', y2: '15' }));
  icon.appendChild(createSvgElement('line', { x1: '9', y1: '9', x2: '15', y2: '15' }));

  const text = document.createElement('p');
  text.textContent = `${t('playground.failed')}${error.message}`;

  panel.appendChild(icon);
  panel.appendChild(text);
  container.replaceChildren(panel);
}

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
  const copyButton = document.getElementById('copy-image-url-btn');
  const downloadButton = document.getElementById('download-image-btn');

  if (copyButton) {
    copyButton.addEventListener('click', copyImageUrl);
  }
  if (downloadButton) {
    downloadButton.addEventListener('click', downloadImage);
  }

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
    renderLoadingState(resultContainer);

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
      renderErrorState(resultContainer, error);
      resultActions.classList.remove('visible');
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
  const image = document.createElement('img');
  image.className = 'generated-image';
  image.src = imageUrl;
  image.alt = 'Generated Image';

  resultContainer.replaceChildren(image);
  resultActions.classList.add('visible');
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
