# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## โปรเจกต์

LoveRead คือเว็บแอปภาษาไทยสำหรับอ่านนิยาย (แบ่งเป็นบท) และการ์ตูน (แบ่งเป็นตอนและหน้า) มี 3 บทบาท: READER, AUTHOR, ADMIN (เก็บใน `users.role`; ใน enum มี `VISITOR` ด้วย) ข้อความใน UI เป็นภาษาไทย

## คำสั่ง

```bash
npm run dev            # next dev --turbopack (http://localhost:3000)
npm run build          # next build --turbopack
npm run lint           # eslint (next/core-web-vitals + typescript)
npx tsc --noEmit       # ตรวจ type
```

โปรเจกต์นี้ไม่มีชุดเทสต์

สคริปต์จัดการฐานข้อมูลใน `scripts/` รันด้วย `npx tsx` เช่น:

```bash
npx tsx scripts/create_admin.ts <email> [password] [name]
npx tsx scripts/set_admin.ts <email>
npx tsx scripts/check_user.ts <email>
npx tsx scripts/update_schema.ts   # รัน schema.sql (CREATE TABLE IF NOT EXISTS) — ไม่เพิ่มคอลัมน์ให้ตารางที่มีอยู่แล้ว
npx tsx scripts/add_coin_system.ts # migration ระบบเหรียญ/ขายตอน (รันซ้ำได้)
npx tsx scripts/move_comic_pages_private.ts [--delete-originals] # ย้ายรูปหน้าการ์ตูนเก่าจาก public/uploads ไป storage/ (รันซ้ำได้)
```

`reset_db.ts` และ `drop_old_db.ts` ลบข้อมูล

## Environment

ใช้ MySQL/MariaDB บนเครื่อง (XAMPP) ใน `.env` ต้องมี `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` (ค่าเริ่มต้น `loveread_db`) และ `AUTH_SECRET` ส่วน `DATABASE_URL` ใช้เฉพาะกับเครื่องมือของ Prisma

## สถาปัตยกรรม

**เข้าถึงข้อมูลด้วย raw SQL ผ่าน `mysql2` ไม่ใช่ Prisma** ทุก API route และ `lib/auth.ts` ใช้ pool จาก `lib/db.ts` ในรูปแบบ `pool.query<RowDataPacket[]>(sql, params)` และใช้ placeholder `?` ไฟล์ `lib/prisma.ts` มีอยู่แต่ไม่มีที่ไหน import ส่วน `prisma/schema.prisma` (introspect มาจาก DB) อธิบายตารางได้ครบที่สุด `schema.sql` เป็น SQL สำหรับสร้างตารางเริ่มต้น ตาราง `author_requests` (มีใน `schema.prisma` แต่ไม่มีใน `schema.sql`) เลิกใช้แล้ว ข้อมูลย้ายไป `writer_profiles` ด้วย `scripts/migrate_author_requests.ts` เมื่อแก้ schema ให้แก้ทั้ง `schema.sql` และ `schema.prisma` ให้ตรงกัน

- Primary key เป็น UUID แบบ `VARCHAR(36)` สร้างในโค้ดด้วย `v4()` จากแพ็กเกจ `uuid` ชื่อคอลัมน์เป็น snake_case
- enum สถานะเนื้อหา: `DRAFT | PUBLISHED | ARCHIVED | BANNED` ดูกฎการมองเห็นในหัวข้อ "การมองเห็นเนื้อหา"
- ลำดับชั้นเนื้อหา: `novels → chapters` (`chapter_order`), `comics → comic_episodes` (`episode_order`) `→ comic_pages` (`page_order`, `image_url`)

**Auth** (`lib/auth.ts`): NextAuth v5 beta, Credentials provider กับ bcrypt, session แบบ JWT callback `jwt` จะอ่าน `role` จาก DB ใหม่ทุก request ทำให้เปลี่ยน role แล้วมีผลทันทีโดยไม่ต้องล็อกอินใหม่ type ของ `session.user.id` และ `session.user.role` อยู่ใน `types/next-auth.d.ts` หน้า sign-in คือ `/login`

**API routes** (`app/api/**/route.ts`) เขียนตามรูปแบบเดียวกัน: `const session = await auth()` แล้วเช็ก role หรือความเป็นเจ้าของ รัน SQL แล้วคืน `NextResponse.json(...)` กรณี error คืน `{ error }` พร้อม status route ฝั่งแอดมินใน `app/api/admin/` เช็ก `session?.user?.role !== 'ADMIN'` เองทุกไฟล์ (middleware ไม่ได้ทำหน้าที่ตรวจสิทธิ์) params ของ dynamic route มี type เป็น `{ params: Promise<{ id: string }> }` และต้อง await (Next 15)

