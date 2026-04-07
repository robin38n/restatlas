package proxy

import (
	"crypto/tls"
	"net/http"
	"time"
)

// NewSafeClient creates an http.Client with SSRF protection and hardened TLS/timeout settings.
func NewSafeClient() *http.Client {
	return &http.Client{
		Timeout: 30 * time.Second,
		Transport: &http.Transport{
			DialContext:            safeDialContext,
			TLSHandshakeTimeout:    10 * time.Second,
			TLSClientConfig:        &tls.Config{MinVersion: tls.VersionTLS12},
			ResponseHeaderTimeout:  15 * time.Second,
			MaxResponseHeaderBytes: 64 << 10,
		},
		CheckRedirect: safeCheckRedirect,
	}
}
