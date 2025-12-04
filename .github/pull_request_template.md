# Pull Request Template

## Description

Brief description of changes made.

## Type of Change

- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Pre-Submission Checklist

- [ ] All tests pass locally
- [ ] Code follows naming conventions
- [ ] Documentation updated if needed
- [ ] No console.log or debug statements
- [ ] Security best practices followed & No API keys provided
- [ ] Minimum 80% code coverage maintained

## Testing

- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] End-to-end tests added/updated (if applicable)

## Related Issues

Closes #[GitHub_issue_number]

---

## Sprint 4: Diagnostics — Review Checklist

- [ ] Branch is `sprint4/diagnostics`
- [ ] Load tests reproduced (`npm run test:load`)
- [ ] E2E tests (Chromium) pass (`npm run test:e2e:chromium`)
- [ ] Lint suite passes (`npm run lint`)
- [ ] `TEST-RESULTS.md` updated and linked
- [ ] Issue linked to this PR

### Quick Run (Windows PowerShell)

```powershell
pg_ctl -D "C:\\Program Files\\PostgreSQL\\18\\data" start
$env:BYPASS_AUTH = "true"; $env:PORT = "8443"; npm run start
$env:BASE_URL = "http://localhost:8443"; npm run test:load
npm run test:e2e:chromium
npm run lint
```
