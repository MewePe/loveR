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
npx tsx scripts/add_notifications.ts # ตาราง notifications และคอลัมน์ comments.parent_id (รันซ้ำได้)
npx tsx scripts/add_item_reads.ts # ตาราง item_reads (บท/ตอนที่อ่านแล้ว) คัดลอกบทล่าสุดจาก reading_history มาให้ (รันซ้ำได้)
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

**Pages** เกือบทั้งหมดเป็น client component (`"use client"`) ที่ดึงข้อมูลจาก `/api/*` ส่วน `components/Providers.tsx` ครอบแอปด้วย `SessionProvider` + `next-themes` (dark mode แบบ `attribute="class"` ใช้คลาส `dark:` ของ Tailwind v4) + `ConfirmProvider` + `ToastProvider`

**การแจ้งเตือน**: ห้ามใช้ `alert()`/`confirm()` ของเบราว์เซอร์ ให้ใช้ `const toast = useToast()` จาก `components/Toast.tsx` (`toast.success(msg)` / `toast.error(msg)` หายเองใน 3.5/6 วินาที ไม่บล็อกหน้า) และ `useConfirm()` จาก `components/ConfirmDialog.tsx` สำหรับการยืนยัน

**แอดมิน**: ทุกอย่างอยู่ที่ `app/admin/page.tsx` ซึ่งเป็นแดชบอร์ดแบบแท็บ (แท็บการเงินแยกไว้ใน `components/admin/PaymentsPanel.tsx` กราฟในแท็บภาพรวมอยู่ใน `components/admin/AnalyticsPanel.tsx`) หน้าเก่าอย่าง `/admin/users`, `/admin/content` ฯลฯ แค่ redirect ไป `/admin`

**ส่วนนักเขียน**: `app/author/page.tsx` มีแค่ sidebar, การสลับแท็บ และโหลดข้อมูลที่แท็บภาพรวม/นิยาย/การ์ตูนใช้ร่วมกัน แต่ละแท็บอยู่ใน `components/author/` (`DashboardPanel`, `WorksPanel` ใช้ร่วมกันทั้งนิยายและการ์ตูน, `EarningsPanel`, `WalletPanel`, `WriterProfilePanel` ซึ่งโหลดข้อมูลเอง) ฟอร์มสร้าง/แก้ไขนิยายและการ์ตูนคือ `WorkFormModal` ข้อความ/สี/route ที่ต่างกันระหว่างนิยายกับการ์ตูนอยู่ใน `WORK_KINDS` (`components/author/types.ts`) บนจอเล็กกว่า `md` sidebar จะซ่อนและใช้แถบแท็บเลื่อนแนวนอนด้านบนแทน (ปุ่มออกจากระบบอยู่ในเมนูมือถือของ Navbar) ส่วน `/author/dashboard` และ `/author/profile` แค่ redirect ไป `/author` หน้าแก้ไขบท/ตอน/หน้าการ์ตูนอยู่ใน route ย่อยใต้ `app/author/novel/[id]/...` และ `app/author/comic/[id]/...`

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
- `GET/POST /api/comments` (คอมเมนต์หลักใหม่สุดก่อน หน้าละ 20, `?page=` แต่ละอันมี `replies` เรียงเก่าสุดก่อน) และ `DELETE /api/comments/[id]` ลบได้โดยเจ้าของคอมเมนต์ เจ้าของเรื่อง หรือแอดมิน UI อยู่ใน `components/CommentSection.tsx` (`id="comments"` ใช้เป็น anchor จากแจ้งเตือน)
- **ตอบกลับ**: `POST` พร้อม `parent_id` ได้ลึก 1 ชั้นเท่านั้น (parent ต้องเป็นคอมเมนต์หลักของเรื่องเดียวกัน ไม่งั้น 400/404) ลบคอมเมนต์หลักแล้วคำตอบหายตาม (FK cascade) `total` นับเฉพาะคอมเมนต์หลัก (ใช้แบ่งหน้า) ส่วน `total_with_replies` นับรวม
- เนื้อหาคอมเมนต์เป็น plain text ไม่เกิน 1000 ตัวอักษร แสดงด้วย `whitespace-pre-line` **ห้ามใช้ `dangerouslySetInnerHTML`** (เหตุผลเดียวกับเนื้อหาบท) จำกัด 5 คอมเมนต์ต่อนาทีต่อคน (429)
- `comments.created_at` เป็น `TIMESTAMP(3)` เพื่อให้เรียงใหม่สุดก่อนได้ถูกต้องเมื่อโพสต์ในวินาทีเดียวกัน
- `GET/PUT/DELETE /api/ratings` คืน `{ average, count, mine, can_rate }` คะแนน 1-5 หนึ่งแถวต่อคนต่อเรื่อง (`PUT` = upsert) ให้คะแนนได้เฉพาะเรื่อง `PUBLISHED` และห้ามให้คะแนนเรื่องของตัวเอง UI อยู่ใน `components/RatingStars.tsx` (กดดาวเดิมซ้ำ = ยกเลิก)
- ทั้งสองอย่างเช็ก `canViewContent()` (เรื่องที่ไม่ได้เผยแพร่ได้ 404 ยกเว้นเจ้าของ/แอดมิน) และซ่อนคอมเมนต์/ไม่นับคะแนนของผู้ใช้ที่เป็น `BANNED`
- คะแนนเฉลี่ยในหน้ารายการ/ค้นหา/อันดับมาจาก `lib/ranking.ts` (ดูหัวข้อ "จัดอันดับและแนะนำ")

