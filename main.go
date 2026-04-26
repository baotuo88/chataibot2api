package main

import (
	"context"
	"embed"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/signal"
	"sort"
	"strconv"
	"strings"
	"sync"
	"syscall"
	"time"

	"chataibot2api/api"
)

var pool, port int
var maxBodyMB, maxImages, acquireTimeoutSec int
var authKey, accountsFile string
var apiClient *api.APIClient
var appState = NewAppState()
var fetchQuota = func(jwt string) (int, error) {
	return apiClient.GetCount(jwt)
}

//go:embed web
var webUI embed.FS

type Account struct {
	JWT       string
	Email     string
	Note      string
	Quota     int
	UpdatedAt time.Time
}

type SimplePool struct {
	accounts []*Account
	leased   map[string]struct{}
	maxSize  int
	mu       sync.Mutex
	cond     *sync.Cond
}

type OpenAIImageReq struct {
	Prompt string   `json:"prompt"`
	Model  string   `json:"model"`
	Size   string   `json:"size"`
	Image  string   `json:"image"`
	Images []string `json:"images"`
}

type OpenAIImageResp struct {
	Created int64       `json:"created"`
	Data    []ImageData `json:"data"`
}

type ImageData struct {
	URL string `json:"url"`
}

type OpenAIModelListResp struct {
	Object string            `json:"object"`
	Data   []OpenAIModelInfo `json:"data"`
}

type OpenAIModelInfo struct {
	ID      string `json:"id"`
	Object  string `json:"object"`
	Created int64  `json:"created"`
	OwnedBy string `json:"owned_by"`
}

type ModelConfig struct {
	Provider  string
	Version   string
	Cost      int
	EditMode  string
	EditCost  int
	MergeMode string
	MergeCost int
}

type AppState struct {
	startedAt time.Time
	config    RuntimeConfig
	mu        sync.Mutex
	stats     RuntimeStats
	logs      []LogEntry
}

type RuntimeConfig struct {
	PoolSize          int      `json:"poolSize"`
	Port              int      `json:"port"`
	AuthEnabled       bool     `json:"authEnabled"`
	MaxBodyMB         int      `json:"maxBodyMb"`
	MaxImages         int      `json:"maxImages"`
	AcquireTimeoutSec int      `json:"acquireTimeoutSec"`
	Models            []string `json:"models"`
}

type RuntimeStats struct {
	RequestsTotal   int    `json:"requestsTotal"`
	RequestsSuccess int    `json:"requestsSuccess"`
	RequestsFailed  int    `json:"requestsFailed"`
	TextRequests    int    `json:"textRequests"`
	EditRequests    int    `json:"editRequests"`
	MergeRequests   int    `json:"mergeRequests"`
	LastResultURL   string `json:"lastResultUrl"`
	LastError       string `json:"lastError"`
	LastModel       string `json:"lastModel"`
	LastMode        string `json:"lastMode"`
}

type LogEntry struct {
	Time    string `json:"time"`
	Level   string `json:"level"`
	Message string `json:"message"`
}

type PoolSnapshot struct {
	MaxSize       int   `json:"maxSize"`
	BufferedNew   int   `json:"bufferedNew"`
	ReadyAccounts int   `json:"readyAccounts"`
	Quotas        []int `json:"quotas"`
}

type StatusResponse struct {
	Now       string        `json:"now"`
	UptimeSec int64         `json:"uptimeSec"`
	Config    RuntimeConfig `json:"config"`
	Stats     RuntimeStats  `json:"stats"`
	Pool      PoolSnapshot  `json:"pool"`
	Logs      []LogEntry    `json:"logs"`
}

type AccountData struct {
	JWT       string `json:"jwt"`
	Email     string `json:"email,omitempty"`
	Note      string `json:"note,omitempty"`
	UpdatedAt string `json:"updatedAt,omitempty"`
}

type AccountListResponse struct {
	Total    int           `json:"total"`
	Accounts []AccountInfo `json:"accounts"`
}

type AccountInfo struct {
	Index     int    `json:"index"`
	Email     string `json:"email"`
	Note      string `json:"note"`
	Quota     int    `json:"quota"`
	JWTMasked string `json:"jwtMasked"`
	UpdatedAt string `json:"updatedAt"`
}

type AddAccountRequest struct {
	JWT   string `json:"jwt"`
	Email string `json:"email,omitempty"`
	Note  string `json:"note,omitempty"`
}

type DeleteAccountRequest struct {
	Index int `json:"index"`
}

