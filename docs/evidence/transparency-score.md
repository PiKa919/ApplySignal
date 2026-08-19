# Explainable transparency score

ApplySignal reports transparency as public information disclosed by a listing, not as employer legitimacy or hiring probability. The score is separate from application burden, lifecycle, freshness, and source confidence.

The score has twelve visible signals totaling 100 points:

| Signal | Points |
| --- | ---: |
| Exact location | 8 |
| Workplace mode | 6 |
| Employment type | 5 |
| Experience expectation | 10 |
| Specific responsibilities | 14 |
| Specific requirements | 14 |
| Skills and technologies | 10 |
| Team or department | 7 |
| Compensation | 12 |
| Closing date | 5 |
| Career stage | 4 |
| Hiring/process information | 5 |

Each signal retains whether it was observed and a short raw-text evidence cue. Missing information contributes zero disclosure points but is not converted into a negative employer claim. The API exposes `transparencyScore`, `transparencySignals`, and `transparencyInterpretation`; the Compare and Job Evidence surfaces show the score and breakdown.
