---
name: "Sprint 4: Diagnostics — Load & E2E Testing"
about: "Track and review load testing + E2E deliverables"
title: "Sprint 4: Diagnostics — Load & E2E Testing"
labels: ["testing", "diagnostics"]
assignees: []
---

## Summary

Document and review the Sprint 4 diagnostics work: load testing (Autocannon), E2E testing (Playwright), server/DB stability, and lint compliance.

## How to Run (Windows PowerShell)

```powershell
# 1) Start PostgreSQL
pg_ctl -D "C:\Program Files\PostgreSQL\18\data" start

# 2) Start server on 8443 with test auth bypass
$env:BYPASS_AUTH = "true"; $env:PORT = "8443"; npm run start

# 3) Load tests (new terminal)
$env:BASE_URL = "http://localhost:8443"; npm run test:load

# 4) E2E tests (Chromium-only)
npm run test:e2e:chromium

# 5) Lint suite
npm run lint
```

## Results Highlights

- Load tests: 100% success across scenarios; ~200k+ requests
- E2E tests: 46/46 passing on Chromium
- Lint: ESLint/Stylelint/HTMLHint/Markdownlint passing
- DB: 168 users seeded; connections stable
- Server: Stable under spike traffic; no crashes

## Links

- `docs/TESTING-QUICKSTART.md`
- `docs/TESTING-SUMMARY.md`
- `docs/TESTING-DEMO-CHECKLIST.md`
- `TEST-RESULTS.md`

## Checklist

- [ ] Load tests reproduced locally
- [ ] E2E suite reproduced locally (Chromium)
- [ ] Lint suite passing
- [ ] Auth bypass disabled before production deploy
- [ ] PR linked to this Issue
