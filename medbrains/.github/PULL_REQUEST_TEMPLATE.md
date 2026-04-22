## Summary

<!-- Brief description of what this PR does -->

## Type of Change

- [ ] Bug fix (non-breaking change that fixes an issue)
- [ ] New feature (non-breaking change that adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Refactoring (no functional changes)
- [ ] Documentation update
- [ ] Infrastructure/CI change

## Module(s) Affected

<!-- Check all that apply -->
- [ ] Backend (Rust/Axum)
- [ ] Frontend (React/Mantine)
- [ ] Mobile (React Native)
- [ ] TV Display
- [ ] Database/Migrations
- [ ] Shared Packages (@medbrains/*)
- [ ] CI/CD

## Checklist

### Code Quality
- [ ] My code follows the project's coding standards
- [ ] I have run `cargo clippy` with no warnings
- [ ] I have run `pnpm typecheck` with no errors
- [ ] I have run `pnpm lint` with no errors

### Testing
- [ ] I have added tests that prove my fix/feature works
- [ ] New and existing tests pass locally
- [ ] I have tested the changes manually

### API Contract (if applicable)
- [ ] I have run `make check-api` to verify API contract
- [ ] Every new API method has a corresponding backend route
- [ ] Every new route has a corresponding frontend API method

### Security (if applicable)
- [ ] Input validation is present on all new endpoints
- [ ] No sensitive data is logged
- [ ] Proper authentication/authorization checks are in place
- [ ] No SQL injection vulnerabilities introduced

### Documentation
- [ ] I have updated the README if needed
- [ ] I have added JSDoc/rustdoc comments for new public APIs

## Screenshots (if UI changes)

<!-- Add screenshots or screen recordings here -->

## Test Plan

<!-- How can reviewers test this change? -->

1.
2.
3.

## Related Issues

<!-- Link to related issues: Fixes #123, Relates to #456 -->
