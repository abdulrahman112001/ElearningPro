# دليل دعم RTL والترجمة في المنصة

## ✅ التحسينات المطبقة

### 1. دعم RTL (Right-to-Left)

#### تكوين HTML

```tsx
// app/layout.tsx
<html lang={locale} dir={isRTL ? "rtl" : "ltr"}>
```

#### CSS للدعم الكامل لـ RTL

تم إضافة الأصناف التالية في `app/globals.css`:

```css
/* Logical Properties للدعم الكامل لـ RTL */
.ms-2 {
  margin-inline-start: 0.5rem;
} /* يعمل كـ margin-left في LTR و margin-right في RTL */
.me-2 {
  margin-inline-end: 0.5rem;
} /* يعمل كـ margin-right في LTR و margin-left في RTL */
.ps-4 {
  padding-inline-start: 1rem;
}
.pe-4 {
  padding-inline-end: 1rem;
}
.start-0 {
  inset-inline-start: 0;
}
.end-0 {
  inset-inline-end: 0;
}
.text-start {
  text-align: start;
}
.text-end {
  text-align: end;
}
```

#### قاعدة Tailwind الذهبية

❌ **لا تستخدم أبداً:**

- `ml-`, `mr-` (استخدم `ms-`, `me-` بدلاً منها)
- `pl-`, `pr-` (استخدم `ps-`, `pe-` بدلاً منها)
- `left-`, `right-` (استخدم `start-`, `end-` بدلاً منها)
- `text-left`, `text-right` (استخدم `text-start`, `text-end`)

✅ **استخدم دائماً:**

```tsx
// ✅ صحيح - يعمل في RTL و LTR
<Icon className="me-2" />

// ❌ خطأ - لن يعمل بشكل صحيح في RTL
<Icon className="mr-2" />
```

#### أيقونات الأسهم في RTL

```tsx
// للأسهم التي يجب أن تنعكس في RTL
<ArrowLeft className="me-2 rtl:rotate-180" />

// الأيقونة ستكون:
// → في LTR
// ← في RTL
```

---

### 2. نظام الترجمة

#### البنية

```
messages/
  └── ar.json  (الترجمة العربية - الافتراضية)
```

#### استخدام الترجمات في المكونات

##### Client Components

```tsx
"use client"
import { useTranslations } from "next-intl"

export function MyComponent() {
  const t = useTranslations("namespace")

  return (
    <div>
      <h1>{t("title")}</h1>
      <p>{t("description")}</p>
    </div>
  )
}
```

##### Server Components

```tsx
import { getTranslations } from "next-intl/server"

export default async function MyPage() {
  const t = await getTranslations("namespace")

  return (
    <div>
      <h1>{t("title")}</h1>
    </div>
  )
}
```

#### Namespaces المتوفرة

```
messages/ar.json:
├── common (الأزرار، الرسائل العامة)
├── nav (القوائم)
├── hero (الصفحة الرئيسية)
├── courses (الكورسات)
├── student (لوحة الطالب)
├── instructor (لوحة المعلم)
├── admin (لوحة الإدارة)
├── categories (التصنيفات)
├── pricing (الأسعار)
├── quiz (الاختبارات)
├── certificate (الشهادات)
└── settings (الإعدادات)
```

---

### 3. الخطوط

#### Cairo للعربية

```tsx
// app/layout.tsx
const cairo = Cairo({
  subsets: ["arabic", "latin"],
  variable: "--font-cairo",
})

<body className={isRTL ? "font-arabic" : "font-sans"}>
```

#### CSS

```css
.font-arabic {
  font-family: "Cairo", "Noto Sans Arabic", sans-serif;
}
```

---

### 4. Toast Notifications

```tsx
// يتم وضع الإشعارات تلقائياً حسب الاتجاه
<Toaster position={isRTL ? "top-left" : "top-right"} />
```

---

## 🎯 أمثلة عملية

