# InforTest — Informatika bo'yicha onlayn test tizimi

5-10 sinflar uchun informatika fanidan nazorat ishlari test tizimi.

## Xususiyatlar

- Ro'yxatdan o'tish va kirish (MongoDB da saqlanadi)
- 5-10 sinflar uchun savollar
- Har bir sinf uchun 4 ta nazorat ishi
- Har bir testda 20 ta savol (tasodifiy tartibda)
- Natijalar MongoDB da saqlanadi
- 70%+ natija uchun sertifikat (PNG)

## Texnologiyalar

- **Backend**: Node.js, Express.js, Mongoose
- **Ma'lumotlar bazasi**: MongoDB Atlas
- **Frontend**: HTML, CSS, JavaScript (vanilla)
- **Deploy**: Render.com

## O'rnatish

```bash
# Loyihani klonlash
git clone <repo-url>
cd informatika-test

# Paketlarni o'rnatish
npm install

# .env faylini yaratish
cp .env.example .env
# MONGODB_URI ni o'zgartiring

# Serverni ishga tushirish
npm start
```

Server `http://localhost:3000` da ishlaydi.

## Environment Variables

| Nomi | Tavsif |
|------|--------|
| `MONGODB_URI` | MongoDB Atlas connection string |
| `PORT` | Server porti (default: 3000) |

## Render.com da deploy qilish

1. GitHub reponi Render.com ga ulang
2. "New Web Service" yarating
3. Environment variable qo'shing: `MONGODB_URI`
4. Deploy tugmasini bosing

Yoki `render.yaml` fayli avtomatik sozlashni amalga oshiradi.

## API Endpoints

### Auth
- `POST /api/auth/register` — Ro'yxatdan o'tish
- `POST /api/auth/login` — Kirish

### Quiz
- `GET /api/quiz/questions` — Barcha savollarni olish (javobsiz)
- `POST /api/quiz/submit` — Test natijalarini yuborish
- `GET /api/quiz/results/:userId` — Foydalanuvchi natijalarini olish
