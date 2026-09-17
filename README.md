# Ensura — Live Indian Train Tracker

Real IRCTC1 (RapidAPI) data ke saath — Live Train Status, PNR Status, Trains Between Stations.
API key kabhi bhi frontend mein expose nahi hoti — sab kuch Vercel serverless functions ke through proxy hota hai.

## Deploy steps (Vercel)

1. Is poore folder ko GitHub repo mein push karo (ya seedha Vercel CLI se deploy karo: `vercel`).
2. Vercel dashboard → Project → **Settings → Environment Variables** mein jaake add karo:
   - Key: `RAPIDAPI_KEY`
   - Value: tumhara RapidAPI IRCTC1 key
3. Redeploy karo (env variable add karne ke baad ek naya deployment trigger karna padta hai).
4. Live URL khol ke test karo.

## Local testing

```
npm i -g vercel
vercel dev
```
`.env.example` ko `.env` bana ke usme apna real key daal do (`.env` ko `.gitignore` mein zaroor rakhna — commit mat karna).

## Free-tier limits (IMPORTANT)

IRCTC1 API ka free tier bahut limited hai (kabhi 20-50 calls/month — RapidAPI dashboard par apna exact limit check karo). Isliye:

- Station search **local hai** (`data/stations.json`) — koi API call nahi lagti.
- Har result session ke liye cache hota hai (`sessionStorage`) — same train/PNR/route dobara dekhne par API call waste nahi hoti.
- Header mein "X calls used this session" counter dikhta hai (sirf tracking ke liye, hard limit nahi laga hai).

Zyada usage chahiye to RapidAPI par paid plan upgrade karna padega.

## Known limitation

IRCTC1 API ka exact response format kabhi-kabhi thoda vary karta hai. Isliye har result card ke niche ek **"Raw response"** collapsible section diya hai — agar UI mein koi field missing/galat dikhe, raw JSON mein poora asli data hamesha available rahega.

## Files

```
index.html            → UI
style.css              → dark theme
script.js               → frontend logic (tabs, autocomplete, caching)
data/stations.json      → local station list (autocomplete)
api/live-status.js      → serverless proxy: live train status
api/pnr-status.js       → serverless proxy: PNR status
api/trains-between.js   → serverless proxy: trains between stations
```
