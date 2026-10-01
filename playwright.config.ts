import {defineConfig} from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 30000,
  use: {baseURL:'http://127.0.0.1:5175', browserName:'chromium', viewport:{width:390,height:844}, isMobile:true, hasTouch:true, reducedMotion:'reduce', screenshot:'only-on-failure', trace:'retain-on-failure'},
  webServer: {command:'npm run dev -- --port 5175 --strictPort', url:'http://127.0.0.1:5175', reuseExistingServer:true},
});
