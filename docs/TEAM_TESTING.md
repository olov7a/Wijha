# تعليمات الاختبار للفريق (TEAM_TESTING)

## الأول: بالعربي

### إيه هي وجهة؟

وجهة موقع بيربط الطلبة بأصحاب السكن الجامعي. الطالب بيدور على سكن ويحجزه،
والمالك بيعرض وحداته، والشركة بتتولى المراجعة والدفع. الدفع يدوي: الطالب
بيدفع بره الموقع، والإدارة بتأكد الدفع من لوحة التحكم. النسخة دي للاختبار،
وممنوع أي محرك بحث يفهرسها.

| الدور | بيعمل إيه |
|---|---|
| طالب | بيسجل، بيأكد الإيميل، بيدور على سكن، بيحجز، وبيتابع حالته |
| مالك | بيسجل، بيأكد الإيميل، بيعرض وحدة جديدة، وبيشوف الحجوزات |
| إدارة | بتأكد الدفع، بترفض أو تقبل الوحدات، وبترجع المحذوفات |

> فيه أدوار إضافية (فريق المعاينة وقائد الفريق) بنفس طريقة الدخول: الإدارة بترقي
> الحسابات ليهم من لوحة التحكم.

### سيناريوهات الاختبار — طالب

1. افتح `/signup` واملأ بياناتك والصورة والكارنيه → اضغط إنشاء الحساب.
   **← المفروض:** تلاقي صفحة «افتح بريدك الإلكتروني» فيها الإيميل بتاعك وزرار
   إعادة الإرسال (بيشتغل تاني بعد 60 ثانية).
2. افتح الرسالة في البريد واضغط رابط التأكيد.
   **← المفروض:** تدخل على مساحة الطالب `/student`.
3. افتح الرابط مرتين (أو في متصفح تاني).
   **← المفروض:** صفحة الدخول تقول «ربما تم تأكيد بريدك الإلكتروني بالفعل، جرب تسجيل الدخول».
4. سجّل الدخول بـ `/login` → تصفح `/explore` → افتح وحدة → اختار غرفة/سرير وتاريخ → تأكيد الحجز.
   **← المفروض:** الحجز يظهر في `/student` بحالة «بانتظار الدفع».
5. حاول تفتح `/admin` أو `/owner` من شريط العنوان.
   **← المفروض:** يرجعك لمساحتك `/dashboard` (يعني `/student`) ومفيش محتوى إدارة.
6. الجّب إلغاء حجز؟ لا تدفع الفلوس دلوقتي. من `/student` ألغي الحجز قبل الموعد بـ 24 ساعة.
   **← المفروض:** الحجز يتلغي، ومفيش خصومات لPDF لو اتعمل.

### سيناريوهات الاختبار — مالك

1. افتح `/signup` كمالك واملأ البيانات → أكّد الإيميل.
   **← المفروض:** تدخل على مساحة المالك `/owner` في انتظار المعاينة.
2. من `/owner` اضغط إضافة وحدة → املأ البيانات والصور → إرسال.
   **← المفروض:** الوحدة تظهر في قائمتك بحالة «قيد المراجعة» ومستنية فريق المعاينة.
3. حاول تفتح `/student` أو `/admin`.
   **← المفروض:** يرجعك لمساحتك، ومفيش حجوزات الطلبة الخصوصية.

### سيناريوهات الاختبار — إدارة

1. سجّل دخول بحساب إدارة → افتح `/admin/payments`.
   **← المفروض:** تشوف الحجوزات المعلقة ومبالغ الإيجار والعمولة.
2. أكّد دفعة حجز → أعد تحميل الصفحة.
   **← المفروض:** الحجز يبقى «مؤكد» ومقدرش يتأكد تاني. الطالب والمالك يشوفوا التحديث.
3. فشّل/ارجع دفعة مدفوعة → تأكد إن الاسترداد لازم يكون بطريق الإدارة.
   **← المفروض:** الحالات تتغير مرة واحدة بس، وكل خطوة مسجلة في سجل النشاط.

### لو حصل Bug اعمل إيه (مهم: عدم إرفاق كلمات سر)

شمل في بلاغك **كل** اللي تحت:

