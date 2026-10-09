# Sources and publishing rules

All URLs and polling intervals are in app/sources.yaml. Every entry below
requires a terms/licence/attribution review before public launch.

| Source | Access method | Check terms before launch? |
|---|---|---|
| Hacker News | hn_api | Yes |
| TechCrunch | rss | Yes |
| The Verge | rss | Yes |
| Ars Technica | rss | Yes |
| Wired | rss | Yes |
| Lobsters | rss | Yes |
| DEV ai | devto_api | Yes |
| DEV webdev | devto_api | Yes |
| DEV security | devto_api | Yes |
| DEV mobile | devto_api | Yes |
| Expo | atom | Yes |
| React Native | atom | Yes |
| FastAPI | atom | Yes |
| VS Code | atom | Yes |
| CPython | atom | Yes |
| Next.js | atom | Yes |
| Tailwind CSS | atom | Yes |
| npm react | npm | Yes |
| npm typescript | npm | Yes |
| npm vite | npm | Yes |
| npm axios | npm | Yes |
| npm zod | npm | Yes |
| PyPI numpy | pypi | Yes |
| PyPI pandas | pypi | Yes |
| PyPI requests | pypi | Yes |
| PyPI pydantic | pypi | Yes |
| PyPI scikit-learn | pypi | Yes |
| confs.tech general | json_file | Yes |
| confs.tech javascript | json_file | Yes |
| confs.tech python | json_file | Yes |
| confs.tech devops | json_file | Yes |
| confs.tech security | json_file | Yes |
| confs.tech android | json_file | Yes |
| confs.tech ios | json_file | Yes |
| confs.tech opensource | json_file | Yes |
| Curated events | manual | Yes |
| Curated hackathons | manual | Yes |
| Devpost (unofficial) | devpost | Yes |

No HTML article scraping is enabled. Store only original links, source credit,
dates, titles, feed-provided image URLs and summaries of at most 200 characters.
Hotlink feed images; do not download or re-host them. Public access does not
imply permission to republish full articles or unrestricted commercial reuse.

Devpost is disabled: its JSON endpoint is unofficial. Review its terms and
robots.txt before enabling; the connector checks robots.txt and fails closed.
Human-readable Devpost deadline dates still need organiser timezone verification.

Conference filenames were checked against the 2026 repository. {year} resolves
at runtime; missing future-year files fail independently. More categories need
only another YAML entry. Manual files are intentionally empty, not fake listings.
Manual item fields: title, url, summary, published_at, starts_at, ends_at,
location, deadline, mode, team_size, image_url. Dates use ISO 8601. Date-only end
and deadline values are inclusive UTC days. Replace BOT_CONTACT before launch.

Windows/Android push requires a real-device development build or APK with FCM
credentials. Android Expo Go does not support remote push in SDK 57. Expo push
receipts are checked after 15 minutes, and DeviceNotRegistered tokens are removed.
Never commit backend .env or tokens. Existing .gitignore already excludes .env.
