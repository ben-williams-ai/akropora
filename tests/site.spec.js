const { expect, test } = require("@playwright/test");

async function gotoStable(page, path = "/") {
  await page.goto(path);
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation: none !important;
        transition: none !important;
      }

      .akro-reveal,
      #banner .hero-kicker,
      #banner h2,
      #banner .hero-capabilities,
      #banner .actions,
      #banner .hero-media {
        opacity: 1 !important;
        transform: none !important;
      }
    `
  });
}

async function expectNoHorizontalOverflow(page) {
  const offenders = await page.evaluate(() => {
    const viewportWidth = document.documentElement.clientWidth;

    return Array.from(document.body.querySelectorAll("*"))
      .map((element) => {
        if (element.closest("#navPanel")) {
          return null;
        }

        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);

        return {
          tag: element.tagName.toLowerCase(),
          id: element.id,
          className: typeof element.className === "string" ? element.className : "",
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          width: Math.round(rect.width),
          display: style.display,
          position: style.position
        };
      })
      .filter(Boolean)
      .filter((item) => {
        if (item.display === "none" || item.position === "fixed" || item.width <= 1) {
          return false;
        }

        return item.left < -2 || item.right > viewportWidth + 2;
      });
  });

  expect(offenders, JSON.stringify(offenders.slice(0, 10), null, 2)).toEqual([]);
}

test("home page loads core sections", async ({ page }) => {
  await gotoStable(page);

  await expect(page).toHaveTitle(/Akropora/);
  await expect(page.getByRole("heading", { name: /Model the world in 3D/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Demos/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: /What we offer/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: /We are looking for founding partners/i })).toBeVisible();
});

test("navigation matches desktop and mobile breakpoints", async ({ page }, testInfo) => {
  await gotoStable(page);

  if (testInfo.project.name === "mobile") {
    await expect(page.locator("#header")).toBeHidden();
    await expect(page.locator("#navButton")).toBeVisible();
  }
  else {
    await expect(page.locator("#header")).toBeVisible();
    await expect(page.locator("#navButton")).toBeHidden();
    await expect(page.locator("#header").getByRole("link", { name: "Demos" })).toBeVisible();
    await expect(page.locator("#header").getByRole("link", { name: "Services" })).toBeVisible();
    await expect(page.locator("#header").getByRole("link", { name: "Partner with us" })).toBeVisible();
  }
});

test("layout has no horizontal overflow at this viewport", async ({ page }) => {
  await gotoStable(page);
  await expectNoHorizontalOverflow(page);
});

test("mobile intro and services keep readable spacing", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "Mobile-only readability check.");

  await gotoStable(page);

  const challenge = page.getByRole("heading", { name: "The challenge" });
  const solution = page.getByRole("heading", { name: "Our solution" });
  const services = page.locator(".akro-service-content");

  const challengeBox = await challenge.boundingBox();
  const solutionBox = await solution.boundingBox();
  const servicesBox = await services.boundingBox();

  expect(challengeBox).not.toBeNull();
  expect(solutionBox).not.toBeNull();
  expect(servicesBox).not.toBeNull();
  expect(solutionBox.y - (challengeBox.y + challengeBox.height)).toBeGreaterThan(12);
  expect(servicesBox.x).toBeGreaterThanOrEqual(0);
  expect(servicesBox.x + servicesBox.width).toBeLessThanOrEqual(390);
});

test("local links and assets resolve", async ({ page }) => {
  await gotoStable(page);

  const paths = await page.evaluate(() => {
    const selectors = [
      ["a[href]", "href"],
      ["img[src]", "src"],
      ["source[src]", "src"],
      ["script[src]", "src"],
      ["link[rel='stylesheet'][href]", "href"]
    ];
    const origin = window.location.origin;
    const urls = new Set();

    for (const [selector, attribute] of selectors) {
      for (const element of document.querySelectorAll(selector)) {
        const raw = element.getAttribute(attribute);
        if (!raw || raw.startsWith("#") || raw.startsWith("mailto:")) {
          continue;
        }

        const url = new URL(raw, window.location.href);
        if (url.origin === origin) {
          url.hash = "";
          urls.add(url.pathname + url.search);
        }
      }
    }

    return Array.from(urls).sort();
  });

  for (const path of paths) {
    const response = await page.request.get(path);
    expect(response.status(), path).toBeLessThan(400);
  }
});

test("reef interactive twin and video fallback are reachable", async ({ page }) => {
  await gotoStable(page, "/splats/reef-restoration/");

  await expect(page.locator("iframe[title='Reef restoration interactive 3D spatial twin']")).toHaveAttribute(
    "src",
    /superspl\.at\/s\?id=392787d3/
  );
  await expect(page.getByRole("link", { name: "Back to demos" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Watch video" })).toHaveAttribute("href", "../../videos/reef-restoration/");
  await expect(page.getByRole("button", { name: "Info" })).toBeVisible();

  await gotoStable(page, "/videos/reef-restoration/");
  await expect(page.locator("video source")).toHaveAttribute("src", "../../assets/videos/reef-restoration.mp4");
  await expect(page.getByRole("link", { name: "View interactive twin" })).toHaveAttribute(
    "href",
    "../../splats/reef-restoration/"
  );
});
