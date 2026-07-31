/// <reference types="vitest/config" />
import { defineConfig } from 'vite';

export default defineConfig({
  test: {
    // DOM environment is opted into per test file via @vitest-environment docblocks.
  },
});
