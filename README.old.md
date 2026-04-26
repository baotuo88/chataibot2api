# chataibot2api

一个基于 Go 的图片代理服务。

它做了两件核心事情：

1. 自动注册 `chataibot.pro` 账号
2. 把 `chataibot.pro` 的图片能力包装成 OpenAI 风格接口

项目现在同时提供：

- Web 控制台：`/`
- 运行状态接口：`/api/status`
- 健康检查：`/healthz`
- OpenAI 兼容图片接口：`/v1/images/generations`

默认账号注册方式：

- `mail.tm` 临时邮箱
- `Camoufox` 浏览器自动化
- 邮件验证后直接提取登录 cookie 中的 `token`

## 功能概览

- 自动创建邮箱
- 自动提交注册
- 自动轮询验证码邮件
- 自动激活账号并获取 JWT
- 自动维护账号池
- 文生图
- 单图编辑
- 多图合并
- Web 管理界面
- 运行状态面板和最近事件日志
- 可选 API Key 鉴权
- 请求体大小限制与账号获取超时保护
- Docker 部署

## 项目结构

```text
.
├── main.go            # 服务入口、账号池、Web/UI、状态接口
├── api/
│   └── api.go         # 对 chataibot.pro 的注册、验证、图片请求封装
├── mail/
│   ├── mail_temp.go   # TempMail 实现
│   └── mail_cf.go     # 自建 Cloudflare 邮箱 API 实现
└── web/
    └── index.html     # Web 控制台
```

## 运行前准备

### 1. 安装 Go

项目 `go.mod` 当前声明的是：

```go
go 1.25.4
```

本地建议使用较新的 Go 版本。当前仓库在本机验证时使用的是 Go 1.26.x，可以正常编译运行。

你可以先确认版本：

```bash
go version
```

### 2. 选择注册方案

项目支持两种注册方式：

#### 方案 A：默认浏览器注册

不传特殊参数时，程序默认使用：

- `https://api.mail.tm`
- `Camoufox`
- 浏览器打开注册页
- 自动收取验证邮件
- 自动完成验证并提取 token

这是最简单的启动方式。

#### 方案 B：旧版 API 注册流程

如果你仍要使用旧版直连接口的注册方式，需要先切到：

- `-register-mode api`

然后可选地接入自建邮箱 API：

- `-api`：邮箱 API 地址
- `-domain`：邮箱域名
- `-token`：管理员密码或认证 token

只有这三个参数都提供时，旧版 API 流程才会切换到自建邮箱模式。

## 快速开始

### 方式 1：直接运行源码

在项目根目录执行：

```bash
go run .
```

默认行为：

- 端口：`8080`
- 号池大小：`10`
- 注册模式：浏览器自动注册

启动后访问：

- Web 控制台：`http://localhost:8080/`
- 状态接口：`http://localhost:8080/api/status`
- 健康检查：`http://localhost:8080/healthz`
- OpenAI 兼容接口：`http://localhost:8080/v1/images/generations`

### 方式 2：指定端口和号池

```bash
go run . -port 8080 -pool 20
```

含义：

- `-port 8080`：服务监听端口
- `-pool 20`：已用账号池最大容量

注意：

- 程序内部还会启动 3 个自动注册 worker 持续产号
- `newChan` 的缓冲区大小目前写死为 `10`

### 方式 2.5：启用 API Key 鉴权

```bash
go run . -port 8080 -pool 20 -auth-key your_secret_key
```

启用后，`/v1/images/generations` 和 `/api/status` 都需要带 API Key。

### 方式 3：使用自建邮箱 API

```bash
go run . \
  -port 8080 \
  -pool 20 \
  -api https://your-mail-api.example.com \
  -domain yourdomain.com \
  -token your_admin_token
```

如果参数完整，日志会显示程序切换到了 Cloudflare 自建邮箱模式。

### 方式 4：使用 Docker 运行

先构建镜像：

```bash
docker build -t chataibot2api .
```

然后运行：

```bash
docker run -d \
  --name chataibot2api \
  -p 8080:8080 \
  chataibot2api
```

启动后访问：

