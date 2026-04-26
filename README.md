# ChatAIBot 2API

专业的 ChatAIBot 图片生成 API 代理服务，提供 OpenAI 风格的接口和完整的 Web 管理界面。

[![GitHub](https://img.shields.io/badge/GitHub-chataibot2api-blue?logo=github)](https://github.com/baotuo88/chataibot2api)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)
[![Go](https://img.shields.io/badge/Go-1.21+-00ADD8?logo=go)](https://golang.org/)

## ✨ 功能特点

- 🎨 支持多种图片生成模型（GPT-Image、Ideogram、Midjourney 等）
- 🔄 智能账号池管理
- 🌐 完整的 Web 管理界面
- 🌓 暗色/亮色主题切换
- ⚠️ 账号额度预警
- 📦 批量导入/导出账号
- 📊 请求历史记录
- 📈 实时数据可视化
- 🔌 OpenAI 兼容 API

---

## 🚀 快速开始

### 方式 1：Docker 部署（推荐）

```bash
# 1. 克隆项目
git clone https://github.com/baotuo88/chataibot2api.git
cd chataibot2api

# 2. 配置环境变量
cp .env.example .env
nano .env  # 设置 APP_AUTH_KEY

# 3. 启动服务
docker compose up -d

# 4. 访问服务
# http://localhost:8880
```

### 方式 2：本地运行

```bash
# 1. 克隆项目
git clone https://github.com/baotuo88/chataibot2api.git
cd chataibot2api

# 2. 编译
go build -o chataibot2api

# 3. 启动
./chataibot2api -port 8880

# 4. 访问服务
# http://localhost:8880
```

---

## 📋 配置说明

### 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `APP_PORT` | 8880 | 服务端口 |
| `APP_POOL` | 10 | 账号池大小 |
| `APP_AUTH_KEY` | - | API Key（强烈建议设置） |
| `APP_MAX_BODY_MB` | 20 | 请求体积上限（MB） |
| `APP_MAX_IMAGES` | 4 | 单次合图最大图片数 |
| `APP_ACQUIRE_TIMEOUT_SEC` | 45 | 账号获取超时（秒） |
| `APP_ACCOUNTS_FILE` | accounts.json | 账号文件路径 |

### 命令行参数

```bash
./chataibot2api -h

参数说明：
  -port int
        服务端口 (默认 8880)
  -pool int
        账号池大小 (默认 10)
  -auth-key string
        API Key，留空表示关闭鉴权
  -accounts-file string
        账号文件路径 (默认 "accounts.json")
  -max-body-mb int
        请求体积上限（MB） (默认 20)
  -max-images int
        单次合图最大图片数 (默认 4)
  -acquire-timeout-sec int
        账号获取超时（秒） (默认 45)
```

---

## 🌐 Web 界面

访问 `http://localhost:8880` 查看完整的管理界面：

### 📊 Dashboard（仪表盘）
- 系统状态概览
- 实时统计数据
- 请求分布图表

### 👥 Accounts（账号管理）
- 添加/删除账号
- 批量导入/导出
- 额度预警提醒

### 🎮 Playground（API 测试）
- 在线测试图片生成
- 支持多种模型
- 实时预览结果

### 🕐 History（请求历史）
- 最近 100 条请求记录
- 详细信息展示
- 成功/失败统计

### 📋 Logs（运行日志）
- 系统运行日志
- 日志级别统计
- 实时日志流

### ⚙️ Settings（系统设置）
- API Key 配置
- 系统信息查看
- API 文档

---

## 🔌 API 使用

### 获取模型列表

```bash
curl http://localhost:8880/v1/models \
  -H "X-API-Key: your-api-key"
```

### 生成图片

```bash
curl -X POST http://localhost:8880/v1/images/generations \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{
    "prompt": "a beautiful sunset over the ocean",
    "model": "gpt-image-1.5",
    "size": "1024x1024"
  }'
```

### 支持的模型

| 模型 | 说明 |
|------|------|
| `gpt-image-1.5` | GPT Image 标准版 |
| `gpt-image-1.5-high` | GPT Image 高质量版 |
| `ideogram` | Ideogram 模型 |
| `google-nano-banana` | Google Nano Banana |
| `google-nano-banana-2` | Google Nano Banana 2 |
| `midjourney-7` | Midjourney 7 |
| `qwen-lora` | Qwen LoRA |

### 图片编辑

```bash
curl -X POST http://localhost:8880/v1/images/generations \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{
    "prompt": "add a rainbow",
    "model": "gpt-image-1.5",
    "image": "data:image/png;base64,..."
  }'
```

### 在其他语言中调用

**Python:**
```python
import requests

response = requests.post(
    'http://localhost:8880/v1/images/generations',
    headers={
        'Content-Type': 'application/json',
        'X-API-Key': 'your-api-key'
    },
    json={
        'prompt': 'a cute cat',
        'model': 'gpt-image-1.5',
        'size': '1024x1024'
    }
)

result = response.json()
print(result['data'][0]['url'])
```

**JavaScript:**
```javascript
const response = await fetch('http://localhost:8880/v1/images/generations', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': 'your-api-key'
  },
  body: JSON.stringify({
    prompt: 'a cute cat',
    model: 'gpt-image-1.5',
    size: '1024x1024'
  })
});

const result = await response.json();
console.log(result.data[0].url);
```

---

## 📦 账号管理

### 手动添加账号

1. 访问 Web 界面的 Accounts 页面
2. 粘贴 JWT token
3. 点击"添加账号"

### 批量导入账号

准备 JSON 文件：

```json
[
  {
    "jwt": "eyJhbGci...",
    "email": "user1@example.com",
    "note": "主账号"
  },
  {
    "jwt": "eyJhbGci...",
    "email": "user2@example.com",
    "note": "备用账号"
  }
]
```

在 Web 界面点击"批量导入 JSON"上传文件。

### 导出账号

点击"导出账号"按钮，下载 JSON 格式的账号数据。

### 列表显示说明

- 账号列表默认只展示脱敏后的 JWT 预览
- 完整 JWT 仅保存在服务端内存和 `accounts.json` 中
- 如需备份原始 JWT，请使用"导出账号"功能
- 重复 JWT 在导入和手动添加时会被拒绝
- 服务启动时会校验账号有效性并刷新真实额度
- 启动后会把清洗过的账号列表回写到 `accounts.json`
- `updatedAt` 表示最近一次成功刷新额度的时间

---

## 🐳 Docker 部署

### 基础部署

```bash
# 启动服务
docker compose up -d

# 查看日志
docker compose logs -f

# 停止服务
docker compose down

# 重启服务
docker compose restart
```

### 自定义配置

编辑 `.env` 文件：

```bash
# 修改端口
APP_PORT=9000

# 设置 API Key
APP_AUTH_KEY=your-secret-key

# 调整账号池大小
APP_POOL=20
```

重启服务使配置生效：

```bash
docker compose down
docker compose up -d
```

### 数据持久化

账号数据保存在 `accounts.json` 文件中，已通过 volume 挂载：

```yaml
volumes:
  - ./accounts.json:/app/accounts.json
```

**备份数据：**

```bash
cp accounts.json accounts.json.backup.$(date +%Y%m%d)
```

---

## 🔒 安全建议

### 1. 设置 API Key（必须）

```bash
# .env
APP_AUTH_KEY=your-very-long-and-random-secret-key
```

### 2. 使用反向代理

**Nginx 配置示例：**

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:8880;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 3. 启用 HTTPS

```bash
# 使用 Let's Encrypt
certbot --nginx -d your-domain.com
```

### 4. 防火墙配置

```bash
# 允许 HTTP/HTTPS
ufw allow 80/tcp
ufw allow 443/tcp

# 如果直接访问，允许 8880
ufw allow 8880/tcp

# 启用防火墙
ufw enable
```

---

## 🔍 故障排查

### 容器无法启动

```bash
# 查看日志
docker compose logs

# 常见问题：
# - 端口被占用：修改 APP_PORT
# - 权限问题：chmod 666 accounts.json
```

### 健康检查失败

```bash
# 测试健康检查端点
curl http://localhost:8880/healthz

# 应该返回：{"status":"ok"}
```

### 账号额度不更新

- 账号在每次使用后自动更新额度
- 额度低于 2 的账号会被自动丢弃
- 额度低于 10 时会显示预警

### 完整重新部署

```bash
# 停止服务
docker compose down

# 删除镜像
docker rmi chataibot2api-chataibot2api

# 清理缓存
docker system prune -f

# 拉取最新代码
git pull

# 重新构建
docker compose build --no-cache

# 启动服务
docker compose up -d
```

---

## 📊 监控

### 查看日志

```bash
# 实时日志
docker compose logs -f

# 最近 100 行
docker compose logs --tail=100

# 只看错误
docker compose logs | grep -i error
```

### 查看资源使用

```bash
docker stats chataibot2api
```

### 健康检查

```bash
curl http://localhost:8880/healthz
```

---

## 🎨 主题切换

Web 界面支持暗色/亮色主题切换：

- 点击侧边栏底部的月亮/太阳图标
- 主题偏好自动保存到浏览器

---

## ⚠️ 额度预警

当账号额度低于 10 时：

- 自动弹出警告通知
- 列表中红色高亮显示
- 显示警告图标 ⚠️

---

## 📈 更新日志

### v2.0.0 (2026-04-26)

- ✅ 移除自动注册功能，简化为纯 2API 反代
- ✅ 优化 Docker 镜像大小
- ✅ 添加请求历史记录功能
- ✅ 添加暗色/亮色主题切换
- ✅ 添加账号额度预警
- ✅ 添加批量导入/导出功能
- ✅ 优化 Web 界面体验

---

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

---

## 📝 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

---

## 🔗 相关链接

- **GitHub**: https://github.com/baotuo88/chataibot2api
- **Issues**: https://github.com/baotuo88/chataibot2api/issues
- **ChatAIBot 官网**: https://chataibot.pro

---

## 💡 常见问题

### Q: 如何获取 JWT token？

A: 访问 chataibot.pro 注册账号，然后从浏览器开发者工具中获取 token cookie。

### Q: 支持哪些图片尺寸？

A: 支持 256x256 到 2048x2048 之间的各种尺寸，具体取决于所选模型。

### Q: 可以同时使用多个账号吗？

A: 可以！系统会自动管理账号池，轮流使用账号以避免额度耗尽。

### Q: API 兼容 OpenAI 格式吗？

A: 是的，API 完全兼容 OpenAI 图片生成接口格式。

### Q: 如何监控服务状态？

A: 访问 Web 界面的 Dashboard 页面查看实时统计，或使用 `/healthz` 端点进行健康检查。

---

## ⭐ Star History

如果这个项目对你有帮助，请给个 Star ⭐️

[![Star History Chart](https://api.star-history.com/svg?repos=baotuo88/chataibot2api&type=Date)](https://star-history.com/#baotuo88/chataibot2api&Date)

---

**Made with ❤️ by [baotuo88](https://github.com/baotuo88)**
