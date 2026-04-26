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

// UpdateUserSettings 更新用户设置
func (c *APIClient) UpdateUserSettings(jwtToken, aspectRatio string) bool {
	url := "https://chataibot.pro/api/user/update"
	payload := UpdateUserRequest{
		Settings: map[string]string{
			"imageAspectRatio": aspectRatio,
		},
	}

	jsonData, err := json.Marshal(payload)
	if err != nil {
		fmt.Println("[-] 更新设置序列化失败：", err)
		return false
	}

	req, _ := http.NewRequest(http.MethodPost, url, bytes.NewBuffer(jsonData))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Cookie", "token="+jwtToken)
	req.Header.Set("x-distribution-channel", "web")
	req.Header.Set("User-Agent", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36")

	fmt.Printf("[*] 正在设置图片比例为 [%s]...\n", aspectRatio)
	resp, err := c.httpClient.Do(req)
	if err != nil {
		fmt.Println("[-] 更新设置请求失败：", err)
		return false
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusOK {
		return true
	}

	body, _ := io.ReadAll(resp.Body)
	fmt.Printf("[-] 更新设置失败(HTTP %d)：%s\n", resp.StatusCode, string(body))
	return false
}

// GetCount 获取剩余请求
func (c *APIClient) GetCount(jwtToken string) (int, error) {
	url := "https://chataibot.pro/api/user/answers-count/v2"
	req, _ := http.NewRequest(http.MethodGet, url, nil)
	req.Header.Set("Cookie", "token="+jwtToken)
	req.Header.Set("x-distribution-channel", "web")
	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/146.0.0.0 Safari/537.36")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		fmt.Println("[-] 获取剩余额度失败：", err)
		return 0, err
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
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

	jsonData, _ := json.Marshal(payload)
	req, _ := http.NewRequest(http.MethodPost, url, bytes.NewBuffer(jsonData))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Cookie", "token="+jwtToken)
	req.Header.Set("x-distribution-channel", "web")
	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/146.0.0.0 Safari/537.36")

	slowClient := *c.httpClient
	slowClient.Timeout = 5 * time.Minute

	fmt.Println("[*] 正在调用模型...")
	resp, err := slowClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("[-] 请求发送失败：%v", err)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)

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

	req, _ := http.NewRequest(http.MethodPost, url, bodyBuffer)
	req.Header.Set("Content-Type", writer.FormDataContentType())
	req.Header.Set("Cookie", "token="+jwtToken)
	req.Header.Set("x-distribution-channel", "web")
	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/146.0.0.0 Safari/537.36")

	slowClient := *c.httpClient
	slowClient.Timeout = 5 * time.Minute

	fmt.Printf("[*] 正在上传图片并执行图生图任务...\n")
	resp, err := slowClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("[-] 请求发送失败: %v", err)
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)

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

	req, _ := http.NewRequest(http.MethodPost, url, bodyBuffer)
	req.Header.Set("Content-Type", writer.FormDataContentType())
	req.Header.Set("Cookie", "token="+jwtToken)
	req.Header.Set("x-distribution-channel", "web")
	req.Header.Set("Accept", "*/*")
	req.Header.Set("Origin", "https://chataibot.pro")
	req.Header.Set("Referer", "https://chataibot.pro/app/chat?chat_id=-2")
	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/146.0.0.0 Safari/537.36")

	slowClient := *c.httpClient
	slowClient.Timeout = 5 * time.Minute

	fmt.Printf("[*] 正在上传 %d 张图片并执行合并任务...\n", len(base64Images))
	resp, err := slowClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("[-] 请求发送失败: %v", err)
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)

	var imgResp ChataibotEditImageResp
	if err := json.Unmarshal(respBody, &imgResp); err != nil {
		return "", fmt.Errorf("解析返回值失败(HTTP %d): %s", resp.StatusCode, string(respBody))
	}

	if imgResp.ImageUrl != "" {
		return imgResp.ImageUrl, nil
	}

	return "", fmt.Errorf("未能获取到合并后的图片链接: %s", string(respBody))
}