type RequestHistory struct {
	Time     string `json:"time"`
	Model    string `json:"model"`
	Prompt   string `json:"prompt"`
	Size     string `json:"size"`
	Success  bool   `json:"success"`
	ImageURL string `json:"imageUrl,omitempty"`
	Error    string `json:"error,omitempty"`
	Duration int64  `json:"duration"` // milliseconds
}

var requestHistoryMu sync.Mutex
var requestHistory []RequestHistory

const maxHistorySize = 100

var modelRouter = map[string]ModelConfig{
	"gpt-image-1.5":          {Provider: "GPT_IMAGE_1_5", Version: "", Cost: 12},
	"gpt-image-1.5-high":     {Provider: "GPT_IMAGE_1_5_HIGH", Version: "", Cost: 40},
	"ideogram":               {Provider: "IDEOGRAM", Version: "", Cost: 8},
	"google-nano-banana-pro": {Provider: "GOOGLE", Version: "nano-banana-pro", Cost: 60},
	"google-nano-banana":     {Provider: "GOOGLE", Version: "nano-banana", Cost: 15, EditMode: "edit_google_nano_banana", EditCost: 15, MergeMode: "merge_google_nano_banana", MergeCost: 15},
	"google-nano-banana-2":   {Provider: "GOOGLE", Version: "nano-banana-2", Cost: 30, EditMode: "edit_google_nano_banana_2", EditCost: 30, MergeMode: "merge_google_nano_banana_2", MergeCost: 30},
	"midjourney-7":           {Provider: "MIDJOURNEY", Version: "7", Cost: 20},
	"qwen-lora":              {Provider: "QWEN", Version: "lora", Cost: 2, EditMode: "edit_qwen_lora", EditCost: 2, MergeMode: "merge_qwen_lora", MergeCost: 2},
	"bytedance-seedream":     {Provider: "BYTEDANCE", Version: "seedream-5-lite", Cost: 14},
}

func init() {
	flag.IntVar(&pool, "pool", 10, "指定号池数量")
	flag.IntVar(&port, "port", 8880, "服务端口")
	flag.IntVar(&maxBodyMB, "max-body-mb", 20, "单次图片请求体积上限（MB）")
	flag.IntVar(&maxImages, "max-images", 4, "单次合图允许上传的最大图片数量")
	flag.IntVar(&acquireTimeoutSec, "acquire-timeout-sec", 45, "账号池获取账号的最长等待时间（秒）")
	flag.StringVar(&authKey, "auth-key", "", "接口鉴权 API Key，留空表示关闭鉴权")
	flag.StringVar(&accountsFile, "accounts-file", "accounts.json", "账号数据文件路径")
}

func main() {
	flag.Parse()
	applyEnvOverrides()

	if maxBodyMB < 1 {
		logEvent("warn", "max-body-mb 非法，回退到 20")
		maxBodyMB = 20
	}
	if maxImages < 1 {
		logEvent("warn", "max-images 非法，回退到 4")
		maxImages = 4
	}
	if acquireTimeoutSec < 1 {
		logEvent("warn", "acquire-timeout-sec 非法，回退到 45")
		acquireTimeoutSec = 45
	}

	apiClient = api.NewAPIClient()
	appState.SetConfig(RuntimeConfig{
		PoolSize:          pool,
		Port:              port,
		AuthEnabled:       authKey != "",
		MaxBodyMB:         maxBodyMB,
		MaxImages:         maxImages,
		AcquireTimeoutSec: acquireTimeoutSec,
		Models:            supportedModels(),
	})

	// 加载账号
	initialAccounts, err := LoadAccountsFromFile(accountsFile)
	if err != nil {
		logEvent("error", fmt.Sprintf("加载账号文件失败: %v", err))
		initialAccounts = []*Account{}
	} else {
		logEvent("info", fmt.Sprintf("从 %s 加载了 %d 个账号", accountsFile, len(initialAccounts)))
		if err := SaveAccountSliceToFile(accountsFile, initialAccounts); err != nil {
			logEvent("error", fmt.Sprintf("回写清洗后的账号文件失败: %v", err))
		} else {
			logEvent("info", fmt.Sprintf("已回写清洗后的账号文件: %s", accountsFile))
		}
	}

	accountPool := StartPool(pool, initialAccounts)
	logEvent("info", "号池已启动，准备就绪")

	mux := http.NewServeMux()
	mux.HandleFunc("/", WebHandler)
	mux.HandleFunc("/api/status", RequireAPIKey(StatusHandler(accountPool)))
	mux.HandleFunc("/api/accounts", RequireAPIKey(ListAccountsHandler(accountPool)))
	mux.HandleFunc("/api/accounts/add", RequireAPIKey(AddAccountHandler(accountPool)))
	mux.HandleFunc("/api/accounts/delete", RequireAPIKey(DeleteAccountHandler(accountPool)))
	mux.HandleFunc("/api/accounts/export", RequireAPIKey(ExportAccountsHandler(accountPool)))
	mux.HandleFunc("/api/history", RequireAPIKey(GetRequestHistoryHandler))
	mux.HandleFunc("/healthz", HealthHandler)
	mux.HandleFunc("/v1/models", RequireAPIKey(ModelsHandler))
	mux.HandleFunc("/v1/images/generations", RequireAPIKey(ImageHandler(accountPool)))

	server := &http.Server{
		Addr:              fmt.Sprintf(":%d", port),
		Handler:           withSecurityHeaders(mux),
		ReadHeaderTimeout: 10 * time.Second,
		ReadTimeout:       30 * time.Second,
		WriteTimeout:      6 * time.Minute,
		IdleTimeout:       60 * time.Second,
	}

	logEvent("info", fmt.Sprintf("Web 界面与 OpenAI 兼容接口启动在 %d 端口", port))
	if authKey != "" {
		logEvent("info", "API Key 鉴权已启用")
	}

	go func() {
		if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			logEvent("error", fmt.Sprintf("Server failed: %v", err))
		}
	}()

	waitForShutdown(server)
}

