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
