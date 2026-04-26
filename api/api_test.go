package api

import (
	"io"
	"net/http"
	"strings"
	"testing"
)

type roundTripFunc func(*http.Request) (*http.Response, error)

func (fn roundTripFunc) RoundTrip(req *http.Request) (*http.Response, error) {
	return fn(req)
}

func newTestClient(fn roundTripFunc) *APIClient {
	return &APIClient{
		httpClient: &http.Client{Transport: fn},
	}
}

func newResponse(statusCode int, body string) *http.Response {
	return &http.Response{
		StatusCode: statusCode,
		Body:       io.NopCloser(strings.NewReader(body)),
		Header:     make(http.Header),
	}
}

func TestUpdateUserSettingsReturnsHTTPErrorBody(t *testing.T) {
	client := newTestClient(func(req *http.Request) (*http.Response, error) {
		if req.Method != http.MethodPost {
			t.Fatalf("unexpected method: %s", req.Method)
		}
		body, err := io.ReadAll(req.Body)
		if err != nil {
			t.Fatalf("failed to read request body: %v", err)
		}
		if !strings.Contains(string(body), `"imageAspectRatio":"16:9"`) {
			t.Fatalf("unexpected request body: %s", string(body))
		}
		return newResponse(http.StatusBadGateway, "upstream unavailable"), nil
	})

	err := client.UpdateUserSettings("jwt-token", "16:9")
	if err == nil {
		t.Fatal("expected update settings error")
	}
	if !strings.Contains(err.Error(), "HTTP 502") || !strings.Contains(err.Error(), "upstream unavailable") {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestGenerateImageReturnsHTTPErrorBody(t *testing.T) {
	client := newTestClient(func(req *http.Request) (*http.Response, error) {
		return newResponse(http.StatusForbidden, "quota exceeded"), nil
	})

	_, err := client.GenerateImage("prompt", "GPT_IMAGE_1_5", "", "jwt-token")
	if err == nil {
		t.Fatal("expected generate image error")
	}
	if !strings.Contains(err.Error(), "HTTP 403") || !strings.Contains(err.Error(), "quota exceeded") {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestEditImageReturnsHTTPErrorBody(t *testing.T) {
	client := newTestClient(func(req *http.Request) (*http.Response, error) {
		if !strings.Contains(req.Header.Get("Content-Type"), "multipart/form-data") {
			t.Fatalf("unexpected content type: %s", req.Header.Get("Content-Type"))
		}
		return newResponse(http.StatusBadRequest, "invalid image payload"), nil
	})

	_, err := client.EditImage("prompt", "aGVsbG8=", "edit_qwen_lora", "jwt-token")
	if err == nil {
		t.Fatal("expected edit image error")
	}
	if !strings.Contains(err.Error(), "HTTP 400") || !strings.Contains(err.Error(), "invalid image payload") {
		t.Fatalf("unexpected error: %v", err)
	}
}