func waitForShutdown(server *http.Server) {
	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, os.Interrupt, syscall.SIGTERM)
	defer signal.Stop(sigCh)

	sig := <-sigCh
	logEvent("info", fmt.Sprintf("收到退出信号：%s，开始优雅停止", sig.String()))

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	if err := server.Shutdown(ctx); err != nil {
		logEvent("error", fmt.Sprintf("优雅停止失败：%v", err))
		return
	}
	logEvent("info", "HTTP 服务已停止")
}

func WebHandler(w http.ResponseWriter, r *http.Request) {
	path := r.URL.Path
	if path == "/" {
		path = "/dashboard.html"
	}

	// 尝试读取文件
	content, err := webUI.ReadFile("web" + path)
	if err != nil {
		http.NotFound(w, r)
		return
	}

	// 设置正确的 Content-Type
	contentType := "text/html; charset=utf-8"
	if strings.HasSuffix(path, ".css") {
		contentType = "text/css; charset=utf-8"
	} else if strings.HasSuffix(path, ".js") {
		contentType = "application/javascript; charset=utf-8"
	} else if strings.HasSuffix(path, ".json") {
		contentType = "application/json; charset=utf-8"
	}

	w.Header().Set("Content-Type", contentType)
	_, _ = w.Write(content)
}

func StatusHandler(pool *SimplePool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		status := appState.Snapshot(pool)
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(status)
	}
}

func HealthHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}

func ModelsHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	models := supportedModels()
	data := make([]OpenAIModelInfo, 0, len(models))
	for _, model := range models {
		data = append(data, OpenAIModelInfo{
			ID:      model,
			Object:  "model",
			Created: 0,
			OwnedBy: "chataibot2api",
		})
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(OpenAIModelListResp{
		Object: "list",
		Data:   data,
	})
}

func StartPool(poolSize int, initialAccounts []*Account) *SimplePool {
	p := &SimplePool{
		accounts: initialAccounts,
		leased:   make(map[string]struct{}),
		maxSize:  poolSize,
	}
	p.cond = sync.NewCond(&p.mu)

	logEvent("info", fmt.Sprintf("号池已初始化，当前账号数=%d", len(initialAccounts)))
	return p
}

func (p *SimplePool) Acquire(ctx context.Context, cost int, wait time.Duration) (*Account, error) {
	if wait > 0 {
		var cancel context.CancelFunc
		ctx, cancel = context.WithTimeout(ctx, wait)
		defer cancel()
	}

	done := make(chan struct{})
	defer close(done)

	go func() {
		select {
		case <-ctx.Done():
			p.mu.Lock()
			p.cond.Broadcast()
			p.mu.Unlock()
		case <-done:
		}
	}()

	p.mu.Lock()
	defer p.mu.Unlock()

	for {
		if bestIdx := p.findAvailableIndexLocked(cost); bestIdx >= 0 {
			acc := p.accounts[bestIdx]
			p.leased[acc.JWT] = struct{}{}
			logEvent("info", fmt.Sprintf("分配账号，额度=%d，请求成本=%d", acc.Quota, cost))
			return acc, nil
		}

		if err := ctx.Err(); err != nil {
			if errors.Is(err, context.DeadlineExceeded) {
				return nil, fmt.Errorf("timed out waiting for available account with sufficient quota (required: %d)", cost)
			}
			return nil, err
		}

		p.cond.Wait()
	}
}

