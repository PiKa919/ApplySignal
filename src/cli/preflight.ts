import { preflightPublicSource } from "../collectors/preflight";

const sourceId = process.env.APPLYSIGNAL_PREFLIGHT_SOURCE_ID;
const targetUrl = process.env.APPLYSIGNAL_PREFLIGHT_URL;
if (!sourceId) throw new Error("APPLYSIGNAL_PREFLIGHT_SOURCE_ID is required");
if (!targetUrl) throw new Error("APPLYSIGNAL_PREFLIGHT_URL is required");

const expectedHost = process.env.APPLYSIGNAL_PREFLIGHT_EXPECTED_HOST?.trim() || new URL(targetUrl).host;
const result = await preflightPublicSource({ sourceId, targetUrl, expectedHost });
console.log(JSON.stringify(result, null, 2));
