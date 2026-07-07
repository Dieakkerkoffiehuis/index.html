# Optional: Native NFC Bridge for SUNMI V3 Mix (Capacitor)

**Only needed if Web NFC turns out to be unreliable on the SUNMI V3 Mix in testing.**
Try the built-in Web NFC path in the app first (see the main setup doc / test steps). Chrome on
Android generally supports `NDEFReader`, and the SUNMI V3 Mix runs Android with NFC hardware, so
there's a good chance you never need this. This doc exists so a developer can wire up the fallback
quickly if a specific device/OS build doesn't cooperate.

The web app already looks for this bridge first, before falling back to Web NFC:

```js
function nfcReadSupported(){ return !!(window.NativeNFC?.scan || window.NDEFReader); }
```

So the entire integration surface you need to build is **one small object**:

```js
window.NativeNFC = {
  scan(timeoutMs) { /* returns Promise<{uid: string}> */ },
  getWifiSSID()    { /* returns Promise<string>, optional */ }
};
```

Nothing else in the web app needs to change once that object exists on `window` before the Clock
In/Out screen loads.

## Why Capacitor

Capacitor can wrap the **already-deployed** `dieakker.pages.dev` site directly (via
`server.url` in its config) instead of bundling a local copy of the app — so this wrapper is a
thin shell, not a rebuild. The web app keeps deploying and updating itself exactly as it does now;
the wrapper just adds the native NFC + Wi-Fi bridge underneath it.

## Setup steps

```bash
npm install @capacitor/core @capacitor/android
npm install -D @capacitor/cli
npx cap init "Die Akker Clock" "za.co.dieakker.clock" --web-dir=www
```

`capacitor.config.ts`:

```ts
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'za.co.dieakker.clock',
  appName: 'Die Akker Clock',
  webDir: 'www',
  server: {
    // Point the wrapper straight at the live app — no local copy to maintain.
    url: 'https://dieakker.pages.dev',
    cleartext: false
  }
};
export default config;
```

Add the Android platform:

```bash
npx cap add android
```

## The NFC plugin

Use the community plugin rather than writing raw `NfcAdapter` code:

```bash
npm install @capacitor-community/nfc
npx cap sync android
```

Then create a tiny bridge plugin (`android/app/src/main/assets/native-bridge.js`, loaded by
Capacitor before the remote page — see `Capacitor.Plugins` docs for the exact injection point in
your Capacitor version) that wraps the plugin's event-based API into the `scan()` promise contract
the web app expects:

```js
// native-bridge.js — conceptual sketch, adjust to the exact
// @capacitor-community/nfc API for the Capacitor version in use.
import { NFC } from '@capacitor-community/nfc';

window.NativeNFC = {
  scan(timeoutMs = 20000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        sub.remove();
        reject(new Error('NFC_TIMEOUT'));
      }, timeoutMs);
      const sub = NFC.addListener('nfcTagScanned', (tag) => {
        clearTimeout(timer);
        sub.remove();
        resolve({ uid: tag.nfcTag?.id || '' });
      });
      NFC.startScan();
    });
  },
  // Optional — Wi-Fi SSID validation. Requires ACCESS_FINE_LOCATION on
  // Android (SSID is only readable with location permission granted).
  async getWifiSSID() {
    // Implement with a small custom Capacitor plugin around
    // android.net.wifi.WifiManager#getConnectionInfo().getSSID(),
    // or drop this method entirely — Wi-Fi validation is optional
    // and the web app skips it gracefully when unavailable.
    throw new Error('not implemented');
  }
};
```

## Android permissions

`android/app/src/main/AndroidManifest.xml`:

```xml
<uses-permission android:name="android.permission.NFC" />
<uses-feature android:name="android.hardware.nfc" android:required="true" />
<!-- Only if implementing getWifiSSID(): -->
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_WIFI_STATE" />
```

## Build & install on the SUNMI V3 Mix

```bash
npx cap sync android
cd android
./gradlew assembleDebug
# APK lands at android/app/build/outputs/apk/debug/app-debug.apk

adb connect <sunmi-ip>:5555     # or connect via USB
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

Sign a release build the normal Android way once it's confirmed working, and install that instead
for daily use.

## When to actually build this

Only after testing the Web NFC path (Chrome, on the SUNMI V3 Mix, over HTTPS) and finding it
unreliable — e.g. `NDEFReader` scan never firing, or Chrome not being the default/available
browser on the device's launcher. The app already degrades gracefully without this wrapper: the
Clock In/Out screen shows a clear "ask a manager to clock you in" message on unsupported devices,
so nothing breaks in the meantime.