func (p *SimplePool) Release(acc *Account) {
	quota, err := fetchQuota(acc.JWT)

	p.mu.Lock()
	defer p.mu.Unlock()

	delete(p.leased, acc.JWT)

	idx := accountIndexByJWT(p.accounts, acc.JWT)
	if idx < 0 {
		p.cond.Broadcast()
		return
	}

	if err != nil {
		logEvent("warn", fmt.Sprintf("获取账号额度失败: %v，保留账号原有额度=%d", err, p.accounts[idx].Quota))
		p.cond.Broadcast()
		return
	}

	p.accounts[idx].Quota = quota
	p.accounts[idx].UpdatedAt = time.Now()

	if quota < 2 {
		p.accounts = append(p.accounts[:idx], p.accounts[idx+1:]...)
		logEvent("warn", fmt.Sprintf("账号额度过低，移出池子，额度=%d", quota))
		p.cond.Broadcast()
		return
	}

	logEvent("info", fmt.Sprintf("账号回收，当前额度=%d", quota))
	p.cond.Broadcast()
}

func ImageHandler(pool *SimplePool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		startTime := time.Now()

		if r.Method != http.MethodPost {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		r.Body = http.MaxBytesReader(w, r.Body, int64(maxBodyMB)<<20)

		var req OpenAIImageReq
		decoder := json.NewDecoder(r.Body)
		decoder.DisallowUnknownFields()
		if err := decoder.Decode(&req); err != nil {
			appState.RecordRequestFailure("", "", "Invalid request body")
			http.Error(w, "Invalid request body", http.StatusBadRequest)
			return
		}
		if err := decoder.Decode(new(struct{})); err != io.EOF {
			appState.RecordRequestFailure("", "", "Request body must contain a single JSON object")
			http.Error(w, "Request body must contain a single JSON object", http.StatusBadRequest)
			return
		}

		req.Prompt = strings.TrimSpace(req.Prompt)
		if req.Prompt == "" {
			appState.RecordRequestFailure("", "", "Prompt is required")
			http.Error(w, "Prompt is required", http.StatusBadRequest)
			return
		}
		if req.Image != "" && len(req.Images) > 0 {
			appState.RecordRequestFailure("", "", "Use either 'image' or 'images', not both")
			http.Error(w, "Use either 'image' or 'images', not both", http.StatusBadRequest)
			return
		}
		if len(req.Images) > maxImages {
			errMsg := fmt.Sprintf("Too many images: got %d, max %d", len(req.Images), maxImages)
			appState.RecordRequestFailure("", "", errMsg)
			http.Error(w, errMsg, http.StatusBadRequest)
			return
		}

		if req.Model == "" {
			req.Model = "gpt-image-1.5"
		}
		modelCfg, exists := modelRouter[req.Model]
		if !exists {
			appState.RecordRequestFailure(req.Model, "", fmt.Sprintf("Unsupported model: %s", req.Model))
			http.Error(w, fmt.Sprintf("Unsupported model: %s", req.Model), http.StatusBadRequest)
			return
		}

		isMergeMode := len(req.Images) > 1
		isEditMode := req.Image != "" || len(req.Images) == 1
		mode := "text-to-image"
		if isMergeMode {
			mode = "image-merge"
		} else if isEditMode {
			mode = "image-edit"
		}

		// 校验模型是否支持该模式
		if isMergeMode && modelCfg.MergeMode == "" {
			appState.RecordRequestFailure(req.Model, mode, fmt.Sprintf("Model '%s' does not support image merging", req.Model))
			http.Error(w, fmt.Sprintf("Model '%s' does not support image merging", req.Model), http.StatusBadRequest)
			return
		}
		if isEditMode && !isMergeMode && modelCfg.EditMode == "" {
			appState.RecordRequestFailure(req.Model, mode, fmt.Sprintf("Model '%s' does not support image editing", req.Model))
			http.Error(w, fmt.Sprintf("Model '%s' does not support image editing", req.Model), http.StatusBadRequest)
			return
		}

		// 确定需要消耗的额度
		requiredCost := modelCfg.Cost
		if isMergeMode {
			requiredCost = modelCfg.MergeCost
		} else if isEditMode {
			requiredCost = modelCfg.EditCost
		}

		appState.RecordRequest(req.Model, mode)
		logEvent("info", fmt.Sprintf("收到图片请求，model=%s mode=%s size=%s cost=%d", req.Model, mode, req.Size, requiredCost))

		ratio := parseRatio(req.Size)
		acc, acquireErr := pool.Acquire(r.Context(), requiredCost, time.Duration(acquireTimeoutSec)*time.Second)
		if acquireErr != nil {
			statusCode := http.StatusGatewayTimeout
			if errors.Is(acquireErr, context.Canceled) || errors.Is(acquireErr, context.DeadlineExceeded) {
				statusCode = http.StatusRequestTimeout
			}
			appState.RecordRequestFailure(req.Model, mode, acquireErr.Error())
			logEvent("error", fmt.Sprintf("获取可用账号失败，model=%s mode=%s err=%v", req.Model, mode, acquireErr))
			http.Error(w, acquireErr.Error(), statusCode)
			return
		}
		defer pool.Release(acc)

		if err := apiClient.UpdateUserSettings(acc.JWT, ratio); err != nil {
			appState.RecordRequestFailure(req.Model, mode, err.Error())
			logEvent("error", fmt.Sprintf("更新用户设置失败，model=%s ratio=%s err=%v", req.Model, ratio, err))
			http.Error(w, "Failed to update user settings", http.StatusInternalServerError)
			return
		}

		var imgURL string
		var err error

		// 路由到对应的方法
		if isMergeMode {
			imgURL, err = apiClient.MergeImage(req.Prompt, req.Images, modelCfg.MergeMode, acc.JWT)
		} else if isEditMode {
			imgData := req.Image
			if imgData == "" {
				imgData = req.Images[0] // 兼容传了 Images 数组但只有一张图的情况
			}
			imgURL, err = apiClient.EditImage(req.Prompt, imgData, modelCfg.EditMode, acc.JWT)
		} else {
			imgURL, err = apiClient.GenerateImage(req.Prompt, modelCfg.Provider, modelCfg.Version, acc.JWT)
		}

		if err != nil {
			duration := time.Since(startTime).Milliseconds()
			AddRequestHistory(req.Model, req.Prompt, req.Size, false, "", err.Error(), duration)
			appState.RecordRequestFailure(req.Model, mode, err.Error())
			logEvent("error", fmt.Sprintf("图片任务失败，model=%s mode=%s err=%v", req.Model, mode, err))
			http.Error(w, fmt.Sprintf("Generation failed: %v", err), http.StatusInternalServerError)
			return
		}

		duration := time.Since(startTime).Milliseconds()
		AddRequestHistory(req.Model, req.Prompt, req.Size, true, imgURL, "", duration)
		appState.RecordRequestSuccess(req.Model, mode, imgURL)
		logEvent("success", fmt.Sprintf("图片任务成功，model=%s mode=%s", req.Model, mode))

		resp := OpenAIImageResp{
			Created: time.Now().Unix(),
			Data:    []ImageData{{URL: imgURL}},
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(resp)
	}
}

func LoadAccountsFromFile(filepath string) ([]*Account, error) {
	data, err := os.ReadFile(filepath)
	if err != nil {
		if os.IsNotExist(err) {
			return []*Account{}, nil
		}
		return nil, err
	}

	var accountsData []AccountData
	if err := json.Unmarshal(data, &accountsData); err != nil {
		return nil, err
	}

	accounts := make([]*Account, 0, len(accountsData))
	seenJWTs := make(map[string]struct{}, len(accountsData))
	for i, ad := range accountsData {
		jwt := strings.TrimSpace(ad.JWT)
		if jwt == "" {
			continue
		}
		if _, exists := seenJWTs[jwt]; exists {
			logEvent("warn", fmt.Sprintf("跳过重复账号，来源=%s index=%d", filepath, i))
			continue
		}

		quota, err := fetchQuota(jwt)
		if err != nil {
			logEvent("warn", fmt.Sprintf("跳过无效账号，来源=%s index=%d err=%v", filepath, i, err))
			continue
		}
		if quota < 2 {
			logEvent("warn", fmt.Sprintf("跳过低额度账号，来源=%s index=%d quota=%d", filepath, i, quota))
			continue
		}

		seenJWTs[jwt] = struct{}{}
		accounts = append(accounts, &Account{
			JWT:       jwt,
			Email:     strings.TrimSpace(ad.Email),
			Note:      strings.TrimSpace(ad.Note),
			Quota:     quota,
			UpdatedAt: time.Now(),
		})
	}

	return accounts, nil
}

func SaveAccountsToFile(filepath string, pool *SimplePool) error {
	pool.mu.Lock()
	accounts := append([]*Account(nil), pool.accounts...)
	pool.mu.Unlock()

	return SaveAccountSliceToFile(filepath, accounts)
}

func SaveAccountSliceToFile(filepath string, accounts []*Account) error {
	accountsData := make([]AccountData, len(accounts))
	for i, acc := range accounts {
		accountsData[i] = AccountData{
			JWT:       acc.JWT,
			Email:     acc.Email,
			Note:      acc.Note,
			UpdatedAt: formatTimestamp(acc.UpdatedAt),
		}
	}

	data, err := json.MarshalIndent(accountsData, "", "  ")
	if err != nil {
		return err
	}

	return os.WriteFile(filepath, data, 0600)
}

func AddAccountHandler(pool *SimplePool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		var req AddAccountRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "Invalid request body", http.StatusBadRequest)
			return
		}

		req.JWT = strings.TrimSpace(req.JWT)
		req.Email = strings.TrimSpace(req.Email)
		req.Note = strings.TrimSpace(req.Note)

		if req.JWT == "" {
			http.Error(w, "JWT is required", http.StatusBadRequest)
			return
		}
		if hasAccountJWT(pool, req.JWT) {
			http.Error(w, "JWT already exists", http.StatusConflict)
			return
		}

		quota, err := fetchQuota(req.JWT)
		if err != nil {
			http.Error(w, fmt.Sprintf("Invalid JWT: %v", err), http.StatusBadRequest)
			return
		}
		if quota < 2 {
			http.Error(w, fmt.Sprintf("JWT quota too low: %d", quota), http.StatusBadRequest)
			return
		}

		pool.mu.Lock()
		if accountIndexByJWT(pool.accounts, req.JWT) >= 0 {
			pool.mu.Unlock()
			http.Error(w, "JWT already exists", http.StatusConflict)
			return
		}
		pool.accounts = append(pool.accounts, &Account{
			JWT:       req.JWT,
			Email:     req.Email,
			Note:      req.Note,
			Quota:     quota,
			UpdatedAt: time.Now(),
		})
		pool.cond.Broadcast()
		pool.mu.Unlock()

		if err := SaveAccountsToFile(accountsFile, pool); err != nil {
			logEvent("error", fmt.Sprintf("保存账号文件失败: %v", err))
		}

		logEvent("success", fmt.Sprintf("添加账号成功，当前额度=%d", quota))

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": true,
			"quota":   quota,
		})
	}
}