1. **الخطوات:** مرات سجلت إيه بالترتيب، والرابط اللي كنت عليه.
2. **المتوقع:** كنت متوقع إيه يحصل.
3. **الفعلي:** إيه اللي حصل فعلًا (كلمة بخطأ أو كود إن ظهر).
4. **لقطة شاشة** للمشكلة.
5. **الجهاز والمتصفح:** موبايل/ديسكتوب، آيفون/أندرويد/ويندوز، نسخة المتصفح.
6. **الدور:** طالب/مالك/إدارة.
   ملاحظة مهمة: **لا تكتب كلمة السر** أو أي مفتاح/كود في البلاغ.

### حدود معروفة في النسخة دي

- الدفع يدوي: مفيش بوابة دفع مرتبطة.
- المالك مقدرش يعدّل وحدة بعد ما يبعتها للمراجعة (في خطة العمل الجاية).
- المراجعات والتقييمات بسيطة، ومتاح للطلاب يكتبوا تقييم للوحدات اللي سكنوا فيها بس.
- الموقع تحت الاختبار: لا بيانات حقيقية، ومحركات البحث محظورة. لو فكرت تسجل حساب تجريبي، استخدم بريد تجريبي فقط.

---

## Below: English

### What is WIJHA?

WIJHA connects university students with student-housing owners. Students search
and book housing, owners list their units, and the company handles review and
payment. Payment is **manual**: the student pays outside the site, while an
admin confirms it in the dashboard. This build is for testing and is blocked
from search-engine indexing.

| Role | What they can do |
|---|---|
| Student | Sign up, confirm email, browse housing, book, and track booking status |
| Owner | Sign up, confirm email, list a new unit, and see incoming bookings |
| Admin | Confirm payments, approve/reject units, and restore deleted items |

> Two extra roles exist (inspection team and team leader) with the same login
> flow; an admin promotes accounts to them from the dashboard.

### Test scenarios — Student

1. Open `/signup`, fill in your details and ID/university-card photos → submit.
   **→ Expected:** "Check your email" screen with your email and a Resend button (re-enables after 60 seconds).
2. Open the email and click the confirmation link.
   **→ Expected:** you land on the student area `/student`.
3. Open the link a second time (or in another browser).
   **→ Expected:** login shows *"Your email may already be confirmed, try logging in"*.
4. Sign in at `/login` → open `/explore` → pick a unit → choose a room/bed and date → confirm.
   **→ Expected:** the booking appears in `/student` as **pending payment**.
5. Try opening `/admin` or `/owner` by typing the URL.
   **→ Expected:** you are sent back to your own area (`/dashboard` → `/student`); no admin content.
6. Cancel a booking (before paying) from `/student`, at least 24 hours ahead.
   **→ Expected:** the booking is cancelled with no charges.

### Test scenarios — Owner

1. Sign up as an owner on `/signup` and confirm your email.
   **→ Expected:** you land on the owner area `/owner`, units waiting for inspection.
2. From `/owner` add a unit → fill the details and photos → submit.
   **→ Expected:** the unit shows in your list as **under review**, waiting for the inspection team.
3. Try opening `/student` or `/admin`.
   **→ Expected:** you are sent back to your own area; no other users' private data.

### Test scenarios — Admin

1. Sign in with an admin account → open `/admin/payments`.
   **→ Expected:** pending bookings are listed with rent and commission amounts.
2. Confirm a booking payment → reload the page.
   **→ Expected:** the booking stays **confirmed** and cannot be confirmed again; the student and owner see the update.
3. Fail or refund a paid booking.
   **→ Expected:** each state change happens once only, and every step is recorded in the activity log.

### How to report a bug (never include passwords)

Include **all** of these in your report:

1. **Steps:** exactly what you did, in order, and the URL you were on.
2. **Expected:** what you thought would happen.
3. **Actual:** what really happened (any error text or code shown).
4. **Screenshot** of the problem.
5. **Device & browser:** phone/desktop, model, browser name and version.
6. **Role:** student / owner / admin.

**Never** put passwords, API keys or verification codes in a bug report.

### Known limitations of this build

- Payment is manual: no payment gateway is connected.
- Owners cannot edit a unit after submitting it for review (planned for a later phase).
- Reviews are simple: students can only rate units they actually stayed in.
- This is a test build: do not use real data, and test accounts only.
