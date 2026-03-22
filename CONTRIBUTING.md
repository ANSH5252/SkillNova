# Contributing to SkillNova 🚀

First off, thank you for considering contributing to SkillNova! It's people like you that make the Git Nova Coders community thrive. 

## 🔄 Engineering Standards & Workflow

To maintain a clean, readable, and professional codebase, we strictly adhere to the following Git conventions.

### 🌿 1. Branch Naming Strategy
Never push directly to `dev` or `main`. Always create a branch off of `dev`. Prefix your branch name to categorize the context of your work:

* **`frontend/...`** : UI components, styling, and client-side logic. *(e.g., `frontend/student-dashboard`)*
* **`backend/...`** : APIs, AI integration, server-side routing. *(e.g., `backend/groq-evaluator`)*
* **`database/...`** : Database configuration, schema updates. *(e.g., `database/ats-scans-collection`)*
* **`bugfix/...`** : Urgent fixes for broken features. *(e.g., `bugfix/pdf-clipping`)*
* **`docs/`** or **`chore/...`** : Housekeeping, configs, or README updates.

### 💬 2. Conventional Commits (with Emojis)
We use emojis and standard prefixes to make our Git history scannable and beautiful. You MUST use one of these prefixes for your commits:

* ✨ `feat:` A new feature
* 🐛 `fix:` A bug fix
* 📄 `docs:` Documentation changes
* ♻️ `refactor:` Code changes that neither fix a bug nor add a feature
* 🚀 `deploy:` Deployment or configuration changes

### 🚀 3. Pull Request Process
1. Ensure your code follows the branch and commit standards above.
2. Push your branch to GitHub and open a Pull Request against the `dev` branch.
3. Fill out the Pull Request template completely.
4. Wait for a code review from a core Git Nova Coders maintainer.
