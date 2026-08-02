import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium";
import fs from "node:fs";

/**
 * Local Chrome first (fast, no extraction step, what dev machines already have).
 * Falls back to @sparticuz/chromium's bundled serverless binary when none is found —
 * covers containers/PaaS like Render that don't have Chrome preinstalled.
 */
async function resolveLaunchOptions(): Promise<{ executablePath: string; args: string[] }> {
  const fromEnv = process.env["PUPPETEER_EXECUTABLE_PATH"];
  if (fromEnv) return { executablePath: fromEnv, args: [] };

  const candidates = [
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium-browser",
  ];
  const found = candidates.find((p) => fs.existsSync(p));
  if (found) return { executablePath: found, args: [] };

  return { executablePath: await chromium.executablePath(), args: chromium.args };
}

/** Renders `html` to a single PDF buffer via a locally-launched (or serverless-fallback) Chrome. */
export async function renderHtmlToPdf(html: string): Promise<Buffer> {
  const { executablePath, args } = await resolveLaunchOptions();
  const browser = await puppeteer.launch({ executablePath, args, headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "load" });
    const pdf = await page.pdf({ format: "A4", printBackground: true });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
