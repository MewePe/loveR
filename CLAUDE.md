# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## โปรเจกต์

LoveRead คือเว็บแอปภาษาไทยสำหรับอ่านนิยาย (แบ่งเป็นบท) และการ์ตูน (แบ่งเป็นตอนและหน้า) มี 3 บทบาท: READER, AUTHOR, ADMIN (เก็บใน `users.role`) นอกจากนี้มี `BANNED` สำหรับผู้ใช้ที่ถูกแบน และใน enum มี `VISITOR` ด้วย ข้อความใน UI เป็นภาษาไทย

MariaDB ในเครื่องนี้**ไม่ได้เปิด strict mode** ถ้าเขียนค่า ENUM ที่ไม่มีอยู่จริง DB จะไม่ error แต่เก็บเป็น `''` เงียบๆ ดังนั้นต้อง whitelist ค่า enum ในโค้ดก่อนเขียนเสมอ

## Git workflow

ทำงานบน `main` โดยตรงแล้ว push ขึ้น `origin/main` เลย **ไม่ต้องแยก branch และไม่ต้องเปิด PR** (ผู้ใช้สั่งไว้ 2026-10-21)

## คำสั่ง

```bash
npm run dev            # next dev --turbopack (http://localhost:3000)
npm run build          # next build --turbopack
npm run lint           # eslint (next/core-web-vitals + typescript)
npx tsc --noEmit       # ตรวจ type
```

### เทสต์ end-to-end

```bash
npm run test:e2e                                                       # ทั้งหมด (~2 นาที)
node --test tests/e2e/coins.test.mjs                                   # ทีละไฟล์
node --test --test-name-pattern="XSS" tests/e2e/security.test.mjs      # ทีละเทสต์
```

- **ต้องเปิด `npm run dev` และ MySQL ไว้ก่อน** เทสต์ยิง HTTP ไปที่ dev server จริง (`E2E_BASE_URL`, ค่าเริ่มต้น `http://localhost:3000`) และอ่าน/เขียน DB ตามที่ตั้งใน `.env`
- เทสต์สร้างผู้ใช้ `e2e-*@test.local` และข้อมูลของตัวเอง แล้วลบทิ้งเองใน `after()` (ใช้ `cleanupUsers()` ใน `tests/e2e/helpers.mjs`) ไม่แตะข้อมูลจริง ยกเว้น `maintenance.test.mjs` ที่เปิด/ปิด maintenance mode ชั่วคราวแล้วคืนค่าเดิม (สคริปต์จึงรันแบบ `--test-concurrency=1`)
- ไม่ยอมรันกับ server ที่ไม่ใช่ localhost ถ้าไม่ได้ตั้ง `E2E_ALLOW_REMOTE=1`
- ใช้ `node:test` + `node:assert` ไม่มี dependency เพิ่ม เขียนเป็น `.mjs` ไฟล์ละ 1 หัวข้อ ภายในไฟล์ test จะรันตามลำดับ และใช้ state ร่วมกันผ่านตัวแปรระดับ module
- **แก้ระบบเงิน การล็อกเนื้อหา สิทธิ์ หรือการอัปโหลดเมื่อไหร่ ให้รัน `npm run test:e2e` ทุกครั้ง**

สคริปต์จัดการฐานข้อมูลใน `scripts/` รันด้วย `npx tsx` เช่น:

```bash
npx tsx scripts/create_admin.ts <email> [password] [name]
npx tsx scripts/set_admin.ts <email>
npx tsx scripts/check_user.ts <email>
npx tsx scripts/update_schema.ts   # รัน schema.sql (CREATE TABLE IF NOT EXISTS) — ไม่เพิ่มคอลัมน์ให้ตารางที่มีอยู่แล้ว
npx tsx scripts/add_coin_system.ts # migration ระบบเหรียญ/ขายตอน (รันซ้ำได้)
npx tsx scripts/move_comic_pages_private.ts [--delete-originals] # ย้ายรูปหน้าการ์ตูนเก่าจาก public/uploads ไป storage/ (รันซ้ำได้)
npx tsx scripts/add_banned_role.ts # เพิ่ม BANNED ใน users.role (รันซ้ำได้)
npx tsx scripts/drop_author_requests.ts # สำรองข้อมูลไป storage/backups/ แล้วลบตาราง author_requests (รันซ้ำได้)
npx tsx scripts/add_login_attempts.ts # ตาราง login_attempts สำหรับจำกัดการล็อกอินผิด (รันซ้ำได้)
npx tsx scripts/add_comments_ratings.ts # ตาราง comments และ ratings (รันซ้ำได้)
npx tsx scripts/add_register_attempts.ts # ตาราง register_attempts สำหรับจำกัดการสมัครสมาชิก (รันซ้ำได้)
npx tsx scripts/add_reading_history.ts # ตาราง reading_history (รันซ้ำได้)
```

