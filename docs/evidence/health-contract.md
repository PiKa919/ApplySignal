# Collector health contract

The paid collector boundary accepts a source-specific contract through environment variables:

```bash
BRIGHTDATA_REQUIRED_FIELDS=source_job_id,title,location
BRIGHTDATA_IDENTITY_FIELD=source_job_id
BRIGHTDATA_EXPECTED_HOST=careers.example.com
BRIGHTDATA_MIN_COVERAGE=0.75
BRIGHTDATA_URL_FIELD=url
BRIGHTDATA_SCOPE_KIND=all_jobs
BRIGHTDATA_EMPTY_STATE_VERIFIED=false
```

The contract is propagated into ingestion and validates cardinality, field coverage, duplicate identity and URL values, URL host, pagination evidence when supplied, explicit scope-aware empty states, semantic swaps, invalid salary ranges, and impossible date ordering before observations are committed. It also stores observed location, department, employment-type, career-stage, and workplace-mode distributions in the run health report for baseline comparison. An unverified empty `all_jobs` result is quarantined; an explicitly verified empty subset can be healthy.

Transport evidence is optional because the Bright Data CLI output does not always expose the target page’s navigation metadata. If supplied, the validator checks navigation success, HTTP status, final URL host, body size, and explicit block/CAPTCHA indicators. Missing transport evidence is reported as `unknown`, not healthy. A known transport failure quarantines the run even when its rows appear structurally complete.
