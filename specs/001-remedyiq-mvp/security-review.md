# RemedyIQ Security Review Report

**Date:** 2026-02-10
**Reviewer:** Security Review Team
**Project:** RemedyIQ MVP
**Version:** 0.1.0
**Scope:** Backend Security Assessment (Tasks T087-T088)

---

## Executive Summary

This security review evaluates the RemedyIQ MVP codebase for authentication, authorization, input validation, injection prevention, file upload security, and CORS configuration. The assessment identifies security vulnerabilities and provides remediation recommendations appropriate for an MVP deployment.

**Overall Security Posture:** ACCEPTABLE FOR MVP with CRITICAL REMEDIATION REQUIRED

**Critical Issues Found:** 1
**High Priority Issues Found:** 3
**Medium Priority Issues Found:** 4
**Low Priority Issues Found:** 2

---

## 1. Authentication & Authorization

### Files Reviewed
- `/Users/omar/Developer/ARLogAnalyzer-25/backend/internal/api/middleware/auth.go`

### Findings

#### CRITICAL: SQL Injection in Development Bypass Headers
**Severity:** Critical
**Location:** `auth.go:74-82`
**Status:** MUST FIX BEFORE PRODUCTION

**Issue:**
The development bypass mechanism accepts `X-Dev-User-ID` and `X-Dev-Tenant-ID` headers without validation when `devMode=true`. While intended for development convenience, this creates multiple security risks:

1. If `devMode` is accidentally enabled in production, attackers can impersonate any user/tenant
2. No validation of UUID format or tenant existence
3. No rate limiting on development bypass attempts

**Code:**
```go
if am.devMode {
    devUser := r.Header.Get("X-Dev-User-ID")
    devTenant := r.Header.Get("X-Dev-Tenant-ID")
    if devUser != "" && devTenant != "" {
        ctx := context.WithValue(r.Context(), UserIDKey, devUser)
        ctx = context.WithValue(ctx, TenantIDKey, devTenant)
        ctx = context.WithValue(ctx, OrgIDKey, devTenant)
        next.ServeHTTP(w, r.WithContext(ctx))
        return
    }
}
```

**Recommendations:**
1. Add explicit environment variable check to prevent accidental production use
2. Validate UUID format for both user and tenant IDs
3. Log all dev bypass usage for audit trail
4. Add rate limiting to prevent abuse in development
5. Consider adding a cryptographic signature to dev headers (HMAC with secret)

**Suggested Fix:**
```go
if am.devMode {
    if os.Getenv("APP_ENV") == "production" {
        slog.Error("dev mode bypass attempted in production environment")
        writeError(w, http.StatusUnauthorized, errCodeUnauthorized, "unauthorized")
        return
    }

    devUser := r.Header.Get("X-Dev-User-ID")
    devTenant := r.Header.Get("X-Dev-Tenant-ID")

    if devUser != "" && devTenant != "" {
        // Validate UUID format
        if _, err := uuid.Parse(devUser); err != nil {
            writeError(w, http.StatusBadRequest, errCodeUnauthorized, "invalid dev user ID format")
            return
        }
        if _, err := uuid.Parse(devTenant); err != nil {
            writeError(w, http.StatusBadRequest, errCodeUnauthorized, "invalid dev tenant ID format")
            return
        }

        slog.Warn("dev bypass used", "user", devUser, "tenant", devTenant, "path", r.URL.Path)

        ctx := context.WithValue(r.Context(), UserIDKey, devUser)
        ctx = context.WithValue(ctx, TenantIDKey, devTenant)
        ctx = context.WithValue(ctx, OrgIDKey, devTenant)
        next.ServeHTTP(w, r.WithContext(ctx))
        return
    }
}
```

#### HIGH: JWT Validation Missing Issuer and Audience Checks
**Severity:** High
**Location:** `auth.go:141-204`

**Issue:**
The JWT validation function only validates signature, expiration (`exp`), and not-before (`nbf`) claims. It does NOT validate:
- Issuer (`iss`) - ensures token comes from Clerk
- Audience (`aud`) - ensures token is intended for this application
- Algorithm enforcement - while HS256 is checked, header could be manipulated

**Recommendations:**
1. Add issuer validation to ensure tokens come from Clerk
2. Add audience validation to prevent token reuse across applications
3. Add algorithm whitelist enforcement before parsing header
4. Consider migrating to RS256/JWKS for production (HS256 with shared secret is less secure)

