# NYX Local Development Guide (Fedora / Linux & Android)

This document provides setup instructions for developing NYX on Linux (specifically Fedora/RHEL and Debian/Ubuntu derivatives) with Android Studio, Expo, and Supabase.

---

## 1. Prerequisites & Tooling Installation

### 1.1 Node.js & Package Manager
Verify Node.js (20+ LTS required, 24 verified) and npm:
```bash
node -v
npm -v
```

### 1.2 Android Development SDK (Fedora)
1. Install OpenJDK 17:
   ```bash
   sudo dnf install -y java-17-openjdk java-17-openjdk-devel
   ```
2. Download and install Android Studio or the standalone Android SDK command-line tools.
3. Set Android environment variables in `~/.bashrc` or `~/.zshrc`:
   ```bash
   export ANDROID_HOME=$HOME/Android/Sdk
   export PATH=$PATH:$ANDROID_HOME/emulator
   export PATH=$PATH:$ANDROID_HOME/platform-tools
   export PATH=$PATH:$ANDROID_HOME/cmdline-tools/latest/bin
   ```
4. Verify ADB connection:
   ```bash
   adb devices
   ```

### 1.3 Supabase CLI & Docker
1. Ensure Docker is installed and running:
   ```bash
   sudo systemctl enable --now docker
   sudo usermod -aG docker $USER
   ```
2. Verify Supabase CLI:
   ```bash
   supabase --version
   ```

---

## 2. Repository Configuration

1. Populate `.env` in the repository root:
   ```env
   EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
   EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ...
   ```
2. Install frontend dependencies:
   ```bash
   cd frontend
   npm install
   ```

---

## 3. Local Supabase Workflow

1. Start local Supabase instance:
   ```bash
   cd backend
   supabase start
   ```
2. Apply migrations:
   ```bash
   supabase db reset
   ```
3. Run database tests:
   ```bash
   supabase test db
   ```

---

## 4. Running the Android Application

1. Connect a physical Android device with USB debugging enabled, or launch an Android Virtual Device (AVD).
2. Start the Expo development server:
   ```bash
   cd frontend
   npx expo start --android
   ```
3. For prebuilding native Android projects (EAS / native debugging):
   ```bash
   cd frontend
   npx expo prebuild --platform android
   npx expo run:android
   ```

---

## 5. Verification & Test Execution

### 5.1 Unit, Vector & Security Tests
```bash
npm --prefix frontend test
# 12 test suites, 94 tests passing
```

### 5.2 Live Supabase Integration & Atomic CAS/Rotation Tests
Executes registration, Argon2id vault creation, atomic Compare-And-Swap (CAS) conflict rejection, atomic multi-account key rotation (`sync_rotate_vault`), and tenant isolation against live Supabase cloud infrastructure:
```bash
npm --prefix backend test
# or directly
node backend/tests/live_integration.test.js
```

### 5.3 Maestro Android UI Automation Flows
With an Android emulator running and Maestro installed (`curl -FsSL "https://get.maestro.mobile.dev" | bash`):
```bash
maestro test frontend/maestro/01-auth-flow.yaml
maestro test frontend/maestro/02-vault-lifecycle.yaml
maestro test frontend/maestro/03-authenticator-flow.yaml
maestro test frontend/maestro/04-synchronization-flow.yaml
maestro test frontend/maestro/05-recovery-flow.yaml
```

### 5.4 Applying Remote Supabase Migrations
Applies forward-only migrations sequentially to the live Supabase project using the Management API:
```bash
node backend/scripts/apply_remote_migrations.js
```

---

## 6. EAS Cloud Build & Project Authorization

NYX is configured with EAS project ID `0a58fd2d-3c2f-485d-8dd9-44b3ebc38a11` in `frontend/app.json`.

### 6.1 Entity Authorization (403 Forbidden)
If running `eas build` or `eas project:info` yields `Entity Not Authorized (403 Forbidden)`:
- Cause: The currently authenticated Expo account (`eas whoami`) does not have owner or collaborator permissions on the configured EAS project ID.
- Resolution Options:
  1. **Grant Permission:** Add the current Expo account as a collaborator in the expo.dev project dashboard.
  2. **Re-link Project (User Authorized Only):** With explicit developer authorization, re-link to an Expo project owned by the current account:
     ```bash
     cd frontend
     eas init
     ```

### 6.2 Local Standalone APK / AAB Build (Without Cloud EAS)
To build standalone release binaries locally using Android Studio or Gradle:
```bash
cd frontend
npx expo prebuild --platform android
cd android
./gradlew assembleRelease # generates release APK
./gradlew bundleRelease   # generates release AAB
```

---

## 7. Beta Release Gate Validation Runbook

Before promoting NYX from `CONDITIONALLY READY` to `VERIFIED BETA`:

1. **Physical Device Connection:**
   Connect a physical Android 14+ device via USB debugging and verify:
   ```bash
   adb devices
   ```
2. **Hardware Keystore & Biometric Invalidation Test:**
   - Install release APK: `adb install frontend/android/app/build/outputs/apk/release/app-release.apk`.
   - Setup vault with Master Passphrase and biometrics.
   - Lock vault and verify biometric unlock succeeds.
   - Go to Android OS Settings -> Security -> Add a new fingerprint.
   - Reopen NYX: verify that the application detects biometric enrollment change and prompts for Master Passphrase re-authentication.
3. **Offline Mutation Queue Crash Test:**
   - Put device in Airplane Mode.
   - Create 3 new TOTP accounts and edit 1 account.
   - Kill app process forcefully: `adb shell am force-stop com.anonymous.nyx`.
   - Reopen app: verify all 4 mutations remain queued in journal (`nyx_mutation_queue_v1.journal`).
   - Re-enable network: verify all mutations sync cleanly with atomic CAS.
4. **Two-Phase Key Rotation Test:**
   - Trigger Vault Key Rotation.
   - Force-kill app immediately upon cloud commit.
   - Reopen app: verify `recoverInterruptedRotation` detects `CLOUD_COMMITTED`, saves $K_v'$ to Keystore, and unlocks cleanly without lockout.
