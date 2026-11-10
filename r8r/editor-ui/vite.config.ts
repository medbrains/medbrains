/// <reference types="vitest/config" />
import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import dts from 'vite-plugin-dts'

/**
 * Two builds from one source.
 *
 * `npm run build` produces the standalone application, which the r8r binary
 * embeds. `npm run build:lib` produces the component library that another
 * application — MedBrains' web app — imports as a route.
 *
 * The library externalises React, Mantine and xyflow. A second copy of any of
 * them would mean a second React context, and the host's theme and
 * notifications would silently stop reaching the editor.
 */
const external = [
  'react',
  'react-dom',
  'react/jsx-runtime',
  /^@mantine\//,
  /^@tabler\//,
  /^@xyflow\//,
]

export default defineConfig(({ mode }) => {
  const library = mode === 'lib'

  return {
    plugins: [
      react(),
      ...(library
        ? [dts({ include: ['src'], exclude: ['src/**/*.test.*', 'src/test/**'], rollupTypes: true })]
        : []),
    ],

    build: library
      ? {
          outDir: 'dist-lib',
          emptyOutDir: true,
          lib: {
            entry: resolve(__dirname, 'src/index.ts'),
            formats: ['es'],
            fileName: () => 'r8r-editor.js',
          },
          rollupOptions: { external },
          cssFileName: 'styles',
        }
      : { outDir: 'dist', emptyOutDir: true },

    server: {
      port: 5173,
      proxy: {
        '/rest': 'http://127.0.0.1:5678',
        '/webhook': 'http://127.0.0.1:5678',
      },
    },

    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: ['./src/test/setup.ts'],
      include: ['src/**/*.test.{ts,tsx}'],
      coverage: {
        provider: 'v8',
        include: ['src/**/*.{ts,tsx}'],
        exclude: ['src/**/*.test.{ts,tsx}', 'src/test/**', 'src/main.tsx'],
      },
    },
  }
})