#### MEDIUM: Clock Skew Tolerance Too Permissive
**Severity:** Medium
**Location:** `auth.go:198-200`

**Issue:**
```go
if nbf, ok := claims["nbf"].(float64); ok {
    if int64(nbf) > now+60 { // allow 60 seconds clock skew
        return nil, fmt.Errorf("token not yet valid")
    }
}
```

60 seconds of clock skew is generous. Industry standard is typically 30 seconds or less.

**Recommendation:** Reduce to 30 seconds for production deployment.

#### LOW: Missing Token Revocation Check
**Severity:** Low
**Location:** `auth.go:141-204`

**Issue:**
No mechanism to check if a JWT has been revoked (logout, account deletion, etc.). This is acceptable for MVP but should be planned for future releases.

**Recommendation:**
For post-MVP, implement token revocation via Redis cache or Clerk session validation API.

---

## 2. Tenant Isolation

### Files Reviewed
- `/Users/omar/Developer/ARLogAnalyzer-25/backend/internal/api/middleware/tenant.go`
- `/Users/omar/Developer/ARLogAnalyzer-25/backend/internal/storage/postgres.go`

### Findings

#### HIGH: SQL Injection Vulnerability in SetTenantContext
**Severity:** High
**Location:** `postgres.go:54-60`
**Status:** MUST FIX

**Issue:**
The `SetTenantContext` function uses string concatenation instead of parameterized queries:

```go
func (p *PostgresClient) SetTenantContext(ctx context.Context, tenantID string) error {
    _, err := p.pool.Exec(ctx, fmt.Sprintf("SET app.tenant_id = '%s'", tenantID))
    if err != nil {
        return fmt.Errorf("postgres: set tenant context: %w", err)
    }
    return nil
}
```

**Attack Vector:**
If `tenantID` contains SQL metacharacters (e.g., `'; DROP TABLE tenants; --`), this could lead to SQL injection even though tenant IDs should be UUIDs.

**Recommendations:**
1. Use parameterized queries even for `SET` commands
2. Validate that `tenantID` is a valid UUID before executing
3. Add integration test for SQL injection attempts

**Suggested Fix:**
```go
func (p *PostgresClient) SetTenantContext(ctx context.Context, tenantID string) error {
    // Validate UUID format first
    if _, err := uuid.Parse(tenantID); err != nil {
        return fmt.Errorf("postgres: invalid tenant ID format: %w", err)
    }

    // Use parameterized query
    _, err := p.pool.Exec(ctx, "SELECT set_config('app.tenant_id', $1, false)", tenantID)
    if err != nil {
        return fmt.Errorf("postgres: set tenant context: %w", err)
    }
    return nil
}
```

#### MEDIUM: Tenant Context Not Consistently Applied
**Severity:** Medium
**Location:** Multiple handlers

**Issue:**
Not all database queries explicitly call `SetTenantContext` before executing. While PostgreSQL Row-Level Security (RLS) provides defense-in-depth, explicitly setting tenant context is a best practice for audit trails and query optimization.

**Observation:**
The codebase relies on tenant_id parameters in WHERE clauses (good defense-in-depth) but does not consistently use `SetTenantContext` session variables that RLS policies expect.

**Recommendation:**
Add middleware or transaction wrapper that automatically calls `SetTenantContext` at the start of every tenant-scoped request.

---

## 3. Input Validation

### Files Reviewed
- `/Users/omar/Developer/ARLogAnalyzer-25/backend/internal/api/handlers/analysis.go`
- `/Users/omar/Developer/ARLogAnalyzer-25/backend/internal/api/handlers/upload.go`

### Findings

#### HIGH: Missing Request Size Limits on JSON Payloads
**Severity:** High
**Location:** `analysis.go:44`

**Issue:**
JSON request body decoding has no size limit:

```go
var req analysisJobCreateRequest
if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
    api.Error(w, http.StatusBadRequest, api.ErrCodeInvalidRequest, "invalid JSON body")
    return
}
```

**Attack Vector:**
Attacker can send extremely large JSON payloads to exhaust server memory (DoS attack).

**Recommendations:**
1. Wrap `r.Body` with `http.MaxBytesReader` before decoding
2. Set reasonable limit (e.g., 1MB for API requests)
3. Apply globally via middleware

