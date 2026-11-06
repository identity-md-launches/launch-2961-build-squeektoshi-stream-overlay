# Submission path budget

Hard limit: 8,388,608 bytes of added submission content. The following explicit budgets authorize the new ignore file's treatment of generated directories. Runtime assets and both requested archives remain delivered.

| Path | Maximum bytes | Treatment |
| --- | ---: | --- |
| `src/` | 524,288 | Source and local runtime art, included |
| `dist/` | 2,097,152 | Complete production export and downloads, explicitly included |
| `artifacts/` | 3,145,728 | Evidence, screenshots, original PNG, source/static ZIPs, explicitly included |
| `tests/`, `types/`, `scripts/` | 524,288 | Reproducible checks, types and release tooling, included |
| Root documentation, metadata, `.gitignore` | 524,288 | Included; `.gitignore` itself limited to 2,048 bytes |
| `test/scratch/` | 0 | Temporary tools, browsers and test scratch; excluded and removed by the task runner |
| `**/node_modules/`, `**/.cache/`, `**/npm-cache/` | 0 | Generated dependencies/caches at every nesting level, excluded |
| Unallocated reserve | 1,572,864 | Must remain inside the hard limit |

Total maximum: 8,388,608 bytes. The final measured file inventory is `artifacts/bundle-budget.json`. The existing root package manifest and lockfile are preserved; no dependency archives or registry mirrors are submitted. ZIP inputs are an explicit allowlist, not a recursive checkout dump.
