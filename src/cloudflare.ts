import { PlaywrightCrawlingContext } from "crawlee";

export async function cloudflareChallengePlaywrightHook(
  context: PlaywrightCrawlingContext,
) {
  const { page, saveSnapshot, log } = context;
  let title = await page.title();
  let retries = 0;
  while (title === "Just a moment...") {
    if (retries > 30) {
      log.error("Cloudflare challenge timed out after 30 retries. Exiting...");
      break;
    }
    log.info("Cloudflare challenge detected, waiting for it to be solved...");
    saveSnapshot({
      key: "cloudflare",
      saveHtml: false,
    });
    await page.waitForTimeout(5000);
    title = await page.title();
  }
}