**Pages** เกือบทั้งหมดเป็น client component (`"use client"`) ที่ดึงข้อมูลจาก `/api/*` ส่วน `components/Providers.tsx` ครอบแอปด้วย `SessionProvider` + `next-themes` (dark mode แบบ `attribute="class"` ใช้คลาส `dark:` ของ Tailwind v4)

**ส่วนนักเขียน**: `app/author/page.tsx` เป็นแดชบอร์ดไฟล์เดียวขนาดใหญ่แบบแท็บ (dashboard/novels/comics/earnings/wallet/profile) `/author/dashboard` แค่ redirect ไป `/author` หน้าแก้ไขบท/ตอน/หน้าการ์ตูนอยู่ใน route ย่อยใต้ `app/author/novel/[id]/...` และ `app/author/comic/[id]/...`

**การสมัครเป็นนักเขียน** ใช้ตาราง `writer_profiles` ตารางเดียว (1 แถวต่อ user, key คือ `user_id`) ผ่าน `/api/author/profile` (GET/POST แบบ multipart) ทั้งหน้า `/become-author` และฟอร์มข้อมูลนักเขียนใน `/author` + `/author/profile`
- ถ้า READER เป็นคนส่ง ถือเป็นการสมัคร: ต้องกรอกข้อมูลส่วนตัวครบ และระบบตั้ง `status = 'PENDING'` ให้ (ถ้าเคยถูกปฏิเสธก็ส่งใหม่ได้)
- ถ้า AUTHOR/ADMIN เป็นคนส่ง แค่แก้ข้อมูล ไม่เปลี่ยนสถานะ
- ฟิลด์ที่ผู้ใช้ตั้งเองได้ถูกจำกัดด้วย whitelist (`TEXT_FIELDS`/`FILE_FIELDS`) ห้ามสร้างชื่อคอลัมน์จาก input โดยตรง
- แอดมินอนุมัติหรือปฏิเสธผ่าน `PATCH /api/admin/writers/[userId]` (`{ status, reason }`) ถ้าอนุมัติจะเปลี่ยน `users.role` เป็น `AUTHOR` ใน transaction เดียวกัน

**การมองเห็นเนื้อหา** (`lib/visibility.ts`):
- นิยาย/การ์ตูนที่เป็น `PUBLISHED` ทุกคนเห็น สถานะอื่นเห็นได้เฉพาะเจ้าของและแอดมิน (`canViewContent()`)
- คนอื่นที่เปิดหน้า/API ของเรื่องที่ไม่ได้เผยแพร่จะได้ **404** ไม่ใช่ paywall
- list endpoint สาธารณะ (`/api/novels`, `/api/comics`) คืนเฉพาะ `PUBLISHED` เสมอ ไม่สนใจ `?status=`
- `canAccess()` ใน `lib/coins.ts` ต้องได้ `content_status` (สถานะของนิยาย/การ์ตูนแม่) ด้วย: `ARCHIVED` อ่านได้เฉพาะคนที่ซื้อตอนนั้นไปแล้ว ส่วน `DRAFT`/`BANNED` คนอื่นอ่านไม่ได้เลย และซื้อได้เฉพาะตอนที่เรื่องเป็น `PUBLISHED`
- นักเขียนตั้งสถานะได้แค่ `AUTHOR_SETTABLE_STATUSES` (DRAFT/PUBLISHED/ARCHIVED) และแก้สถานะเรื่องที่ถูก `BANNED` ไม่ได้ มีแต่แอดมินที่แบนหรือปลดแบนได้ผ่าน `/api/admin/content`