- Web 控制台：`http://localhost:8080/`
- 状态接口：`http://localhost:8080/api/status`
- 健康检查：`http://localhost:8080/healthz`

### 方式 5：使用 Docker Compose

项目已经包含 [`docker-compose.yml`](/Users/yewuchen/Desktop/chataibot.pro/docker-compose.yml:1) 和 [.env.example](/Users/yewuchen/Desktop/chataibot.pro/.env.example:1)。

推荐先准备环境文件：

```bash
cp .env.example .env
```

如需对外提供服务，建议至少设置：

- `APP_AUTH_KEY`
- `APP_PORT`
- `APP_POOL`

如果要切到自建邮箱模式，再额外设置：

- `REGISTER_MODE=api`
- `MAIL_API`
- `MAIL_DOMAIN`
- `MAIL_TOKEN`

然后启动：

```bash
docker compose up -d --build
```

推荐部署后的检查命令：

```bash
docker compose ps
docker compose logs -f
curl http://localhost:8080/healthz
```

查看日志：

```bash
docker compose logs -f
```

停止服务：

```bash
docker compose down
```

## 启动后会发生什么

程序启动流程大致如下：

1. 解析启动参数
2. 根据参数决定注册模式
3. 初始化 API client
4. 初始化账号池
5. 启动 3 个自动注册 worker
6. 挂载 Web 页面和 API 路由
7. 开始监听 HTTP 请求

自动注册流程如下：

1. 创建 `mail.tm` 邮箱
2. 用浏览器打开 `chataibot.pro` 注册页
3. 提交邮箱与密码
4. 轮询验证邮件并提取验证链接
5. 浏览器打开验证链接
6. 从 cookie 中提取 `token`
7. 把新账号加入池中

## 启动参数

| 参数 | 默认值 | 说明 |
| --- | --- | --- |
| `-port` | `8080` | 服务端口 |
| `-pool` | `10` | 已用账号池最大容量 |
| `-max-body-mb` | `20` | 单次图片请求体积上限（MB） |
| `-max-images` | `4` | 单次合图允许上传的最大图片数量 |
| `-acquire-timeout-sec` | `45` | 从账号池等待可用账号的最长时间（秒） |
| `-register-timeout-sec` | `180` | 创建单个账号的最长时间（秒） |
| `-register-mode` | `browser` | 账号注册模式，支持 `browser` 和 `api` |
| `-api` | 空 | 自建邮箱 API 地址 |
| `-domain` | 空 | 自建邮箱域名 |
| `-token` | 空 | 自建邮箱管理员密码或 token |
| `-auth-key` | 空 | API Key，留空表示关闭鉴权 |

### 参数切换规则

- `-register-mode browser`：走 `mail.tm + Camoufox`
- `-register-mode api` 且 `-api`、`-domain`、`-token` 不完整：走旧版 TempMail
- `-register-mode api` 且 `-api`、`-domain`、`-token` 都提供：走旧版自建邮箱

## Web 控制台说明

打开：

```text
http://localhost:8080/
```

Web 页面目前包含两部分：

### 1. Image Console

支持直接发图片任务：

- 不上传图片：文生图
- 上传 1 张图：单图编辑
- 上传 2 张及以上：多图合并

可选项：

- Prompt
- Model
- Size

### 2. Runtime Dashboard

可查看：

- 自动注册成功次数
- 自动注册失败次数
- 请求总数
- 成功率
- 文生图/编辑/合图的请求分布
- 当前邮箱来源
- 当前端口
- 当前号池状态
- 支持的模型列表
- 最近运行日志

页面会定时请求：

```text
/api/status
```

如果服务启用了 `-auth-key`，页面左侧表单顶部有一个 API Key 输入框。填入后会保存在当前浏览器，并自动附加到控制台自己的请求里。

## OpenAI 兼容接口说明

接口地址：

```text
POST /v1/images/generations
```

返回格式模仿 OpenAI 图片接口：

```json
{
  "created": 1712345678,
  "data": [
    {
      "url": "https://..."
    }
  ]
}
```

