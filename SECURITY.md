# Security Audit Report - V2_Murabha Application

**Date:** April 14, 2026  
**Application Type:** Electron + React + Node.js (Desktop App)  
**Audit Scope:** Full codebase including frontend, backend, and Electron main process

---

## Executive Summary

| Category | Count | Severity |
|----------|-------|----------|
| CRITICAL | 1 | Immediate action required |
| HIGH | 2 | Strong remediation recommended |
| MEDIUM | 4 | Should be addressed |
| LOW | 3 | Minor improvements |
| INFO | 2 | Informational |

**Overall Risk Level:** HIGH

---

## Findings

### 1. CRITICAL: No Authentication/Authorization System

**Location:** Backend entire application (`backend/src/`)

**Description:** The application has NO authentication, authorization, session management, or JWT implementation. All API endpoints are publicly accessible without any access control.

**Evidence:**
- No JWT, sessions, cookies, or tokens found anywhere in backend
- No middleware for authentication checking
- All routes (`/api/customers`, `/api/sales`, `/api/payments`, `/api/backup`, etc.) are fully open
- Backup endpoints allow full database export/import without authentication

**Impact:** 
- Any user with network access can read, modify, or delete all data
- Complete database compromise possible
- Full backup export/import available to anyone
- Customer financial data (payments, installments) completely exposed

**Recommendation:** Implement authentication immediately:
- Add JWT-based authentication
- Create login/logout endpoints
- Add middleware to protect all routes
- Consider role-based access control (admin vs. collector)

---

### 2. HIGH: Database Backup Without Authentication

**Location:** `backend/src/routes/backup.ts`

**Description:** The backup routes allow complete database export and import without any authentication. This includes:
- `/api/backup/export` - Downloads entire SQLite database
- `/api/backup/import` - Overwrites database with uploaded file
- `/api/backup/auto` - Creates automatic backups
- `/api/backup/list` - Lists all backup files

**Evidence:**
```typescript
router.post('/import', upload.single('file'), async (req: Request, res: Response) => {
  // No auth check - anyone can upload database files
  const fileBuffer = req.file.buffer;
  fs.writeFileSync(finalPath, fileBuffer);
});
```

**Impact:**
- Complete data exfiltration via database download
- Database corruption or replacement via malicious file upload
- Full customer and financial data exposure

**Recommendation:** 
- Add authentication to all backup endpoints
- Add file type validation for imported backups
- Add audit logging for backup operations
- Consider encryption for backup files

---

### 3. HIGH: Path Traversal Risk in Backup Import

**Location:** `backend/src/routes/backup.ts`, lines 9-50

**Description:** While path traversal is partially mitigated by using fixed paths, the backup import feature uses user-controlled filename for backup creation and reads from potentially user-controlled paths.

**Code:**
```typescript
const DB_PATH = path.join(process.cwd(), 'prisma', 'dev.db');
const BACKUP_DIR = path.join(process.cwd(), 'backups');
```

**Current Status:** LOW RISK - Uses fixed paths, but lacks:
- File type validation on uploaded files
- File size limits
- Content validation for uploaded database

**Recommendation:**
- Add MIME type validation for uploads
- Implement file size limits (e.g., max 50MB)
- Add file content validation (check SQLite magic bytes)

---

### 4. MEDIUM: Unvalidated Query Parameters in Reports

**Location:** `backend/src/routes/reports.ts`

**Description:** Query parameters are passed directly to Date constructor without validation. Invalid dates could cause unexpected errors or behavior.

**Code:**
```typescript
router.get('/sales', async (req: Request, res: Response, next: NextFunction) => {
  const { startDate, endDate } = req.query;
  const result = await reportService.salesReport(
    startDate ? new Date(startDate as string) : undefined,
    endDate ? new Date(endDate as string) : undefined
  );
});
```

**Impact:**
- Invalid date strings create "Invalid Date" objects
- Could cause unexpected SQL behavior
- Potential denial of service via malformed dates

**Recommendation:** Add date validation:
```typescript
const startDateParam = req.query.startDate as string;
if (startDateParam && isNaN(Date.parse(startDateParam))) {
  return res.status(400).json({ error: 'Invalid startDate format' });
}
```

---

### 5. MEDIUM: CORS Configuration Allows All Origins

**Location:** `backend/src/index.ts`, lines 27-35

**Description:** CORS is configured to allow all origins (callback always returns `true`), which is more permissive than intended.

**Code:**
```typescript
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(null, true);  // BUG: Should reject unknown origins
    }
  },
}));
```

**Impact:**
- Any website can make requests to the API
- Enables CSRF attacks
- Expands attack surface unnecessarily