func accountIndexByJWT(accounts []*Account, jwt string) int {
	for i, acc := range accounts {
		if acc.JWT == jwt {
			return i
		}
	}
	return -1
}

func hasAccountJWT(pool *SimplePool, jwt string) bool {
	pool.mu.Lock()
	defer pool.mu.Unlock()
	return accountIndexByJWT(pool.accounts, jwt) >= 0
}

func DeleteAccountHandler(pool *SimplePool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		var req DeleteAccountRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "Invalid request body", http.StatusBadRequest)
			return
		}

		pool.mu.Lock()
		if req.Index < 0 || req.Index >= len(pool.accounts) {
			pool.mu.Unlock()
			http.Error(w, "Invalid account index", http.StatusBadRequest)
			return
		}

		removedJWT := pool.accounts[req.Index].JWT
		pool.accounts = append(pool.accounts[:req.Index], pool.accounts[req.Index+1:]...)
		delete(pool.leased, removedJWT)
		pool.cond.Broadcast()
		pool.mu.Unlock()

		if err := SaveAccountsToFile(accountsFile, pool); err != nil {
			logEvent("error", fmt.Sprintf("保存账号文件失败: %v", err))
		}

		logEvent("success", fmt.Sprintf("删除账号成功，索引=%d", req.Index))

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]bool{"success": true})
	}
}

