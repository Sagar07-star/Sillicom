# Sillicom: installation and APK guide

The self-contained setup.sh and setup.ps1 embed every source/configuration file.
Run one installer in an empty working directory. They only write files, not
install dependencies, log into accounts or deploy. They stop if sillicom already
exists. Use Node 22 LTS (22.13+) or Node 24 LTS and Python 3.11.

## 1. Assemble

macOS/Linux, with setup.sh in the current directory:

```bash
bash ./setup.sh
```

Windows PowerShell, with setup.ps1 in the current directory:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\setup.ps1
```

## 2. Audit changes

- Explicit Reanimated 4 Worklets plugin is last. Automatic insertion is disabled
  to avoid a duplicate plugin.
- Added expo-system-ui, expo-build-properties and @expo/metro-runtime.
- npm run align uses npx expo install to select SDK-compatible packages instead
  of manually guessing their versions. The project remains on SDK 57.
- Enabled Android cleartext HTTP for local LAN backend testing.
- Added eas.json, .easignore, Python version files and explicit Python packages.
- Seed JSON reads UTF-8 explicitly; Windows setup is UTF-8 with BOM, and all
  generated source files are UTF-8 without BOM with LF newlines.
- Existing action buttons wrap on narrow screens.
- Verified Router layouts, strict TypeScript, centralized colors, startup database
  creation, CORS and per-source ingestion failure handling.

## 3. Backend

macOS/Linux, from the directory containing sillicom:

```bash
cd sillicom/backend
python3.11 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
python -m pip check
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

Windows PowerShell, from the directory containing sillicom:

```powershell
cd sillicom\backend
py -3.11 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m pip check
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

Leave that terminal running. Test from another terminal.

macOS/Linux:

```bash
curl --fail http://localhost:8000/health
curl --fail 'http://localhost:8000/feed?type=event&limit=2'
curl --fail 'http://localhost:8000/feed?type=news&limit=2'
```

Windows:

```powershell
curl.exe --fail http://localhost:8000/health
curl.exe --fail "http://localhost:8000/feed?type=event&limit=2"
curl.exe --fail "http://localhost:8000/feed?type=news&limit=2"
```

Health returns {"status":"ok"}. Events are ready immediately; public news and
updates fill in as startup ingestion completes. Run one server worker.

## 4. Mobile and API address

From a fresh terminal in the directory containing sillicom:

```bash
cd sillicom/mobile
npm install
npm run align
npm run typecheck
```

Use sillicom/mobile/.env as the single API configuration file.
Android emulator: http://10.0.2.2:8000.
iOS simulator: http://localhost:8000.
A real phone needs the laptop's LAN IPv4 address, never localhost/10.0.2.2.

Windows PowerShell, from sillicom/mobile:

```powershell
ipconfig
$SillicomLanIp = (Get-NetIPConfiguration | Where-Object { $_.IPv4DefaultGateway -and $_.NetAdapter.Status -eq 'Up' } | Select-Object -First 1).IPv4Address.IPAddress | Select-Object -First 1
if (-not $SillicomLanIp) { throw 'No active IPv4 connection found. Check Wi-Fi and ipconfig.' }
"EXPO_PUBLIC_API_URL=http://${SillicomLanIp}:8000" | Set-Content -Encoding ascii .env
npx expo start --go
```

macOS, from sillicom/mobile:

```bash
SILLICOM_INTERFACE=$(route -n get default | awk '/interface:/{print $2}')
SILLICOM_LAN_IP=$(ipconfig getifaddr "$SILLICOM_INTERFACE")
test -n "$SILLICOM_LAN_IP" || exit 1
printf 'Laptop LAN IP: %s\n' "$SILLICOM_LAN_IP"
printf 'EXPO_PUBLIC_API_URL=http://%s:8000\n' "$SILLICOM_LAN_IP" > .env
npx expo start --go
```

Linux, from sillicom/mobile:

```bash
ip -4 address
SILLICOM_LAN_IP=$(ip -4 route get 1.1.1.1 | awk '{for(i=1;i<=NF;i++) if($i=="src"){print $(i+1);exit}}')
test -n "$SILLICOM_LAN_IP" || exit 1
printf 'EXPO_PUBLIC_API_URL=http://%s:8000\n' "$SILLICOM_LAN_IP" > .env
npx expo start --go
```

For Android emulator use this instead, from sillicom/mobile:

```bash
node -e "require('fs').writeFileSync('.env','EXPO_PUBLIC_API_URL=http://10.0.2.2:8000\n')"
npx expo start
```

The --go flag explicitly selects Expo Go because expo-dev-client is installed.
Without it, press S in Metro to switch between development client and Expo Go.

Install Expo Go from the phone's app store, put phone/laptop on the same Wi-Fi,
then scan Metro's QR code with Expo Go on Android or the Camera app on iPhone.
Calendar needs the development or preview APK, not Expo Go in SDK 57.

If connection fails:

1. In the phone browser, open the configured laptop API URL with /health appended.
2. Keep uvicorn bound to 0.0.0.0 and running. Confirm the IPv4 address.
3. Use a trusted network without guest-client isolation; disable VPN for the test.
4. Allow backend port 8000 and Metro port 8081 through the laptop firewall.
5. Stop Metro and restart it with a cleared cache:

```bash
npx expo start --go --clear
```

If the QR/Metro connection still fails:

```bash
npm install --global @expo/ngrok
npx expo start --go --tunnel
```

Expo tunnel exposes Metro only. It does not expose FastAPI; use LAN access
or the deployed HTTPS backend described below.

## 5. Free backend deployment on Render

Create a GitHub repository with backend/ and mobile/ at its root using the
source generated inside sillicom. On Render choose New > Web Service, connect
that repository and select Python and the Free instance.

Settings:

- Root Directory: backend
- Build Command: python -m pip install -r requirements.txt && python -m pip check
- Start Command: python -m uvicorn app.main:app --host 0.0.0.0 --port $PORT --workers 1
- Health Check Path: /health
- PYTHON_VERSION: 3.11.17
- DATABASE_URL: sqlite:///./sillicom.db

The .python-version files also select Python 3.11. Copy the HTTPS URL from
Render after deployment. Free Render sleeps on idle and its local SQLite
file is lost on restart/redeploy/sleep. This MVP recreates tables, samples
and feed data at startup, so the free service is suitable for a demo, not
durable server-side history. Bookmarks remain on the phone.

Update the same mobile/.env file before building the APK.

Windows PowerShell, from sillicom/mobile:

```powershell
$SillicomApiUrl = (Read-Host 'Paste the HTTPS URL shown by Render').Trim().TrimEnd('/')
if (-not $SillicomApiUrl.StartsWith('https://')) { throw 'Use the Render HTTPS URL.' }
"EXPO_PUBLIC_API_URL=$SillicomApiUrl" | Set-Content -Encoding ascii .env
curl.exe --fail --max-time 120 "$SillicomApiUrl/health"
```

macOS/Linux, from sillicom/mobile:

```bash
read -r -p 'Paste the HTTPS URL shown by Render: ' SILLICOM_API_URL
SILLICOM_API_URL=${SILLICOM_API_URL%/}
case "$SILLICOM_API_URL" in https://*) ;; *) echo 'Use the Render HTTPS URL'; exit 1 ;; esac
printf 'EXPO_PUBLIC_API_URL=%s\n' "$SILLICOM_API_URL" > .env
curl --fail --max-time 120 "$SILLICOM_API_URL/health"
```

A sleeping Render service can take about a minute to wake. Visit /health in
its browser URL first, wait for success, then retry the mobile feed.

## 6. Installable Android APK with EAS

From sillicom/mobile:

```bash
npm install --global eas-cli
eas login
eas build:configure --platform android
npm run typecheck
npx expo install --check
eas build --platform android --profile preview
```

Log into your own Expo account. Allow project creation/linking and let EAS
generate the Android keystore when prompted. These account steps cannot be
pre-completed by the setup scripts.

The generated eas.json includes this preview profile:

```json
{
  "cli": {"appVersionSource": "local"},
  "build": {
    "preview": {
      "distribution": "internal",
      "environment": "preview",
      "android": {"buildType": "apk"}
    },
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "environment": "development",
      "android": {"buildType": "apk"}
    }
  }
}
```

Keep preview if build:configure adds another profile. .easignore deliberately
includes .env so the public API URL is present during the remote bundle build.
That file must contain only EXPO_PUBLIC_API_URL; the URL is public in the app.
If your Expo account already has an EXPO_PUBLIC_API_URL variable in the preview
environment, update/remove it so it does not override this file.

Wait for EAS to finish, open the build details link on your phone, download
the .apk, and allow Install unknown apps for the browser/file manager.
Tap the downloaded APK and install it. No Google Play account is needed.
The preview APK includes JavaScript/fonts and does not require Metro/Expo Go.
It still needs the configured backend to be reachable.

An API URL change requires rebuilding the APK; editing .env after installation
does not change the URL inside the already-built APK.

For an optional development APK:

```bash
eas build --platform android --profile development
npx expo start --dev-client
```

## 7. Smoke test: twelve checks

1. Tap topic bubbles; fewer than three blocks Continue; preferences survive restart.
2. Open News, Updates, Events and Hackathons; exercise search and topic chips.
3. Swipe news left: skip and advance with a spring/haptic.
4. Swipe news right: save and advance; verify the bookmark.
5. Swipe news up: advance without saving.
6. Tap Save/Skip/Share buttons and open the source; remove an item in Saved.
7. On the APK, Add to calendar opens a native editor; save and verify the event.
8. Hackathons show deadline rings, mode and team size; Open link launches a browser.
9. Switch Light, Dark and Follow system; check readability and system theme changes.
10. On the installed APK, load each feed, enable airplane mode, restart and verify
    cached content (allow the 10-second request timeout) plus saved bookmarks.
11. Pull to refresh; stop the backend on an uncached filter and check Retry.
12. Clear cache online; saved items/topics/theme remain; refresh downloads feeds again.

## 8. Common errors

| Error | Fix |
|---|---|
| Network request failed / could not reach Sillicom | Correct .env, use LAN IP for phone, bind uvicorn to 0.0.0.0 and allow port 8000. |
| Unable to resolve module | In mobile run npm install, npm run align, then npx expo start --go --clear. |
| Failed to create a worklet / plugin mismatch | Keep react-native-worklets/plugin last exactly once; align packages and rebuild APK. |
| Expo Go incompatible SDK | Use Expo Go supporting SDK 57, or install the preview APK; run npm run align. |
| Cannot find native module ExpoCalendar | Test calendar in the development/preview APK; SDK 57 Expo Go lacks the module. |
| Address already in use / EADDRINUSE | Stop the older uvicorn/Metro process with Ctrl+C before restarting. |
| npm.ps1 / eas.ps1 cannot be loaded | In PowerShell use npm.cmd, npx.cmd and eas.cmd instead. |
| Render 502 or first request times out | Check deployment logs/start command; wake /health and wait before retrying. |

## If it still fails, send me this

- Full terminal/red-screen error output, including the first error and stack trace.
- OS, phone Android/iOS version, node --version and Python version.
- mobile/package.json, mobile/app.json, mobile/babel.config.js, mobile/eas.json.
- mobile/.env's EXPO_PUBLIC_API_URL line (it is a public URL).
- backend/requirements.txt and uvicorn/Render logs if the API fails.
- Output of npm run typecheck, npx expo install --check and the /health curl.
- For APK failure, EAS build log/link and whether you used preview or development.

Do not paste passwords, Expo tokens, keystore credentials or unrelated secrets.
