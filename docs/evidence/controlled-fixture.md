# Controlled lifecycle fixture

ApplySignal includes a deterministic local career-site fixture so lifecycle and extraction behavior can be demonstrated without spending Bright Data credits.

## Cases

| ID | Case | Expected interpretation |
| --- | --- | --- |
| `fixture-fresh-001` | exact recent posting date | exact source date and observed age |
| `fixture-relative-002` | `30+ Days Ago` | lower-bound freshness, not a fabricated date |
| `fixture-evergreen-003` | continuous / rolling hiring language | explicit evergreen |
| `fixture-talent-004` | future-opportunity talent pool | talent pool, not an ordinary vacancy |
| `fixture-multi-005` | Bengaluru, Pune, and Remote | preserve the multi-location string |
| `fixture-rich-006` | public form with resume, CTC, history, and education fields | application burden and Resume Re-entry Tax |

## Layout switch

The fixture contains two representations of the same six semantic postings:

- `layout-a`: card-shaped rows using the normalized snake_case field names.
- `layout-b`: definition-list-like openings using aliases such as `reference`, `role`, `place`, `detail`, and `apply`.

Select the second representation with:

```bash
APPLYSIGNAL_FIXTURE_LAYOUT=layout-b bun run seed:fixture
```

The loader canonicalizes both layouts before ingestion. Tests assert identical posting IDs and six rows in each layout. Ingestion requires six rows, identity coverage, required field coverage, and the expected fixture host. The fixture is marked `dataMode: fixture` and is not evidence about a real employer.

The application payload contains field labels and requiredness only. It contains no candidate values and is never submitted.
