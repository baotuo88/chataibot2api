package main

import (
	"bytes"
	"encoding/json"
	"errors"
	"net/http"
	"os"
	"strings"
	"testing"
	"time"
)

type testResponseWriter struct {
	header http.Header
	body   bytes.Buffer
	status int
}

func (w *testResponseWriter) Header() http.Header {
	if w.header == nil {
		w.header = make(http.Header)
	}
	return w.header
}

func (w *testResponseWriter) Write(data []byte) (int, error) {
	if w.status == 0 {
		w.status = http.StatusOK
	}
	return w.body.Write(data)
}

func (w *testResponseWriter) WriteHeader(statusCode int) {
	w.status = statusCode
}

func withFetchQuotaStub(t *testing.T, stub func(string) (int, error)) {
	t.Helper()
	original := fetchQuota
	fetchQuota = stub
	t.Cleanup(func() {
		fetchQuota = original
	})
}

func TestAcquireWaitsForReleasedAccount(t *testing.T) {
	withFetchQuotaStub(t, func(string) (int, error) {
		return 9, nil
	})

	pool := StartPool(2, []*Account{
		{JWT: "jwt-1", Quota: 10},
	})

	first, err := pool.Acquire(t.Context(), 5, 0)
	if err != nil {
		t.Fatalf("first acquire failed: %v", err)
	}

	resultCh := make(chan *Account, 1)
	errCh := make(chan error, 1)
	go func() {
		acc, acquireErr := pool.Acquire(t.Context(), 5, 200*time.Millisecond)
		if acquireErr != nil {
			errCh <- acquireErr
			return
		}
		resultCh <- acc
	}()

	select {
	case <-resultCh:
		t.Fatal("second acquire returned before an account was released")
	case err := <-errCh:
		t.Fatalf("second acquire failed before release: %v", err)
	case <-time.After(50 * time.Millisecond):
	}

	pool.Release(first)

	select {
	case acc := <-resultCh:
		if acc.JWT != "jwt-1" {
			t.Fatalf("unexpected account after release: %s", acc.JWT)
		}
	case err := <-errCh:
		t.Fatalf("second acquire failed after release: %v", err)
	case <-time.After(250 * time.Millisecond):
		t.Fatal("second acquire did not resume after release")
	}
}

func TestSaveAccountsToFileIncludesLeasedAccounts(t *testing.T) {
	pool := StartPool(4, []*Account{
		{JWT: "jwt-1", Quota: 10},
		{JWT: "jwt-2", Quota: 12},
	})

	if _, err := pool.Acquire(t.Context(), 5, 0); err != nil {
		t.Fatalf("acquire failed: %v", err)
	}

	filepath := t.TempDir() + "/accounts.json"
	if err := SaveAccountsToFile(filepath, pool); err != nil {
		t.Fatalf("save accounts failed: %v", err)
	}

	data, err := os.ReadFile(filepath)
	if err != nil {
		t.Fatalf("read saved accounts failed: %v", err)
	}

	var saved []AccountData
	if err := json.Unmarshal(data, &saved); err != nil {
		t.Fatalf("unmarshal saved accounts failed: %v", err)
	}

	if len(saved) != 2 {
		t.Fatalf("expected 2 saved accounts, got %d", len(saved))
	}
}

func TestReleaseKeepsAccountWhenQuotaRefreshFails(t *testing.T) {
	withFetchQuotaStub(t, func(string) (int, error) {
		return 0, errors.New("temporary upstream failure")
	})

	pool := StartPool(2, []*Account{
		{JWT: "jwt-1", Quota: 10},
	})

	acc, err := pool.Acquire(t.Context(), 5, 0)
	if err != nil {
		t.Fatalf("acquire failed: %v", err)
	}

	pool.Release(acc)

	pool.mu.Lock()
	defer pool.mu.Unlock()

	if len(pool.accounts) != 1 {
		t.Fatalf("expected account to remain in pool, got %d accounts", len(pool.accounts))
	}
	if _, leased := pool.leased["jwt-1"]; leased {
		t.Fatal("account remained marked as leased after release failure")
	}
}

