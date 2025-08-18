#!/bin/bash

# CreativeWriter2 Release Preparation Script
# This script prepares a release by generating release notes and updating version information

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
REPO_ROOT=$(git rev-parse --show-toplevel)
PACKAGE_JSON="$REPO_ROOT/package.json"
CHANGELOG="$REPO_ROOT/CHANGELOG.md"
RELEASE_NOTES="$REPO_ROOT/.claude/release-notes-temp.md"

# Helper functions
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

log_section() {
    echo -e "\n${CYAN}═══════════════════════════════════════════${NC}"
    echo -e "${CYAN}  $1${NC}"
    echo -e "${CYAN}═══════════════════════════════════════${NC}\n"
}

# Get current version from package.json
get_current_version() {
    node -p "require('$PACKAGE_JSON').version" 2>/dev/null || echo "0.0.0"
}

# Get the latest git tag
get_latest_tag() {
    git describe --tags --abbrev=0 2>/dev/null || echo ""
}

# Prompt for new version
prompt_for_version() {
    local current_version=$1
    local suggested_patch suggested_minor suggested_major
    
    # Parse current version
    IFS='.' read -r major minor patch <<< "$current_version"
    
    # Calculate suggestions
    suggested_patch="$major.$minor.$((patch + 1))"
    suggested_minor="$major.$((minor + 1)).0"
    suggested_major="$((major + 1)).0.0"
    
    echo -e "${YELLOW}Current version: $current_version${NC}"
    echo "Suggested versions:"
    echo "  1) Patch: $suggested_patch (bug fixes)"
    echo "  2) Minor: $suggested_minor (new features)"
    echo "  3) Major: $suggested_major (breaking changes)"
    echo "  4) Custom version"
    
    read -p "Select option (1-4): " option
    
    case $option in
        1) echo "$suggested_patch" ;;
        2) echo "$suggested_minor" ;;
        3) echo "$suggested_major" ;;
        4) 
            read -p "Enter custom version: " custom_version
            echo "$custom_version"
            ;;
        *) 
            log_error "Invalid option"
            exit 1
            ;;
    esac
}

