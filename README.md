# Recovo — Elite Athlete Performance Platform

Built by **Recovo**

---

## Project Structure

```
recovo/
├── mobile/          # React Native (Expo) — Android APK
└── dashboard/       # Next.js 14 — Coach web dashboard
```

---

## Mobile App (React Native + Expo)

### Stack
- **Expo SDK 51** + Expo Router v3 (file-based routing)
- **Firebase** — Auth + Realtime Database
- **Zustand** — global state
- **React Native Reanimated** — 60fps animations
- **EAS Build** — cloud APK/AAB generation

### Setup

```bash
cd mobile
npm install
cp .env .env.local  # fill in your Firebase credentials
```

Add your `google-services.json` from Firebase Console → Project Settings → Android App.

### Run locally

```bash
npx expo start          # Expo Go / dev client
npx expo run:android    # requires Android SDK
```

### Build APK (EAS)

```bash
npm install -g eas-cli
eas login               # log in to your Expo account
eas build:configure     # sets up eas.json (already done)

# Preview APK (installable .apk file)
eas build --platform android --profile preview

# Production AAB (for Play Store)
eas build --platform android --profile production
```

> The APK download link appears in your Expo dashboard after build completes (~10–15 min).

### Local APK without EAS (no cloud)

```bash
npx expo prebuild --platform android   # generates /android folder
cd android
./gradlew assembleRelease              # builds APK locally
# Output: android/app/build/outputs/apk/release/app-release.apk
```

> Requires Java 17 + Android SDK installed locally.

### Fonts

Download and place in `assets/fonts/`:
- [Bebas Neue](https://fonts.google.com/specimen/Bebas+Neue) → `BebasNeue-Regular.ttf`
- [IBM Plex Mono](https://fonts.google.com/specimen/IBM+Plex+Mono) → `IBMPlexMono-Regular.ttf`, `IBMPlexMono-Medium.ttf`
- [Outfit](https://fonts.google.com/specimen/Outfit) → `Outfit-Regular.ttf`, `Outfit-Medium.ttf`, `Outfit-SemiBold.ttf`

### App Screens

| Screen | Role | Description |
|--------|------|-------------|
| Dashboard | Both | Readiness ring, streak, 7-day snapshot, Kinetic Alert |
| Tracks | Athlete | Live session timer, MET calorie calc, workout log |
| Recovery | Athlete | Readiness ring, device sync simulation, AI suggestions |
| Injuries | Athlete | 3D body canvas tap-to-log, pain history |
| Daily Status | Athlete | Mood/energy/stress/sleep → synced to coach in real-time |
| Legion | Both | Join (athlete) or Forge (coach) + roster view |

---

## Coach Dashboard (Next.js 14)

### Stack
- **Next.js 14** App Router
- **Tailwind CSS** — Cosmic Onyx theme
- **Firebase** Realtime Database (client SDK)
- **Firebase Admin** SDK (API routes)
- **Recharts** — data visualisation

### Setup

```bash
cd dashboard
npm install
cp .env.local .env.local  # fill in your Firebase credentials
```

### Run locally

```bash
npm run dev    # http://localhost:3000
```

### Build & deploy

```bash
npm run build
npm run start

# Or deploy to Vercel:
npx vercel --prod
```

### Dashboard Pages

| Route | Description |
|-------|-------------|
| `/` | Legion Readiness Dashboard — team overview, distribution chart, athlete cards |
| `/legion` | Full roster table, invite code management |
| `/athletes` | Per-athlete drill-down — 14-day readiness trend, HRV/sleep charts, pain flags |

---

## Firebase Setup

1. Create a Firebase project at [console.firebase.google.com](https://console.firebase.google.com)
2. Enable **Email/Password** and **Google** auth providers
3. Enable **Realtime Database** (not Firestore)
4. Copy config into both `.env` files
5. Add these security rules to your Realtime Database:

```json
{
  "rules": {
    "users": {
      "$uid": {
        ".read": "$uid === auth.uid || root.child('legions').child(data.child('legionId').val()).child('coachUid').val() === auth.uid",
        ".write": "$uid === auth.uid"
      }
    },
    "workouts": {
      "$uid": {
        ".read": "$uid === auth.uid",
        ".write": "$uid === auth.uid"
      }
    },
    "recovery": {
      "$uid": {
        ".read": "$uid === auth.uid",
        ".write": "$uid === auth.uid"
      }
    },
    "injuries": {
      "$uid": {
        ".read": "$uid === auth.uid",
        ".write": "$uid === auth.uid"
      }
    },
    "daily_status": {
      "$uid": {
        ".read": "$uid === auth.uid",
        ".write": "$uid === auth.uid"
      }
    },
    "legions": {
      "$legionId": {
        ".read": "auth != null",
        ".write": "auth != null && (data.child('coachUid').val() === auth.uid || !data.exists())"
      }
    }
  }
}
```

---

## Formulas

```
Readiness = (Recovery × 0.7) − (Pain × 0.3)
Recovery  = (HRV_score × 0.4) + (RHR_score × 0.3) + (Sleep_score × 0.3)
Calories  = MET × weight_kg × duration_hours
```

---

## Roadmap

- [ ] Real device API integrations (Garmin, Whoop, Apple Health via HealthKit)
- [ ] Firebase Admin server-side auth verification in middleware
- [ ] Push notifications via Expo Notifications (injury alerts to coach)
- [ ] AI-powered periodisation suggestions using Claude API
- [ ] iOS build profile in EAS
- [ ] Play Store submission

---

*Recovo — building in public*
