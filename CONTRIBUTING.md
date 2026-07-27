# Contributing to CodeLens

First off, thank you for considering contributing to CodeLens. By participating in this project, you are helping build an unapologetically honest engineering tool.

## 1. Branching Strategy
We adhere to strict branch naming conventions:
- `feat/feature-name` (for new UI modules, backend routes, algorithms)
- `fix/bug-description` (for hotfixes and CSS corrections)
- `chore/task-name` (for documentation, dependency updates, and tooling)

## 2. Code Standards

### The Frontend Rulebook
1. **Strict Brutalism:** No rounded corners (`rounded-none` implicitly or explicitly). Colors are restricted to pure `black` and `white`, plus grayscale for disabled elements.
2. **Generous Whitespace:** Utilize extremely large padding (`py-20`, `py-32`) to allow typography to breathe.
3. **Massive Typography:** Headers should scale dramatically (`text-5xl` to `text-9xl`). Use `font-black` and `uppercase tracking-widest` heavily.

### The Backend Rulebook
1. **ES Modules Only:** `require()` is strictly forbidden. Use `import` and `export` everywhere. Ensure all local imports contain the `.js` extension (e.g., `import db from './config/db.js'`).
2. **Modular Architecture:** Do not dump logic into monolithic files. Controllers parse the request, Services execute business/AI logic, and the Database layer handles queries.
3. **AI Determinism:** When modifying the Gemini API interfaces, strictly enforce prompt engineering that demands deterministic JSON structures (no markdown wrappers).

## 3. Pull Request Submission
1. Ensure your code satisfies `npm run lint` if applicable.
2. If modifying UI, test on both desktop `lg` views and mobile viewports (`flex-col` scaling).
3. Draft a thorough PR description mapping your solution to the original GitHub issue.
4. Request review from a core maintainer.

## 4. Surviving the CI/CD Pipeline (How to Avoid PR Failures)
CodeLens uses strict automated checks to ensure top-tier quality, security, and performance. Before opening a PR, follow this checklist to guarantee a "green" build:

### 1. The Pre-Push Checklist (Quality & Tests)
Before you type `git commit`, always run:
- `npm run lint` (in both `frontend` and `server` if you modified both). Fix any warnings or errors.
- `npm test` (if applicable). Make sure no unit tests are broken.
- **Coverage:** If you add a new feature, try to add a test. Significant drops in code coverage (Codecov) will flag your PR.

### 2. Conventional Commits (Semantic Versioning)
We use automated Semantic Versioning. You **must** prefix your commits and PR titles so our bots know how to generate the Changelog:
- `feat: [message]` (For new features)
- `fix: [message]` (For bug fixes)
- `docs:`, `chore:`, `refactor:`, `test:`, or `style:` (For other updates)
- *Example:* `feat: add CodeChef integration`

### 3. Playwright E2E Tests (UI & API Contracts)
If you change the text of a core button (e.g., changing "LOGIN" to "SIGN IN") or alter a route, the End-to-End browser bots might fail to find the element.
- If you modify core UI, run the Playwright tests locally or check the `tests/` directory to update the selectors to match your new UI.

### 4. Lighthouse Performance & SEO
Google Lighthouse audits every PR. We enforce a strict **70% minimum score**.
- **Images:** Compress images before committing. Do not upload massive assets.
- **Performance:** Avoid heavy, blocking JavaScript loops on the main thread.
- **Accessibility:** Ensure buttons have text or aria-labels, and contrast is high.

### 5. CodeQL Security
- Never hardcode API keys, secrets, or passwords.
- Always sanitize user inputs on the backend to avoid NoSQL injection.

## 5. Issues & Feedback
If you locate a bug, please check the existing issue tracker before creating a duplicate. For new features, open a discussion thread outlining the architectural approach before submitting large PRs.