**Suggested Fix:**
```go
r.Body = http.MaxBytesReader(w, r.Body, 1<<20) // 1 MB limit
var req analysisJobCreateRequest
if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
    if err.Error() == "http: request body too large" {
        api.Error(w, http.StatusRequestEntityTooLarge, api.ErrCodeInvalidRequest, "request body too large")
        return
    }
    api.Error(w, http.StatusBadRequest, api.ErrCodeInvalidRequest, "invalid JSON body")
    return
}
```

#### MEDIUM: UUID Parsing Errors Leak Internal Details
**Severity:** Medium
**Location:** `analysis.go:49-52`

**Issue:**
Generic error messages don't distinguish between malformed UUIDs and unauthorized access, potentially leaking information about valid UUIDs through timing attacks.

**Recommendation:**
Use constant-time comparison and generic error messages: "invalid or not found"

#### LOW: Missing Input Sanitization for JAR Flags
**Severity:** Low
**Location:** `analysis.go:63-69`

**Issue:**
`JARFlags` struct members are not validated for reasonable ranges (e.g., negative values, excessively large heap sizes).

**Recommendation:**
Add validation for JAR configuration parameters in future iterations.

---

## 4. Injection Prevention

### Files Reviewed
- `/Users/omar/Developer/ARLogAnalyzer-25/backend/internal/storage/clickhouse.go`
- `/Users/omar/Developer/ARLogAnalyzer-25/backend/internal/storage/postgres.go`

### Findings

#### POSITIVE: ClickHouse Parameterized Queries
**Status:** SECURE

**Observation:**
All ClickHouse queries use parameterized binding via `clickhouse.Named()`:

```go
clickhouse.Named("tenantID", tenantID),
clickhouse.Named("jobID", jobID),
```

This effectively prevents SQL injection in ClickHouse queries.

#### POSITIVE: PostgreSQL Parameterized Queries
**Status:** SECURE

**Observation:**
All PostgreSQL queries use `$1, $2, ...` parameter placeholders:

```go
WHERE id = $1 AND tenant_id = $2
```

This is the correct approach and prevents SQL injection.

#### MEDIUM: Dynamic Query Construction in SearchEntries
**Severity:** Medium
**Location:** `clickhouse.go:439-532`

**Issue:**
While the query uses parameterized binding, the WHERE clause is built dynamically with string concatenation:

```go
where := "tenant_id = @tenantID AND job_id = @jobID"
if q.Query != "" {
    where += " AND (raw_text ILIKE @query OR error_message ILIKE @query)"
    namedArgs = append(namedArgs, driver.NamedValue{Name: "query", Value: "%" + q.Query + "%"})
}
```

The `sortCol` parameter uses string matching but allows direct substitution into ORDER BY:

```go
sortCol := "timestamp"
switch q.SortBy {
case "duration_ms", "line_number", "timestamp":
    sortCol = q.SortBy
}
// ...
ORDER BY %s %s
```

**Assessment:**
Current implementation is SAFE because:
1. Parameters are bound via named arguments
2. Sort column uses whitelist validation
3. Sort direction is validated (`ASC` vs `DESC`)

**Recommendation:**
Add defensive comment explaining why this is safe to prevent future regressions.

---

## 5. File Upload Security

### Files Reviewed
- `/Users/omar/Developer/ARLogAnalyzer-25/backend/internal/api/handlers/upload.go`

### Findings

#### POSITIVE: File Size Limit Enforced
**Status:** SECURE

```go
const maxUploadSize = 2 << 30 // 2 GB
r.Body = http.MaxBytesReader(w, r.Body, maxUploadSize)
```

Appropriate limit for log files.

#### POSITIVE: Checksum Validation
**Status:** SECURE

```go
hasher := sha256.New()
countReader := &countingReader{r: io.TeeReader(file, hasher)}
// ...
ChecksumSHA256: fmt.Sprintf("%x", hasher.Sum(nil)),
```

SHA-256 checksums are computed and stored for integrity verification.

#### MEDIUM: Missing MIME Type Validation
**Severity:** Medium
**Location:** `upload.go:80`

**Issue:**
Content-Type from client is trusted without validation:

```go
ContentType: header.Header.Get("Content-Type"),
```

**Attack Vector:**
Malicious files could be uploaded with forged Content-Type headers.

**Recommendations:**
1. Validate Content-Type against whitelist (e.g., `text/plain`, `application/gzip`, `application/x-tar`)
2. Use magic number detection (file signature) to verify actual file type
3. Reject executables and script files

