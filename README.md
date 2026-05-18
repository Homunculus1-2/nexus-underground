# NEXUS // PUBG Underground

PUBG Mobile akkauntlar, UC, turnirlar va giveaway uchun platforma.
Admin panel orqali to'liq boshqariladi.

## Texnologiyalar
- **Backend:** Node.js + Express
- **Database:** PostgreSQL
- **Frontend:** HTML + Tailwind (CDN)
- **Hosting:** Railway

## Loyiha tarkibi
```
nexus-app/
├── server.js          ← Express server + REST API
├── db.js              ← PostgreSQL schema va connection
├── package.json       ← dependencies
├── railway.json       ← Railway config
├── .env.example       ← config namunasi
└── public/
    ├── index.html     ← asosiy sayt (foydalanuvchilar uchun)
    └── admin.html     ← admin panel
```

---

## 🚀 RAILWAY'GA DEPLOY QILISH

### 1-qadam — GitHub'ga yuklash

1. [github.com](https://github.com) da yangi repo yarating (masalan: `nexus-underground`)
2. Loyihani GitHub'ga push qiling:

```bash
cd nexus-app
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/USERNAME/nexus-underground.git
git push -u origin main
```

### 2-qadam — Railway'da loyiha yaratish

1. [railway.app](https://railway.app) ga kiring (GitHub orqali login)
2. **"New Project"** → **"Deploy from GitHub repo"**
3. `nexus-underground` repo'ni tanlang
4. Railway avtomatik build qiladi

### 3-qadam — PostgreSQL qo'shish

1. Loyihangiz ichida **"+ New"** → **"Database"** → **"Add PostgreSQL"**
2. Railway PostgreSQL yaratadi va `DATABASE_URL` env variable'ni avtomatik qo'shadi

### 4-qadam — Environment Variables sozlash

Loyihangizning **Variables** bo'limiga o'ting va shularni qo'shing:

```
ADMIN_USERNAME=admin
ADMIN_PASSWORD=Sizning_kuchli_parolingiz_123
JWT_SECRET=juda_uzun_random_string_kamida_32_belgi_bolsin_xavfsizlik_uchun
NODE_ENV=production
```

> ⚠️ **MUHIM:** `ADMIN_PASSWORD` va `JWT_SECRET` ni o'zgartiring! Default qiymatlar bilan qoldirmang.

> `DATABASE_URL` va `PORT` Railway tomonidan avtomatik beriladi.

### 5-qadam — Domen olish

1. **Settings → Networking → Generate Domain** tugmasini bosing
2. Sizga `nexus-underground-production.up.railway.app` kabi domen beriladi
3. Yoki o'zingizning domeningizni ulashingiz mumkin (Custom Domain)

### 6-qadam — Tekshirish

- Sayt: `https://your-domain.up.railway.app/`
- Admin: `https://your-domain.up.railway.app/admin`

Admin sahifaga kirib, login/parol kiriting va akkauntlar, UC, turnirlar qo'shing!

---

## 💻 LOKAL ISHGA TUSHIRISH

```bash
# Dependencies o'rnatish
npm install

# .env yaratish
cp .env.example .env
# .env ichidagi qiymatlarni o'zgartiring

# PostgreSQL kerak (lokal)
# yoki Railway PostgreSQL URL'ni .env ga yozing

# Ishga tushirish
npm start
```

Sayt: http://localhost:3000
Admin: http://localhost:3000/admin

---

## 📋 ADMIN PANEL IMKONIYATLARI

Admin shu narsalarni boshqaradi:

- **Akkauntlar:** qo'shish, tahrirlash, o'chirish, "sotilgan" deb belgilash
- **UC paketlari:** narxlar, kategoriyalar
- **Turnirlar:** vaqt, mukofotlar, joylar, slot'lar
- **Giveaway:** vaqt, mukofotlar
- **G'oliblar:** kim qachon nimani yutgan
- **Leaderboard:** top o'yinchilar
- **Match jadvali:** keyingi o'yinlar
- **Statistika:** sotilgan akk soni, kurs, online userlar

Hammasi real vaqtda saytda yangilanadi.

---

## 🔐 XAVFSIZLIK

- Admin paroli `.env` da saqlanadi, kodga yozilmagan
- JWT token bilan autentifikatsiya
- 7 kun davomida login esda qoladi (localStorage)
- Faqat admin POST/PUT/DELETE qila oladi
- Boshqalar faqat GET (ma'lumotlarni ko'rish)

---

## 🐛 MUAMMOLAR

**Sayt ochilmayapti:**
- Railway dashboard'da Deploy log'larni tekshiring
- `DATABASE_URL` env variable mavjudligini tekshiring

**Admin'ga kira olmayapman:**
- `ADMIN_USERNAME` va `ADMIN_PASSWORD` env variable'lar to'g'ri yozilganmi?
- Browser console'ni oching (F12) — xatolarni ko'ring

**Database xato:**
- PostgreSQL plugin ishga tushirilganmi tekshiring
- `db.js` da xatolik bo'lsa, Railway log'lardan ko'rinadi

---

## 💰 NARX

Railway'da har oy **$5 bepul kredit** bor. Kichik loyiha uchun yetadi.
Ko'p trafik bo'lsa: $5-20/oy.

---

## 📞 ALOQA

Telegram: @nexus_underground (saytdagi linkda o'zgartiring)
