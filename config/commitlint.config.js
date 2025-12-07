export default {
  extends: ['@commitlint/config-conventional'],
  ignores: [
    (commit) => commit.startsWith('Add comprehensive load testing')
  ]
};
