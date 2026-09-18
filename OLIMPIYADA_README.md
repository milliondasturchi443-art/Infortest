# Informatika Olimpiyada - Руководство

## 📌 Описание

Добавлены олимпиадные тесты по информатике для 9, 10 и 11 классов.

## 📁 Структура файлов

```
data/
  └── informatika.js    # Олимпиадные тесты (9, 10, 11 sinf)
routes/
  └── quiz.js           # Обновлен для поддержки олимпиады
```

## 🎯 Содержание

### 9-sinf olimpiyada
- **Количество вопросов:** 20
- **Темы:**
  - Основы информатики
  - Кодировки (ASCII)
  - MS Word
  - Python программирование
  - MS Excel
  - Логические выражения
- **Балльная система:**
  - Вопросы 1-10: 0.9 балла
  - Вопросы 11-20: 1.5 балла

### 10-sinf olimpiyada
- **Количество вопросов:** 20
- **Темы:**
  - Логика
  - Платформы (CMS, Joomla)
  - Программирование (IDE, трансляторы)
  - Python (операторы, функции)
  - Алгоритмы
- **Балльная система:**
  - Вопросы 1-10: 0.9 балла
  - Вопросы 11-20: 1.5 балла

### 11-sinf olimpiyada
- **Количество вопросов:** 20
- **Темы:**
  - IDE
  - Python (функции, модули)
  - MS Excel (функции, ошибки)
  - Базы данных
  - Веб-разработка
  - Логические выражения
- **Балльная система:**
  - Вопросы 1-10: 0.9 балла
  - Вопросы 11-20: 1.5 балла

## 🔧 API Endpoints

### Получить вопросы олимпиады
```http
GET /api/quiz/questions?subject=informatika-olimpiyada
```

**Ответ:**
```json
{
  "9-sinf olimpiyada": {
    "label": "9-sinf olimpiyada",
    "tests": [
      {
        "title": "Informatika olimpiyada - 9-sinf",
        "topic": "Olimpiyada savollari",
        "questions": [...]
      }
    ]
  },
  "10-sinf olimpiyada": {...},
  "11-sinf olimpiyada": {...}
}
```

### Получить список предметов
```http
GET /api/quiz/subjects
```

**Ответ:**
```json
{
  "informatika": {
    "grades": ["5-sinf", "6-sinf", ...],
    "totalTests": 28
  },
  "informatika-olimpiyada": {
    "grades": ["9-sinf olimpiyada", "10-sinf olimpiyada", "11-sinf olimpiyada"],
    "totalTests": 3
  },
  ...
}
```

### Отправить ответы
```http
POST /api/quiz/submit
```

**Body:**
```json
{
  "userId": "user_id_here",
  "subject": "informatika-olimpiyada",
  "sinf": "9-sinf olimpiyada",
  "testIdx": 0,
  "answers": [1, 0, 3, 2, 0, 3, 0, 1, 3, 2, 2, 1, 3, 1, 0, 0, 1, 0, 1, 2]
}
```

**Ответ:**
```json
{
  "score": 18,
  "total": 20,
  "pct": 90,
  "key": "informatika-olimpiyada_9-sinf olimpiyada_0",
  "xpEarned": 50,
  "correctAnswers": [...],
  "streak": 5,
  "level": 3,
  "xp": 250
}
```

### Рейтинг (с фильтром)
```http
GET /api/quiz/leaderboard?filter=olimpiyada
```

**Параметры:**
- `filter=all` - Все результаты (default)
- `filter=olimpiyada` - Только олимпиада
- `filter=informatika` - Только информатика
- `filter=matematika` - Только математика

**Ответ:**
```json
[
  {
    "rank": 1,
    "name": "Alisher",
    "school": "3-MKTB",
    "region": "Toshkent",
    "grade": "9-sinf",
    "totalTests": 3,
    "avgPct": 92,
    "xp": 300,
    "level": 3,
    "streak": 5,
    "subjects": {
      "informatika-olimpiyada": { "count": 3, "avg": 92 }
    },
    "sinfs": {
      "9": { "count": 1, "avg": 90 },
      "10": { "count": 1, "avg": 94 },
      "11": { "count": 1, "avg": 92 }
    }
  }
]
```

## 💻 Пример использования на фронтенде

### React/JavaScript
```javascript
// Получить вопросы олимпиады
async function getOlimpiadaQuestions() {
  const response = await fetch('/api/quiz/questions?subject=informatika-olimpiyada');
  const data = await response.json();
  return data;
}

// Отправить ответы
async function submitOlimpiadaTest(userId, sinf, testIdx, answers) {
  const response = await fetch('/api/quiz/submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId,
      subject: 'informatika-olimpiyada',
      sinf,
      testIdx,
      answers
    })
  });
  return await response.json();
}

// Получить рейтинг олимпиады
async function getOlimpiadaLeaderboard() {
  const response = await fetch('/api/quiz/leaderboard?filter=olimpiyada');
  const data = await response.json();
  return data;
}
```

## 🔑 Ключи ответов

### 9-sinf
```
B, A, D, C, A, D, A, B, D, C, C, B, D, B, A, A, B, A, B, C
```

### 10-sinf
```
B, B, D, B, B, A, A, C, D, D, A, B, C, A, A, C, A, A, D, C
```

### 11-sinf
```
C, B, B, A, A, A, A, B, D, C, B, D, A, B, D, A, B, C, B, B
```

## 📊 Система оценивания

- **90-100%**: 50 XP + отлично
- **70-89%**: 30 XP + хорошо
- **50-69%**: 20 XP + удовлетворительно
- **0-49%**: 10 XP + нужно улучшить

## 🚀 Деплой

После мерджа Pull Request изменения будут автоматически применены на продакшене.

## 📝 Лицензия

© 2026 Infortest - Все права защищены