**จัดอันดับและแนะนำ** (`lib/ranking.ts`, ทุก query คืนเฉพาะ `PUBLISHED`):
- `baseSql()` รวมสถิติต่อเรื่องด้วย derived table: `rating_avg`/`rating_count` (ไม่นับผู้ใช้ `BANNED` เหมือน `/api/ratings`), `sales` (จำนวนแถวใน `purchases` ของบท/ตอนในเรื่อง), `bookmarks` ลำดับการเรียงอยู่ใน `SORTS` เท่านั้น (รับจาก input ผ่าน `isSortKey()` ห้ามต่อ ORDER BY จาก input)
- `/ranking?type=novel|comic&sort=views|rating|sales|bookmarks` (`RANKING_SORTS`) 50 อันดับ เป็นอันดับรวมตลอดกาล (ถ้าจะทำรายสัปดาห์ต้องมีตารางเก็บวิวรายวัน) ลิงก์อยู่ใน Navbar และ "ดูอันดับทั้งหมด" ในหน้าแรก
- `/api/novels`, `/api/comics` รับ `?sort=newest|views|rating` (`SEARCH_SORTS`, ค่าอื่น = newest) และทุกแถวมีสถิติข้างบน หน้า `/search` มี dropdown เรียงลำดับ (`SORT_OPTIONS` ในหน้า ต้องตรงกับ `SEARCH_SORTS` เพราะ import `lib/ranking.ts` ใน client ไม่ได้)
- `getSimilarStories()`: "เรื่องที่คล้ายกัน" ในหน้า `/novel/[id]`, `/comic/[id]` หมวดเดียวกันก่อน แล้วเติมด้วยเรื่องที่วิวสูง
- `getRecommendations()`: "แนะนำสำหรับคุณ" ในหน้าแรก (เฉพาะคนล็อกอินที่มีประวัติ) ให้น้ำหนักหมวดจากบุ๊กมาร์ก 2 และ `reading_history` 1 รวมนิยายกับการ์ตูน ตัดเรื่องที่อ่าน/บุ๊กมาร์กแล้วและเรื่องของตัวเองออก
- การ์ดปกใช้ `components/StoryCard.tsx` ร่วมกัน เทสต์อยู่ใน `tests/e2e/ranking.test.mjs` (ใช้ยอดวิวหลักพันล้านให้เรื่องทดสอบอยู่บนสุดเหนือข้อมูลจริง)

