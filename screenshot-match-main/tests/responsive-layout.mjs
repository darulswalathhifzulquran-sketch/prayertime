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
            navOutside: navRect ? (navRect.left < -1 || navRect.right > innerWidth + 1 || navRect.top < 0 || navRect.bottom > innerHeight + 1) : true,
            activeCard: card?.id || null,
          };
        });
        // The full location picker is available on Home and Prayer only.
        const picker = await page.locator(".awqaat-location-trigger").count();
        const shouldShowPicker = tab === "home" || tab === "prayers";
        if ((picker === 1) !== shouldShowPicker) {
          failures.push(vp.name + " / " + tab + ": location picker visibility=" + picker + ", expected " + Number(shouldShowPicker));
        }
        if (shouldShowPicker) {
          const width = await page.locator(".awqaat-location-trigger").evaluate((node) => node.getBoundingClientRect().width);
          const minWidth = vp.width <= 365 ? 125 : vp.width <= 640 ? 155 : vp.width < 860 ? 175 : 210;
          if (width < minWidth) {
            failures.push(vp.name + " / " + tab + ": location picker too narrow (" + width + "px vs " + minWidth + "px)");
          }
        }
        console.log(vp.name.padEnd(18), String(vp.width).padStart(4), tab.padEnd(9), JSON.stringify(metric));
        if (metric.document > 3 || metric.header > 4 || metric.main > 4 ||
            metric.card > 4 || metric.nav > 4 || metric.navOutside) {
          failures.push(vp.name + " / " + tab + ": " + JSON.stringify(metric));
          await page.screenshot({ path: "/tmp/awqaat-overflow-" + vp.width + "-" + tab + ".png", fullPage: true });
        }
      }

      await measure("home");
      // Test the vocalized Dhuhr word even when the prayer API is unavailable
      // or the next prayer is different at the time of CI.
      const arabicSpacing = await page.evaluate(async () => {
        const panel = document.querySelector("#home .glass-on-dark");
        const existing = panel.querySelector("p.font-arabic[lang=ar]");
        const word = existing ? existing.cloneNode(true) : document.createElement("p");
        word.className = "mt-3 font-arabic text-4xl font-bold leading-tight text-white drop-shadow-sm sm:text-5xl";
        word.lang = "ar";
        word.dir = "rtl";
        word.textContent = "الظُّهْر";
        const label = panel.firstElementChild;
        label.after(word);
        try {
          await document.fonts.ready;
          const style = getComputedStyle(word);
          const bounds = word.getBoundingClientRect();
          return { ratio: parseFloat(style.lineHeight) / parseFloat(style.fontSize),
            gap: bounds.top - label.getBoundingClientRect().bottom,
            font: style.fontFamily, padding: parseFloat(style.paddingTop) };
        } finally { word.remove(); }
      });
      if (arabicSpacing.ratio < 1.75 || arabicSpacing.gap < 10 || arabicSpacing.padding <= 0 || !arabicSpacing.font.includes("Scheherazade New"))
        failures.push(vp.name + ": insufficient Arabic diacritic spacing " + JSON.stringify(arabicSpacing));

      const layout = await page.evaluate(() => {
        const main = document.querySelector(".awqaat-main");
        const home = document.querySelector("#home");
        const prayers = document.querySelector("#prayers");
        const row = prayers.querySelector(".glassy-prayer-row");
        return { main: main.getBoundingClientRect().width, home: home.getBoundingClientRect().width,
          prayers: prayers.getBoundingClientRect().width, row: row.getBoundingClientRect().height,
          gap: parseFloat(getComputedStyle(prayers.querySelector(".flex.flex-col")).gap) };
      });
      if (layout.main < Math.min(vp.width - 4, 1500) || layout.gap < 10)
        failures.push(vp.name + ": spacious layout not applied " + JSON.stringify(layout));
      if (vp.width >= 1366 && (layout.home < 570 || layout.prayers < 610))
        failures.push(vp.name + ": desktop dashboard too narrow " + JSON.stringify(layout));

      // Typeface-only update: verify the main wordmark and all core text roles.
      const fonts = await page.evaluate(() => {
        const family = (sel) => {
          const el = document.querySelector(sel);
          return el ? getComputedStyle(el).fontFamily : "";
        };
        return {
          body: family("body"),
          brand: family(".brand-awqaat"),
          heading: family("#prayers h2"),
          arabic: family("#prayers .font-arabic"),
          malayalam: family("#prayers .font-ml"),
          nav: family(".glass-nav-item"),
          date: family(".awqaat-date-hijri-value"),
        };
      });
      for (const role of ["body", "heading", "arabic", "malayalam", "nav", "date"]) {
        if (!fonts[role].startsWith('"Scheherazade New"') && !fonts[role].startsWith("Scheherazade New")) {
          failures.push(vp.name + ": wrong font for " + role + " " + fonts[role]);
        }
        if (!fonts[role].includes("Noto Sans Malayalam")) failures.push(vp.name + ": missing Malayalam fallback for " + role);
      }
      if (!fonts.brand.startsWith("Cinzel")) failures.push(vp.name + ": wordmark font changed: " + fonts.brand);

      // The dock follows manual scroll in both directions on a stacked dashboard.
      // The desktop two-column dashboard is intentionally not scroll-spied.
      if (vp.width < 860) {
        const selected = () => page.evaluate(() => {
          const buttons = Array.from(document.querySelectorAll(".glass-bottom-nav .glass-nav-item"));
          return buttons.findIndex(button => button.getAttribute("aria-current") === "page");
        });
        await page.evaluate(() => window.scrollTo({top: document.documentElement.scrollHeight, behavior:"instant"}));
        await page.waitForTimeout(180);
        if (await selected() !== 1) failures.push(vp.name + ": scrolling down did not select Prayer");
        await page.evaluate(() => window.scrollTo({top: 0, behavior:"instant"}));
        await page.waitForTimeout(180);
        if (await selected() !== 0) failures.push(vp.name + ": scrolling up did not select Home");
        if (vp.width === 390) {
          await navButtons.nth(1).click();
          await page.waitForTimeout(700);
          if (await selected() !== 1) failures.push(vp.name + ": Prayer click selection was overridden by scroll spy");
          await page.mouse.wheel(0, -5000);
          await page.waitForTimeout(350);
          if (await selected() !== 0) failures.push(vp.name + ": manual scroll did not release the navigation lock");
        }
      }


      // The explicit Prayer tab hides the institutional footer, while manual
      // scrolling within Home retains it even when the Prayer icon is active.
      await navButtons.nth(0).click();
      await page.locator(".jamia-site-footer").waitFor({state: "visible"});
      // Let the smooth navigation finish before measuring dock/footer clearance.
      await page.waitForTimeout(750);
      const footer = await page.locator(".jamia-site-footer").evaluate(async (node) => {
        const logo = node.querySelector("img");
        await logo.decode();
        const rect = node.getBoundingClientRect();
        const inner = node.querySelector(".jamia-footer-inner");
        return { left: rect.left, right: rect.right, overflow: node.scrollWidth - node.clientWidth,
          columns: getComputedStyle(inner).gridTemplateColumns.split(" ").length,
          logo: logo.naturalWidth, logoSource: logo.getAttribute("src"), phones: node.querySelectorAll('a[href^="tel:"]').length,
          email: !!node.querySelector('a[href="mailto:info@jamiaimamnavavi-ra.com"]'),
          website: !!node.querySelector('a[href="https://jamiaimamnavavi-ra.com/"]') };
      });
      if (footer.left < -1 || footer.right > vp.width + 1 || footer.overflow > 2 ||
          footer.columns !== (vp.width <= 700 ? 1 : 2) || footer.logo < 270 || footer.logoSource !== "/jamia-footer-logo.svg" || footer.phones !== 3 ||
          !footer.email || !footer.website) failures.push(vp.name + ": institutional footer regression " + JSON.stringify(footer));
      await page.evaluate(() => window.scrollTo({top: document.documentElement.scrollHeight, behavior:"instant"}));
      await page.waitForTimeout(120);
      const footerClearance = await page.evaluate(() => document.querySelector(".glass-bottom-nav").getBoundingClientRect().top - document.querySelector(".jamia-site-footer").getBoundingClientRect().bottom);
      if (footerClearance < 0) failures.push(vp.name + ": fixed navigation overlaps footer at bottom of page");
      await page.evaluate(() => window.scrollTo({top: 0, behavior:"instant"}));
      await page.waitForTimeout(150);
      if (await page.locator("#prayers .awqaat-date-hijri-value, #prayers > div:first-child p").count()) failures.push(vp.name + ": duplicate prayer date caption");
      const dock = await page.locator(".glass-bottom-nav").evaluate((node) => {
        const style = getComputedStyle(node);
        const buttons = Array.from(node.querySelectorAll("button"));
        return { fixed: style.position === "fixed", tint: style.backgroundImage, buttons: buttons.length, allVisible: buttons.every(b => {
          const r = b.getBoundingClientRect();
          const target = document.elementFromPoint(r.x+r.width/2, r.y+r.height/2);
          return r.height >= 39 && r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth && target && b.contains(target);
        }) };
      });
      if (!dock.fixed || dock.tint === "none" || !dock.allVisible || dock.buttons !== 7) failures.push(vp.name + ": mobile glass dock not visible or reachable " + JSON.stringify(dock));

      if (!(await page.locator(".awqaat-hijri-date").isVisible())) {
        failures.push(vp.name + ": Hijri date missing from Home screen");
      }
      const dateFonts = await page.evaluate(() => ({
        gregorian: getComputedStyle(document.querySelector(".awqaat-date-gregorian")).fontSize,
        hijri: getComputedStyle(document.querySelector(".awqaat-date-hijri-value")).fontSize,
      }));
      if (dateFonts.gregorian !== dateFonts.hijri) failures.push(vp.name + ": calendar font sizes differ");
      if (vp.width === 390) {
        await page.context().grantPermissions(["geolocation"]);
        await page.context().setGeolocation({ latitude: 19.076, longitude: 72.8777, accuracy: 10 });
        const configResponse = await page.request.get(new URL("/api/push/config", base).href);
        if (configResponse.status() !== 200) failures.push("Push config endpoint is unavailable");
        else {
          const json = await configResponse.json();
          if (typeof json.ready !== "boolean") failures.push("Push config ready flag missing");
        }
        const unauthorizedCron = await page.request.get(new URL("/api/push/dispatch", base).href);
        if (unauthorizedCron.status() !== 401) failures.push("Push scheduler must reject unauthenticated requests");
      }
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
        // Portrait/landscape phones: the shared Home+Prayer screen ends with
        // its footer after Prayer. iPads and desktops show it on Home only.
        const phone = vp.width <= 700 || (vp.width <= 950 && vp.height <= 520);
        const footerExpected = index === 0 || (index === 1 && phone);
        const footerVisible = await page.locator(".jamia-site-footer").isVisible();
        if (footerVisible !== footerExpected)
          failures.push(vp.name + ": incorrect footer visibility on " + name + ": " + footerVisible);
        if (index === 1 && phone && footerVisible) {
          const order = await page.evaluate(() => ({
            prayerBottom: document.querySelector("#prayers").getBoundingClientRect().bottom,
            footerTop: document.querySelector(".jamia-site-footer").getBoundingClientRect().top,
            footers: document.querySelectorAll(".jamia-site-footer").length,
          }));
          if (order.footers !== 1 || order.footerTop < order.prayerBottom)
            failures.push(vp.name + ": footer is not below Prayer " + JSON.stringify(order));
        }
        if (name === "qibla") {
          if (!(await page.locator(".qibla-ios .qibla-live-dial").isVisible())) {
            failures.push(vp.name + ": iPhone Qibla compass missing");
          }
          if (await page.locator(".qibla-ios-heading-label, .qibla-ios-compass-caution").count()) failures.push(vp.name + ": removed Qibla captions still present");
          if (await page.locator(".qibla-location-line").count()) failures.push(vp.name + ": district name appears in Qibla");
          if (vp.width === 390) {
            await page.waitForFunction(() => document.querySelector("#qibla .qibla-stat strong")?.textContent?.includes("°"), {timeout: 10000});
            const value = await page.locator("#qibla .qibla-stat strong").first().textContent();
            const angle = Number(value.replace("°", ""));
            const r = (n) => n * Math.PI / 180;
            const delta = r(39.826206 - 72.8777);
            const expected = ((Math.atan2(Math.sin(delta) * Math.cos(r(21.422487)), Math.cos(r(19.076)) * Math.sin(r(21.422487)) - Math.sin(r(19.076)) * Math.cos(r(21.422487)) * Math.cos(delta)) * 180 / Math.PI) + 360) % 360;
            if (Math.abs(angle - expected) > 0.2) failures.push("Qibla did not use independent device coordinates: " + value);
            // With GPS but no orientation event, the real bearing must already be visible.
            const staticGuide = await page.evaluate(() => {
              const dial = document.querySelector(".qibla-live-dial");
              const marker = dial?.querySelector("[data-qibla-marker]");
              const pointer = dial?.querySelector("[data-qibla-pointer]");
              return {
                mode: dial?.getAttribute("data-compass-mode"),
                marker: !!marker,
                rotation: pointer?.getAttribute("transform"),
                reference: !!document.querySelector("[data-qibla-reference]"),
                falselyAligned: !!document.querySelector(".qibla-aligned"),
              };
            });
            if (staticGuide.mode !== "reference" || !staticGuide.marker || !staticGuide.reference ||
                !staticGuide.rotation || staticGuide.falselyAligned ||
                Math.abs(Number(staticGuide.rotation.match(/rotate\(([-.\d]+)/)?.[1]) - expected) > 0.2) {
              failures.push("GPS-only Qibla pointer regression: " + JSON.stringify(staticGuide));
            }
            // Simulated Android sensor stream, with measured no-motion gyro readings.
            // A synthetic sensor test is not a physical compass calibration.
            const motionResult = await page.evaluate(async () => {
              const tick = async (heading, speed) => {
                const motion = new Event("devicemotion");
                Object.defineProperty(motion, "rotationRate", { value: { alpha: speed, beta: 0, gamma: 0 } });
                window.dispatchEvent(motion);
                const orientation = new Event("deviceorientationabsolute");
                for (const [key, value] of Object.entries({alpha: (360-heading+360)%360,beta:0,gamma:0,absolute:true})) {
                  Object.defineProperty(orientation, key, {value});
                }
                window.dispatchEvent(orientation);
                await new Promise(resolve => setTimeout(resolve, 35));
              };
              const heading = () => document.querySelector(".qibla-ios-heading-number")?.textContent;
              const marker = () => document.querySelector("[data-qibla-marker]");
              const markerAngle = () => marker()?.parentElement?.parentElement?.getAttribute("transform");
              for(let i=0;i<22;i++) await tick(291,0);
              const before = heading(), beforeAngle = markerAngle();
              let stable = true;
              for(const n of [289,285,288,290,287,288,287,280,285,289,291]) {
                await tick(n,0);
                stable &&= heading() === before && markerAngle() === beforeAngle;
              }
              for(let i=0;i<7;i++) await tick(321,60);
              const after = heading();
              const asset = marker()?.getAttribute("href");
              let decoded = false;
              if (asset) {
                const image = new Image();
                image.src = asset;
                try { await image.decode(); decoded = image.naturalWidth > 0; } catch {}
              }
              return {stable, before, after, beforeAngle, afterAngle: markerAngle(), decoded, mode: document.querySelector(".qibla-live-dial")?.getAttribute("data-compass-mode")};
            });
            console.log("Qibla synthetic motion test:", JSON.stringify(motionResult));
            if(!motionResult.stable || !motionResult.beforeAngle || !motionResult.afterAngle ||
              motionResult.before === motionResult.after || !motionResult.decoded || motionResult.mode !== "live")
              failures.push("Qibla motion lock or Kaaba image failed: " + JSON.stringify(motionResult));

          }
        }
        if (name === "reminder" && !(await page.locator(".awqaat-push-card").isVisible())) {
          failures.push(vp.name + ": prayer notifications preview missing");
        }
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
      const locationTypography = await page.locator(".awqaat-location-menu").evaluate(node => {
        const font = selector => {
          const element = node.querySelector(selector);
          return element ? parseFloat(getComputedStyle(element).fontSize) : null;
        };
        return {
          heading: font(":scope > div:first-child"),
          label: font("label"),
          district: font("[cmdk-item]"),
          secondaryDistrict: font("[cmdk-item] .font-ml"),
          search: font("input"),
          help: font(":scope > p"),
          coordinateLabel: font("dt"),
          coordinateValue: font("dd"),
        };
      });
      if (locationTypography.heading < 18 || locationTypography.label < 15 ||
          locationTypography.district < 15 || locationTypography.secondaryDistrict < 15 ||
          locationTypography.search < 16 || locationTypography.help < 15 ||
          locationTypography.coordinateLabel < 14 || locationTypography.coordinateValue < 15) {
        failures.push(vp.name + ": location text remains too small " + JSON.stringify(locationTypography));
      }
      const stateDropdown = page.locator(".awqaat-location-menu button[role=combobox]").first();
      await stateDropdown.click();
      const stateOptionSize = await page.locator(".awqaat-location-state-options [role=option]").first()
        .evaluate(node => parseFloat(getComputedStyle(node).fontSize));
      if (stateOptionSize < 16) failures.push(vp.name + ": state dropdown font too small " + stateOptionSize);
      await page.keyboard.press("Escape");
      await page.keyboard.press("Escape");

      await navButtons.nth(6).click();
      await page.locator(".awqaat-settings-panel").waitFor({ state: "visible" });
      // Radix Sheet animates in from the right for up to 500 ms.
      // An off-screen initial animation frame is not a layout overflow.
      await page.waitForTimeout(750);
      const settingsTheme = await page.locator(".awqaat-settings-panel").evaluate((node) => ({
        theme: getComputedStyle(node).getPropertyValue("--settings-ink").trim(),
        fields: node.querySelectorAll(".space-y-5 > div").length,
        creditsCollapsed: node.querySelector(".awqaat-settings-credits")?.open === false,
      }));
      if (!settingsTheme.theme || settingsTheme.fields !== 6 || !settingsTheme.creditsCollapsed) failures.push(vp.name + ": Settings theme or controls missing");
      if (await page.locator(".awqaat-settings-panel [data-hijri-standard]").count() || await page.locator(".awqaat-settings-panel").getByText("Hijri moon-sighting correction", {exact:true}).count()) failures.push(vp.name + ": redundant Hijri setting is still visible");
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
