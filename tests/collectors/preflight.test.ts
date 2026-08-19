import { expect, test } from "bun:test";
import { preflightPublicSource } from "../../src/collectors/preflight";

const response = (body: string, init: ResponseInit = {}) => new Response(body, {
  status: 200,
  headers: { "content-type": "text/html; charset=utf-8" },
  ...init,
});

test("accepts a reachable public source on the expected host without Bright Data", async () => {
  const result = await preflightPublicSource({
    sourceId: "demo",
    targetUrl: "https://jobs.example.test/openings",
    expectedHost: "jobs.example.test",
  }, async () => response("<html><body><h1>Open roles</h1></body></html>"));

  expect(result).toMatchObject({
    status: "reachable",
    navigationSucceeded: true,
    httpStatus: 200,
    finalHost: "jobs.example.test",
    contentType: "text/html; charset=utf-8",
    brightDataCalls: 0,
  });
  expect(result.bodyBytes).toBeGreaterThan(0);
});

test("detects a block page returned with HTTP 200", async () => {
  const result = await preflightPublicSource({ sourceId: "blocked", targetUrl: "https://jobs.example.test" }, async () => response("<html>Access denied. Please complete CAPTCHA.</html>"));

  expect(result.status).toBe("blocked");
  expect(result.blockIndicators).toEqual(expect.arrayContaining(["access denied", "captcha"]));
  expect(result.navigationSucceeded).toBe(true);
});

test("does not classify a captcha stylesheet dependency as a block page", async () => {
  const result = await preflightPublicSource({ sourceId: "scripted", targetUrl: "https://jobs.example.test" }, async () => response("<html><style>.grecaptcha-badge{visibility:hidden}</style><body>Open roles</body></html>"));

  expect(result.status).toBe("reachable");
  expect(result.blockIndicators).toEqual([]);
});

test("rejects an unexpected final host before any collector is considered", async () => {
  const redirected = response("redirected");
  Object.defineProperty(redirected, "url", { value: "https://login.example.test/sign-in" });
  const result = await preflightPublicSource({
    sourceId: "redirected",
    targetUrl: "https://jobs.example.test",
    expectedHost: "jobs.example.test",
  }, async () => redirected);

  expect(result.status).toBe("unexpected_host");
  expect(result.finalHost).toBe("login.example.test");
  expect(result.brightDataCalls).toBe(0);
});

test("reports network failure without throwing or spending collector credits", async () => {
  const result = await preflightPublicSource({ sourceId: "offline", targetUrl: "https://jobs.example.test" }, async () => { throw new Error("network unavailable"); });

  expect(result.status).toBe("unreachable");
  expect(result.navigationSucceeded).toBe(false);
  expect(result.error).toContain("network unavailable");
  expect(result.brightDataCalls).toBe(0);
});
