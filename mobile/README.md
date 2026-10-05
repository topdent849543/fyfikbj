# TopDent Native Android App

This folder is a real React Native/Expo Android client. It does **not** use WebView. It connects to the existing Express API and therefore uses the same Supabase database, authentication, products, orders, uploads, and role permissions as the web application.

## Local development

```bash
npm ci
EXPO_PUBLIC_API_URL=https://fyfikbj-production.up.railway.app/api npx expo start
```

## Build APK with GitHub Actions

Open **Actions → Build TopDent Android APK → Run workflow**. Optionally provide a backend API URL ending in `/api`. The generated `topdent-release-apk` is available in the workflow artifacts.

Every push to `main` that changes `mobile/**` also triggers the build.

## Backend requirements

Add the Android app origins to the backend `CORS_ORIGINS` if the API rejects native requests. Keep `SUPABASE_SERVICE_KEY` and `JWT_SECRET` server-side only; never place them in this folder or in an APK.