**อัปโหลดไฟล์**: ใช้ฟังก์ชันใน `lib/upload.ts` ทุกครั้งที่รับไฟล์รูป ทั้งหมดรับเฉพาะ JPG/PNG/WEBP/GIF ไม่เกิน 10MB ตรวจชนิดจาก magic bytes และตั้งนามสกุลตามชนิดที่ตรวจได้ `POST /api/upload` (multipart field `file`, ต้องล็อกอิน) มี 2 แบบ:
- **ทั่วไป** (ปก, avatar, สลิป ฯลฯ): `saveImageUpload()` เก็บไว้ที่ `public/uploads/` แล้วคืน `{ url: "/uploads/..." }` เอกสารนักเขียนเก็บใน `public/uploads/writers/`
- **หน้าการ์ตูน** (`purpose=comic-page`, AUTHOR/ADMIN เท่านั้น): `savePrivateComicPage()` เก็บไว้ที่ `storage/comic-pages/<authorId>/` ซึ่งอยู่นอก `public/` แล้วคืน `/api/media/comic-pages/<authorId>/<file>` route นี้จะส่งไฟล์ให้เฉพาะคนที่ `canAccess()` ตอนที่ใช้รูปนั้นได้ หรือเป็นเจ้าของไฟล์
- ทุกที่ที่รับ URL หน้าการ์ตูน ต้องผ่าน `validatePageUrls(urls, userId)` ซึ่งยอมรับเฉพาะไฟล์ private ของผู้เขียนคนนั้นเอง หรือไฟล์ `/uploads/...` แบบเก่า กันการเอา URL รูปของตอนที่ขายของคนอื่นมาใส่ตอนฟรีของตัวเอง
- **รูปจาก `/api/media` ห้ามใช้ `next/image` แบบ optimize** (ให้ใส่ `unoptimized` หรือใช้ `<img>`) เพราะ optimizer ไม่ส่ง cookie ของผู้ใช้ไปด้วย
- `public/uploads/` และ `storage/` ไม่ถูก track ใน git

**Maintenance mode**: `middleware.ts` ใช้ runtime `nodejs` (เพื่อ query MySQL ได้) อ่าน `system_settings.maintenance_mode` แล้ว cache ไว้ 10 วินาที ถ้าเปิดอยู่ ผู้ที่ไม่ใช่ ADMIN จะถูก rewrite ไป `/maintenance` (API ได้ 503) ยกเว้น path ใน `ALWAYS_ALLOWED` ตรวจ role จาก JWT ด้วย `getToken` ไม่ได้เรียก `auth()`

**รายงานเนื้อหา**: `components/ReportButton.tsx` (อยู่ในหน้านิยาย/การ์ตูน) → `POST /api/reports` (NOVEL/COMIC เท่านั้น ห้ามรายงานซ้ำขณะที่ยัง PENDING) แอดมินจัดการที่ `/admin` แท็บ Reports

**ระบบเหรียญและขายตอน** (logic หลักอยู่ใน `lib/coins.ts`):
- 1 เหรียญ = 1 บาท ยอดเหรียญของผู้อ่านอยู่ที่ `users.coins` แต่ละบท/ตอนมี `price` (0 = ฟรี)
- **เติมเหรียญ**: ผู้อ่านอัปโหลดสลิปที่ `/coins` → แถวใน `coin_topups` (PENDING) → แอดมินอนุมัติที่ `/admin` แท็บการเงิน แล้วเหรียญจึงเพิ่ม
- **ซื้อตอน**: `purchaseItem()` ทำใน transaction ที่ lock แถว user (`FOR UPDATE`) แล้วบันทึกลง `purchases` พร้อม `author_earning` = ราคา × `system_settings.author_share_percent` ณ ตอนซื้อ (เปลี่ยนส่วนแบ่งแล้วไม่มีผลย้อนหลัง)
- **ยอดของนักเขียนคำนวณสดเสมอ** ด้วย `getAuthorBalance()` = SUM(`purchases.author_earning`) − SUM(`withdrawals` ที่เป็น PENDING/APPROVED) ไม่มีคอลัมน์ยอดคงเหลือ ถ้าปฏิเสธการถอน เงินจะกลับเข้ายอดเอง
- **ถอนเงิน**: ต้องมี `writer_profiles` ที่อนุมัติแล้วและกรอกบัญชีธนาคาร แอดมินโอนเงินแล้วแนบสลิปเพื่ออนุมัติ
- **การเปลี่ยนสถานะเงินทุกแบบ** (อนุมัติเติมเหรียญ, อนุมัติ/ปฏิเสธการถอน) ต้องมีเงื่อนไข `WHERE status = 'PENDING'` เพื่อกันการทำซ้ำ
- **ทุกที่ที่ส่งเนื้อหาบท/ตอนออกไป** ต้องผ่าน `canAccess()` ได้แก่ `app/read/[chapterId]`, `app/comic/[id]/read/[episodeId]`, `/api/chapters`, `/api/novels/[id]/chapters` (ส่ง `content` ให้เฉพาะเจ้าของ), `/api/comics/[id]/episodes/[episodeId]` และ `.../pages` ถ้าเพิ่ม endpoint ใหม่ที่คืนเนื้อหา ต้องเช็กเหมือนกัน
- รูปหน้าการ์ตูนส่งผ่าน `/api/media/...` ซึ่งเช็กสิทธิ์ก่อนส่งไฟล์ (ดูหัวข้อ "อัปโหลดไฟล์")