**Suggested Enhancement:**
```go
allowedTypes := map[string]bool{
    "text/plain": true,
    "application/gzip": true,
    "application/x-gzip": true,
    "application/x-tar": true,
    "application/zip": true,
}

contentType := header.Header.Get("Content-Type")
if contentType == "" {
    contentType = "application/octet-stream"
}

if !allowedTypes[contentType] {
    api.Error(w, http.StatusBadRequest, api.ErrCodeInvalidRequest, "unsupported file type")
    return
}
```

#### LOW: Filename Not Sanitized for Path Traversal
**Severity:** Low
**Location:** `upload.go:65`

**Issue:**
While the S3 key is generated server-side (preventing directory traversal), the original filename is stored without sanitization:

```go
Filename: header.Filename,
```

**Attack Vector:**
Filenames like `../../../etc/passwd` or `<script>alert(1)</script>` could be stored in database, potentially causing issues if filename is:
- Displayed in web UI without HTML escaping (XSS)
- Used in filesystem operations (path traversal)

**Recommendation:**
Sanitize filename to remove path separators and HTML metacharacters before storage.

---

## 6. CORS Configuration

### Files Reviewed
- `/Users/omar/Developer/ARLogAnalyzer-25/backend/internal/api/middleware/cors.go`
- `/Users/omar/Developer/ARLogAnalyzer-25/.env.example`

### Findings

#### MEDIUM: Wildcard CORS in Development
**Severity:** Medium
**Location:** `cors.go:16-18`, `.env.example:19`

**Issue:**
The CORS middleware allows wildcard origin `"*"` when configured:

```go
for _, o := range allowedOrigins {
    if o == "*" {
        allowAll = true
    }
    originSet[o] = struct{}{}
}
```

The `.env.example` shows mixed configuration:
```
CORS_ORIGINS=http://localhost:3000,http://localhost:8080
```

**Assessment:**
Current default is SECURE (specific origins listed), but the wildcard capability is dangerous if accidentally used in production.

**Recommendations:**
1. Add explicit check to prevent `"*"` when `APP_ENV=production`
2. Log warning when wildcard is used in development
3. Update documentation to emphasize production security

**Suggested Fix:**
```go
for _, o := range allowedOrigins {
    if o == "*" {
        if os.Getenv("APP_ENV") == "production" {
            slog.Error("wildcard CORS origin not allowed in production")
            continue // skip wildcard in production
        }
        slog.Warn("wildcard CORS origin enabled (development only)")
        allowAll = true
    }
    originSet[o] = struct{}{}
}
```

#### POSITIVE: Credentials Handling
**Status:** SECURE

```go
w.Header().Set("Access-Control-Allow-Credentials", "true")
```

Correctly allows credentials (cookies, auth headers) for authenticated requests.

#### POSITIVE: Preflight Handling
**Status:** SECURE

```go
if r.Method == http.MethodOptions {
    w.WriteHeader(http.StatusNoContent)
    return
}
```

Preflight OPTIONS requests are handled correctly.

---

## 7. Overall Assessment

### Security Architecture Strengths

1. **Defense in Depth:** Multi-layer tenant isolation (JWT claims, middleware context, WHERE clauses, RLS)
2. **Parameterized Queries:** Consistent use of parameter binding prevents most SQL injection
3. **File Upload Controls:** Size limits, checksums, and tenant-scoped storage keys
4. **Authentication Framework:** JWT validation with signature verification and expiration checks

### Security Architecture Weaknesses

1. **Development Bypass Risks:** Unvalidated dev headers pose production deployment risk
2. **SQL Injection in SetTenantContext:** String concatenation creates injection vulnerability
3. **Input Validation Gaps:** Missing request size limits on JSON payloads
4. **Limited Audit Logging:** Security events (auth failures, dev bypass usage) not comprehensively logged

### MVP Appropriateness

The current security posture is **ACCEPTABLE FOR MVP** with the following caveats:

**MUST FIX BEFORE ANY DEPLOYMENT:**
1. SQL injection in `SetTenantContext` (postgres.go)
2. Environment check for dev bypass mode (auth.go)
3. JSON payload size limits (analysis.go and globally)

**SHOULD FIX FOR PRODUCTION:**
1. JWT issuer and audience validation
2. MIME type validation for file uploads
3. CORS wildcard prevention in production
4. Comprehensive security event logging