`reset_db.ts` และ `drop_old_db.ts` ลบข้อมูล

## Environment

ใช้ MySQL/MariaDB บนเครื่อง (XAMPP) ใน `.env` ต้องมี `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` (ค่าเริ่มต้น `loveread_db`) และ `AUTH_SECRET` ส่วน `DATABASE_URL` ใช้เฉพาะกับเครื่องมือของ Prisma

## สถาปัตยกรรม

**เข้าถึงข้อมูลด้วย raw SQL ผ่าน `mysql2` ไม่ใช่ Prisma** ทุก API route และ `lib/auth.ts` ใช้ pool จาก `lib/db.ts` ในรูปแบบ `pool.query<RowDataPacket[]>(sql, params)` และใช้ placeholder `?` ไม่มี Prisma client ใน runtime ส่วน `prisma/schema.prisma` ใช้เป็นเอกสารอ้างอิงโครงสร้างตาราง (ตรวจด้วย `npx prisma validate`) `schema.sql` ใช้สร้างฐานข้อมูลใหม่ได้ครบ ส่วน DB เก่าให้อัปเกรดด้วยสคริปต์ใน `scripts/` ตามลำดับที่ระบุใน README เมื่อแก้ schema ให้แก้ทั้ง `schema.sql` และ `schema.prisma` ให้ตรงกัน และถ้า DB เก่าต้องเปลี่ยนตาม ให้เพิ่มสคริปต์ migration ที่รันซ้ำได้ ตาราง `author_requests` ถูกลบแล้ว (ใช้ `writer_profiles` แทน)

- `bookmarks`, `comments`, `ratings`, `reading_history` มีคอลัมน์ `novel_id` หรือ `comic_id` อย่างใดอย่างหนึ่ง แต่ API ใช้รูปแบบ `{ content_type: 'novel' | 'comic', content_id }` ใช้ `lib/contentRef.ts` (`CONTENT_COLUMN`, `isContentType()`, `getContentRow()`) แปลงเป็นชื่อคอลัมน์ ห้ามเอา input ไปต่อเป็น SQL ตรงๆ

- Primary key เป็น UUID แบบ `VARCHAR(36)` สร้างในโค้ดด้วย `v4()` จากแพ็กเกจ `uuid` ชื่อคอลัมน์เป็น snake_case
- enum สถานะเนื้อหา: `DRAFT | PUBLISHED | ARCHIVED | BANNED` ดูกฎการมองเห็นในหัวข้อ "การมองเห็นเนื้อหา"
- ลำดับชั้นเนื้อหา: `novels → chapters` (`chapter_order`), `comics → comic_episodes` (`episode_order`) `→ comic_pages` (`page_order`, `image_url`)

**Auth** (`lib/auth.ts`): NextAuth v5 beta, Credentials provider กับ bcrypt, session แบบ JWT callback `jwt` จะอ่าน `role` จาก DB ใหม่ทุก request ทำให้เปลี่ยน role แล้วมีผลทันทีโดยไม่ต้องล็อกอินใหม่ ถ้าผู้ใช้ถูกลบหรือเป็น `BANNED` callback จะคืน `null` ซึ่งทำให้ session สิ้นสุด และ `authorize()` ก็ไม่ให้ผู้ใช้ BANNED ล็อกอิน แอดมินเปลี่ยน role ของตัวเองไม่ได้