func TestReleaseRemovesLowQuotaAccount(t *testing.T) {
	withFetchQuotaStub(t, func(string) (int, error) {
		return 1, nil
	})

	pool := StartPool(2, []*Account{
		{JWT: "jwt-1", Quota: 10},
	})

	acc, err := pool.Acquire(t.Context(), 5, 0)
	if err != nil {
		t.Fatalf("acquire failed: %v", err)
	}

	pool.Release(acc)

	pool.mu.Lock()
	defer pool.mu.Unlock()

	if len(pool.accounts) != 0 {
		t.Fatalf("expected low-quota account to be removed, got %d accounts", len(pool.accounts))
	}
}

func TestAcquireTimesOutWhenNoAccountBecomesAvailable(t *testing.T) {
	pool := StartPool(1, []*Account{
		{JWT: "jwt-1", Quota: 10},
	})

	acc, err := pool.Acquire(t.Context(), 5, 0)
	if err != nil {
		t.Fatalf("initial acquire failed: %v", err)
	}
	t.Cleanup(func() {
		pool.mu.Lock()
		delete(pool.leased, acc.JWT)
		pool.mu.Unlock()
	})

	start := time.Now()
	_, err = pool.Acquire(t.Context(), 5, 80*time.Millisecond)
	if err == nil {
		t.Fatal("expected acquire to time out")
	}
	if !strings.Contains(err.Error(), "timed out waiting for available account") {
		t.Fatalf("unexpected acquire error: %v", err)
	}
	if time.Since(start) < 60*time.Millisecond {
		t.Fatalf("acquire returned too early: %v", time.Since(start))
	}
}

func TestSaveAccountSliceToFileCreatesParentDir(t *testing.T) {
	filepath := t.TempDir() + "/nested/accounts.json"
	accounts := []*Account{
		{JWT: "jwt-1", Email: "user@example.com", Quota: 10, UpdatedAt: time.Now()},
	}

	if err := SaveAccountSliceToFile(filepath, accounts); err != nil {
		t.Fatalf("save account slice failed: %v", err)
	}

	if _, err := os.Stat(filepath); err != nil {
		t.Fatalf("expected saved file to exist: %v", err)
	}
}

func TestListAccountsHandlerSupportsPagination(t *testing.T) {
	pool := StartPool(5, []*Account{
		{JWT: "jwt-1", Email: "a@example.com", Quota: 30, UpdatedAt: time.Now()},
		{JWT: "jwt-2", Email: "b@example.com", Quota: 8, UpdatedAt: time.Now()},
		{JWT: "jwt-3", Email: "c@example.com", Quota: 15, UpdatedAt: time.Now()},
		{JWT: "jwt-4", Email: "d@example.com", Quota: 7, UpdatedAt: time.Now()},
		{JWT: "jwt-5", Email: "e@example.com", Quota: 20, UpdatedAt: time.Now()},
	})

	req, err := http.NewRequest(http.MethodGet, "/api/accounts?page=2&pageSize=2", nil)
	if err != nil {
		t.Fatalf("build request failed: %v", err)
	}
	rec := &testResponseWriter{}

	ListAccountsHandler(pool).ServeHTTP(rec, req)

	if rec.status != http.StatusOK {
		t.Fatalf("unexpected status code: %d", rec.status)
	}

	var resp AccountListResponse
	if err := json.NewDecoder(&rec.body).Decode(&resp); err != nil {
		t.Fatalf("decode response failed: %v", err)
	}

	if resp.Total != 5 || resp.Page != 2 || resp.PageSize != 2 || resp.TotalPages != 3 {
		t.Fatalf("unexpected pagination response: %+v", resp)
	}
	if resp.LowQuotaCount != 2 {
		t.Fatalf("unexpected low quota count: %d", resp.LowQuotaCount)
	}
	if len(resp.Accounts) != 2 {
		t.Fatalf("expected 2 accounts on page 2, got %d", len(resp.Accounts))
	}
	if resp.Accounts[0].Index != 2 || resp.Accounts[1].Index != 3 {
		t.Fatalf("unexpected account indexes on page 2: %+v", resp.Accounts)
	}
}