func ListAccountsHandler(pool *SimplePool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		pool.mu.Lock()
		accounts := make([]AccountInfo, len(pool.accounts))
		for i, acc := range pool.accounts {
			accounts[i] = AccountInfo{
				Index:     i,
				Email:     acc.Email,
				Note:      acc.Note,
				Quota:     acc.Quota,
				JWTMasked: maskJWT(acc.JWT),
				UpdatedAt: formatTimestamp(acc.UpdatedAt),
			}
		}
		pool.mu.Unlock()

		resp := AccountListResponse{
			Total:    len(accounts),
			Accounts: accounts,
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(resp)
	}
}

func ExportAccountsHandler(pool *SimplePool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		pool.mu.Lock()
		accountsData := make([]AccountData, len(pool.accounts))
		for i, acc := range pool.accounts {
			accountsData[i] = AccountData{
				JWT:       acc.JWT,
				Email:     acc.Email,
				Note:      acc.Note,
				UpdatedAt: formatTimestamp(acc.UpdatedAt),
			}
		}
		pool.mu.Unlock()

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(accountsData)
	}
}

func AddRequestHistory(model, prompt, size string, success bool, imageURL, errorMsg string, duration int64) {
	requestHistoryMu.Lock()
	defer requestHistoryMu.Unlock()

	history := RequestHistory{
		Time:     time.Now().Format(time.RFC3339),
		Model:    model,
		Prompt:   prompt,
		Size:     size,
		Success:  success,
		ImageURL: imageURL,
		Error:    errorMsg,
		Duration: duration,
	}

	requestHistory = append([]RequestHistory{history}, requestHistory...)
	if len(requestHistory) > maxHistorySize {
		requestHistory = requestHistory[:maxHistorySize]
	}
}

func GetRequestHistoryHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	requestHistoryMu.Lock()
	history := make([]RequestHistory, len(requestHistory))
	copy(history, requestHistory)
	requestHistoryMu.Unlock()

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"total":   len(history),
		"history": history,
	})
}

func parseRatio(size string) string {
	switch size {
	case "1024x1024", "1:1":
		return "1:1"
	case "1024x1792", "9:16":
		return "9:16"
	case "1792x1024", "16:9":
		return "16:9"
	default:
		return "auto"
	}
}

func NewAppState() *AppState {
	return &AppState{
		startedAt: time.Now(),
		logs:      make([]LogEntry, 0, 64),
	}
}

func (s *AppState) SetConfig(cfg RuntimeConfig) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.config = cfg
}

func (s *AppState) appendLog(level, message string) {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.logs = append(s.logs, LogEntry{
		Time:    time.Now().Format(time.RFC3339),
		Level:   strings.ToUpper(level),
		Message: message,
	})
	if len(s.logs) > 80 {
		s.logs = s.logs[len(s.logs)-80:]
	}
}

func (s *AppState) RecordRequest(model, mode string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.stats.RequestsTotal++
	s.stats.LastModel = model
	s.stats.LastMode = mode
	switch mode {
	case "image-edit":
		s.stats.EditRequests++
	case "image-merge":
		s.stats.MergeRequests++
	default:
		s.stats.TextRequests++
	}
}

func (s *AppState) RecordRequestSuccess(model, mode, resultURL string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.stats.RequestsSuccess++
	s.stats.LastModel = model
	s.stats.LastMode = mode
	s.stats.LastResultURL = resultURL
	s.stats.LastError = ""
}

func (s *AppState) RecordRequestFailure(model, mode, errMsg string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.stats.RequestsFailed++
	if model != "" {
		s.stats.LastModel = model
	}
	if mode != "" {
		s.stats.LastMode = mode
	}
	s.stats.LastError = errMsg
}

func (s *AppState) Snapshot(pool *SimplePool) StatusResponse {
	s.mu.Lock()
	config := s.config
	stats := s.stats
	logs := append([]LogEntry(nil), s.logs...)
	startedAt := s.startedAt
	s.mu.Unlock()

	return StatusResponse{
		Now:       time.Now().Format(time.RFC3339),
		UptimeSec: int64(time.Since(startedAt).Seconds()),
		Config:    config,
		Stats:     stats,
		Pool:      pool.Snapshot(),
		Logs:      logs,
	}
}

func (p *SimplePool) Snapshot() PoolSnapshot {
	p.mu.Lock()
	defer p.mu.Unlock()

	quotas := make([]int, 0, len(p.accounts))
	for _, acc := range p.accounts {
		if _, leased := p.leased[acc.JWT]; leased {
			continue
		}
		quotas = append(quotas, acc.Quota)
	}

	return PoolSnapshot{
		MaxSize:       p.maxSize,
		BufferedNew:   0,
		ReadyAccounts: len(quotas),
		Quotas:        quotas,
	}
}