**กราฟแดชบอร์ด** (`lib/analytics.ts`, `components/TimeSeriesChart.tsx` ใช้ recharts):
- `?range=30d|12m` (ค่าอื่น = 30d) แบ่งเป็นรายวัน 30 จุดหรือรายเดือน 12 จุด key ของแต่ละจุดสร้างจาก `CURDATE()` ของ MySQL ให้ตรงกับ `DATE_FORMAT()` ใน query และเติม 0 ให้ช่วงที่ไม่มีข้อมูล (`seriesByBucket()`)
- `GET /api/admin/analytics` (ADMIN): ยอดเติมเหรียญเฉพาะ `APPROVED` (นับตามเวลาที่อนุมัติคือ `updated_at`), ยอดขาย = SUM(`purchases.price`), ส่วนแบ่งเว็บ = price − `author_earning`, ผู้ใช้ใหม่ และยอดรวม + จำนวนสลิปรอตรวจ
- `GET /api/author/analytics`: รายได้ของผู้เขียนตามช่วงเวลา และสถิติรายเรื่องของตัวเอง (ทุกสถานะ) คือ จำนวนตอน วิว ขายได้ รายได้ คะแนน คอมเมนต์ บุ๊กมาร์ก (ไม่นับคะแนน/คอมเมนต์ของผู้ใช้ `BANNED`) แสดงใน `components/author/DashboardPanel.tsx`
- สีกราฟใช้ `SERIES_COLORS` (indigo `#6366F1`, pink `#EC4899` ผ่านการเช็กตาบอดสีและ contrast ทั้งพื้นสว่างและมืดแล้ว) ถ้าเพิ่ม series ต้องเลือกสีที่ผ่านการเช็กเดียวกัน ทุกกราฟมี "ดูเป็นตาราง" และไม่ใช้กราฟสองแกน y
- เทสต์อยู่ใน `tests/e2e/analytics.test.mjs` (เทียบค่าก่อน/หลังใส่ข้อมูล เพราะ DB มีข้อมูลจริงปนอยู่)

**ยอดวิว** (`lib/views.ts`): `recordView()` ถูกเรียกในหน้าอ่านทั้งสองหน้าคู่กับ `recordRead()` เฉพาะเมื่อผ่าน `canAccess()` แล้ว เพิ่มทั้งบท/ตอนและนิยาย/การ์ตูนแม่ใน UPDATE เดียว (ยอดของเรื่อง = ผลรวมของบท) ผู้อ่านที่ไม่ได้ล็อกอินก็นับ หน้า paywall และเจ้าของเรื่องอ่านเองไม่นับ ยังไม่กันการกดรีเฟรชซ้ำ (เปิดหน้าเดิมกี่ครั้งก็นับทุกครั้ง) ถ้า error จะ log แล้วให้อ่านได้ตามปกติ เทสต์อยู่ใน `tests/e2e/views.test.mjs`

**ประวัติการอ่าน** (`lib/readingHistory.ts`, ตาราง `reading_history`):
- 1 แถวต่อคนต่อเรื่อง เก็บบท/ตอนล่าสุดที่เปิด (`chapter_id`/`episode_id`) และ `read_at` (`TIMESTAMP(3)`)
- `recordRead()` ถูกเรียกในหน้า `app/read/[chapterId]` และ `app/comic/[id]/read/[episodeId]` เฉพาะเมื่อผ่าน `canAccess()` แล้ว (หน้า paywall ไม่บันทึก) ถ้า error จะ log แล้วยังให้อ่านได้ตามปกติ
- `GET /api/history?page=` (ล่าสุดก่อน หน้าละ 20) ซ่อนเรื่องที่ไม่ได้ `PUBLISHED` ยกเว้นเรื่องของตัวเอง (กฎเดียวกับ bookmarks) และ `DELETE /api/history` (`{ content_type, content_id }` หรือ `{ all: true }`) หน้า UI คือ `/history` ซึ่งมีปุ่ม "อ่านต่อ"
- ถ้าบทถูกลบ แถวยังอยู่แต่ `chapter_id` เป็น NULL (ปุ่มอ่านต่อจะพาไปหน้าเรื่องแทน) `novelsRead`/`comicsRead` ใน `/api/profile` นับจากตารางนี้
- `recordRead()` บันทึกลงตาราง `item_reads` ด้วย (1 แถวต่อคนต่อบท/ตอน ไว้ทำเครื่องหมาย "อ่านแล้ว") ทั้งสองตารางแยก try/catch กัน การลบประวัติ (`DELETE /api/history`) ลบ `item_reads` ของเรื่องนั้น/ทั้งหมดด้วย ผ่าน `clearReadItems()`

