# EXPLAIN ANALYZE — 2026-11-08 (production, read-only)

للمراجعة السريعة بتاعة D11. كلها على بيانات صغيرة حالياً (2 profiles, ~0-10 bookings) — الخطط بتتغير لما يكبر.

## 1) unit_listings approved

```sql
EXPLAIN ANALYZE SELECT * FROM public.unit_listings WHERE status='approved';
```

- Bitmap Index Scan on `units_status_idx` (index جديد على status)
- Planning 19ms / Execution 8.6ms
- ✅ index مستعمل، ما فيش Seq Scan

## 2) bookings by student + status

```sql
EXPLAIN ANALYZE SELECT * FROM public.bookings WHERE student_id='...' AND status='confirmed';
```

- Bitmap Index Scan on `bookings_status_created_at_idx` (index جديد على (status, created_at))
- Planning 0.6ms / Execution 0.7ms
- ✅

## 3) payments pending by booking

```sql
EXPLAIN ANALYZE SELECT * FROM public.payments WHERE booking_id='...' AND status='pending';
```

- Bitmap Index Scan on `payments_status_idx` (index جديد على status)
- Planning 2.4ms / Execution 1.5ms
- ✅

## ملحوظة
- كل الخطط مستعملة الـ indexes، ما فيش full scan على أي جدول.
- لو كبرت الداتا أعد تشغيل الكويري مرة تانية ومراقب `missing index` من Supabase Query Performance.
