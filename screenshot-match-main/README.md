# Kerala Prayer Times

Daily prayer times for all 14 Kerala districts, including the five prayers and Sunrise (displayed last). The app includes Malayalam/Arabic/English prayer labels, a live clock, stopwatch, next-prayer countdown and an Azan player.

## Local development

Node.js 22 or newer is recommended.

```bash
npm install
npm run dev
```

## Deploy on Vercel

1. Import `darulswalathhifzulquran-sketch/prayertime` from GitHub.
2. Set **Root Directory** to `screenshot-match-main`.
3. Use the **TanStack Start** framework preset; leave build/output settings at the framework defaults.
4. Deploy. Changes pushed to the linked production branch trigger automatic deployments.

The app uses TanStack Start, Nitro, React, Vite and Tailwind. It does not need a Lovable build plugin.

## Data and audio

Prayer times are fetched from the AlAdhan API using district-headquarters coordinates. Calculated times may not match the timetable of a local mosque.

The Azan player requires an uploaded or otherwise properly hosted MP3 URL to play audio; the existing interface alone does not upload audio. Audio autoplay and background notifications depend on browser permissions and browser/OS restrictions.
