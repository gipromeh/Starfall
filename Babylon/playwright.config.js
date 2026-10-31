import {defineConfig,devices} from "@playwright/test";
export default defineConfig({
  testDir:"./tests",
  timeout:60000,
  expect:{timeout:15000},
  fullyParallel:false,
  reporter:"list",
  use:{baseURL:"http://127.0.0.1:4173",...devices["Desktop Chrome"],launchOptions:{args:["--use-gl=angle","--use-angle=swiftshader","--enable-webgl","--ignore-gpu-blocklist"]}},
  webServer:{
    command:"python3 -m http.server 4173 --directory ..",
    port:4173,
    reuseExistingServer:!process.env.CI,
    timeout:15000
  }
});