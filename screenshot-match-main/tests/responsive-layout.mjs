import { chromium } from "playwright";

const base = process.env.BASE_URL || "http://127.0.0.1:4173";
const viewports = [
  { name: "iPhone SE", width: 320, height: 667 },
  { name: "small iPhone", width: 375, height: 812 },
  { name: "modern iPhone", width: 390, height: 844 },
  { name: "large phone", width: 430, height: 932 },
  { name: "iPhone landscape", width: 844, height: 390 },
  { name: "iPad portrait", width: 768, height: 1024 },
  { name: "iPad Air", width: 820, height: 1180 },
  { name: "iPad landscape", width: 1024, height: 768 },
  { name: "laptop", width: 1366, height: 768 },
  { name: "desktop", width: 1920, height: 1080 },
];

const browser = await chromium.launch({ headless: true });
let failures = [];
try {
  for (const vp of viewports) {
    const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: 1 });
    try {
      const response = await page.goto(base, { waitUntil: "domcontentloaded", timeout: 30000 });
      if (!response || response.status() >= 400) throw new Error("Page did not load: " + response?.status());
      await page.locator(".glass-bottom-nav .glass-nav-item").first().waitFor({ timeout: 25000 });
      // SSR markup appears before React event handlers are hydrated.
      // Wait for the document's JS resources before exercising navigation.
      await page.waitForLoadState("load", { timeout: 20000 });
      await page.waitForTimeout(1600);

      // All seven navigation items are present and reachable, even on small phones.
      const navButtons = page.locator(".glass-bottom-nav .glass-nav-item");
      const count = await navButtons.count();
      if (count !== 7) throw new Error("Expected seven navigation buttons; got " + count);

      async function measure(tab) {
        const metric = await page.evaluate(() => {
          const gap = (node) => node ? Math.max(0, node.scrollWidth - node.clientWidth) : 0;
          const header = document.querySelector(".awqaat-header-layout");
          const main = document.querySelector(".awqaat-main");
          const bottom = document.querySelector(".glass-bottom-nav");
          const card = document.querySelector(".awqaat-main > section:not(.hidden)");
          const navRect = bottom?.getBoundingClientRect();
          return {
            document: Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth),
            header: gap(header),
            main: gap(main),
            card: gap(card),
            nav: gap(bottom),
            navOutside: navRect ? (navRect.left < -1 || navRect.right > innerWidth + 1) : true,
            activeCard: card?.id || null,
          };
        });
        console.log(vp.name.padEnd(18), String(vp.width).padStart(4), tab.padEnd(9), JSON.stringify(metric));
        if (metric.document > 3 || metric.header > 4 || metric.main > 4 ||
            metric.card > 4 || metric.nav > 4 || metric.navOutside) {
          failures.push(vp.name + " / " + tab + ": " + JSON.stringify(metric));
          await page.screenshot({ path: "/tmp/awqaat-overflow-" + vp.width + "-" + tab + ".png", fullPage: true });
        }
      }

      await measure("home");
      for (const [index, name] of [
        [1, "prayers"], [2, "qibla"], [3, "azan"],
        [4, "reminder"], [5, "stopwatch"], [0, "home"],
      ]) {
        await navButtons.nth(index).click();
        // TanStack navigation is hydrated; measure the destination only after
        // the routed panel has become visible, not during its initial transition.
        const sectionId = index === 2 ? "#qibla" : index === 3 || index === 4 ? "#azan" :
          index === 5 ? "#stopwatch" : "#home";
        await page.locator(sectionId).waitFor({ state: "visible", timeout: 5000 });
        await page.waitForTimeout(120);
        await measure(name);
      }

      await page.locator(".awqaat-location-trigger").click();
      await page.locator(".awqaat-location-menu").waitFor();
      const popover = await page.locator(".awqaat-location-menu").evaluate((node) => {
        const r = node.getBoundingClientRect();
        return { left: r.left, right: r.right, window: innerWidth, width: r.width, scroll: node.scrollWidth - node.clientWidth };
      });
      if (popover.left < -2 || popover.right > vp.width + 2 || popover.scroll > 4) {
        failures.push(vp.name + ": location selector overflow " + JSON.stringify(popover));
      }
      await page.keyboard.press("Escape");

      await navButtons.nth(6).click();
      await page.locator(".awqaat-settings-panel").waitFor({ state: "visible" });
      // Radix Sheet animates in from the right for up to 500 ms.
      // An off-screen initial animation frame is not a layout overflow.
      await page.waitForTimeout(750);
      const settings = await page.locator(".awqaat-settings-panel").evaluate((node) => {
        const r = node.getBoundingClientRect();
        return { left: r.left, right: r.right, width: r.width, window: innerWidth, scroll: node.scrollWidth - node.clientWidth };
      });
      if (settings.left < -2 || settings.right > vp.width + 2 || settings.scroll > 4) {
        failures.push(vp.name + ": settings overflow " + JSON.stringify(settings));
      }
    } catch (error) {
      failures.push(vp.name + ": " + String(error));
    } finally {
      await page.close();
    }
  }
} finally {
  await browser.close();
}
if (failures.length) {
  console.error("Responsive regressions (" + failures.length + "):\n" + failures.join("\n"));
  process.exit(1);
}
console.log("Responsive browser checks passed for all 10 viewport sizes and sections.");
