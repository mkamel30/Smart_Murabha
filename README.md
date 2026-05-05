# Payment & Sales Desktop App

برنامج المبيعات والتحصيل - تطبيق سطح مكتب للشركة

## نظرة عامة

تطبيق سطح مكتب مبني بـ Electron لتتبع المبيعات والتحصيلات وإدارة العملاء والأقساط.

## التقنيات

- **Frontend**: React + TypeScript + Vite + TailwindCSS v4
- **Backend**: Node.js + Express + TypeScript
- **Database**: Prisma + SQLite
- **Desktop**: Electron

## المتطلبات

- Node.js 20+
- npm 10+

## التثبيت

```bash
npm install
```

## تشغيل التطوير

```bash
# تشغيل كل الخدمات (backend + frontend)
npm run dev

# تشغيل منفصل
npm run dev:backend   # تشغيل السيرفر
npm run dev:frontend  # تشغيل الواجهة
```

## بناء التطبيق

```bash
# بناء الواجهة
npm run build

# بناء تطبيق Electron
npm run build:electron
```

## قاعدة البيانات

```bash
# تشغيل migrations
npm run prisma:migrate

# إضافة بيانات تجريبية
npm run prisma:seed
```

## هيكل المشروع

```
payment-app/
├── frontend/          # React + Vite
├── backend/          # Express + Prisma
├── electron/         # Electron main + preload
└── package.json      # workspace root
```

## الواجهة

- اللغة: العربية (RTL)
- التنسيق: ar-EG
-_supported: Windows

## الوحات

- لوحة التحكم
- العملاء
- المبيعات
- الأقساط
- التحصيلات
- المتابعة
- التقارير

## الترخيص

خاص - للاستخدام الداخلي