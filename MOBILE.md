# Nigeria Flavours Mobile App

The repository now contains Capacitor projects for Android and iOS.

## Before building

The native app needs a public HTTPS URL for the Express API. Set it in the environment before synchronizing:

```powershell
$env:CAPACITOR_API_URL = 'https://nigeria-flavours-website.onrender.com/api'
npm run cap:sync
```

The value is written to `www/app-config.js` and bundled into both native projects.

## Android

Install Android Studio, the Android SDK, and a JDK. Then run:

```powershell
$env:CAPACITOR_API_URL = 'https://nigeria-flavours-website.onrender.com/api'
npm run android
```

Alternatively, open the generated `android` folder in Android Studio and run the app on an emulator or connected device. Build an APK or AAB from Android Studio for distribution.

## iOS

iOS builds require macOS, Xcode, CocoaPods, and an Apple Developer account for device distribution. Copy this repository to a Mac, install dependencies, then run:

```bash
export CAPACITOR_API_URL='https://your-api-host.example.com/api'
npm install
npm run cap:sync
npx cap open ios
```

Use Xcode to select a signing team, configure the bundle identifier `com.nigeriaflavours.app`, and archive the app for TestFlight or the App Store.
