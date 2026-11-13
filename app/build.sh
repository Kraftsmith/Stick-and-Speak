#!/usr/bin/env bash
# Rebuilds the Android APK from the web app in ../web -> ../stick-and-speak.apk
set -e
cd "$(dirname "$0")"
export JAVA_HOME="/c/Program Files/Microsoft/jdk-21.0.13.21-hotspot"
export PATH="$JAVA_HOME/bin:$PATH"
# sticker artwork and the launch screen picture (web and iOS) from ../Art
node art.js
# the whole web app goes into the Capacitor web dir, as is (no build step; sw.js is not registered inside the shells)
rm -rf www && cp -r ../web www && rm -rf www/.vercel www/.gitignore www/README.md
npx cap sync android
(cd android && ./gradlew.bat assembleDebug -q)
cp android/app/build/outputs/apk/debug/app-debug.apk ../stick-and-speak.apk
echo "APK: $(cd .. && pwd)/stick-and-speak.apk"
# iOS: the web assets go into ios/App/App/public too; compiling needs a Mac (see IOS.md)
npx cap sync ios >/dev/null 2>&1 && echo "iOS project synced (app/ios)"