### 请求字段

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `prompt` | string | 是 | 提示词 |
| `model` | string | 否 | 模型名，不传默认 `gpt-image-1.5` |
| `size` | string | 否 | 图片比例映射 |
| `image` | string | 否 | 单张图片的 base64 或 data URL |
| `images` | string[] | 否 | 多张图片的 base64 或 data URL |

额外限制：

- `prompt` 必填
- `image` 和 `images` 不能同时传
- `images` 数量不能超过 `-max-images`
- 请求体大小不能超过 `-max-body-mb`

### 鉴权方式

如果启动时传了 `-auth-key`，请求需要带任意一种头：

```text
Authorization: Bearer your_secret_key
```

或：

```text
X-API-Key: your_secret_key
```

### 模式判断规则

- `images` 长度大于 1：合图
- `image` 非空：编辑
- `images` 长度等于 1：编辑
- 否则：文生图

### `size` 支持值

| 输入值 | 后端映射 |
| --- | --- |
| `1024x1024` | `1:1` |
| `1:1` | `1:1` |
| `1024x1792` | `9:16` |
| `9:16` | `9:16` |
| `1792x1024` | `16:9` |
| `16:9` | `16:9` |
| 其他 | `auto` |

## 模型支持

当前内置模型如下：

- `gpt-image-1.5`
- `gpt-image-1.5-high`
- `ideogram`
- `google-nano-banana-pro`
- `google-nano-banana`
- `google-nano-banana-2`
- `midjourney-7`
- `qwen-lora`
- `bytedance-seedream`

注意：

- 不是每个模型都支持编辑和合图
- 后端会根据模型配置校验能力，不支持时会直接返回错误

## 调用示例

### 1. 文生图

```bash
curl -X POST http://localhost:8080/v1/images/generations \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your_secret_key" \
  -d '{
    "prompt": "a cinematic portrait of a cyberpunk cat, ultra detailed",
    "model": "gpt-image-1.5",
    "size": "1024x1024"
  }'
```

### 2. 单图编辑

这里的 `image` 需要传 base64，或 `data:image/...;base64,...` 格式。

```bash
curl -X POST http://localhost:8080/v1/images/generations \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your_secret_key" \
  -d '{
    "prompt": "turn this image into a watercolor illustration",
    "model": "google-nano-banana",
    "size": "1024x1024",
    "image": "data:image/png;base64,xxxx"
  }'
```

### 3. 多图合并

```bash
curl -X POST http://localhost:8080/v1/images/generations \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your_secret_key" \
  -d '{
    "prompt": "merge these two characters into one poster scene",
    "model": "google-nano-banana",
    "images": [
      "data:image/png;base64,xxxx",
      "data:image/png;base64,yyyy"
    ]
  }'
```

## 状态接口

### `GET /healthz`

健康检查：

```json
{
  "status": "ok"
}
```

### `GET /api/status`

返回运行时状态，包含：

- 当前时间
- 运行时长
- 当前配置
- 请求统计
- 账号池快照
- 最近日志

这对于排查以下问题很有帮助：

- 为什么还没有可用账号
- 自动注册是不是卡住了
- 最近失败是发生在注册、验证码还是图片请求

## 常见运行方式

### 前台运行

适合开发和调试：

```bash
go run .
```

### 编译后二进制运行

```bash
go build -o chataibot2api .
./chataibot2api -port 8080 -pool 20
```

### Docker 单容器运行

```bash
docker build -t chataibot2api .
docker run -d \
  --name chataibot2api \
  -p 8080:8080 \
  chataibot2api
```

### Docker Compose 运行

推荐：

```bash
cp .env.example .env
docker compose up -d --build
```

这个 compose 会自动把 `.env` 里的变量注入容器，程序本身也支持直接读取：

- `APP_PORT`
- `APP_POOL`
- `APP_MAX_BODY_MB`
- `APP_MAX_IMAGES`
- `APP_ACQUIRE_TIMEOUT_SEC`
- `REGISTER_MODE`
- `REGISTER_TIMEOUT_SEC`
- `APP_AUTH_KEY`
- `MAIL_API`
- `MAIL_DOMAIN`
- `MAIL_TOKEN`

默认使用 `REGISTER_MODE=browser`，也就是 `mail.tm + Camoufox`。

