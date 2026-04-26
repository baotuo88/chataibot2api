package api

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"strings"
	"time"
)

type UpdateUserRequest struct {
	Settings map[string]string `json:"settings"`
}

type ChataibotImageResp []struct {
	ImageUrl string `json:"imageUrl"`
}

type ChataibotEditImageResp struct {
	ImageUrl string `json:"imageUrl"`
}

type APIClient struct {
	httpClient *http.Client
}

func NewAPIClient() *APIClient {
	return &APIClient{
		httpClient: &http.Client{Timeout: 15 * time.Second},
	}
}

func newAuthenticatedRequest(method, url string, body io.Reader, jwtToken, userAgent string) (*http.Request, error) {
	req, err := http.NewRequest(method, url, body)
	if err != nil {
		return nil, err
	}

	req.Header.Set("Cookie", "token="+jwtToken)
	req.Header.Set("x-distribution-channel", "web")
	req.Header.Set("User-Agent", userAgent)
	return req, nil
}

func readResponseBody(resp *http.Response) ([]byte, error) {
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read response body: %w", err)
	}
	return body, nil
}

// UpdateUserSettings 更新用户设置
func (c *APIClient) UpdateUserSettings(jwtToken, aspectRatio string) error {
	url := "https://chataibot.pro/api/user/update"
	payload := UpdateUserRequest{
		Settings: map[string]string{
			"imageAspectRatio": aspectRatio,
		},
	}

	jsonData, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("marshal update settings request: %w", err)
	}

	req, err := newAuthenticatedRequest(
		http.MethodPost,
		url,
		bytes.NewBuffer(jsonData),
		jwtToken,
		"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36",
	)
	if err != nil {
		return fmt.Errorf("build update settings request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("update settings request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusOK {
		return nil
	}

	body, err := readResponseBody(resp)
	if err != nil {
		return fmt.Errorf("update settings failed with HTTP %d and unreadable body: %w", resp.StatusCode, err)
	}
	return fmt.Errorf("update settings failed (HTTP %d): %s", resp.StatusCode, string(body))
}

// GetCount 获取剩余请求
func (c *APIClient) GetCount(jwtToken string) (int, error) {
	url := "https://chataibot.pro/api/user/answers-count/v2"
	req, err := newAuthenticatedRequest(
		http.MethodGet,
		url,
		nil,
		jwtToken,
		"Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/146.0.0.0 Safari/537.36",
	)
	if err != nil {
		return 0, fmt.Errorf("build quota request: %w", err)
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return 0, fmt.Errorf("quota request failed: %w", err)
	}
	defer resp.Body.Close()

	body, err := readResponseBody(resp)
	if err != nil {
		return 0, err
	}
	if resp.StatusCode != http.StatusOK {
		return 0, fmt.Errorf("quota request failed (HTTP %d): %s", resp.StatusCode, string(body))
	}

	var respData struct {
		LeftAnswersCount int `json:"leftAnswersCount"`
	}
	if err := json.Unmarshal(body, &respData); err != nil {
		return 0, err
	}

	return respData.LeftAnswersCount, nil
}

// GenerateImage 图片生成
func (c *APIClient) GenerateImage(prompt, provider, version, jwtToken string) (string, error) {
	url := "https://chataibot.pro/api/image/generate"
	payload := map[string]any{
		"text":            prompt,
		"from":            1,
		"generationType":  provider,
		"isInternational": true,
	}
	if version != "" {
		payload["version"] = version
	}

	jsonData, err := json.Marshal(payload)
	if err != nil {
		return "", fmt.Errorf("marshal generate image request: %w", err)
	}

	req, err := newAuthenticatedRequest(
		http.MethodPost,
		url,
		bytes.NewBuffer(jsonData),
		jwtToken,
		"Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/146.0.0.0 Safari/537.36",
	)
	if err != nil {
		return "", fmt.Errorf("build generate image request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	slowClient := *c.httpClient
	slowClient.Timeout = 5 * time.Minute

	resp, err := slowClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("generate image request failed: %w", err)
	}
	defer resp.Body.Close()

	body, err := readResponseBody(resp)
	if err != nil {
		return "", err
	}
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("generate image failed (HTTP %d): %s", resp.StatusCode, string(body))
	}

	var imgResp ChataibotImageResp
	if err := json.Unmarshal(body, &imgResp); err != nil {
		return "", fmt.Errorf("解析返回值失败：%s", string(body))
	}

	if len(imgResp) > 0 && imgResp[0].ImageUrl != "" {
		return imgResp[0].ImageUrl, nil
	}

	return "", fmt.Errorf("未能获取到图片链接：%s", string(body))
}

func (c *APIClient) EditImage(prompt, base64Data, model, jwtToken string) (string, error) {
	url := "https://chataibot.pro/api/file/recognize"

	b64Str := base64Data
	fileName := "upload.png"

	if strings.HasPrefix(b64Str, "data:image/") {
		parts := strings.SplitN(b64Str, ";base64,", 2)
		if len(parts) == 2 {
			if strings.Contains(parts[0], "jpeg") || strings.Contains(parts[0], "jpg") {
				fileName = "upload.jpg"
			}
			b64Str = parts[1]
		}
	}

	imgBytes, err := base64.StdEncoding.DecodeString(b64Str)
	if err != nil {
		return "", fmt.Errorf("Base64 解码失败：%v", err)
	}

	bodyBuffer := &bytes.Buffer{}
	writer := multipart.NewWriter(bodyBuffer)

	_ = writer.WriteField("mode", model)
	_ = writer.WriteField("chatContextId", "-2")
	_ = writer.WriteField("lang", "en")
	_ = writer.WriteField("from", "1")
	_ = writer.WriteField("isInternational", "true")
	_ = writer.WriteField("caption", prompt)

	part, err := writer.CreateFormFile("images", fileName)
	if err != nil {
		return "", fmt.Errorf("创建文件表单失败: %v", err)
	}
	_, err = part.Write(imgBytes)
	if err != nil {
		return "", fmt.Errorf("写入图片数据失败: %v", err)
	}

	err = writer.Close()
	if err != nil {
		return "", fmt.Errorf("关闭 multipart writer 失败: %v", err)
	}

	req, err := newAuthenticatedRequest(
		http.MethodPost,
		url,
		bodyBuffer,
		jwtToken,
		"Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/146.0.0.0 Safari/537.36",
	)
	if err != nil {
		return "", fmt.Errorf("build edit image request: %w", err)
	}
	req.Header.Set("Content-Type", writer.FormDataContentType())

	slowClient := *c.httpClient
	slowClient.Timeout = 5 * time.Minute

	resp, err := slowClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("edit image request failed: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := readResponseBody(resp)
	if err != nil {
		return "", err
	}
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("edit image failed (HTTP %d): %s", resp.StatusCode, string(respBody))
	}

	var imgResp ChataibotEditImageResp
	if err := json.Unmarshal(respBody, &imgResp); err != nil {
		return "", fmt.Errorf("解析返回值失败(HTTP %d): %s", resp.StatusCode, string(respBody))
	}

	if imgResp.ImageUrl != "" {
		return imgResp.ImageUrl, nil
	}

	return "", fmt.Errorf("未能获取到编辑后的图片链接: %s", string(respBody))
}

// MergeImage 发送多图合并请求
func (c *APIClient) MergeImage(prompt string, base64Images []string, mergeType, jwtToken string) (string, error) {
	url := "https://chataibot.pro/api/file/merge"

	bodyBuffer := &bytes.Buffer{}
	writer := multipart.NewWriter(bodyBuffer)

	_ = writer.WriteField("type", mergeType)
	_ = writer.WriteField("lang", "en")
	_ = writer.WriteField("from", "1")
	_ = writer.WriteField("isInternational", "true")
	_ = writer.WriteField("caption", prompt)

	// 循环处理并写入多张图片
	for i, b64Str := range base64Images {
		fileName := fmt.Sprintf("upload_%d.png", i)

		if strings.HasPrefix(b64Str, "data:image/") {
			parts := strings.SplitN(b64Str, ";base64,", 2)
			if len(parts) == 2 {
				if strings.Contains(parts[0], "jpeg") || strings.Contains(parts[0], "jpg") {
					fileName = fmt.Sprintf("upload_%d.jpg", i)
				}
				b64Str = parts[1]
			}
		}

		imgBytes, err := base64.StdEncoding.DecodeString(b64Str)
		if err != nil {
			return "", fmt.Errorf("第 %d 张图片 Base64 解码失败: %v", i+1, err)
		}

		part, err := writer.CreateFormFile("images", fileName)
		if err != nil {
			return "", fmt.Errorf("创建第 %d 张图片表单失败: %v", i+1, err)
		}
		_, err = part.Write(imgBytes)
		if err != nil {
			return "", fmt.Errorf("写入第 %d 张图片数据失败: %v", i+1, err)
		}
	}

	err := writer.Close()
	if err != nil {
		return "", fmt.Errorf("关闭 multipart writer 失败: %v", err)
	}

	req, err := newAuthenticatedRequest(
		http.MethodPost,
		url,
		bodyBuffer,
		jwtToken,
		"Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/146.0.0.0 Safari/537.36",
	)
	if err != nil {
		return "", fmt.Errorf("build merge image request: %w", err)
	}
	req.Header.Set("Content-Type", writer.FormDataContentType())
	req.Header.Set("Accept", "*/*")
	req.Header.Set("Origin", "https://chataibot.pro")
	req.Header.Set("Referer", "https://chataibot.pro/app/chat?chat_id=-2")

	slowClient := *c.httpClient
	slowClient.Timeout = 5 * time.Minute

	resp, err := slowClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("merge image request failed: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := readResponseBody(resp)
	if err != nil {
		return "", err
	}
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("merge image failed (HTTP %d): %s", resp.StatusCode, string(respBody))
	}

	var imgResp ChataibotEditImageResp
	if err := json.Unmarshal(respBody, &imgResp); err != nil {
		return "", fmt.Errorf("解析返回值失败(HTTP %d): %s", resp.StatusCode, string(respBody))
	}

	if imgResp.ImageUrl != "" {
		return imgResp.ImageUrl, nil
	}

	return "", fmt.Errorf("未能获取到合并后的图片链接: %s", string(respBody))
}
