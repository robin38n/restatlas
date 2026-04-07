package proxy_test

import (
	"net/http"
	"testing"

	"github.com/robin38n/reqviz/backend/internal/proxy"
)

func TestSanitizeHeaders(t *testing.T) {
	h := http.Header{
		"Content-Type":  []string{"application/json"},
		"Set-Cookie":    []string{"bad=cookie"},
		"Date":          []string{"today"},
		"Authorization": []string{"secret"},
	}

	sanitized := proxy.SanitizeHeaders(h)

	if _, ok := sanitized["Content-Type"]; !ok {
		t.Error("expected Content-Type to be preserved")
	}
	if _, ok := sanitized["Date"]; !ok {
		t.Error("expected Date to be preserved")
	}
	if _, ok := sanitized["Set-Cookie"]; ok {
		t.Error("expected Set-Cookie to be stripped")
	}
	if _, ok := sanitized["Authorization"]; ok {
		t.Error("expected Authorization to be stripped")
	}
}

func TestIsNumericOrEncodedHost(t *testing.T) {
	tests := []struct {
		host string
		want bool
	}{
		{"example.com", false},
		{"127.0.0.1", false}, // IPs are not numeric-re-matched (handled by net.ParseIP)
		{"2130706433", true}, // Decimal
		{"0x7f000001", true}, // Hex
		{"017700000001", true}, // Octal
		{"[::1]", false}, // IPv6
	}

	for _, tt := range tests {
		if got := proxy.IsNumericOrEncodedHost(tt.host); got != tt.want {
			t.Errorf("IsNumericOrEncodedHost(%q) = %v, want %v", tt.host, got, tt.want)
		}
	}
}

func TestHostInList(t *testing.T) {
	list := []string{"example.com", "API.foo.com"}

	if !proxy.HostInList("example.com", list) {
		t.Error("expected example.com to be in list")
	}
	if !proxy.HostInList("EXAMPLE.COM", list) {
		t.Error("expected host matching to be case-insensitive")
	}
	if !proxy.HostInList("api.foo.com", list) {
		t.Error("expected host matching to be case-insensitive for list items too")
	}
	if proxy.HostInList("google.com", list) {
		t.Error("expected google.com to NOT be in list")
	}
}
