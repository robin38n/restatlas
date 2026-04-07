package proxy

import (
	"io"
	"net/http"
	"net/url"
	"regexp"
	"strings"
)

var allowedRespHeaders = map[string]bool{
	"Content-Type": true, "Content-Length": true, "Date": true, "Server": true,
	"Etag": true, "Cache-Control": true, "Last-Modified": true, "Vary": true,
}

// SanitizeHeaders returns an allowlisted subset of response headers.
func SanitizeHeaders(h http.Header) map[string]string {
	out := make(map[string]string, len(allowedRespHeaders))
	for k, vals := range h {
		if allowedRespHeaders[http.CanonicalHeaderKey(k)] {
			out[k] = strings.Join(vals, ", ")
		}
	}
	return out
}

var allowedRespContentTypePrefixes = []string{
	"application/json", "application/xml", "application/x-www-form-urlencoded", "text/",
}

func ContentTypeAllowed(ct string) bool {
	ct = strings.ToLower(strings.TrimSpace(ct))
	if ct == "" {
		return true
	}
	if idx := strings.Index(ct, ";"); idx >= 0 {
		ct = strings.TrimSpace(ct[:idx])
	}
	for _, p := range allowedRespContentTypePrefixes {
		if strings.HasPrefix(ct, p) {
			return true
		}
	}
	return false
}

var (
	pureDecimalRe = regexp.MustCompile(`^[0-9]+$`)
	hexHostRe     = regexp.MustCompile(`^0[xX][0-9a-fA-F]+$`)
	octalHostRe   = regexp.MustCompile(`^0[0-7]+$`)
)

// IsNumericOrEncodedHost detects decimal/hex/octal hostnames to prevent SSRF bypasses.
func IsNumericOrEncodedHost(host string) bool {
	host = strings.Trim(host, "[]")
	return pureDecimalRe.MatchString(host) || hexHostRe.MatchString(host) || octalHostRe.MatchString(host)
}

// ExtractServerHosts pulls hostnames from the OpenAPI `servers` list.
func ExtractServerHosts(raw map[string]any) []string {
	servers, ok := raw["servers"].([]any)
	if !ok {
		return nil
	}
	seen := map[string]bool{}
	out := []string{}
	for _, s := range servers {
		obj, ok := s.(map[string]any)
		if !ok {
			continue
		}
		urlStr, _ := obj["url"].(string)
		if urlStr == "" {
			continue
		}
		u, err := url.Parse(urlStr)
		if err != nil || u.Host == "" {
			continue
		}
		host := strings.ToLower(u.Hostname())
		if !seen[host] {
			seen[host] = true
			out = append(out, host)
		}
	}
	return out
}

func ReadBodyWithCap(r io.Reader, max int64) ([]byte, bool, error) {
	buf, err := io.ReadAll(io.LimitReader(r, max+1))
	if err != nil {
		return nil, false, err
	}
	if int64(len(buf)) > max {
		return buf[:max], true, nil
	}
	return buf, false, nil
}

func HostInList(host string, list []string) bool {
	host = strings.ToLower(host)
	for _, h := range list {
		if strings.ToLower(h) == host {
			return true
		}
	}
	return false
}