只有在 `REGISTER_MODE=api` 时，才会启用旧版直连接口注册逻辑；这时如果同时设置 `MAIL_API`、`MAIL_DOMAIN`、`MAIL_TOKEN`，则切换到自建邮箱模式。

当前 compose 还额外做了这些部署优化：

- `restart: unless-stopped`
- `healthcheck`
- `init: true`
- 只读根文件系统
- `tmpfs /tmp`
- `no-new-privileges`
- 日志滚动限制
- 优雅停止等待时间

也可以直接：

```bash
docker compose up -d --build
```

如果你要反代到域名，建议把容器只监听在内网端口，再由 Nginx / Caddy / Traefik 处理：

- HTTPS 证书
- 域名访问
- 访问日志
- IP 白名单或基础限流

### 指定本地缓存测试编译

如果你的环境对系统缓存目录有权限限制，可以这样执行：

```bash
GOCACHE=$(pwd)/.gocache go test
GOCACHE=$(pwd)/.gocache go test ./api ./mail
```

## 常见问题

### 1. 启动后一直没有账号

先看：

- 终端日志
- `http://localhost:8080/api/status`
- Web 页面右侧 Recent Events

常见原因：

- TempMail 创建失败
- 验证码邮件拉取失败
- `chataibot.pro` 注册接口行为变化
- 外网访问异常

### 2. 图片请求很慢

这是正常现象的一部分。

原因包括：

- 先要从池里拿账号
- 图片接口本身设置了最长 5 分钟超时
- 第一次请求时可能刚好需要等待新账号产出

### 3. 为什么有些模型能生图但不能编辑/合图

因为模型配置里区分了：

- 普通生成能力
- 编辑能力
- 合图能力

如果模型没有对应模式配置，后端会直接拒绝请求。

### 4. Web 页面能不能改启动参数

不能。

目前 Web 页面展示的是运行时状态，不会动态修改：

- `-port`
- `-pool`
- `-api`
- `-domain`
- `-token`

这些参数仍然需要在启动程序时传入。

### 5. Docker 里怎么传启动参数

有两种方式：

#### 直接覆盖 `docker run` 命令参数

```bash
docker run -d \
  --name chataibot2api \
  -p 8080:8080 \
  chataibot2api \
  -port 8080 \
  -pool 20
```

#### 在 `docker-compose.yml` 里修改 `command`

默认 compose 文件里已经有：

```yaml
command:
  - -port
  - "8080"
  - -pool
  - "10"
```

如果你想切到自建邮箱模式，可以改成：

```yaml
command:
  - -port
  - "8080"
  - -pool
  - "20"
  - -api
  - https://your-mail-api.example.com
  - -domain
  - yourdomain.com
  - -token
  - your_admin_token
```

## 注意事项

- 这个项目强依赖外部站点接口行为，外部接口一旦变更，注册或图片功能可能失效
- 这个项目没有内建鉴权，不建议直接裸露到公网
- Web 页面是内置静态页面，没有用户系统
- 运行效果依赖网络连通性和目标服务状态
- 邮箱和验证码解析逻辑依赖当前邮件格式，格式变化后可能需要调整代码
- Docker 镜像里默认监听 `8080` 端口，宿主机需要放通对应端口
- 如果宿主机网络访问外网受限，Docker 容器里的自动注册和图片请求也会失败

## 开发验证

当前可用的基本验证命令：

```bash
go test
go test ./api ./mail
```

如果你本地有缓存权限问题：

```bash
GOCACHE=$(pwd)/.gocache go test
GOCACHE=$(pwd)/.gocache go test ./api ./mail
```

## 后续可扩展方向

- 给 Web 后台加登录鉴权
- 增加配置文件支持
- 支持环境变量启动
- 增加请求历史持久化
- 增加日志持久化
- 增加 Dockerfile 和 docker-compose
- 增加更完整的错误处理和测试

## 一句话启动

如果你只是想先跑起来，最短命令就是：

```bash
go run .
```

然后打开：

```text
http://localhost:8080/
```

如果你想直接容器运行，最短命令是：

```bash
docker compose up -d --build
```
