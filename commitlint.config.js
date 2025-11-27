module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      [
        'feat',     // New feature
        'fix',      // Bug fix
        'docs',     // Documentation changes
        'style',    // Code style changes (formatting, etc)
        'refactor', // Code refactoring
        'perf',     // Performance improvements
        'test',     // Adding or updating tests
        'chore',    // Maintenance tasks
        'ci',       // CI/CD changes
        'build',    // Build system changes
        'revert',   // Revert previous commit
        "main",     // Changes to main branch
        "init",     // Initial commit
        "config",    // Configuration changes
        "setup"      // Setup related changes
      ],
    ],
    'subject-case': [0], // Allow any case in subject
    'subject-max-length': [2, 'always', 100],
  },
};