func (p *SimplePool) findAvailableIndexLocked(cost int) int {
	bestIdx := -1
	for i, acc := range p.accounts {
		if _, leased := p.leased[acc.JWT]; leased {
			continue
		}
		if acc.Quota < cost {
			continue
		}
		if bestIdx == -1 || acc.Quota < p.accounts[bestIdx].Quota {
			bestIdx = i
		}
	}
	return bestIdx
}

func logEvent(level, message string) {
	appState.appendLog(level, message)
	fmt.Printf("[%s] %s\n", strings.ToUpper(level), message)
}

func RequireAPIKey(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if authKey == "" {
			next(w, r)
			return
		}

		if supplied := extractAPIKey(r); supplied == authKey {
			next(w, r)
			return
		}

		logEvent("warn", fmt.Sprintf("未授权请求：%s %s", r.Method, r.URL.Path))
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
	}
}

func extractAPIKey(r *http.Request) string {
	if value := strings.TrimSpace(r.Header.Get("X-API-Key")); value != "" {
		return value
	}

	authHeader := strings.TrimSpace(r.Header.Get("Authorization"))
	if strings.HasPrefix(strings.ToLower(authHeader), "bearer ") {
		return strings.TrimSpace(authHeader[7:])
	}

	return ""
}

func withSecurityHeaders(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("X-Frame-Options", "DENY")
		w.Header().Set("Referrer-Policy", "no-referrer")
		w.Header().Set("Content-Security-Policy", "default-src 'self'; img-src 'self' data: https:; style-src 'self'; style-src-attr 'none'; script-src 'self'; script-src-attr 'none'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'")
		next.ServeHTTP(w, r)
	})
}

func supportedModels() []string {
	models := make([]string, 0, len(modelRouter))
	for model := range modelRouter {
		models = append(models, model)
	}
	sort.Strings(models)
	return models
}

func maskValue(value string) string {
	if value == "" {
		return ""
	}
	if len(value) <= 6 {
		return "***"
	}
	return value[:3] + "***" + value[len(value)-3:]
}

func maskJWT(jwt string) string {
	if jwt == "" {
		return ""
	}
	if len(jwt) <= 24 {
		return maskValue(jwt)
	}
	return jwt[:12] + "..." + jwt[len(jwt)-12:]
}

func formatTimestamp(t time.Time) string {
	if t.IsZero() {
		return ""
	}
	return t.Format(time.RFC3339)
}

func maskEmail(email string) string {
	parts := strings.SplitN(email, "@", 2)
	if len(parts) != 2 {
		return "***"
	}
	name := parts[0]
	if len(name) <= 2 {
		name = "***"
	} else {
		name = name[:2] + "***"
	}
	return name + "@" + parts[1]
}

func applyEnvOverrides() {
	if !flagWasSet("pool") {
		pool = envInt("APP_POOL", pool)
	}
	if !flagWasSet("port") {
		port = envInt("APP_PORT", port)
	}
	if !flagWasSet("max-body-mb") {
		maxBodyMB = envInt("APP_MAX_BODY_MB", maxBodyMB)
	}
	if !flagWasSet("max-images") {
		maxImages = envInt("APP_MAX_IMAGES", maxImages)
	}
	if !flagWasSet("acquire-timeout-sec") {
		acquireTimeoutSec = envInt("APP_ACQUIRE_TIMEOUT_SEC", acquireTimeoutSec)
	}
	if !flagWasSet("auth-key") {
		authKey = envString("APP_AUTH_KEY", authKey)
	}
	if !flagWasSet("accounts-file") {
		accountsFile = envString("APP_ACCOUNTS_FILE", accountsFile)
	}
}

func flagWasSet(name string) bool {
	found := false
	flag.Visit(func(f *flag.Flag) {
		if f.Name == name {
			found = true
		}
	})
	return found
}

func envString(name, fallback string) string {
	if value := strings.TrimSpace(os.Getenv(name)); value != "" {
		return value
	}
	return fallback
}

func envInt(name string, fallback int) int {
	value := strings.TrimSpace(os.Getenv(name))
	if value == "" {
		return fallback
	}

	parsed, err := strconv.Atoi(value)
	if err != nil {
		logEvent("warn", fmt.Sprintf("环境变量 %s 非法，继续使用默认值 %d", name, fallback))
		return fallback
	}
	return parsed
}