**Recommendation:** Fix the callback:
```typescript
else {
  callback(new Error('Not allowed by CORS'), false);
}
```

---

### 6. MEDIUM: No Input Rate Limiting on Critical Endpoints

**Location:** `backend/src/index.ts`, lines 38-43

**Description:** Rate limiting is applied globally (500 requests/15min) but backup endpoints are not separately rate-limited, and no per-user limits exist.

**Code:**
```typescript
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  message: { error: 'طلب كثير، حاول مرة أخرى بعد قليل' },
});
app.use('/api', limiter);
```

**Impact:**
- Single IP can trigger many operations
- Brute force attacks on authentication (if added later) would be easier
- DoS via repeated requests

**Recommendation:** 
- Add stricter rate limits on sensitive endpoints (backup, import)
- Add per-user rate limiting once auth is implemented
- Consider IP-based blocking after repeated failures

---

### 7. MEDIUM: Potential XSS via document.write in Frontend

**Location:** `frontend/src/pages/Reports.tsx:534`, `SaleDetail.tsx:84`, `Payments.tsx:51`

**Description:** Uses `document.write()` to render HTML content in new windows for printing. While using internal HTML templates, this pattern can be risky if user data is injected.

**Code:**
```typescript
printWindow.document.write(html);
```

**Current Status:** LOW RISK - Templates appear to be internal strings, not user-controlled. However, potential exists if template data sources change.

**Recommendation:** 
- Replace with `DOMParser` and proper DOM manipulation
- Or use `innerHTML` with sanitization (e.g., DOMPurify) if dynamic content needed

---

### 8. LOW: Express Error Handler Exposes Stack Traces

**Location:** `backend/src/index.ts`, lines 121-125

**Description:** Error handler exposes stack traces in development mode.

**Code:**
```typescript
details: process.env.NODE_ENV === 'development' ? err.stack : undefined
```

**Status:** ACCEPTABLE - Only shows in development, but ensure `NODE_ENV=production` in production.

---

### 9. LOW: No HTTPS Enforcement

**Location:** `backend/src/index.ts`

**Description:** Server runs over plain HTTP with no redirect to HTTPS or HSTS headers.

**Recommendation:** 
- Add HTTPS support
- Configure helmet to include HSTS
- Use TLS in production

---

### 10. LOW: Prisma Type Safety Cast

**Location:** `backend/src/routes/customers.ts:14`

**Description:** Uses `as any` to cast validated data, bypassing TypeScript safety.

**Code:**
```typescript
return result.data as any;
```

**Impact:** Minor - Zod validation is done but casting removes TypeScript safety.

---

### 11. INFO: Good Security Practices Found

The following positive security measures were identified:

1. **Electron Security Configuration** - GOOD
   - `contextIsolation: true` - Properly isolates renderer from Node.js
   - `nodeIntegration: false` - Prevents renderer process access to Node APIs
   - Uses preload script for IPC

2. **Zod Schema Validation** - GOOD
   - All POST/PUT endpoints use Zod schemas
   - Proper input validation with type checking
   - String length limits enforced

3. **Prisma ORM** - GOOD
   - Uses parameterized queries (not raw SQL)
   - SQL injection resistant by default

4. **Helmet.js** - GOOD
   - Security headers enabled

5. **Rate Limiting** - GOOD
   - Global rate limiting implemented

6. **No Dangerous React Patterns** - GOOD
   - No `dangerouslySetInnerHTML` found in custom code
   - No `innerHTML` assignments in React components

---

## Dependency Vulnerabilities

### Checked Dependencies

| Package | Version | Known CVEs |
|---------|---------|------------|
| express | ^4.21.1 | None critical |
| @prisma/client | ^5.22.0 | None critical |
| axios | ^1.7.7 | None critical |
| react | ^18.3.1 | None critical |
| electron | ^33.2.0 | Check electron-releases |

**Recommendation:** Run `npm audit` and `npm audit fix` regularly to check for new vulnerabilities.

---

## Remediation Priority

| Priority | Issue | Effort |
|----------|-------|--------|
| P1 | Implement Authentication | Medium |
| P2 | Add Auth to Backup Endpoints | Low |
| P3 | Fix CORS Configuration | Low |
| P4 | Add Date Validation in Reports | Low |
| P5 | Add File Validation for Backup Import | Low |
| P6 | Replace document.write | Medium |

---

## Conclusion

This application requires **immediate security work** before any production deployment. The most critical issue is the complete lack of authentication, which exposes all customer and financial data. The backup functionality without authentication compounds this risk significantly.

**Recommended Next Steps:**
1. Implement JWT-based authentication system
2. Protect all API routes with auth middleware
3. Fix CORS configuration
4. Add input validation for query parameters
5. Conduct penetration testing after auth implementation