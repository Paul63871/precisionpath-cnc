# App Store / Play Store Readiness

## What's done

- **Capacitor native wrapper** added for both platforms (`ios/`, `android/` folders), app ID `com.precisionpath.cnc`.
- **App icons** generated at every required size for iOS, Android (including adaptive/maskable), and the web PWA manifest — sourced from a custom PrecisionPath CNC mark (`assets/icon.png`).
- **Splash screens** generated for both platforms (light + dark).
- **`manifest.json`** now exists (was previously referenced by `index.html` but missing) with correct name, theme color, and icon set — makes the site properly installable as a PWA too.
- Android build already targets SDK 35 (current Play Store requirement) via Capacitor's default config.

## What's still needed before you can actually submit

**iOS (App Store):**
1. A Mac with Xcode installed — CocoaPods and `xcodebuild` aren't available in this Linux sandbox, so `pod install` and any real iOS build/run has to happen there (or in a cloud Mac CI like Xcode Cloud/Codemagic).
2. An Apple Developer Program account ($99/yr) to get a Team ID, provisioning profile, and signing certificate.
3. Open `ios/App/App.xcworkspace` in Xcode, set your Team, run `pod install` once, then Archive → upload to App Store Connect.
4. App Store Connect listing: screenshots (6.7", 6.5", 5.5" sizes), description, keywords, support URL, privacy policy URL, age rating, and privacy "nutrition label" (what data the app collects — should be minimal/none since there's no tracking).

**Android (Play Store):**
1. Android Studio (or just Gradle/JDK) to build a signed release AAB — can likely be done here in the sandbox if you want; ask and I can attempt a headless Gradle build.
2. A **release keystore** — generate once, keep it forever (losing it means you can never update the app again under the same listing). I have not generated one yet since it's a permanent, sensitive artifact you should own/store yourself.
3. A Google Play Console account ($25 one-time) to create the listing: screenshots, description, content rating questionnaire, privacy policy URL, data-safety form.
4. Upload the signed AAB, complete the store listing, submit for review.

**Both stores also want:**
- A **privacy policy URL** — required even for apps that store data only locally. Should be a short static page describing that saved calculations/materials/profiles are stored in your account and not sold/shared.
- A support/contact URL or email.
- Confirmation that `deleteAccount` (already implemented as a backend function) is reachable from within the app, since both stores require in-app account deletion if you offer account creation.

## Recommended split of work

- **Icons, splash, screenshots, store copy/descriptions** — fine to keep doing in Base44 while the subscription is active, since these are static assets independent of the codebase.
- **Capacitor wrapper, build config, signing setup** — keep this in the GitHub repo (already done here) since it needs to travel with the portable, non-Base44-locked codebase for the actual store builds.