**ปุ่มเลือกตอน** (`components/EpisodePicker.tsx`, `lib/episodeList.ts`): อยู่ในแถบบนและระหว่างปุ่มก่อนหน้า/ถัดไปของหน้าอ่านทั้งสองหน้า (การ์ตูนแทนลิงก์ "รายการตอน" เดิม และบนมือถือปุ่มก่อนหน้า/ถัดไปของแถบบนจะซ่อน เหลือแถบล่าง)
- server ส่งรายการผ่าน `getEpisodeList()` เท่านั้น ซึ่งมีแค่ id/เลข/ชื่อ/ราคา/`locked`/`read` **ห้ามใส่ `content`** เพราะ props ถูก serialize ลงในหน้า ส่วน `locked` ใช้กฎเดียวกับ `canAccess()` (เจ้าของ/แอดมินไม่ล็อก) ถ้าเรื่องไม่ใช่ `PUBLISHED` (คือ `ARCHIVED` ที่คนซื้อเปิดได้) คนอื่นจะเห็นเฉพาะตอนที่ซื้อแล้ว ตอนอื่นจะเป็น 404
- กดตอนที่ล็อกจะไปหน้าอ่านตอนนั้นซึ่งแสดง paywall ตามเดิม ช่องค้นหาเลขตอนแสดงเมื่อมีมากกว่า 20 ตอน (Enter = ไปตอนที่เลขตรงพอดี) ต้อง render ด้วย `key={currentId}` เพื่อให้ปิดและล้างช่องค้นหาเมื่อเปลี่ยนตอน
- เทสต์อยู่ใน `tests/e2e/episode-picker.test.mjs` (อ่าน props จาก RSC payload ในหน้า HTML)

**แจ้งเตือน** (`lib/notifications.ts`, ตาราง `notifications`):
- สร้างผ่าน `notify(recipients, { type, message, link }, actorId)` / `notifyAdmins()` / `notifyNewItem()` เท่านั้น `type` ต้องอยู่ใน `NOTIFICATION_TYPES` (เก็บเป็น VARCHAR) `message` เป็น plain text ที่ server เขียน (ตัดข้อความจากผู้ใช้ด้วย `short()`) `link` เป็น path ภายในเว็บ
- เรียกหลังงานหลักสำเร็จ (หลัง commit) และ error จะถูก log แล้วกลืน แจ้งเตือนต้องไม่ทำให้งานหลักล้ม
- `actorId` = คนที่ทำให้เกิด: ไม่แจ้งเตือนตัวเอง และ `actor_id ON DELETE CASCADE` ทำให้ลบผู้ใช้แล้วแจ้งเตือนที่เขาก่อหายด้วย (เทสต์อาศัยข้อนี้ ไม่ให้แอดมินจริงได้แจ้งเตือนขยะ) ฝั่งแอดมินส่งให้ ADMIN ทุกคน
- จุดที่สร้าง: บท/ตอนใหม่ของเรื่อง PUBLISHED → คนที่บุ๊กมาร์ก, คอมเมนต์ → เจ้าของเรื่อง, ตอบกลับ → เจ้าของคอมเมนต์หลัก, ให้คะแนนครั้งแรก → เจ้าของเรื่อง (ไม่ระบุชื่อผู้ให้), ขายตอน → นักเขียน (ไม่ระบุชื่อผู้ซื้อ), ผลเติมเหรียญ / คำขอนักเขียน / การถอน → เจ้าของ, สลิปเติมเหรียญ / คำขอนักเขียน / คำขอถอน / รายงาน → แอดมิน
- API: `GET /api/notifications` (`?page=` หรือ `?limit=`), `GET /api/notifications/count`, `PATCH /api/notifications/[id]` (อ่านแล้ว เฉพาะของตัวเอง), `POST /api/notifications/read-all` UI คือ `components/NotificationBell.tsx` ใน Navbar (poll ทุก 30 วินาทีเฉพาะตอนแท็บเปิดอยู่) และหน้า `/notifications`
- `/admin` และ `/author` รับ `?tab=` เพื่อเปิดแท็บตรงจากลิงก์แจ้งเตือน

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
- `npm run lint` ต้องไม่มีทั้ง error และ warning (`npm run build` รัน lint ด้วย ถ้ามี error จะ build ไม่ผ่าน) ห้ามใช้ `any` ให้ใช้ type จริงหรือ `RowDataPacket` แทน ฟังก์ชันที่เรียกใน `useEffect` ให้ห่อด้วย `useCallback` แล้วใส่ใน dependency
- ข้อความทั้งหมดใน UI (รวม toast, confirm, title, placeholder และข้อความ error จาก API ที่แสดงให้ผู้ใช้เห็น) เป็นภาษาไทย ค่า enum ที่แสดงในตารางให้แปลงผ่าน label map (เช่น `ROLE_LABEL` ใน `app/admin/page.tsx`) ไม่แสดงค่าดิบ
- **อย่ารัน `npm run build` ขณะที่ `npm run dev` เปิดอยู่** เพราะทั้งคู่เขียนลง `.next/` ให้ปิด dev ก่อน แล้วลบ `.next` ก่อนเปิด dev ใหม่

