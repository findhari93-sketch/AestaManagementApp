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
    // Navigate to login page
    await page.goto(`${baseURL}/login`);

    // Wait for login form to be ready
    await page.waitForSelector('input[type="email"]', { timeout: 10000 });

    // Fill credentials
    await page.fill(
      'input[type="email"]',
      "Haribabu@nerasmclasses.onmicrosoft.com"
    );
    await page.fill('input[type="password"]', "Padma@123");

    // Click sign in button
    await page.click('button[type="submit"]');

    // Wait for successful login (redirect away from login page)
    await page.waitForURL((url) => !url.pathname.includes("/login"), {
      timeout: 30000,
    });

    // Wait a bit for session to be fully established
    await page.waitForTimeout(1000);

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
