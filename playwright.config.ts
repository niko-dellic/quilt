import { defineConfig } from '@playwright/test';
const port = Number(process.env.LAYOUTS_TEST_PORT ?? 5197);
if (!Number.isInteger(port) || port < 1 || port > 65535)
  throw new Error('Invalid LAYOUTS_TEST_PORT');
const baseURL = `http://localhost:${port}`;
export default defineConfig({
  testDir: './tests/browser',
  use: { baseURL, headless: true },
  workers: 1,
  webServer: {
    command: `npm run dev -- --port ${port} --strictPort`,
    url: baseURL,
    reuseExistingServer: false,
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
    { name: 'firefox', use: { browserName: 'firefox' } },
    { name: 'webkit', use: { browserName: 'webkit' } },
    {
      name: 'chromium-webgpu',
      testMatch: /three-(backends|benchmark)\.spec\.ts/,
      use: {
        browserName: 'chromium',
        // Exercise canvas presentation under Xvfb on Linux, including its compositor.
        headless: process.platform !== 'linux',
        launchOptions: {
          args: [
            '--enable-unsafe-webgpu',
            '--use-webgpu-adapter=swiftshader',
            '--use-angle=swiftshader',
            '--enable-unsafe-swiftshader',
          ],
        },
      },
    },
  ],
});