## งานที่เหลือ (อัปเดตล่าสุด 2026-10-23)

**สถานะ branch**: ทุกอย่างอยู่บน `main` และ push ขึ้น `origin/main` แล้ว ไม่มีงานค้างในเครื่อง

**ยังไม่ได้เปิดดูในเบราว์เซอร์** (ทำเสร็จและเทสต์ผ่านแล้ว แต่ไม่มีใครดูหน้าตาจริง เพราะตอนทำ Chrome extension ไม่ได้เชื่อมต่อ) ให้เช็กทั้งจอคอมและโหมดมือถือ (F12 → ctrl+shift+M) ทั้งธีมสว่างและมืด:
- `/admin` แท็บภาพรวม: การ์ดยอดเงิน, กราฟเติมเหรียญ/ยอดขาย และผู้ใช้ใหม่, ปุ่มสลับ 30 วัน/12 เดือน, tooltip, "ดูเป็นตาราง"
- `/author` แท็บภาพรวม: กราฟรายได้ และตาราง "สถิติรายเรื่อง" (บนมือถือต้องเลื่อนแนวนอนได้)
- `/ranking` (แท็บนิยาย/การ์ตูน, ตัวเลือกเรียง 4 แบบ), "แนะนำสำหรับคุณ" ในหน้าแรก (ต้องล็อกอินและเคยอ่าน/บุ๊กมาร์ก), "เรื่องที่คล้ายกัน" ล่างหน้า `/novel/[id]`, dropdown เรียงลำดับใน `/search`
- ปุ่ม "เลือกตอน" ในหน้าอ่านนิยาย/การ์ตูน (แถบบน + แถบล่าง) มีเรื่องทดสอบ 30 ตอนใน DB เครื่องนี้ที่ `/read/95b71236-8285-4819-b1b7-63b8fbdcc20c` (ช่องค้นหาเลขตอนขึ้น, ตอน 21-30 ล็อก) ดูเสร็จแล้วลบด้วย
  `node -e "import('file:///D:/loveR/tests/e2e/helpers.mjs').then(async h=>{const db=await h.connectDb();await h.cleanupUsers(db,['588296a5-af9f-407f-af21-597d212ed4ca']);await db.end()})"`
- ยอดวิวเพิ่งเริ่มนับ 2026-10-23 ข้อมูลเก่าเป็น 0 ถ้าจะพรีเซนต์อันดับ/กราฟ ควรเปิดอ่านหลายเรื่องให้มีข้อมูลก่อน

**อัปเดตเครื่องอื่น/DB อื่นให้ตรงกับ `main`** (ทุกสคริปต์รันซ้ำได้ ถ้าเคยรันแล้วจะข้ามเอง):
1. `git pull` แล้ว `npm install` (2026-10-21 อัปเกรด `next` เป็น 15.5.28 และ dependency อื่นจาก `npm audit fix`)
2. รัน migration ตามลำดับ:
   ```bash
   npx tsx scripts/add_login_attempts.ts      # จำกัดการล็อกอินผิด
   npx tsx scripts/add_comments_ratings.ts    # คอมเมนต์และให้คะแนน
   npx tsx scripts/add_register_attempts.ts   # จำกัดการสมัครสมาชิก
   npx tsx scripts/add_reading_history.ts     # ประวัติการอ่าน
   npx tsx scripts/add_notifications.ts       # แจ้งเตือน + comments.parent_id (ตอบกลับ)
   npx tsx scripts/add_item_reads.ts          # บท/ตอนที่อ่านแล้ว (ปุ่มเลือกตอน)
   ```
   DB ที่เก่ากว่านั้นให้รันสคริปต์ก่อนหน้าตามลำดับใน README ก่อน ส่วน DB ใหม่ใช้ `schema.sql` ได้เลยไม่ต้องรันพวกนี้
3. ลบ `.next` แล้วเปิด `npm run dev` ใหม่ จากนั้นรัน `npm run test:e2e` เพื่อเช็ก (ต้องผ่านทั้งหมด 101 เทสต์)

