# Collector health contract

The paid collector boundary accepts a source-specific contract through environment variables:

```bash
BRIGHTDATA_REQUIRED_FIELDS=source_job_id,title,location
BRIGHTDATA_IDENTITY_FIELD=source_job_id
BRIGHTDATA_EXPECTED_HOST=careers.example.com
BRIGHTDATA_MIN_COVERAGE=0.75
```

The contract is propagated into ingestion and validates cardinality, field coverage, duplicate identity, URL host, semantic swaps, and impossible date ordering before observations are committed.

Transport evidence is optional because the Bright Data CLI output does not always expose the target page’s navigation metadata. If supplied, the validator checks navigation success, HTTP status, final URL host, body size, and explicit block/CAPTCHA indicators. Missing transport evidence is reported as `unknown`, not healthy. A known transport failure quarantines the run even when its rows appear structurally complete.
