#!/usr/bin/env bash
# Rebuilds the Android APK from prototype/index.html -> ../stick-and-speak.apk
set -e
cd "$(dirname "$0")"
export JAVA_HOME="/c/Program Files/Microsoft/jdk-21.0.13.21-hotspot"
export PATH="$JAVA_HOME/bin:$PATH"
node art.js
npm run prepare:web
npx cap sync android
(cd android && ./gradlew.bat assembleDebug -q)
cp android/app/build/outputs/apk/debug/app-debug.apk ../stick-and-speak.apk
echo "APK: $(cd .. && pwd)/stick-and-speak.apk"
# iOS: the web assets go into ios/App/App/public too; compiling needs a Mac (see IOS.md)
npx cap sync ios >/dev/null 2>&1 && echo "iOS project synced (app/ios)"
