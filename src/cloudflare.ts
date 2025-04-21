import { Log, PlaywrightCrawlingContext, SaveSnapshotOptions } from "crawlee";
import { Page } from "playwright";

export async function cloudflareChallengePlaywrightHook(
  context: PlaywrightCrawlingContext,
) {
  const { page, saveSnapshot, log } = context;
  let title = await page.title();
  let retries = 0;
  const maxRetries = 60;
  while (title === "Just a moment...") {
    page.setDefaultTimeout(0);
    if (retries > maxRetries) {
      log.error("Cloudflare challenge timed out after 30 retries. Exiting...");
      break;
    }
    log.info("Cloudflare challenge detected, waiting for it to be solved...");
    retries = await cloudflareWait(page, saveSnapshot, log, retries, maxRetries);
    retries = await cloudflareChapter(page, saveSnapshot, log, retries, maxRetries);
    await page.waitForTimeout(5000);
    title = await page.title();
    retries++;
  }
}

async function cloudflareWait(
  page: Page, 
  saveSnapshot: (options?: SaveSnapshotOptions) => Promise<void>,
  log: Log,
  retries: number,
  maxRetries: number,
): Promise<number> {
  while (retries < maxRetries) {
    await saveSnapshot({key: `cloudflare_${retries}`, saveHtml: false});
    const html = await page.content();
    if (!html.includes("This may take a few seconds")) {
      log.info("Cloudflare challenge 'take a few seconds' solved, proceeding...");
      break;
    }
    await page.waitForTimeout(5000);
    retries++;
  }
  return retries;
}

async function cloudflareChapter(
  page: Page,
  saveSnapshot: (options?: SaveSnapshotOptions) => Promise<void>,
  log: Log,
  retries: number,
  maxRetries: number,
) : Promise<number> {
  while (retries < maxRetries) {
    await saveSnapshot({key: `cloudflare_${retries}`, saveHtml: false});
    const html = await page.content();
    if (!html.includes("Verify you are human by completing the action below")) {
      log.info("Cloudflare challenge 'completing the action' solved, proceeding...");
      break;
    }
    const x = 522 + 18 * Math.random();
    const y = 278 + 18 * Math.random();
    page.mouse.click(x, y, { delay: 100 + Math.random() * 500 });
    log.info(`Cloudflare challenge 'completing the action' detected, try click (${x}, ${y}) to complete it...`);
    await page.waitForTimeout(5000);
    retries++;
  }
  return retries;
}
