import { defineConfig } from 'vite';

// Relative asset paths, so the build works from a GitHub Pages sub-path as well as from the root.
export default defineConfig({ base: './' });