# Generate release notes from git commits
generate_release_notes() {
    local from_tag=$1
    local to_ref=${2:-HEAD}
    local version=$3
    local output_file=$4
    
    log_info "Generating release notes from $from_tag to $to_ref..."
    
    # Get commit count
    local commit_count=$(git rev-list --count ${from_tag}..${to_ref})
    
    # Start release notes
    cat > "$output_file" << EOF
# Release v${version}

**Date:** $(date '+%Y-%m-%d')  
**Commits since last release:** ${commit_count}

## Highlights

EOF
    
    # Extract key highlights (manual selection of important features)
    local highlights=$(git log ${from_tag}..${to_ref} --pretty=format:"%s" | grep -E "^(feat|fix):" | head -5)
    if [ -n "$highlights" ]; then
        echo "$highlights" | while IFS= read -r line; do
            echo "- $line" >> "$output_file"
        done
    fi
    
    echo "" >> "$output_file"
    
    # Features
    local features=$(git log ${from_tag}..${to_ref} --pretty=format:"%h %s" | grep -E "^[a-f0-9]+ feat:" || true)
    if [ -n "$features" ]; then
        echo "## 🚀 New Features" >> "$output_file"
        echo "" >> "$output_file"
        echo "$features" | while IFS= read -r line; do
            commit_hash=$(echo "$line" | cut -d' ' -f1)
            commit_msg=$(echo "$line" | cut -d' ' -f2-)
            # Remove feat: prefix and format
            formatted_msg=$(echo "$commit_msg" | sed 's/^feat: //')
            echo "- $formatted_msg (\`$commit_hash\`)" >> "$output_file"
        done
        echo "" >> "$output_file"
    fi
    
    # Bug Fixes
    local fixes=$(git log ${from_tag}..${to_ref} --pretty=format:"%h %s" | grep -E "^[a-f0-9]+ fix:" || true)
    if [ -n "$fixes" ]; then
        echo "## 🐛 Bug Fixes" >> "$output_file"
        echo "" >> "$output_file"
        echo "$fixes" | while IFS= read -r line; do
            commit_hash=$(echo "$line" | cut -d' ' -f1)
            commit_msg=$(echo "$line" | cut -d' ' -f2-)
            # Remove fix: prefix and format
            formatted_msg=$(echo "$commit_msg" | sed 's/^fix: //')
            echo "- $formatted_msg (\`$commit_hash\`)" >> "$output_file"
        done
        echo "" >> "$output_file"
    fi
    
    # Documentation
    local docs=$(git log ${from_tag}..${to_ref} --pretty=format:"%h %s" | grep -E "^[a-f0-9]+ docs:" || true)
    if [ -n "$docs" ]; then
        echo "## 📚 Documentation" >> "$output_file"
        echo "" >> "$output_file"
        echo "$docs" | while IFS= read -r line; do
            commit_hash=$(echo "$line" | cut -d' ' -f1)
            commit_msg=$(echo "$line" | cut -d' ' -f2-)
            # Remove docs: prefix and format
            formatted_msg=$(echo "$commit_msg" | sed 's/^docs: //')
            echo "- $formatted_msg (\`$commit_hash\`)" >> "$output_file"
        done
        echo "" >> "$output_file"
    fi
    
    # Refactoring
    local refactors=$(git log ${from_tag}..${to_ref} --pretty=format:"%h %s" | grep -E "^[a-f0-9]+ refactor:" || true)
    if [ -n "$refactors" ]; then
        echo "## ♻️ Refactoring" >> "$output_file"
        echo "" >> "$output_file"
        echo "$refactors" | while IFS= read -r line; do
            commit_hash=$(echo "$line" | cut -d' ' -f1)
            commit_msg=$(echo "$line" | cut -d' ' -f2-)
            # Remove refactor: prefix and format
            formatted_msg=$(echo "$commit_msg" | sed 's/^refactor: //')
            echo "- $formatted_msg (\`$commit_hash\`)" >> "$output_file"
        done
        echo "" >> "$output_file"
    fi
    
    # Other Changes
    local others=$(git log ${from_tag}..${to_ref} --pretty=format:"%h %s" | grep -vE "^[a-f0-9]+ (feat|fix|docs|refactor|chore|test|style|perf):" | head -20 || true)
    if [ -n "$others" ]; then
        echo "## 🔧 Other Changes" >> "$output_file"
        echo "" >> "$output_file"
        echo "$others" | while IFS= read -r line; do
            if [ -n "$line" ]; then
                commit_hash=$(echo "$line" | cut -d' ' -f1)
                commit_msg=$(echo "$line" | cut -d' ' -f2-)
                echo "- $commit_msg (\`$commit_hash\`)" >> "$output_file"
            fi
        done
        echo "" >> "$output_file"
    fi
    
    # Contributors
    echo "## 👥 Contributors" >> "$output_file"
    echo "" >> "$output_file"
    git log ${from_tag}..${to_ref} --pretty=format:"%an" | sort -u | while IFS= read -r author; do
        echo "- $author" >> "$output_file"
    done
    echo "" >> "$output_file"
    
    # Full Changelog link
    echo "## Full Changelog" >> "$output_file"
    echo "" >> "$output_file"
    if [ -n "$from_tag" ]; then
        echo "View all changes: [\`${from_tag}...v${version}\`](https://github.com/MarcoDroll/creativewriter2/compare/${from_tag}...v${version})" >> "$output_file"
    else
        echo "This is the first release!" >> "$output_file"
    fi
    
    log_success "Release notes generated successfully!"
}

# Update CHANGELOG.md
update_changelog() {
    local version=$1
    local release_notes=$2
    
    log_info "Updating CHANGELOG.md..."
    
    # Create backup
    if [ -f "$CHANGELOG" ]; then
        cp "$CHANGELOG" "${CHANGELOG}.backup"
    fi
    
    # Create new changelog with release notes at the top
    {
        echo "# Changelog"
        echo ""
        echo "All notable changes to CreativeWriter2 will be documented in this file."
        echo ""
        echo "The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),"
        echo "and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html)."
        echo ""
        echo "---"
        echo ""
        cat "$release_notes"
        echo ""
        echo "---"
        echo ""
        
        # Append existing changelog content (skip header if exists)
        if [ -f "${CHANGELOG}.backup" ]; then
            # Skip the header and first release if it exists
            tail -n +8 "${CHANGELOG}.backup" 2>/dev/null || cat "${CHANGELOG}.backup"
        fi
    } > "$CHANGELOG"
    
    log_success "CHANGELOG.md updated!"
}

