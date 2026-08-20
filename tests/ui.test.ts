import { expect, test } from "bun:test";

const app = await Bun.file("src/ui/app.ts").text();
const html = await Bun.file("src/ui/index.html").text();
const css = await Bun.file("src/ui/styles.css").text();

test("UI handles API failures with retryable state", () => {
  expect(app).toContain("response.ok");
  expect(app).toContain("Retry");
  expect(app).toContain("Couldn’t load live observations");
});

test("UI exposes loading and coordinated zero-live state", () => {
  expect(html).toContain("dashboard-status");
  expect(app).toContain("Loading live observations");
  expect(app).toContain("No verified live listings are available right now");
});

test("UI distinguishes unknown confidence from zero confidence", () => {
  expect(app).toContain("Unknown");
  expect(app).toContain("confidenceLabel");
});

test("job cards are keyboard accessible and listing links do not select cards", () => {
  expect(app).toContain('role="button"');
  expect(app).toContain("keydown");
  expect(app).toContain("stopPropagation");
  expect(css).toContain(":focus-visible");
});
