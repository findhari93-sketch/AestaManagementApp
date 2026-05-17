import { chromium, FullConfig } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

const AUTH_FILE = path.join(__dirname, ".auth", "user.json");

async function globalSetup(config: FullConfig) {
  const { baseURL } = config.projects[0].use;

  // Check if auth file exists and is recent (less than 1 hour old)
  if (fs.existsSync(AUTH_FILE)) {
    const stats = fs.statSync(AUTH_FILE);
    const ageInHours = (Date.now() - stats.mtimeMs) / (1000 * 60 * 60);
    if (ageInHours < 1) {
      console.log("Using existing auth state (less than 1 hour old)");
      return;
    }
    console.log("Auth state is stale, re-authenticating...");
  }

  // Ensure .auth directory exists
  const authDir = path.dirname(AUTH_FILE);
  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true });
  }

  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Use dev-login page which auto-authenticates on mount (no form interaction)
    await page.goto(`${baseURL}/dev-login`);

    // Wait for redirect to dashboard (dev-login handles auth and redirects)
    await page.waitForURL((url) => url.pathname.includes("/dashboard"), {
      timeout: 30000,
    });

    // Save storage state (localStorage + cookies)
    await context.storageState({ path: AUTH_FILE });

    console.log("Auth state saved successfully");
  } catch (error) {
    console.error("Failed to authenticate:", error);
    throw error;
  } finally {
    await browser.close();
  }
}

export default globalSetup;