# Update package.json version
update_package_version() {
    local new_version=$1
    
    log_info "Updating package.json version to $new_version..."
    
    # Use Node.js to update package.json properly
    node -e "
    const fs = require('fs');
    const pkg = require('$PACKAGE_JSON');
    pkg.version = '$new_version';
    fs.writeFileSync('$PACKAGE_JSON', JSON.stringify(pkg, null, 2) + '\\n');
    "
    
    log_success "package.json updated to version $new_version!"
}

# Create release summary for PR/merge
create_release_summary() {
    local version=$1
    local release_notes=$2
    local summary_file="$REPO_ROOT/.claude/RELEASE_SUMMARY.md"
    
    log_info "Creating release summary..."
    
    cat > "$summary_file" << EOF
# Release v${version} Summary

This release has been automatically prepared with comprehensive release notes.

## Pre-Release Checklist
- [x] Version updated in package.json
- [x] CHANGELOG.md updated
- [x] Release notes generated
- [x] Commits analyzed and categorized
- [ ] Tests passed
- [ ] Build successful
- [ ] Linting passed

## Quick Stats
- **Version:** ${version}
- **Date:** $(date '+%Y-%m-%d')
- **Commits:** $(git rev-list --count ${from_tag}..HEAD)
- **Contributors:** $(git log ${from_tag}..HEAD --pretty=format:"%an" | sort -u | wc -l)

## Next Steps
1. Review the generated release notes in CHANGELOG.md
2. Run tests: \`npm test\`
3. Build: \`npm run build\`
4. Lint: \`npm run lint\`
5. Commit these changes
6. Merge to release branch
7. The automated workflow will sync to public repository
8. A GitHub release will be created automatically

## Files Modified
- package.json (version bump)
- CHANGELOG.md (release notes)
- .claude/RELEASE_SUMMARY.md (this file)

---

*Release prepared on $(date) by prepare-release.sh*
EOF
    
    log_success "Release summary created at $summary_file"
}

# Main execution
main() {
    log_section "CreativeWriter2 Release Preparation"
    
    # Check if we're in a git repository
    if ! git rev-parse --git-dir > /dev/null 2>&1; then
        log_error "Not in a git repository!"
        exit 1
    fi
    
    # Get current version and latest tag
    current_version=$(get_current_version)
    latest_tag=$(get_latest_tag)
    from_tag=${latest_tag:-$(git rev-list --max-parents=0 HEAD)}
    
    log_info "Current version: $current_version"
    log_info "Latest tag: ${latest_tag:-none}"
    
    # Check for uncommitted changes
    if [ -n "$(git status --porcelain)" ]; then
        log_warning "You have uncommitted changes."
        read -p "Continue anyway? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            log_info "Release preparation cancelled"
            exit 0
        fi
    fi
    
    # Prompt for new version
    echo ""
    new_version=$(prompt_for_version "$current_version")
    
    if [ -z "$new_version" ]; then
        log_error "No version specified"
        exit 1
    fi
    
    log_section "Preparing Release v${new_version}"
    
    # Generate release notes
    generate_release_notes "$from_tag" "HEAD" "$new_version" "$RELEASE_NOTES"
    
    # Show preview
    echo ""
    log_section "Release Notes Preview"
    head -30 "$RELEASE_NOTES"
    echo "..."
    echo ""
    
    read -p "Continue with release preparation? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_info "Release preparation cancelled"
        rm -f "$RELEASE_NOTES"
        exit 0
    fi
    
    # Update files
    update_package_version "$new_version"
    update_changelog "$new_version" "$RELEASE_NOTES"
    create_release_summary "$new_version" "$RELEASE_NOTES"
    
    # Clean up temp file
    rm -f "$RELEASE_NOTES"
    
    log_section "Release Preparation Complete!"
    
    echo -e "${GREEN}✨ Release v${new_version} has been prepared!${NC}"
    echo ""
    echo "Next steps:"
    echo "1. Review CHANGELOG.md for accuracy"
    echo "2. Run tests: npm test"
    echo "3. Build: npm run build"
    echo "4. Lint: npm run lint"
    echo "5. Commit changes:"
    echo "   git add -A"
    echo "   git commit -m \"chore: prepare release v${new_version}\""
    echo "6. Create and push tag:"
    echo "   git tag v${new_version}"
    echo "   git push origin main --tags"
    echo "7. Merge to release branch to trigger public sync"
    echo ""
    echo "Files updated:"
    echo "  - package.json (version: ${new_version})"
    echo "  - CHANGELOG.md (release notes added)"
    echo "  - .claude/RELEASE_SUMMARY.md (summary created)"
}

# Run main function
main "$@"