**จำกัดการล็อกอินผิด** (`lib/loginThrottle.ts`) และ rate limit อื่นๆ:
- ตาราง `login_attempts` เก็บเฉพาะครั้งที่ล็อกอินผิด (อีเมลที่ไม่มีอยู่จริงก็นับ เพื่อไม่ให้เดาได้ว่ามีบัญชีไหนบ้าง)
- ผิดเกิน 5 ครั้งต่ออีเมล หรือ 20 ครั้งต่อ IP ใน 15 นาที → `authorize()` throw `TooManyAttempts` แม้รหัสถูกก็ตาม ฝั่ง client จะได้ `code: 'rate_limited'` จาก `signIn()`
- ล็อกอินสำเร็จจะล้างตัวนับของอีเมลนั้น
- IP อ่านจาก `x-forwarded-for` ถ้าไม่มีจะเป็น `'unknown'` ซึ่งจะ**ไม่**ใช้ limit ต่อ IP (ไม่งั้นจะล็อกทุกคนพร้อมกัน) ถ้า deploy หลัง reverse proxy ต้องให้ proxy ตั้ง header นี้
- **สมัครสมาชิก** (`lib/registerThrottle.ts`, ตาราง `register_attempts`): 10 ครั้งต่อ IP ต่อชั่วโมง → 429 นับทุกครั้งที่ผ่าน validation รวมอีเมลซ้ำ (409) กันการไล่เดาอีเมล IP `'unknown'` ไม่จำกัดเหมือนกัน ถ้าตารางยังไม่มีจะ log แล้วให้สมัครได้
- **เติมเหรียญ**: `/api/coins/topup` รับได้ไม่เกิน 10 รายการต่อคนต่อ 24 ชั่วโมง (นับทุกสถานะ จาก `coin_topups.created_at`) และ PENDING พร้อมกันได้ไม่เกิน 3
- ถ้าตารางยังไม่มี (ยังไม่ได้รัน migration) จะ log error แล้วยังเช็กรหัสผ่านตามปกติ ไม่ล็อกทุกคนออก type ของ `session.user.id` และ `session.user.role` อยู่ใน `types/next-auth.d.ts` หน้า sign-in คือ `/login`

**API routes** (`app/api/**/route.ts`) เขียนตามรูปแบบเดียวกัน: `const session = await auth()` แล้วเช็ก role หรือความเป็นเจ้าของ รัน SQL แล้วคืน `NextResponse.json(...)` กรณี error คืน `{ error }` พร้อม status route ฝั่งแอดมินใน `app/api/admin/` เช็ก `session?.user?.role !== 'ADMIN'` เองทุกไฟล์ (middleware ไม่ได้ทำหน้าที่ตรวจสิทธิ์) params ของ dynamic route มี type เป็น `{ params: Promise<{ id: string }> }` และต้อง await (Next 15)

**เนื้อหาบทนิยาย** เป็น plain text (ผู้เขียนพิมพ์ใน textarea) แสดงด้วย `whitespace-pre-line` **ห้ามแสดงด้วย `dangerouslySetInnerHTML`** เพราะผู้เขียนจะฝังสคริปต์ให้ไปรันในเบราว์เซอร์ผู้อ่านได้ (เช่น สั่งซื้อตอนด้วยเหรียญของผู้อ่าน)

**Pages** เกือบทั้งหมดเป็น client component (`"use client"`) ที่ดึงข้อมูลจาก `/api/*` ส่วน `components/Providers.tsx` ครอบแอปด้วย `SessionProvider` + `next-themes` (dark mode แบบ `attribute="class"` ใช้คลาส `dark:` ของ Tailwind v4)

**แอดมิน**: ทุกอย่างอยู่ที่ `app/admin/page.tsx` ซึ่งเป็นแดชบอร์ดแบบแท็บ (แท็บการเงินแยกไว้ใน `components/admin/PaymentsPanel.tsx`) หน้าเก่าอย่าง `/admin/users`, `/admin/content` ฯลฯ แค่ redirect ไป `/admin`

**ส่วนนักเขียน**: `app/author/page.tsx` เป็นแดชบอร์ดไฟล์เดียวขนาดใหญ่แบบแท็บ (dashboard/novels/comics/earnings/wallet/profile) แท็บรายได้และกระเป๋าเงินอยู่ใน `components/author/` ส่วน `/author/dashboard` และ `/author/profile` แค่ redirect ไป `/author` หน้าแก้ไขบท/ตอน/หน้าการ์ตูนอยู่ใน route ย่อยใต้ `app/author/novel/[id]/...` และ `app/author/comic/[id]/...`

