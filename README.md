# Flight Dispatcher (Next.js + Tailwind)

Web app קטנה: בוחר שדה תעופה (ICAO) → מקבל יציאות מהעכשיו והלאה + משך טיסה → קישור לפתיחה ב‑SimBrief.

## מה צריך
- Node.js 18+ (מומלץ 20+)
- מפתח RapidAPI ל‑AeroDataBox (Free tier)

## התקנה
```bash
npm install
```

## הגדרת מפתח API
1) שכפל את `.env.example` ל־`.env.local`
2) שים שם את המפתח:

```
RAPIDAPI_KEY=xxxxxxxxxxxxxxxx
```

## הרצה
```bash
npm run dev
```

ואז:
- פתח: http://localhost:3000
- הזן ICAO (למשל `LLBG`) ולחץ "הבא יציאות מהעכשיו"

## הערות
- כרגע הקלט מצפה ל‑ICAO (4 אותיות). אפשר להוסיף תמיכה ב‑IATA (3 אותיות) ע"י endpoint קטן שממפה IATA->ICAO.
- זמן "Airport" יעבוד הכי טוב אם ה‑API מחזיר timezone לשדה. אם לא, נוכל להוסיף קריאה משלימה ל‑timezone.

Enjoy ✈️
