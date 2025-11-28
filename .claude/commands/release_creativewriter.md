# Public Release Agent

You are a release management agent for CreativeWriter2. Your task is to prepare and trigger a public release.

## Steps to Execute

### Step 1: Fetch Latest Changes
Run the following commands to ensure you have the latest state:
```bash
git fetch origin
```

### Step 2: Analyze Changes Since Last Release
Get all commits between the release branch and main, excluding merge commits:
```bash
git log origin/release..main --oneline --no-merges
```

### Step 3: Generate Release Notes
Parse the commits and categorize them by conventional commit type. Create comprehensive release notes with the following structure:

**Categories to use:**
- **New Features** (`feat:` commits)
- **Bug Fixes** (`fix:` commits)
- **Refactoring** (`refactor:` commits)
- **Performance** (`perf:` commits)
- **Tests** (`test:` commits)
- **Documentation** (`docs:` commits)
- **Chores** (`chore:` commits)
- **Other** (commits that don't follow conventional commit format)

**For each commit:**
- Extract the scope if present (e.g., `feat(beat-ai):` → scope is `beat-ai`)
- Clean up the commit message to be human-readable
- Group related changes together when possible

### Step 4: Write Release Notes
Write the generated release notes to `RELEASE_NOTES.md` in the repository root with this format:

```markdown
# Release Notes

## New Features
- **scope**: Description of the feature
- Description without scope

## Bug Fixes
- **scope**: Description of the fix

## Refactoring
- **scope**: Description of the refactor

## Performance Improvements
- **scope**: Description of the improvement

## Tests
- **scope**: Description of the test changes

## Documentation
- **scope**: Description of the documentation changes

## Maintenance
- **scope**: Description of maintenance/chore changes

---
*Release prepared by Claude Code*
```

Only include categories that have commits. Skip empty categories.

### Step 5: Show Summary and Ask for Confirmation
Display a summary to the user:
1. Total number of commits to be released
2. Breakdown by category
3. The full release notes content

Then use the AskUserQuestion tool to ask:
- "Do you want to proceed with the public release?"
- Options: "Yes, trigger release" / "No, cancel"

### Step 6: Trigger the Release (only if confirmed)
If the user confirms, execute the following:

```bash
# Stage the release notes
git add RELEASE_NOTES.md

# Commit the release notes (if there are changes)
git diff --cached --quiet || git commit -m "docs: update release notes for public release"

# Push to main first (to include release notes)
git push origin main

# Merge main into release
git checkout release
git merge main --no-edit
git push origin release

# Return to main branch
git checkout main
```

After pushing to release, inform the user:
- The GitHub workflow `sync-public.yml` has been triggered
- They can monitor progress at: https://github.com/MarcoDroll/creativewriter2/actions
- The public release will be created automatically with the prepared release notes

### Step 7: Handle Cancellation
If the user cancels:
- Inform them the release was cancelled
- The RELEASE_NOTES.md file has been created but not committed
- They can review/edit it and run `/release` again when ready

## Important Notes
- Always ensure you're on the main branch before starting
- Never force push or use destructive git commands
- If there are no new commits to release, inform the user and exit
- If there are uncommitted changes, warn the user before proceeding
