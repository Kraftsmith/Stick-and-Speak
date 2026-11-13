# iOS build

The iOS project lives in `app/ios/` (Capacitor). It uses the same `www/` as Android, so the web app, artwork and voice clips are shared. Settings already in place: landscape only, full screen, status bar hidden, bundle id `app.stickandplay.kids`, display name "Stick & Speak", 1024px app icon, deployment target iOS 15.

## What is needed

- A Mac with Xcode (or a cloud Mac / CI, see below). Windows cannot compile or sign an iOS app.
- An Apple Developer account (99 $/year) for signing, TestFlight and the App Store.

## Refresh the web assets (any OS)

```
cd app
bash build.sh          # Android APK; also runs art.js and copies www
npx cap sync ios       # copies www into ios/App/App/public and updates plugins
```

## Build on a Mac

```
cd app
npm install
npx cap sync ios
npx cap open ios       # opens Xcode
```

In Xcode: select the team under Signing & Capabilities, pick a device or simulator, Run. For TestFlight: Product → Archive → Distribute.

## Build without a Mac

Any of these builds and signs from the same `app/` folder:
- **Codemagic** (free minutes for small projects): connect the repository, choose "Capacitor", add the App Store Connect API key; it produces an IPA and can upload to TestFlight.
- **GitHub Actions** with a `macos-latest` runner: `npm ci && npx cap sync ios && xcodebuild -workspace ios/App/App.xcworkspace -scheme App -configuration Release archive`, then `xcodebuild -exportArchive`. Signing needs the certificate and provisioning profile as secrets (fastlane `match` is the usual way).
- A rented Mac in the cloud (MacStadium, MacinCloud) with Xcode, used over remote desktop.

Either way the repository must be in git first (the project is not yet).

## Before App Store review (Kids Category)

- App Store Connect: age band 5 and under, Kids Category; no third-party analytics or ads SDKs.
- Privacy "nutrition label": no data collected (nothing leaves the device until the parent account in 7.1 exists; then "contact info: email, linked to user" for the parent only).
- A parental gate before any link out or purchase — already the parent lock.
- Screenshots for 12.9" and 11" iPad and 6.7" iPhone, landscape.