**การสมัครเป็นนักเขียน** ใช้ตาราง `writer_profiles` ตารางเดียว (1 แถวต่อ user, key คือ `user_id`) ผ่าน `/api/author/profile` (GET/POST แบบ multipart) ทั้งหน้า `/become-author` และแท็บ "ข้อมูลนักเขียน" ใน `/author`
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
- **ทั่วไป** (ปก, avatar): `saveImageUpload()` เก็บไว้ที่ `public/uploads/` แล้วคืน `{ url: "/uploads/..." }` URL ปกและ avatar ที่รับจากผู้ใช้ต้องผ่าน `isPublicUploadUrl()` (ไฟล์ใน `/uploads/` เท่านั้น ห้าม URL ภายนอก)
- **เอกสารส่วนตัว** (สำเนาบัตรประชาชน, สมุดบัญชี, สลิปเติมเหรียญ, สลิปโอนเงินถอน): `savePrivateDocument(file, category, ownerId)` เก็บไว้ที่ `storage/private/<category>/<ownerId>/` และส่งผ่าน `/api/media/private/...` ให้เฉพาะเจ้าของกับแอดมิน การอนุมัติถอนเงินส่งสลิปเป็น multipart ไปที่ `PATCH /api/admin/withdrawals/[id]` โดยตรง
- `next.config.ts` ไม่มี `remotePatterns` ห้ามใส่ `'**'` เพราะจะทำให้ `/_next/image` กลายเป็น open proxy
- **หน้าการ์ตูน** (`purpose=comic-page`, AUTHOR/ADMIN เท่านั้น): `savePrivateComicPage()` เก็บไว้ที่ `storage/comic-pages/<authorId>/` ซึ่งอยู่นอก `public/` แล้วคืน `/api/media/comic-pages/<authorId>/<file>` route นี้จะส่งไฟล์ให้เฉพาะคนที่ `canAccess()` ตอนที่ใช้รูปนั้นได้ หรือเป็นเจ้าของไฟล์
- ทุกที่ที่รับ URL หน้าการ์ตูน ต้องผ่าน `validatePageUrls(urls, userId)` ซึ่งยอมรับเฉพาะไฟล์ private ของผู้เขียนคนนั้นเอง หรือไฟล์ `/uploads/...` แบบเก่า กันการเอา URL รูปของตอนที่ขายของคนอื่นมาใส่ตอนฟรีของตัวเอง
- **รูปจาก `/api/media` ห้ามใช้ `next/image` แบบ optimize** (ให้ใส่ `unoptimized` หรือใช้ `<img>`) เพราะ optimizer ไม่ส่ง cookie ของผู้ใช้ไปด้วย
- `public/uploads/` และ `storage/` ไม่ถูก track ใน git

**Maintenance mode**: `middleware.ts` ใช้ runtime `nodejs` (เพื่อ query MySQL ได้) อ่าน `system_settings.maintenance_mode` แล้ว cache ไว้ 10 วินาที ถ้าเปิดอยู่ ผู้ที่ไม่ใช่ ADMIN จะถูก rewrite ไป `/maintenance` (API ได้ 503) ยกเว้น path ใน `ALWAYS_ALLOWED` ตรวจ role จาก JWT ด้วย `getToken` ไม่ได้เรียก `auth()`

**รายงานเนื้อหา**: `components/ReportButton.tsx` (อยู่ในหน้านิยาย/การ์ตูน และแบบ `compact` ข้างแต่ละคอมเมนต์) → `POST /api/reports` (NOVEL/COMIC/COMMENT ห้ามรายงานซ้ำขณะที่ยัง PENDING) แอดมินจัดการที่ `/admin` แท็บ Reports ซึ่งลบคอมเมนต์ที่ถูกรายงานได้เลย

**คอมเมนต์และให้คะแนน** (ระดับเรื่อง ไม่ใช่รายบท อยู่ล่างรายการตอนในหน้า `/novel/[id]` และ `/comic/[id]`):
- `GET/POST /api/comments` (ใหม่สุดก่อน หน้าละ 20, `?page=`) และ `DELETE /api/comments/[id]` ลบได้โดยเจ้าของคอมเมนต์ เจ้าของเรื่อง หรือแอดมิน UI อยู่ใน `components/CommentSection.tsx`
- เนื้อหาคอมเมนต์เป็น plain text ไม่เกิน 1000 ตัวอักษร แสดงด้วย `whitespace-pre-line` **ห้ามใช้ `dangerouslySetInnerHTML`** (เหตุผลเดียวกับเนื้อหาบท) จำกัด 5 คอมเมนต์ต่อนาทีต่อคน (429)
- `comments.created_at` เป็น `TIMESTAMP(3)` เพื่อให้เรียงใหม่สุดก่อนได้ถูกต้องเมื่อโพสต์ในวินาทีเดียวกัน
- `GET/PUT/DELETE /api/ratings` คืน `{ average, count, mine, can_rate }` คะแนน 1-5 หนึ่งแถวต่อคนต่อเรื่อง (`PUT` = upsert) ให้คะแนนได้เฉพาะเรื่อง `PUBLISHED` และห้ามให้คะแนนเรื่องของตัวเอง UI อยู่ใน `components/RatingStars.tsx` (กดดาวเดิมซ้ำ = ยกเลิก)
- ทั้งสองอย่างเช็ก `canViewContent()` (เรื่องที่ไม่ได้เผยแพร่ได้ 404 ยกเว้นเจ้าของ/แอดมิน) และซ่อนคอมเมนต์/ไม่นับคะแนนของผู้ใช้ที่เป็น `BANNED`
- ยังไม่แสดงคะแนนเฉลี่ยในหน้ารายการ/ค้นหา (ถ้าจะเพิ่ม ให้ JOIN แบบ aggregate ใน `/api/novels`, `/api/comics`)

