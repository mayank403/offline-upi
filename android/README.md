# Offline UPI Android App (Native Kotlin + Jetpack Compose)

This is the real, production-ready native Android application codebase that enables real-world **offline UPI payments** using the official NPCI `*99#` NUUP USSD protocol and UPI 123PAY voice IVR on physical Android smartphones.

---

## 🏗️ Project Architecture

```
android/
├── app/
│   ├── build.gradle.kts
│   └── src/main/
│       ├── AndroidManifest.xml          # Telephony, CALL_PHONE, and offline intents
│       ├── res/                         # Strings, colors, themes, accessibility configs
│       └── java/com/offlineupi/app/
│           ├── MainActivity.kt          # Handles runtime permissions & upi://pay intents
│           ├── telephony/
│           │   ├── UssdController.kt    # Encodes & triggers *99# USSD & 123PAY calls
│           │   └── UssdAutomationService.kt # Accessibility service to assist user
│           ├── qr/
│           │   └── OfflineQrParser.kt   # Decodes upi://pay QR URLs offline
│           ├── data/
│           │   └── OfflineStorage.kt    # Offline beneficiary persistence
│           └── ui/
│               ├── theme/Theme.kt       # Modern dark fintech theme
│               └── screens/HomeScreen.kt# Jetpack Compose UI
├── gradle/
│   └── libs.versions.toml               # Modern Gradle Version Catalog
├── build.gradle.kts
└── settings.gradle.kts
```

---

## ⚡ Key Real-World Engineering Highlights

1. **MMI `#` Encoding (`Uri.encode`):**
   When invoking Android's `Intent.ACTION_CALL` with USSD strings like `*99#`, Android's URI parser treats `#` as a URL fragment identifier by default. `UssdController.kt` properly encodes it (`*99%23`), ensuring carrier networks receive the complete MMI command.

2. **TelephonyManager Support (`sendUssdRequest`):**
   Includes programmatic USSD invocation for Android 8.0+ (API 26+) with fallback to the direct telephony dialer.

3. **Offline `upi://pay` Deep Link Receiver:**
   Registered in `AndroidManifest.xml` to catch offline UPI intent URLs from local QR scanners, Bluetooth, or SMS, converting them instantly into the corresponding `*99#` MMI code.

---

## 📲 How to Build & Install on Your Phone

### Step 1: Open in Android Studio
1. Launch **Android Studio** (Hedgehog, Iguana, Jellyfish, or newer).
2. Click **Open** and select the folder:
   `c:\Users\Mayank\Desktop\upi without internet\android`
3. Wait for Gradle Sync to complete.

### Step 2: Connect Your Android Phone
1. Enable **Developer Options** and **USB Debugging** on your phone:
   - Settings ➔ About Phone ➔ Tap "Build Number" 7 times.
   - Settings ➔ Developer Options ➔ Enable "USB Debugging".
2. Plug your phone into your computer via USB.

### Step 3: Run / Build APK
- **Direct Run:** Select your phone in Android Studio's device dropdown and click the green **Play (Run)** button.
- **Generate APK:** Go to **Build ➔ Build Bundle(s) / APK(s) ➔ Build APK(s)**. The `.apk` file will be generated in `app/build/outputs/apk/debug/`.
- Transfer the `.apk` file to your phone and install it.

---

## 🧪 Real-World Testing on Phone (Without Internet)

1. Turn **OFF** Mobile Data and Wi-Fi on your phone.
2. Launch the **Offline UPI** app.
3. Grant the **Phone Call** permission when prompted.
4. Tap **Main *99#** or **Check Balance (*99*3#)**:
   - Your carrier (Airtel, Jio, Vi, BSNL) will open the official NPCI prompt.
   - Enter your bank UPI PIN directly on the carrier screen.
   - You will receive instant confirmation and a carrier SMS from your bank with zero internet used!
