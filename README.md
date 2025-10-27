# Conductor-App
Final project for CSE 210.

## CI Pipeline

This project includes automated CI validation through GitHub Actions that runs on all pull requests and pushes:

- **Linting**: JavaScript (ESLint), CSS (Stylelint), and HTML (HTMLHint) validation
- **Testing**: Automated test execution
- **Documentation**: JSDoc generation
- **PR Title Validation**: Ensures commit message conventions using commitlint
- **Slack Notifications**: Automated status updates to team channel

The pipeline ensures code quality and consistency across all contributions.