**ประวัติการอ่าน** (`lib/readingHistory.ts`, ตาราง `reading_history`):
- 1 แถวต่อคนต่อเรื่อง เก็บบท/ตอนล่าสุดที่เปิด (`chapter_id`/`episode_id`) และ `read_at` (`TIMESTAMP(3)`)
- `recordRead()` ถูกเรียกในหน้า `app/read/[chapterId]` และ `app/comic/[id]/read/[episodeId]` เฉพาะเมื่อผ่าน `canAccess()` แล้ว (หน้า paywall ไม่บันทึก) ถ้า error จะ log แล้วยังให้อ่านได้ตามปกติ
- `GET /api/history?page=` (ล่าสุดก่อน หน้าละ 20) ซ่อนเรื่องที่ไม่ได้ `PUBLISHED` ยกเว้นเรื่องของตัวเอง (กฎเดียวกับ bookmarks) และ `DELETE /api/history` (`{ content_type, content_id }` หรือ `{ all: true }`) หน้า UI คือ `/history` ซึ่งมีปุ่ม "อ่านต่อ"
- ถ้าบทถูกลบ แถวยังอยู่แต่ `chapter_id` เป็น NULL (ปุ่มอ่านต่อจะพาไปหน้าเรื่องแทน) `novelsRead`/`comicsRead` ใน `/api/profile` นับจากตารางนี้

**ระบบเหรียญและขายตอน** (logic หลักอยู่ใน `lib/coins.ts`):
- 1 เหรียญ = 1 บาท ยอดเหรียญของผู้อ่านอยู่ที่ `users.coins` แต่ละบท/ตอนมี `price` (0 = ฟรี)
- **เติมเหรียญ**: ผู้อ่านอัปโหลดสลิปที่ `/coins` → แถวใน `coin_topups` (PENDING) → แอดมินอนุมัติที่ `/admin` แท็บการเงิน แล้วเหรียญจึงเพิ่ม
- **ซื้อตอน**: `purchaseItem()` ทำใน transaction ที่ lock แถว user (`FOR UPDATE`) แล้วบันทึกลง `purchases` พร้อม `author_earning` = ราคา × `system_settings.author_share_percent` ณ ตอนซื้อ (เปลี่ยนส่วนแบ่งแล้วไม่มีผลย้อนหลัง)
- **ยอดของนักเขียนคำนวณสดเสมอ** ด้วย `getAuthorBalance()` = SUM(`purchases.author_earning`) − SUM(`withdrawals` ที่เป็น PENDING/APPROVED) ไม่มีคอลัมน์ยอดคงเหลือ ถ้าปฏิเสธการถอน เงินจะกลับเข้ายอดเอง
- **ถอนเงิน**: ต้องมี `writer_profiles` ที่อนุมัติแล้วและกรอกบัญชีธนาคาร แอดมินโอนเงินแล้วแนบสลิปเพื่ออนุมัติ
- **การเปลี่ยนสถานะเงินทุกแบบ** (อนุมัติเติมเหรียญ, อนุมัติ/ปฏิเสธการถอน) ต้องมีเงื่อนไข `WHERE status = 'PENDING'` เพื่อกันการทำซ้ำ
- **ทุกที่ที่ส่งเนื้อหาบท/ตอนออกไป** ต้องผ่าน `canAccess()` ได้แก่ `app/read/[chapterId]`, `app/comic/[id]/read/[episodeId]`, `/api/chapters`, `/api/novels/[id]/chapters` (ส่ง `content` ให้เฉพาะเจ้าของ), `/api/comics/[id]/episodes/[episodeId]` และ `.../pages` ถ้าเพิ่ม endpoint ใหม่ที่คืนเนื้อหา ต้องเช็กเหมือนกัน
- รูปหน้าการ์ตูนส่งผ่าน `/api/media/...` ซึ่งเช็กสิทธิ์ก่อนส่งไฟล์ (ดูหัวข้อ "อัปโหลดไฟล์")