### مثال 1: بطاقة كورس

```tsx
<Card>
  <CardHeader>
    <div className="flex items-center justify-between">
      {/* الأيقونة في البداية (يمين في العربي) */}
      <BookOpen className="me-2" />
      <h3>{course.titleAr}</h3>

      {/* السعر في النهاية (يسار في العربي) */}
      <span className="ms-auto">{formatPrice(course.price)}</span>
    </div>
  </CardHeader>
</Card>
```

### مثال 2: زر مع أيقونة

```tsx
<Button>
  {t("button.label")}
  <ArrowLeft className="me-2 rtl:rotate-180" />
</Button>
```

### مثال 3: Form Input

```tsx
<div className="relative">
  <Search className="absolute start-3 top-1/2 -translate-y-1/2" />
  <Input
    placeholder={t("search")}
    className="ps-10"  {/* padding من البداية */}
  />
</div>
```

---

## 📋 Checklist للمطورين

### قبل commit أي كود:

- [ ] استخدمت `ms-`/`me-` بدلاً من `ml-`/`mr-`
- [ ] استخدمت `ps-`/`pe-` بدلاً من `pl-`/`pr-`
- [ ] استخدمت `start-`/`end-` بدلاً من `left-`/`right-`
- [ ] أضفت `rtl:rotate-180` للأسهم
- [ ] استخدمت `useTranslations()` للنصوص
- [ ] لم أضع أي نصوص مباشرة في الكود
- [ ] اختبرت الصفحة في RTL

---

## 🛠️ أدوات المساعدة

### تشغيل script إصلاح RTL

```bash
node scripts/fix-rtl.js
```

سيقوم هذا الـ script بـ:

- البحث عن جميع ملفات `.tsx` و `.jsx`
- تحويل `ml-` إلى `ms-`
- تحويل `mr-` إلى `me-`
- تحويل `pl-` إلى `ps-`
- تحويل `pr-` إلى `pe-`

---

## 🎨 التصميم المتجاوب

### استخدم Flexbox بذكاء

```tsx
// ✅ صحيح
<div className="flex justify-between items-center">
  <span>{t("label")}</span>
  <Button>{t("action")}</Button>
</div>

// في RTL سينعكس الترتيب تلقائياً
```

### Grid مع RTL

```tsx
// Grid يعمل بشكل طبيعي في RTL
<div className="grid grid-cols-3 gap-4">
  {items.map((item) => (
    <Card key={item.id} />
  ))}
</div>
```

---

## 📝 إضافة ترجمات جديدة

1. افتح `messages/ar.json`
2. أضف الترجمة في الـ namespace المناسب:

```json
{
  "courses": {
    "newKey": "النص العربي هنا"
  }
}
```

3. استخدمها في الكود:

```tsx
const t = useTranslations("courses")
<span>{t("newKey")}</span>
```

---

## ✅ الحالة الحالية

### ما تم إصلاحه:

- ✅ تكوين RTL في `app/layout.tsx`
- ✅ إضافة Logical Properties في `globals.css`
- ✅ إصلاح Hero Section
- ✅ إنشاء RTL utilities
- ✅ إنشاء fix script

### ما يحتاج مراجعة:

- ⚠️ جميع المكونات القديمة تحتاج تشغيل `fix-rtl.js`
- ⚠️ مراجعة الترجمات للتأكد من اكتمالها
- ⚠️ اختبار جميع الصفحات في RTL

---

## 🚀 الخطوات التالية

1. تشغيل `node scripts/fix-rtl.js` لإصلاح جميع الملفات
2. مراجعة النتائج
3. اختبار الموقع
4. إضافة أي ترجمات ناقصة

---

## 📞 دعم

إذا وجدت أي مشاكل في RTL أو الترجمة، يرجى:

1. التأكد من استخدام الـ classes الصحيحة
2. التحقق من وجود الترجمة في `messages/ar.json`
3. مراجعة هذا الدليل
