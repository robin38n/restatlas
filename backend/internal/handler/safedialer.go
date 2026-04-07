package handler

import (
	"context"
	"crypto/tls"
	"fmt"
	"net"
	"net/http"
	"time"
)

// privateRanges contains all CIDR ranges considered private/internal.
// Parsed once at init() to avoid repeated parsing on every request.
var privateRanges []*net.IPNet

func init() {
	cidrs := []string{
		"127.0.0.0/8",      // IPv4 loopback
		"10.0.0.0/8",       // RFC 1918
		"172.16.0.0/12",    // RFC 1918
		"192.168.0.0/16",   // RFC 1918
		"0.0.0.0/8",        // Current network
		"169.254.0.0/16",   // Link-local
		"224.0.0.0/4",      // Multicast
		"255.255.255.255/32", // Broadcast
		"::1/128",          // IPv6 loopback
		"fe80::/10",        // IPv6 link-local
		"fc00::/7",         // IPv6 unique local (ULA)
	}
	for _, cidr := range cidrs {
		_, network, err := net.ParseCIDR(cidr)
		if err != nil {
			panic("invalid CIDR in privateRanges: " + cidr)
		}
		privateRanges = append(privateRanges, network)
	}
}

// isPrivateIP checks whether an IP address belongs to a private, loopback,
// link-local, or otherwise non-routable range.
func isPrivateIP(ip net.IP) bool {
	// Normalize IPv4-mapped IPv6 (e.g. ::ffff:127.0.0.1 → 127.0.0.1)
	// so IPv4 CIDRs catch them.
	if v4 := ip.To4(); v4 != nil {
		ip = v4
	}

	// Belt-and-suspenders: stdlib checks as fallback.
	if ip.IsLoopback() || ip.IsLinkLocalUnicast() || ip.IsLinkLocalMulticast() || ip.IsUnspecified() {
		return true
	}

	for _, network := range privateRanges {
		if network.Contains(ip) {
			return true
		}
	}
	return false
}

// resolveAndValidate resolves a hostname and checks that none of the
// returned IPs are private. Returns an error if any IP is private or
// if resolution fails.
func resolveAndValidate(ctx context.Context, host string) ([]net.IP, error) {
	if host == "localhost" {
		return nil, fmt.Errorf("requests to localhost are not allowed")
	}
	if isNumericOrEncodedHost(host) {
		return nil, fmt.Errorf("numeric/encoded hostnames are not allowed")
	}

	// If it's already an IP literal, validate directly.
	if ip := net.ParseIP(host); ip != nil {
		if isPrivateIP(ip) {
			return nil, fmt.Errorf("requests to private/internal addresses are not allowed")
		}
		return []net.IP{ip}, nil
	}

	// Resolve DNS.
	ips, err := net.DefaultResolver.LookupIP(ctx, "ip", host)
	if err != nil {
		return nil, fmt.Errorf("DNS resolution failed: %w", err)
	}
	if len(ips) == 0 {
		return nil, fmt.Errorf("DNS resolution returned no addresses")
	}

	for _, ip := range ips {
		if isPrivateIP(ip) {
			return nil, fmt.Errorf("requests to private/internal addresses are not allowed")
		}
	}
	return ips, nil
}

// safeDialContext resolves the hostname and validates that the resolved IP
// is not private before establishing the connection. This prevents DNS
// rebinding attacks because validation happens at connection time.
func safeDialContext(ctx context.Context, network, addr string) (net.Conn, error) {
	host, port, err := net.SplitHostPort(addr)
	if err != nil {
		return nil, fmt.Errorf("invalid address %q: %w", addr, err)
	}

	ips, err := resolveAndValidate(ctx, host)
	if err != nil {
		return nil, err
	}

	// Dial the first safe IP.
	dialer := &net.Dialer{Timeout: 10 * time.Second}
	return dialer.DialContext(ctx, network, net.JoinHostPort(ips[0].String(), port))
}

// safeCheckRedirect validates each redirect hop to prevent redirect-based
// SSRF attacks (e.g. 302 redirect to an internal IP).
func safeCheckRedirect(req *http.Request, via []*http.Request) error {
	if len(via) >= 10 {
		return fmt.Errorf("too many redirects (max 10)")
	}

	scheme := req.URL.Scheme
	if scheme != "http" && scheme != "https" {
		return fmt.Errorf("redirect to disallowed scheme: %s", scheme)
	}

	host := req.URL.Hostname()
	_, err := resolveAndValidate(req.Context(), host)
	if err != nil {
		return fmt.Errorf("redirect blocked: %w", err)
	}

	return nil
}

// newSafeProxyClient creates an http.Client with SSRF protection:
// - Custom DialContext that validates resolved IPs
// - CheckRedirect that re-validates on every redirect hop
func newSafeProxyClient() *http.Client {
	return &http.Client{
		Timeout: 30 * time.Second,
		Transport: &http.Transport{
			DialContext:           safeDialContext,
			TLSHandshakeTimeout:   10 * time.Second,
			TLSClientConfig:       &tls.Config{MinVersion: tls.VersionTLS12},
			ResponseHeaderTimeout: 15 * time.Second,
			MaxResponseHeaderBytes: 64 << 10,
		},
		CheckRedirect: safeCheckRedirect,
	}
}
