# Run the redesigned Sangai beta

Sangai uses one Expo / React Native codebase for Android and iOS. This local APK targets an **x86_64 Android emulator**, is signed with a development certificate, and includes its JavaScript bundle. It does not require Metro. It is not a Play Store release or an APK for a typical ARM phone.

## On this Windows computer

1. Start Docker Desktop. In PowerShell, run:

   ```powershell
   Set-Location 'C:\Users\Dell\Documents\Codex\2026-09-28\u\work\DatingAppMVP'
   docker compose up -d
   docker compose ps
   ```

   API, database and Mailpit should be healthy. The host API is `http://localhost:4100`; the Android emulator uses `http://10.0.2.2:4100`.

2. Open Android Studio → Device Manager and start the **SangaiBeta** emulator. Its task-local AVD is stored on D:. If Android Studio does not list it, start it from PowerShell:

   ```powershell
   $env:ANDROID_AVD_HOME='D:\CodexBuild\SangaiBeta\Avds'
   $env:ANDROID_USER_HOME='D:\CodexBuild\SangaiBeta\AndroidUser'
   $env:ANDROID_EMULATOR_HOME='D:\CodexBuild\SangaiBeta\AndroidUser'
   & 'D:\CodexBuild\SangaiBeta\AndroidSdk\emulator\emulator.exe' -avd SangaiBeta
   ```

3. Drag the delivered `Sangai-ui-polish-beta-x86_64.apk` onto the running emulator, then open **Sangai Beta**. Alternatively:

   ```powershell
   & 'D:\CodexBuild\SangaiBeta\AndroidSdk\platform-tools\adb.exe' install -r 'C:\Users\Dell\Documents\Codex\2026-09-28\u\outputs\Sangai-ui-polish-beta-x86_64.apk'
   ```

Use a clearly labeled fictional demo account to explore immediately. To exercise signup, create an email/password account and read its local verification message at `http://localhost:8025`. This is a captured development email, not external delivery. Complete the adult declaration and all five profile steps. Real accounts do not discover fictional demo accounts.

Tap **Explore demo accounts** on Welcome, Sign up or Log in, then choose **Try Aarav demo account**. If an old session is already open, use Profile → Profile settings → Sign out first. The [October UI audit](ui-redesign.md) describes the current layouts and verification.

## Build and run from Android Studio

The prepared native project is **`D:\CodexBuild\SangaiBeta\Mobile\android`**. Open that directory, rather than the parent folder. Use Java 21 as the Gradle JDK and `D:\CodexBuild\SangaiBeta\AndroidSdk` as the Android SDK. The parent `Mobile` folder contains the matching Expo source. The source-of-truth Git repository is the C: path above; sync any source changes to the short D: build directory before building there.

The normal debug Run button needs Metro. In a separate PowerShell terminal:

```powershell
Set-Location 'D:\CodexBuild\SangaiBeta\Mobile'
npx expo start --dev-client --localhost
```

For a self-contained emulator APK:

```powershell
$env:JAVA_HOME='D:\CodexBuild\SangaiBeta\Java21\jdk-21.0.12.1+1'
$env:ANDROID_HOME='D:\CodexBuild\SangaiBeta\AndroidSdk'
$env:ANDROID_SDK_ROOT=$env:ANDROID_HOME
$env:ANDROID_USER_HOME='D:\CodexBuild\SangaiBeta\AndroidUser'
$env:ANDROID_EMULATOR_HOME='D:\CodexBuild\SangaiBeta\AndroidUser'
$env:GRADLE_USER_HOME='D:\CodexBuild\SangaiBeta\Gradle'
$env:NODE_ENV='production'
Set-Location 'D:\CodexBuild\SangaiBeta\Mobile\android'
.\gradlew.bat :app:assembleRelease -PreactNativeArchitectures=x86_64 --max-workers=1 --no-daemon
```

The APK is under `app\build\outputs\apk\release\app-release.apk`. Regenerate native projects with Expo when configuration or native dependencies change; do not edit generated Gradle/Xcode files manually. This host needs the task-local newer Ninja described in README to avoid Windows path failures. Run native compilation, multi-platform export and emulator testing sequentially on this 16 GB host. Two simultaneous API 36 emulators stalled the extra instance and caused paging pressure; prefer one emulator and a lightweight browser client. An earlier concurrent build/export expanded the Windows pagefile and temporarily exhausted C: space. Native build output and task-local temporary files are on D:; check free space before the next large build.

## What to try

- **Discover:** swipe or use Pass / Like / Super Like; undo a decision before matching. A second positive swipe is required before chat opens. Incoming likes remain hidden.
- **Chat:** choose an existing match, send a message, then open `+` for ordinary media, games and Plan a Date. The camera and match-only stories live here.
- **Games:** open two accounts on separate clients, select each other, and mark both ready. Invite, explicitly accept, then play. Three games are available; four follow in the next agreed increment.
- **Sangai:** share a library photo/video or text moment with matches, comment, save, or share with someone already authorized to see it.
- **Profile:** edit sections/gallery, open My moments or Saved moments, adjust privacy, and preview Free / Plus pricing. Purchases remain unavailable.

For two simultaneous clients, use a second emulator or the secondary browser preview at `http://localhost:8081` after starting `npm run web --prefix apps/mobile -- --host localhost` from the repository root.

Google sign-in needs registered OAuth clients and a rebuilt app. External email needs configured SMTP and HTTPS. Native iOS still needs a Mac/device or EAS environment and runtime testing; an iOS bundle export is not an iOS device test. See `verification.md` for the exact completed checks.
