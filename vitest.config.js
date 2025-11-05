// vitest.config.js
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    threads: false,                 // run tests in a single thread
    sequence: { concurrent: false },// run files in order
  },
});