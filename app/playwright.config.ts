import { defineConfig } from '@playwright/test';

const PORT = 8783;

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    // 本地直接用装好的 Chrome，CI 用 playwright 自带的 chromium
    channel: process.env.CI ? undefined : 'chrome',
    viewport: { width: 1280, height: 800 },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    launchOptions: {
      // CI 是无 GPU 的 runner，用 ANGLE + SwiftShader 兜住 WebGL2，顺手打开 WebGPU 试试
      args: process.env.CI
        ? ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-webgpu']
        : []
    }
  },
  webServer: {
    command: `npx vite preview --port ${PORT} --strictPort`,
    port: PORT,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000
  }
});