## ข้อควรระวังตอนพัฒนา

- **หลัง `git checkout` หรือ `git pull` ให้รีสตาร์ท `npm run dev` หนึ่งครั้ง** ถ้า `next.config.ts` ถูกเปลี่ยนหลายครั้งติดกันเร็วๆ dev server อาจค้างใช้ config เก่า (เคยเกิดแล้ว: เทสต์ open proxy fail ทั้งที่โค้ดถูก แก้ได้ด้วยการ `touch next.config.ts`)
- **ไฟล์ใน `public/uploads/` เคยถูก track ใน git** จนถึง commit `627e644` ซึ่ง `git rm` ออกไป ทำให้ไฟล์ในเครื่องหายด้วย (ปก/รูปเก่าขึ้น 404) การ checkout commit ก่อนหน้านั้นแล้วกลับมาก็ทำให้หายได้อีก กู้คืนได้ด้วย `git archive 627e644^ public/uploads | tar -x --skip-old-files` (ไฟล์ที่อัปโหลดหลังจากนั้นไม่อยู่ใน git ต้องสำรองเอง)
- lint ไม่มี error แล้ว (เหลือแค่ warning) และ `npm run build` รัน lint ด้วย ถ้ามี error จะ build ไม่ผ่าน ห้ามใช้ `any` ให้ใช้ type จริงหรือ `RowDataPacket` แทน
- **อย่ารัน `npm run build` ขณะที่ `npm run dev` เปิดอยู่** เพราะทั้งคู่เขียนลง `.next/` ให้ปิด dev ก่อน แล้วลบ `.next` ก่อนเปิด dev ใหม่

## งานที่เหลือ (อัปเดตล่าสุด 2026-10-21)

**สถานะ branch**: ทุกอย่างอยู่บน `main` แล้ว (`login-rate-limit` merge แล้ว) DB อื่นที่ไม่ใช่เครื่องนี้ต้องรัน `scripts/add_login_attempts.ts`, `scripts/add_comments_ratings.ts`, `scripts/add_register_attempts.ts` และ `scripts/add_reading_history.ts`

**ผู้ดูแลต้องทำเอง**:
- กรอก "ข้อมูลการชำระเงิน" ที่ `/admin` → Settings ถ้ายังไม่กรอก ผู้อ่านจะเติมเหรียญไม่ได้
- สำรอง `storage/` และ `public/uploads/` ซึ่งไม่อยู่ใน git
- ถ้ามั่นใจแล้วว่ารูปการ์ตูนใน storage ใช้ได้: `npx tsx scripts/move_comic_pages_private.ts --delete-originals` (URL เก่าใน `public/uploads/` ยังเปิดได้จนกว่าจะรัน)

**งานพัฒนา** (เรียงตามความสำคัญ):
1. **dependency ที่มีช่องโหว่** (อัปเกรด next เป็น 15.5.28 และรัน `npm audit fix` แล้วเมื่อ 2026-10-21): ที่เหลือแก้ได้ทางเดียวคือขึ้น Next 16 (breaking) ได้แก่ `postcss` ที่ next ฝังมาเอง (ใช้ตอน build CSS ของเราเอง ไม่ได้รับ input จากผู้ใช้) และ `braces`/`micromatch`/`fast-glob` ใต้ `eslint-config-next` (dev เท่านั้น) อย่าใช้ `npm audit fix --force` เพราะจะอัปเกรดแบบ breaking
2. **เปลี่ยน `alert()` เป็น toast**: ยังมี `alert()` ทั่วโปรเจกต์ ควรทำให้เป็นรูปแบบเดียวกับ `components/ConfirmDialog.tsx` (Provider + hook)
3. **แยก `app/author/page.tsx`** (~1,300 บรรทัด) ออกเป็น component ตามแท็บ แบบเดียวกับ `components/author/EarningsPanel.tsx`
4. **object storage**: จำเป็นเฉพาะถ้าจะ deploy บน Vercel/serverless ตอนนี้ไฟล์ทั้งหมดเขียนลงดิสก์ (`lib/upload.ts` เป็นจุดเดียวที่ต้องแก้)
