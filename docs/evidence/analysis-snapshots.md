# Persisted analysis snapshots

ApplySignal stores a versioned analysis snapshot for each healthy listing observation in `analysis_snapshots`. Each snapshot carries both the stable `posting_id` and the version-specific `observation_id`; it contains the derived Reciprocity Gap, transparency signals, application burden, lifecycle classification, and freshness evidence as one JSON record.

Snapshots are written only after collector health gates pass. Application-field ingestion replaces the same observation/version snapshot so the burden and re-entry analysis reflects the latest public application observation. The API exposes the records as `analysisSnapshots` and uses them for `/api/summary`, `/api/jobs`, and job detail responses; observations without a snapshot remain safely computable from stored facts. The application observation separately retains the public form evidence URL, never candidate-entered values.

`analysisVersion` is explicit (`reciprocity-v1`) so a future scoring change can coexist with or intentionally backfill earlier versions. The snapshot is an analysis artifact, not a new source fact and not a hiring-outcome claim.
