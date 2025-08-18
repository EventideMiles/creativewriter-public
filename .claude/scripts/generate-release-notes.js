#!/usr/bin/env node

/**
 * Release Notes Generator for CreativeWriter2
 * This script generates formatted release notes from git commit history
 * Can be used standalone or integrated with CI/CD pipelines
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Configuration
const CONFIG = {
  commitTypes: {
    feat: { emoji: '🚀', title: 'New Features', priority: 1 },
    fix: { emoji: '🐛', title: 'Bug Fixes', priority: 2 },
    perf: { emoji: '⚡', title: 'Performance Improvements', priority: 3 },
    refactor: { emoji: '♻️', title: 'Code Refactoring', priority: 4 },
    docs: { emoji: '📚', title: 'Documentation', priority: 5 },
    style: { emoji: '💅', title: 'Styling', priority: 6 },
    test: { emoji: '🧪', title: 'Tests', priority: 7 },
    chore: { emoji: '🔧', title: 'Maintenance', priority: 8 },
    ci: { emoji: '👷', title: 'CI/CD', priority: 9 }
  },
  breakingChangeIndicators: ['BREAKING CHANGE:', 'BREAKING:', '!:'],
  maxCommitsPerSection: 50,
  highlightCount: 5
};

class ReleaseNotesGenerator {
  constructor(fromRef, toRef = 'HEAD', version = null) {
    this.fromRef = fromRef;
    this.toRef = toRef;
    this.version = version || this.getPackageVersion();
    this.commits = [];
    this.breakingChanges = [];
  }

  getPackageVersion() {
    try {
      const packageJson = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8'));
      return packageJson.version;
    } catch (error) {
      return 'unreleased';
    }
  }

  parseCommits() {
    try {
      // Get commit data in a structured format
      const format = '%H|%h|%an|%ae|%ad|%s|%b|%D';
      const log = execSync(
        `git log ${this.fromRef}..${this.toRef} --pretty=format:"${format}" --date=short`,
        { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 }
      );

      const lines = log.trim().split('\n').filter(line => line);
      
      if (lines.length === 0 || (lines.length === 1 && lines[0] === '')) {
        this.commits = [];
        return this.commits;
      }
      
      this.commits = lines.map(line => {
        const parts = line.split('|');
        if (parts.length < 6) {
          return null;
        }
        const [hash, shortHash, author, email, date, subject, body = '', refs = ''] = parts;
        
        // Parse commit type and scope
        const typeMatch = subject.match(/^(\w+)(\(([^)]+)\))?(!)?:\s*(.+)/);
        let type = 'other';
        let scope = null;
        let breaking = false;
        let description = subject;

        if (typeMatch) {
          type = typeMatch[1];
          scope = typeMatch[3] || null;
          breaking = !!typeMatch[4];
          description = typeMatch[5];
        }

        // Check for breaking changes in body
        const hasBreakingInBody = CONFIG.breakingChangeIndicators.some(indicator => 
          body.includes(indicator)
        );

        if (breaking || hasBreakingInBody) {
          this.breakingChanges.push({
            shortHash,
            description,
            body: body.trim()
          });
        }

        return {
          hash,
          shortHash,
          author,
          email,
          date,
          type,
          scope,
          breaking: breaking || hasBreakingInBody,
          description,
          body: body.trim(),
          refs: refs.trim()
        };
      }).filter(commit => commit !== null);

      return this.commits;
    } catch (error) {
      console.error('Error parsing commits:', error.message);
      return [];
    }
  }

  groupCommitsByType() {
    const grouped = {};
    
    this.commits.forEach(commit => {
      const type = commit.type;
      if (!grouped[type]) {
        grouped[type] = [];
      }
      grouped[type].push(commit);
    });

    return grouped;
  }

  generateHighlights() {
    const highlights = [];
    
    // Get most important features
    const features = this.commits
      .filter(c => c.type === 'feat')
      .slice(0, 3)
      .map(c => c.description);
    
    // Get critical fixes
    const fixes = this.commits
      .filter(c => c.type === 'fix' && (c.breaking || c.description.toLowerCase().includes('critical')))
      .slice(0, 2)
      .map(c => c.description);

    return [...features, ...fixes].slice(0, CONFIG.highlightCount);
  }

  generateMarkdown() {
    const grouped = this.groupCommitsByType();
    const highlights = this.generateHighlights();
    const stats = this.generateStats();
    
    let markdown = `# Release v${this.version}\n\n`;
    markdown += `**Date:** ${new Date().toISOString().split('T')[0]}\n`;
    markdown += `**Commits:** ${this.commits.length}\n`;
    markdown += `**Contributors:** ${stats.contributors}\n\n`;

    // Breaking Changes
    if (this.breakingChanges.length > 0) {
      markdown += `## ⚠️ BREAKING CHANGES\n\n`;
      this.breakingChanges.forEach(change => {
        markdown += `- ${change.description} (\`${change.shortHash}\`)\n`;
        if (change.body) {
          const breakingDetails = this.extractBreakingDetails(change.body);
          if (breakingDetails) {
            markdown += `  ${breakingDetails}\n`;
          }
        }
      });
      markdown += '\n';
    }

    // Highlights
    if (highlights.length > 0) {
      markdown += `## ✨ Highlights\n\n`;
      highlights.forEach(highlight => {
        markdown += `- ${highlight}\n`;
      });
      markdown += '\n';
    }

    // Detailed sections by type
    Object.entries(CONFIG.commitTypes)
      .sort((a, b) => a[1].priority - b[1].priority)
      .forEach(([type, config]) => {
        if (grouped[type] && grouped[type].length > 0) {
          markdown += `## ${config.emoji} ${config.title}\n\n`;
          
          // Group by scope if applicable
          const byScope = this.groupByScope(grouped[type]);
          
          Object.entries(byScope).forEach(([scope, commits]) => {
            if (scope !== 'null') {
              markdown += `### ${scope}\n\n`;
            }
            
            commits.slice(0, CONFIG.maxCommitsPerSection).forEach(commit => {
              markdown += `- ${commit.description} (\`${commit.shortHash}\`)\n`;
            });
            
            if (commits.length > CONFIG.maxCommitsPerSection) {
              markdown += `- ...and ${commits.length - CONFIG.maxCommitsPerSection} more\n`;
            }
            
            markdown += '\n';
          });
        }
      });

    // Other changes
    if (grouped.other && grouped.other.length > 0) {
      markdown += `## 🔄 Other Changes\n\n`;
      grouped.other.slice(0, 20).forEach(commit => {
        markdown += `- ${commit.description} (\`${commit.shortHash}\`)\n`;
      });
      if (grouped.other.length > 20) {
        markdown += `- ...and ${grouped.other.length - 20} more\n`;
      }
      markdown += '\n';
    }

    // Statistics
    markdown += `## 📊 Statistics\n\n`;
    markdown += `- **Total Commits:** ${stats.totalCommits}\n`;
    markdown += `- **Contributors:** ${stats.contributors}\n`;
    markdown += `- **Files Changed:** ${stats.filesChanged}\n`;
    markdown += `- **Additions:** +${stats.additions}\n`;
    markdown += `- **Deletions:** -${stats.deletions}\n\n`;

    // Contributors list
    markdown += `## 👥 Contributors\n\n`;
    stats.contributorsList.forEach(contributor => {
      markdown += `- ${contributor.name} (${contributor.commits} commits)\n`;
    });
    markdown += '\n';

    // Full changelog link
    markdown += `## 📋 Full Changelog\n\n`;
    markdown += `View all changes: [\`${this.fromRef}...v${this.version}\`](https://github.com/MarcoDroll/creativewriter2/compare/${this.fromRef}...v${this.version})\n`;

    return markdown;
  }

  generateJSON() {
    const grouped = this.groupCommitsByType();
    const highlights = this.generateHighlights();
    const stats = this.generateStats();

    return {
      version: this.version,
      date: new Date().toISOString(),
      fromRef: this.fromRef,
      toRef: this.toRef,
      stats,
      highlights,
      breakingChanges: this.breakingChanges,
      commits: grouped,
      raw: this.commits
    };
  }

  groupByScope(commits) {
    const byScope = {};
    
    commits.forEach(commit => {
      const scope = commit.scope || 'null';
      if (!byScope[scope]) {
        byScope[scope] = [];
      }
      byScope[scope].push(commit);
    });

    return byScope;
  }

  extractBreakingDetails(body) {
    for (const indicator of CONFIG.breakingChangeIndicators) {
      const index = body.indexOf(indicator);
      if (index !== -1) {
        const details = body.substring(index + indicator.length).trim();
        return details.split('\n')[0]; // Return first line of breaking change description
      }
    }
    return null;
  }

  generateStats() {
    try {
      // Get unique contributors
      const contributors = new Set(this.commits.map(c => c.author));
      
      // Get contributor commit counts
      const contributorCounts = {};
      this.commits.forEach(c => {
        contributorCounts[c.author] = (contributorCounts[c.author] || 0) + 1;
      });
      
      const contributorsList = Object.entries(contributorCounts)
        .sort((a, b) => b[1] - a[1])
        .map(([name, commits]) => ({ name, commits }));

      // Get file statistics
      let filesChanged = 0;
      let additions = 0;
      let deletions = 0;
      
      try {
        const diffStat = execSync(
          `git diff --shortstat ${this.fromRef}..${this.toRef}`,
          { encoding: 'utf8' }
        );
        
        const match = diffStat.match(/(\d+) files? changed(?:, (\d+) insertions?\(\+\))?(?:, (\d+) deletions?\(-\))?/);
        if (match) {
          filesChanged = parseInt(match[1]) || 0;
          additions = parseInt(match[2]) || 0;
          deletions = parseInt(match[3]) || 0;
        }
      } catch (error) {
        // Ignore diff errors
      }

      return {
        totalCommits: this.commits.length,
        contributors: contributors.size,
        contributorsList,
        filesChanged,
        additions,
        deletions
      };
    } catch (error) {
      console.error('Error generating statistics:', error.message);
      return {
        totalCommits: this.commits.length,
        contributors: 0,
        contributorsList: [],
        filesChanged: 0,
        additions: 0,
        deletions: 0
      };
    }
  }
}

// CLI Interface
function main() {
  const args = process.argv.slice(2);
  
  if (args.length < 1 || args.includes('--help')) {
    console.log(`
Usage: generate-release-notes.js <from-ref> [to-ref] [options]

Arguments:
  from-ref    Starting git reference (tag, commit, branch)
  to-ref      Ending git reference (default: HEAD)

Options:
  --version <version>   Specify version number
  --format <format>     Output format: markdown (default), json, both
  --output <file>       Output to file instead of stdout
  --help               Show this help message

Examples:
  generate-release-notes.js v1.0.0
  generate-release-notes.js v1.0.0 HEAD --version 1.1.0
  generate-release-notes.js v1.0.0 --format json --output release.json
    `);
    process.exit(0);
  }

  const fromRef = args[0];
  const toRef = args[1] && !args[1].startsWith('--') ? args[1] : 'HEAD';
  
  // Parse options
  const options = {
    version: null,
    format: 'markdown',
    output: null
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--version' && args[i + 1]) {
      options.version = args[i + 1];
    } else if (args[i] === '--format' && args[i + 1]) {
      options.format = args[i + 1];
    } else if (args[i] === '--output' && args[i + 1]) {
      options.output = args[i + 1];
    }
  }

  // Generate release notes
  const generator = new ReleaseNotesGenerator(fromRef, toRef, options.version);
  generator.parseCommits();

  let output;
  if (options.format === 'json') {
    output = JSON.stringify(generator.generateJSON(), null, 2);
  } else if (options.format === 'both') {
    output = {
      markdown: generator.generateMarkdown(),
      json: generator.generateJSON()
    };
    output = JSON.stringify(output, null, 2);
  } else {
    output = generator.generateMarkdown();
  }

  // Output results
  if (options.output) {
    fs.writeFileSync(options.output, output);
    console.log(`Release notes written to ${options.output}`);
  } else {
    console.log(output);
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}

module.exports = ReleaseNotesGenerator;