**ผู้ดูแลต้องทำเอง**:
- กรอก "ข้อมูลการชำระเงิน" ที่ `/admin` → ตั้งค่า (เครื่องนี้ยังเป็นข้อความตัวอย่างอยู่) ถ้ายังไม่กรอก ผู้อ่านจะเติมเหรียญไม่ได้
- สำรอง `storage/` และ `public/uploads/` ซึ่งไม่อยู่ใน git (ไฟล์สำรองเก่า `storage-2026-10-17.zip` ย้ายไปไว้ที่ `D:\loveR-backups\` แล้ว)
- ถ้ามั่นใจแล้วว่ารูปการ์ตูนใน storage ใช้ได้: `npx tsx scripts/move_comic_pages_private.ts --delete-originals` (URL เก่าใน `public/uploads/` ยังเปิดได้จนกว่าจะรัน)
- ตอน deploy: ให้ reverse proxy (เช่น nginx) ตั้ง `x-forwarded-for` ไม่งั้น limit ต่อ IP ของการล็อกอินและการสมัครจะไม่ทำงาน (IP เป็น `'unknown'`)

**งานพัฒนา** (เรียงตามความสำคัญ ข้อ 1-2 คือหัวข้อในขอบเขตโปรเจกต์ที่ยังไม่ครบ ดูตารางในหัวข้อถัดไป):
1. **ข้อ 12 ตรวจเนื้อหาด้วย API** (ยังเป็น ❌): ผู้ใช้เลือกทำข้อ 8 ก่อน ยังไม่ได้ตัดสินใจว่าจะใช้ API ตัวไหน ข้อเสนอคือ OpenAI Moderation (ฟรี, ข้อความ+รูป) + รายการคำต้องห้ามไทย ดูทางเลือกทั้งหมดในหัวข้อถัดไป ต้องให้ผู้ใช้สมัครและใส่ API key ใน `.env` เอง แผน: ตรวจตอนโพสต์คอมเมนต์ บันทึกบท/ตอน และชื่อเรื่อง/เรื่องย่อ ถ้าถูกตีธงให้สร้างแถว `reports` (PENDING) ให้แอดมินตัดสิน ไม่บล็อกอัตโนมัติ ถ้า API ล่มหรือไม่มี key ต้องโพสต์ได้ตามปกติ
2. **ข้อ 14 เก็บงาน UX** (⚠️): ได้แก่ข้อ 3, 4, 6 ในรายการนี้ และผลทดสอบกับผู้ใช้จริง (เช่น แบบสอบถาม SUS) สำหรับรายงาน
3. **หน้า `/admin` ใช้บนมือถือไม่ได้**: sidebar กว้างตายตัว (`fixed w-64` + `pl-64`) ให้ทำแบบเดียวกับ `/author` (ซ่อน sidebar ใต้ `md` แล้วใช้แถบแท็บเลื่อนแนวนอน)
4. **`prompt()` ในแท็บการเงิน** (`components/admin/PaymentsPanel.tsx`): ตอนปฏิเสธการเติมเหรียญและการถอนเงิน ยังใช้กล่องของเบราว์เซอร์ถามเหตุผล (จัดการกดยกเลิกถูกแล้ว) ควรเปลี่ยนเป็น dialog แบบเดียวกับการปฏิเสธคำขอนักเขียนใน `app/admin/page.tsx`
5. **ลบแจ้งเตือนเก่า**: ตาราง `notifications` ยังไม่มีการลบอัตโนมัติ ถ้าใช้งานนานควรลบที่เก่ากว่า ~90 วัน (เช่นใน `notify()` นานๆ ครั้ง หรือ cron)
6. **ข้อความ error ภาษาอังกฤษใน API**: เช่น `Unauthorized`, `Content not found`, `Invalid ...` ปกติผู้ใช้ไม่เห็น แต่ถ้าแสดงใน toast ควรเป็นภาษาไทย (UI ทั้งหมดเป็นภาษาไทยแล้ว)
7. **dependency ที่มีช่องโหว่** (อัปเกรด next เป็น 15.5.28 และรัน `npm audit fix` แล้วเมื่อ 2026-10-21): ที่เหลือแก้ได้ทางเดียวคือขึ้น Next 16 (breaking) ได้แก่ `postcss` ที่ next ฝังมาเอง (ใช้ตอน build CSS ของเราเอง ไม่ได้รับ input จากผู้ใช้) และ `braces`/`micromatch`/`fast-glob` ใต้ `eslint-config-next` (dev เท่านั้น) อย่าใช้ `npm audit fix --force` เพราะจะอัปเกรดแบบ breaking
8. **object storage**: จำเป็นเฉพาะถ้าจะ deploy บน Vercel/serverless ตอนนี้ไฟล์ทั้งหมดเขียนลงดิสก์ (`lib/upload.ts` เป็นจุดเดียวที่ต้องแก้)

## ตรวจตามขอบเขตโปรเจกต์ที่เสนออาจารย์ (ตรวจจากโค้ด 2026-10-23)

| # | หัวข้อ | สถานะ | หน้าที่ใช้โชว์ | ไฟล์หลัก |
|---|---|---|---|---|
| 1 | อ่านนิยายและสลับตอน | ✅ | `/novel/[id]`, `/read/[chapterId]`, `/comic/[id]/read/[episodeId]` | `app/read/[chapterId]/page.tsx`, `app/comic/[id]/read/[episodeId]/page.tsx` |
| 2 | ที่คั่นหน้าและประวัติการอ่าน | ✅ | `/bookmarks`, `/history` | `api/bookmarks`, `api/history`, `lib/readingHistory.ts`, `components/BookmarkButton.tsx` |
| 3 | เติมเหรียญ | ✅ | `/coins` → `/admin?tab=payments` | `api/coins/topup`, `api/admin/topups/[id]`, `components/admin/PaymentsPanel.tsx` |
| 4 | กระเป๋าเหรียญ | ✅ | `/coins`, `/author?tab=wallet` | `api/coins`, `components/author/WalletPanel.tsx` |
| 5 | ซื้อตอนด้วยเหรียญ | ✅ | `/read/[chapterId]` (ตอนที่มีราคา) | `lib/coins.ts` (`purchaseItem`, `canAccess`), `components/Paywall.tsx`, `api/purchases` |
| 6 | แบ่งรายได้ให้ผู้เขียน | ✅ | `/author?tab=earnings`, `/admin` → ตั้งค่า (ส่วนแบ่ง %) | `lib/coins.ts` (`getAuthorBalance`), `api/author/earnings`, `api/author/withdrawals` |
| 7 | ระบบผู้เขียน (เพิ่ม/แก้ไขตอน + สถิติ) | ✅ | `/author` (กราฟรายได้ + สถิติรายเรื่อง), `/author/novel/[id]/chapters`, `/author/comic/[id]/episodes` | `components/author/*`, `api/author/stats`, `api/author/analytics` |
| 8 | การจัดเก็บและแสดงผล Dashboard | ✅ | `/admin` (ภาพรวม: การ์ดยอดเงิน + กราฟ 30 วัน/12 เดือน), `/author` (ภาพรวม) | `lib/analytics.ts`, `components/TimeSeriesChart.tsx`, `components/admin/AnalyticsPanel.tsx`, `components/author/DashboardPanel.tsx` |
| 9 | ผู้ดูแลระบบ | ✅ | `/admin` ทุกแท็บ | `app/admin/page.tsx`, `app/api/admin/**` |
| 10 | รีวิว/คอมเมนต์และให้คะแนน | ✅ | ล่างหน้า `/novel/[id]`, `/comic/[id]` | `components/CommentSection.tsx`, `components/RatingStars.tsx`, `api/comments`, `api/ratings` |
| 11 | จัดอันดับและแนะนำ | ✅ (อันดับรวมตลอดกาล) | `/ranking`, `/` (แนะนำสำหรับคุณ + ยอดนิยม), ล่างหน้า `/novel/[id]` (เรื่องที่คล้ายกัน), `/search` (เรียงตาม) | `lib/ranking.ts`, `app/ranking/page.tsx`, `components/StoryCard.tsx` |
| 12 | ตรวจสอบเนื้อหาเบื้องต้นด้วย API | ❌ | — | — |
| 13 | รักษาความปลอดภัย | ✅ | `/login` (ล็อกอินผิดเกิน 5 ครั้ง), เปิดตอนที่ยังไม่ซื้อ | `lib/auth.ts`, `lib/loginThrottle.ts`, `lib/upload.ts`, `lib/visibility.ts`, `tests/e2e/security.test.mjs` |
| 14 | ทดสอบระบบและปรับ UX/UI | ⚠️ | `npm run test:e2e` (101 เทสต์) | `tests/e2e/` |

**สิ่งที่ขาด**:
- ~~ยอดวิวไม่เคยเพิ่ม~~ **แก้แล้ว 2026-10-23** (ดูหัวข้อ "ยอดวิว" ในสถาปัตยกรรม) ยอดวิวเก่าก่อนวันนั้นของนิยาย/บท/การ์ตูนยังเป็น 0 เพราะไม่มีข้อมูลย้อนหลัง
- **ข้อ 7**: **ทำแล้ว 2026-10-23** (กราฟรายได้และสถิติรายเรื่องในแท็บภาพรวมของ `/author`)
- **ข้อ 8**: **ทำแล้ว 2026-10-23** ส่วน "รูปแบบการจัดเก็บ" ใช้ `schema.sql`/`prisma/schema.prisma` ทำ ER diagram ใส่รายงานได้
- **ข้อ 11**: **ทำแล้ว 2026-10-23** เหลือเพิ่มได้ถ้าต้องการ: อันดับรายสัปดาห์/รายเดือน (ต้องมีตารางเก็บวิวรายวัน) และกันการกดรีเฟรชซ้ำในการนับวิว
- **ข้อ 12**: ยังไม่มีการตรวจเนื้อหาอัตโนมัติ มีแค่ผู้ใช้กดรายงาน → แอดมินดู ทางเลือก API ที่ตรวจภาษาไทย (ราคาเปลี่ยนบ่อย เช็กหน้า pricing ก่อนเขียนรายงาน):
  - **OpenAI Moderation API** (`omni-moderation-latest`): ฟรี รองรับหลายภาษารวมไทย ตรวจได้ทั้งข้อความและรูป (ใช้กับหน้าการ์ตูนได้) ใช้ง่าย / ข้อเสีย: แม่นกับภาษาไทยน้อยกว่าอังกฤษ (คำแสลง คำหยาบเลี่ยงตัวสะกด) หมวดตายตัว ปรับนโยบายเองไม่ได้ ส่งข้อมูลออกไปต่างประเทศ
  - **LLM (เช่น Claude Haiku) + prompt นโยบายของเว็บ**: เข้าใจภาษาไทยและบริบทนิยายดีที่สุด กำหนดหมวดเองได้ (18+, ด่าทอ, สแปม/ลิงก์พนัน) และให้เหตุผลภาษาไทยกลับมาได้ / ข้อเสีย: เสียเงินตาม token (บทนิยายยาว ต้องตัดเป็นช่วงหรือตรวจเฉพาะคอมเมนต์+ชื่อเรื่อง+เรื่องย่อ) ช้ากว่า ผลไม่ deterministic
  - **Azure AI Content Safety**: ตรวจข้อความ+รูป มีระดับความรุนแรง มี free tier / ข้อเสีย: ภาษาไทยไม่อยู่ในกลุ่มภาษาที่ train หลัก (ใช้ได้แต่คุณภาพต่ำกว่า) ต้องมีบัญชี Azure
  - **Google Cloud Vision SafeSearch** (เฉพาะรูป): ตรวจรูปโป๊/รุนแรง มีโควตาฟรีต่อเดือน แล้วคิดต่อรูป / ข้อเสีย: ไม่ตรวจข้อความ
  - **รายการคำต้องห้ามภาษาไทยในเครื่อง** (ตัดคำด้วย `Intl.Segmenter('th')`): ฟรี เร็ว ไม่ส่งข้อมูลออก / ข้อเสีย: ไม่ใช่ API จับบริบทไม่ได้ ใช้เป็นด่านแรกคู่กับ API
  - ข้อเสนอ: OpenAI Moderation (ฟรี, ข้อความ+รูป) + รายการคำต้องห้ามไทย ถ้าต้องการความแม่นภาษาไทยให้ใช้ LLM เฉพาะคอมเมนต์/เรื่องย่อ ผลที่ถูกตีธงให้สร้างแถวใน `reports` (PENDING) ให้แอดมินตัดสิน ไม่บล็อกอัตโนมัติ และถ้า API ล่มต้องให้โพสต์ได้ตามปกติ (แบบเดียวกับ `notify()`)
- **ข้อ 13** (ครบแล้ว เพิ่มได้ถ้าต้องการ): security headers (CSP, `X-Frame-Options`) ใน `next.config.ts`, ลืมรหัสผ่าน/ยืนยันอีเมล
- **ข้อ 14**: ดูรายการ "งานพัฒนา" ข้อ 3, 4, 6 ข้างบน (`/admin` บนมือถือ, `prompt()`, error ภาษาอังกฤษ) ส่วนรายงานควรมีผลทดสอบกับผู้ใช้จริง (เช่น แบบสอบถาม SUS) ซึ่งไม่อยู่ในโค้ด