**NICE TO HAVE (Future Releases):**
1. Token revocation mechanism
2. Rate limiting on authentication endpoints
3. Filename sanitization
4. Migration to RS256/JWKS for JWT validation

---

## 8. Recommendations

### Immediate Actions (Before MVP Deployment)

1. **Fix SQL Injection in SetTenantContext**
   - Priority: CRITICAL
   - Effort: 1 hour
   - Use parameterized query with UUID validation

2. **Add Environment Check to Dev Bypass**
   - Priority: CRITICAL
   - Effort: 30 minutes
   - Prevent dev mode in production environment

3. **Implement JSON Request Size Limits**
   - Priority: HIGH
   - Effort: 2 hours
   - Add global middleware with `MaxBytesReader`

4. **Add UUID Validation to Dev Headers**
   - Priority: HIGH
   - Effort: 30 minutes
   - Prevent injection via malformed IDs

### Short-Term Actions (Next Sprint)

1. **Enhance JWT Validation**
   - Add issuer and audience checks
   - Reduce clock skew to 30 seconds
   - Document migration path to RS256

2. **Implement MIME Type Validation**
   - Whitelist allowed file types
   - Add magic number detection
   - Reject dangerous file types

3. **Add Security Logging**
   - Log all authentication failures
   - Log dev bypass usage
   - Log tenant context switches
   - Send alerts for suspicious patterns

4. **CORS Hardening**
   - Prevent wildcard in production
   - Add origin validation tests
   - Document secure configuration

### Long-Term Actions (Post-MVP)

1. **Token Revocation**
   - Implement Redis-based revocation cache
   - Add logout functionality
   - Support session invalidation

2. **Rate Limiting**
   - Add per-tenant rate limits
   - Implement authentication rate limiting
   - Add DDoS protection

3. **Security Testing**
   - Add automated security scanning (SAST/DAST)
   - Conduct penetration testing
   - Implement security regression tests

4. **Compliance Preparation**
   - Prepare for SOC 2 Type II
   - Document security controls
   - Implement audit logging for compliance

---

## 9. Security Testing Recommendations

### Unit Tests Needed

1. Auth middleware with malicious JWT tokens
2. SQL injection attempts in SetTenantContext
3. Large JSON payload handling
4. File upload with malicious filenames
5. CORS with various origin combinations

### Integration Tests Needed

1. Tenant isolation across multiple tenants
2. JWT expiration and refresh flows
3. File upload end-to-end with checksum validation
4. Search query injection attempts

### Security Scanning

1. **SAST (Static Analysis):**
   - gosec (Go security scanner)
   - semgrep with security rules

2. **DAST (Dynamic Analysis):**
   - OWASP ZAP automated scanning
   - Burp Suite professional assessment

3. **Dependency Scanning:**
   - govulncheck (Go vulnerability database)
   - Dependabot alerts
   - Snyk or similar SCA tool

---

## 10. Compliance Considerations

### Data Protection

- **GDPR:** Tenant isolation supports data controller separation
- **Data Retention:** Plan deletion workflows for log files and analysis results
- **Right to Erasure:** Implement complete tenant data deletion

### Access Control

- **Principle of Least Privilege:** Current implementation supports this via JWT claims
- **Audit Logging:** Needs enhancement for compliance requirements
- **Authentication Records:** Store authentication events for audit trail

### Encryption

- **At Rest:** PostgreSQL/ClickHouse encryption not configured (infrastructure concern)
- **In Transit:** HTTPS required for production (deployment configuration)
- **S3 Storage:** MinIO/S3 server-side encryption should be enabled

---

## Conclusion

The RemedyIQ MVP demonstrates solid security fundamentals with appropriate use of parameterized queries, tenant isolation mechanisms, and file upload controls. However, **THREE CRITICAL ISSUES** must be resolved before any deployment:

1. SQL injection vulnerability in `SetTenantContext`
2. Development bypass lacking production safeguards
3. Missing JSON request size limits

With these fixes, the application achieves an acceptable security posture for MVP deployment. The recommended short-term and long-term improvements will strengthen security as the platform matures toward production-grade hardening.

**Security Approval Status:** CONDITIONAL PASS
**Required Actions:** Fix 3 critical issues documented above
**Re-Review Required:** After critical fixes implemented

---

**Report Generated:** 2026-02-10
**Next Review Scheduled:** Upon completion of critical fixes
