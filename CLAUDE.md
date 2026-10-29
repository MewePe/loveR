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
- **ตรวจเนื้อหา (Gemini) ในเทสต์ใช้ผลจำลองเสมอ**: `Client` ใน `helpers.mjs` ส่ง header `x-moderation-mock: safe` ทุก request บท/ตอนที่สร้างผ่าน API จึงผ่านการตรวจทันทีโดยไม่เรียก API จริง เปลี่ยนผลได้ด้วย `client.extraHeaders[MOCK_HEADER] = 'mature' | 'explicit:2,3' | 'illegal' | 'minor' | 'refused' | 'error'` (ตัวเลขหลัง `:` = หน้าการ์ตูนที่มีปัญหา) header นี้ใช้ได้เฉพาะตอน `NODE_ENV !== 'production'` เทสต์กับ API จริงอยู่ใน `moderation-gemini.test.mjs` (ข้อความปลอดภัย + คำหยาบเล็กน้อยเท่านั้น ข้ามเองถ้าไม่มี `GEMINI_API_KEY`)
- ใช้ `node:test` + `node:assert` ไม่มี dependency เพิ่มเขียนเป็น `.mjs` ไฟล์ละ 1 หัวข้อ ภายในไฟล์ test จะรันตามลำดับ และใช้ state ร่วมกันผ่านตัวแปรระดับ module
- **แก้ระบบเงิน การล็อกเนื้อหา สิทธิ์ การตรวจเนื้อหา/ยืนยันอายุ หรือการอัปโหลดเมื่อไหร่ ให้รัน `npm run test:e2e` ทุกครั้ง**

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
npx tsx scripts/add_story_categories.ts # ตาราง novel_categories/comic_categories (หลายหมวดต่อเรื่อง) คัดลอกหมวดเดิมจาก category_id มาให้ (รันซ้ำได้)
npx tsx scripts/add_author_profiles.ts # คอลัมน์โปรไฟล์ใน users (username/bio/cover_image/social_links), is_completed, ตาราง follows/supports และตั้ง username ให้ทุกคน (รันซ้ำได้)
npx tsx scripts/add_admin_tools.ts # คอลัมน์แบนใน users (ban_reason/banned_at/role_before_ban), ตาราง coin_adjustments และ admin_logs (รันซ้ำได้)
npx tsx scripts/add_mature_flag.ts # คอลัมน์ is_mature (18+) ใน novels/comics (รันซ้ำได้)
npx tsx scripts/add_reader_settings.ts # คอลัมน์ users.reader_settings (ตั้งค่าการอ่าน Aa) (รันซ้ำได้)
npx tsx scripts/add_moderation.ts # ตรวจเนื้อหาด้วย API + ยืนยันอายุ: moderation_status ใน chapters/comic_episodes (ของเดิมเป็น APPROVED), users.birth_date, ตาราง moderation_checks (รันซ้ำได้)
```

`reset_db.ts` และ `drop_old_db.ts` ลบข้อมูล

## Environment

ใช้ MySQL/MariaDB บนเครื่อง (XAMPP) ใน `.env` ต้องมี `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` (ค่าเริ่มต้น `loveread_db`) และ `AUTH_SECRET` ส่วน `DATABASE_URL` ใช้เฉพาะกับเครื่องมือของ Prisma `GEMINI_API_KEY` ใช้ตรวจเนื้อหา (ไม่มีก็ใช้งานได้ แต่ทุกบท/ตอนใหม่จะรอแอดมินตรวจ) `GEMINI_MODEL` เปลี่ยนโมเดลได้ (ค่าเริ่มต้น `gemini-3.1-flash-lite`)

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

**การแจ้งเตือน**: ห้ามใช้ `alert()`/`confirm()`/`prompt()` ของเบราว์เซอร์ (ถ้าต้องถามข้อความ เช่น เหตุผลที่ปฏิเสธ ให้ทำ dialog ในหน้าแบบใน `PaymentsPanel.tsx`) ให้ใช้ `const toast = useToast()` จาก `components/Toast.tsx` (`toast.success(msg)` / `toast.error(msg)` หายเองใน 3.5/6 วินาที ไม่บล็อกหน้า) และ `useConfirm()` จาก `components/ConfirmDialog.tsx` สำหรับการยืนยัน

**แอดมิน** (`app/admin/page.tsx` + `components/admin/`): page.tsx มีแค่ sidebar, การเช็กสิทธิ์ และสลับแท็บ แต่ละแท็บเป็น component แยก (`DashboardPanel`, `UsersPanel` + `UserDetail`, `ContentPanel`, `ReportsPanel`, `ModerationPanel`, `WritersPanel`, `PaymentsPanel`, `AuditLogPanel`, `CategoriesPanel`, `SettingsPanel` ซึ่งได้ props แบบ `PanelProps` ใน `components/admin/types.ts`) ส่วนที่ใช้ร่วมกัน (Badge, ปุ่มที่มีข้อความ, Modal, `ReasonDialog`, `ImageLightbox`, Pagination, `fetchJson`/`sendJson`) อยู่ใน `components/admin/ui.tsx` หน้าเก่าอย่าง `/admin/users`, `/admin/content` ฯลฯ แค่ redirect ไป `/admin`
- **state อยู่ใน URL**: `?tab=` และ `?user=<id>` (หน้ารายละเอียดผู้ใช้), `?view=topups|withdrawals|history` (การเงิน), `?type=novels|comics` (เนื้อหา), `?target=<id>` (ประวัติแอดมินของรายการเดียว) ใช้ `navigate(tab, params)` ที่ page ส่งให้ panel จะถูก remount เมื่อ view/type/target เปลี่ยน
- **ตัวเลขแดงบนเมนู**: `GET /api/admin/counts` (`writers`, `topups`, `withdrawals`, `reports`, `moderation`) โหลดตอนเปิด ตอนเปลี่ยนแท็บ ทุก 60 วินาที และเมื่อ panel เรียก `refreshCounts()` หลังทำรายการ `moderation` = จำนวนในคิวตรวจเนื้อหา (`QUEUE_SQL` ใน `lib/moderation.ts`)
- **ภาพรวม** `GET /api/admin`: การ์ด 6 ใบ (ผู้ใช้ทั้งหมด/ใหม่วันนี้/นักเขียน/เรื่องทั้งหมด/เติมเหรียญเดือนนี้เฉพาะ APPROVED/รายได้แพลตฟอร์ม = `SPENT_SQL` − author_earning) กล่องงานรอดำเนินการ กราฟ (`AnalyticsPanel`) เรื่องยอดนิยม 5 อันดับ (นิยาย+การ์ตูนรวมกันตามวิว จาก `listStories`) และกิจกรรมล่าสุด 10 รายการ
- **ผู้ใช้**: `GET /api/admin/users?search=&role=READER|AUTHOR|ADMIN&status=active|banned&page=` → `{ users, total, page, pageSize }` (role กรองจากสิทธิ์ก่อนแบนด้วย) `GET /api/admin/users/[id]` คืนข้อมูลบัญชี, เติมเหรียญ, ซื้อตอน, สนับสนุน, การปรับเหรียญ, ผลงาน, รายงานที่โดน (บัญชี/เรื่อง/คอมเมนต์ของเขา) และ log ที่เกี่ยวกับเขา
- **แบน**: `PATCH /api/admin/users/[id]` `{ action: 'ban', reason }` (ต้องมีเหตุผล) เก็บ role เดิมใน `users.role_before_ban` พร้อม `ban_reason`/`banned_at` ส่วน `{ action: 'unban' }` คืน role เดิม `{ role }` แบบเก่ายังใช้ได้ (`role: 'BANNED'` = แบนโดยไม่บังคับเหตุผล, role อื่น = เปลี่ยนสิทธิ์และปลดแบน) แบน/เปลี่ยนสิทธิ์ตัวเองไม่ได้
- **ปรับเหรียญ**: `POST /api/admin/users/[id]/coins` `{ amount, reason }` (จำนวนเต็ม ≠ 0, |amount| ≤ 1,000,000, ต้องมีเหตุผล, ยอดห้ามติดลบ) lock แถว `FOR UPDATE` บันทึกลงตาราง `coin_adjustments` และแจ้งเตือน `COINS_ADJUSTED`
- **เนื้อหา**: `GET /api/admin/content?type=&search=&categoryId=&status=published|hidden|banned&page=` (hidden = DRAFT/ARCHIVED) ทุกแถวมีสถิติ (ตอน วิว ขาย รายได้ คะแนน คอมเมนต์ บุ๊กมาร์ก รายงานค้าง) `PATCH /api/admin/content/[id]` ซ่อน (`ARCHIVED`) และแบนต้องมี `reason` แล้วแจ้งเตือน `CONTENT_MODERATED` ถึงนักเขียน
- **การเงิน**: `/api/admin/topups` และ `/api/admin/withdrawals` รับ `?status=&from=&to=` (YYYY-MM-DD, `to` นับรวมวันนั้น ผ่าน `listFilters()`) `GET /api/admin/transactions?type=TOPUP|PURCHASE|SUPPORT|WITHDRAWAL|ADJUSTMENT&status=&from=&to=&search=&page=` รวมทุกการเคลื่อนไหวของเงินด้วย UNION (ทุก SELECT ใน `KINDS` ต้องตั้งชื่อคอลัมน์เอง เพราะตัวไหนก็เป็นตัวแรกได้) ดูสลิปผ่าน `ImageLightbox` (ใช้ `<img>` เพราะเป็นไฟล์ private)
- **ประวัติการทำงานของแอดมิน** (`lib/adminLog.ts`, ตาราง `admin_logs`): ทุก route ที่แอดมินเปลี่ยนข้อมูลต้องเรียก `logAdminAction(adminId, { action, targetType, targetId, targetLabel, detail, reason }, conn?)` (ถ้ามี transaction ให้ส่ง connection) `action` ต้องอยู่ใน `ADMIN_ACTIONS` (`lib/adminActions.ts` ซึ่งไม่ import อะไรฝั่ง server จึงใช้ใน client ได้ และมี `ROLE_LABEL`/`CONTENT_STATUS_LABEL`) error จะถูก log แล้วกลืนเหมือน `notify()` เก็บ `admin_name` เป็นสำเนาไว้ (admin_id `ON DELETE SET NULL`) แอดมินลบคอมเมนต์ของคนอื่นผ่าน `DELETE /api/comments/[id]` ก็ถูกบันทึก `GET /api/admin/logs?action=&adminId=&targetId=&from=&to=&page=`
- **ทุกการกระทำต้องยืนยันก่อน**: การกระทำที่ต้องมีเหตุผล (แบน ซ่อน/แบนเรื่อง ปฏิเสธ) ใช้ `ReasonDialog` ซึ่งปุ่มในกล่องคือการยืนยัน ที่เหลือใช้ `useConfirm()` (ปรับเหรียญใช้ทั้งกล่องกรอกและ confirm) ปุ่มจัดการทุกปุ่มมีข้อความกำกับ (`ActionButton`)
- เทสต์อยู่ใน `tests/e2e/admin.test.mjs`

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

**หน้าแรก** (`app/page.tsx` server component, ข้อมูลจาก `lib/home.ts` + `lib/ranking.ts` โหลดพร้อมกันด้วย `Promise.all`):
- เรียงลำดับ: แบนเนอร์สไลด์ (`components/home/HeroCarousel.tsx`), แถบหมวดหมู่, อ่านต่อ, อัปเดตล่าสุด, นิยายยอดนิยม, การ์ตูนยอดนิยม, 10 อันดับ (เลขตัวใหญ่), แนะนำสำหรับคุณ, เรื่องที่จบแล้ว, นักเขียนยอดนิยม ส่วนไหนไม่มีข้อมูลจะไม่แสดงเลย (ไม่ปล่อยกล่องว่าง)
- แบนเนอร์: `getFeatured()` 5 เรื่องที่วิวสูงสุดและมีตอนแล้ว (ที่มีปกก่อน) **ไม่เอาเรื่อง 18+** ปุ่ม "อ่านเลย" ไปตอนแรก เลื่อนเองทุก 6 วินาที หยุดเมื่อชี้/โฟกัส/แท็บซ่อน/กดหยุด และไม่เลื่อนเองถ้าผู้ใช้ตั้ง `prefers-reduced-motion`
- อ่านต่อ (`getContinueReading()`, เฉพาะคนล็อกอินที่มี `reading_history`) กฎการซ่อนเหมือน `/api/history`; อัปเดตล่าสุด (`getLatestUpdates()`) ใช้ sort `updated` (`last_item_at` = เวลาบท/ตอนล่าสุด) แล้วดึงบท/ตอนล่าสุดของแต่ละเรื่อง; นักเขียนยอดนิยม (`getTopAuthors()`) = ผลรวมวิวของเรื่อง PUBLISHED ไม่นับ `BANNED`
- ทุกแถวเลื่อนซ้ายขวาด้วย `components/home/ScrollRow.tsx` (+ `RowItem`) ปัดนิ้วบนมือถือ มีปุ่มลูกศรตั้งแต่ `md` **ตัว list ต้องเป็น `relative`** และการ์ดข้างในต้องมี positioned ancestor (StoryCard เป็น `relative`) ไม่งั้นสิ่งที่เป็น `absolute` เช่น `sr-only` จะหลุดออกนอก scroller ทำให้ทั้งหน้าเลื่อนซ้ายขวาได้ (เคยเกิดแล้ว)
- **ทุกแถวจาก `lib/ranking.ts`** มี `item_count`, `last_item_at`, `is_completed`, `is_mature` (เป็น boolean แล้ว) และ `listStories()` รับ `completed`/`hasItems` เพิ่ม sort `updated` อยู่ใน `SORTS` แต่ไม่อยู่ใน `SEARCH_SORTS`/`RANKING_SORTS` จึงรับจาก input ไม่ได้
- **การ์ดเรื่อง** `components/StoryCard.tsx`: ป้ายนิยาย/การ์ตูน, 18+, จบแล้ว, วิวแบบย่อ (`compactNumber()`), คะแนน, จำนวนบท/ตอน, ยกขึ้นตอนชี้ (`motion-reduce` ปิด) `maxTags` จำกัดป้ายหมวด ปกใช้ `components/StoryCover.tsx`: รูปโหลดแบบ `loading="lazy"` (ยกเว้นสไลด์แรก) ไม่มีรูปจะสร้างปกจากชื่อเรื่องบน gradient ที่สีมาจาก `hueOf(id)` (FNV-1a, **ห้ามกลับไปใช้ `h*31+c`** เพราะ UUID ได้สีเกือบเดียวกันหมด) ความสว่าง 30%/17% ให้ตัวอักษรขาวอ่านได้ทุกสี
- **18+** (`novels.is_mature`/`comics.is_mature`): นักเขียนต้องเลือก "ทั่วไป" หรือ "18+" ใน `WorkFormModal` ตอนสร้างเรื่อง (POST ไม่ส่ง `isMature: boolean` = 400, PATCH ไม่ใช่ boolean = 400) การ์ดเบลอปกและมีป้าย หน้าเรื่องมีป้าย 18+ และต้องยืนยันอายุก่อนเข้า (ดูหัวข้อ "ยืนยันอายุ 18+")
- `timeAgo()` อยู่ที่ `lib/timeAgo.ts` (ใช้ได้ทั้ง server/client, `NotificationBell` re-export)
- **Footer** `components/Footer.tsx` อยู่ใน `app/layout.tsx` ซ่อนในหน้า `/admin`, `/author`, หน้าอ่าน และ `/maintenance` (`HIDDEN`)
- เทสต์อยู่ใน `tests/e2e/home.test.mjs` (ใช้ยอดวิวหลักพันล้านให้เรื่องทดสอบอยู่บนสุด)
- **ตรวจหน้าตาโดยไม่มี Chrome extension**: ใช้ Chrome headless ผ่าน DevTools Protocol (`--remote-debugging-port`, `Emulation.setDeviceMetricsOverride` + `setEmulatedMedia prefers-color-scheme`, `Page.captureScreenshot captureBeyondViewport`) ห้ามตั้งความสูงหน้าต่างเท่าทั้งหน้า เพราะ `min-h-screen` จะดัน footer ออกนอกภาพ

**หน้าโปรไฟล์** (`/profile/[username]`, `lib/authors.ts`, `lib/username.ts`, `lib/profile.ts`) หน้าเดียวสำหรับทุกคน:
- ผู้ใช้ทุกคนมีหน้าโปรไฟล์ (รวม READER) ยกเว้น `BANNED` และ username ที่ไม่มีอยู่ได้ 404 (`getPublicProfile()`) รับได้ทั้ง username และ user id (id หรือตัวพิมพ์ใหญ่จะ redirect ไป URL ที่ถูกต้อง)
- `is_author` (AUTHOR/ADMIN หรือมีเรื่อง PUBLISHED) เท่านั้นที่มีแท็บผลงาน (นิยาย/การ์ตูน) แฟนตัวยง จำนวนผู้ติดตาม และปุ่มติดตาม/สนับสนุน (`getPublicAuthor()`/`canHaveProfile()` ใช้กับ follow/support จึงยังได้ 404 สำหรับผู้อ่าน) ผู้อ่านที่คนอื่นเปิดดูจะเห็นแค่ส่วนหัวกับข้อความ "ยังไม่มีผลงานที่เผยแพร่"
- **เจ้าของโปรไฟล์** เห็นเพิ่ม: แท็บ บุ๊กมาร์ก/ประวัติการอ่าน/กระเป๋าเหรียญ (`components/profile/BookmarksTab.tsx`, `HistoryTab.tsx`, `WalletTab.tsx` ดึงจาก `/api/bookmarks`, `/api/history`, `/api/coins`) ปุ่ม "แก้ไขโปรไฟล์" และ "หน้านักเขียน" (AUTHOR/ADMIN) และกล่องแนะนำให้ตั้งชื่อถ้ายังเป็น `user_xxxx` (`isDefaultUsername()`) คนอื่นส่ง `?tab=wallet` มาก็ได้แท็บปกติ บนมือถือแท็บใช้ชื่อสั้น (ประวัติ/เหรียญ) และเลื่อนซ้ายขวาได้ถ้ามี 5 แท็บ
- `/profile` redirect ไปโปรไฟล์ของตัวเอง (เก็บ `?tab=` ที่ถูกต้องไว้) ไม่ล็อกอินไป `/login` ส่วน `/bookmarks` และ `/history` redirect ไป `/profile?tab=bookmarks|history` หน้าเติมเหรียญยังเป็น `/coins` (ประวัติเหรียญใช้ `components/profile/CoinHistory.tsx` ร่วมกับแท็บกระเป๋าเหรียญ)
- **แก้ไขโปรไฟล์** ที่ `/profile/edit` (ทุกคน): รูปโปรไฟล์ รูปปก ชื่อที่แสดง (1-100) @username แนะนำตัว ลิงก์โซเชียล → `PATCH /api/profile` (ส่งเฉพาะช่องที่เปลี่ยน) ตรวจทั้งหมดใน `updateProfile()` (`lib/profile.ts`) ซึ่ง `PATCH /api/author/public-profile` แบบเก่าก็ใช้ (จำกัดเฉพาะนักเขียนเหมือนเดิม) แท็บ "โปรไฟล์สาธารณะ" ใน `/author` แค่ลิงก์มาหน้านี้ บันทึกแล้วส่ง event `loveread:profile-updated` ให้ Navbar โหลดชื่อ/รูปใหม่
- **@username ตรวจขณะพิมพ์**: กฎรูปแบบเช็กใน client ทันที (`usernameProblem()` ใน `lib/username.ts`) แล้วถาม `GET /api/profile/username?username=` (`checkUsername()`) หลังหยุดพิมพ์ 400ms → `{ available, taken, current, error }` ห้ามใช้ชื่อใน `RESERVED_USERNAMES` (เช่น `edit` ซึ่งชนกับ `/profile/edit`) และห้ามตั้งชื่อขึ้นต้น `user_` (สงวนไว้ให้ชื่ออัตโนมัติ ยกเว้นชื่อปัจจุบันของตัวเอง) เช็ก "มีคนใช้แล้ว" (409) ก่อน "สงวนไว้" (400) และ UNIQUE index เป็นตัวตัดสินสุดท้ายถ้าบันทึกพร้อมกัน
- `users.username`: a-z 0-9 _ ยาว 3-30 (`USERNAME_PATTERN` ไม่มี `-` จึงไม่ชนกับ UUID) ค่าเริ่มต้นคือ `user_<hex จาก id>` (`defaultUsername()`) **ไม่สร้างจากอีเมล** เพราะจะเปิดเผยอีเมล ตั้งให้ตอนสมัคร (`ensureUsername()`), ใน `create_admin.ts` และใน migration ผู้ใช้ที่ยังไม่มี username ลิงก์จะใช้ id แทน
- ลิงก์ชื่อนักเขียนทุกที่ใช้ `components/AuthorLink.tsx` / `profileHref()` (query ต้องคืน `author_username` และ `author_id`) ใน `StoryCard` และแถวของ `/ranking` ชื่อนักเขียนเป็นลิงก์แยกจากลิงก์เรื่อง (ห้ามซ้อน `<a>`: การ์ดแยกลิงก์ปก/ชื่อเรื่อง ส่วนแถวอันดับใช้ stretched link `after:absolute after:inset-0` + `relative z-10`) ในคอมเมนต์ลิงก์เฉพาะชื่อเจ้าของเรื่อง (API ส่ง `author_username` เฉพาะตอน `is_author`)
- รูปโปรไฟล์/รูปปกต้องเป็น `/uploads/` เท่านั้น (ไม่มีปกใช้ `public/images/default-cover.svg`) แนะนำตัวเป็น plain text ≤1000 แสดงด้วย `whitespace-pre-line` ลิงก์โซเชียล (`SOCIAL_PLATFORMS`, เก็บ JSON ใน `users.social_links`) รับเฉพาะ http(s) ผ่าน `isSafeUrl()` แสดงด้วย `rel="noopener noreferrer nofollow ugc"`
- ปกเรื่องในแท็บผลงาน บุ๊กมาร์ก และประวัติใช้ `StoryCover` (ไม่มีปก = ปกอัตโนมัติแบบหน้าแรก, 18+ เบลอ) ตัว `getAuthorWorks()` และ `/api/bookmarks`, `/api/history` จึงคืน `is_mature` ด้วย
- **ติดตาม**: ตาราง `follows`, `POST/DELETE /api/authors/[id]/follow` (ซ้ำได้ ไม่ error) ห้ามติดตามตัวเอง ผู้ติดตามได้แจ้งเตือน `NEW_STORY` ตอนเรื่องเปลี่ยนจาก DRAFT เป็น PUBLISHED ครั้งแรก (`notifyNewStory()` เช็กว่าเคยส่งลิงก์นี้แล้วหรือยัง) และ `NEW_CHAPTER` รวมกับคนที่บุ๊กมาร์ก (ได้ครั้งเดียวแม้เป็นทั้งสองอย่าง)
- **สนับสนุน**: `POST /api/authors/[id]/support` `{ amount, message? }` → `supportAuthor()` ใน `lib/coins.ts` (lock แถวผู้ส่ง `FOR UPDATE` แบบเดียวกับ `purchaseItem()`) 1-10,000 เหรียญ ข้อความ ≤200 ตัว (plain text) จำกัด 5 ครั้งต่อนาทีต่อคน (429) เหรียญไม่พอ 402 บันทึกในตาราง `supports` พร้อม `author_earning` = จำนวน × `author_share_percent` ณ ตอนส่ง แล้วแจ้งเตือน `SUPPORT` ถึงนักเขียน (มีชื่อผู้ส่งและข้อความ) ค่าคงที่ฝั่ง client ใน `components/profile/SupportDialog.tsx` ต้องตรงกับ `SUPPORT_MIN/MAX/MESSAGE_MAX`
- **แฟนตัวยง** (`getTopFans()`): รวม `purchases.price` + `supports.amount` ต่อผู้ใช้ 10 อันดับ ไม่นับ `BANNED` และตัวนักเขียนเอง เท่ากันให้คนที่จ่ายก่อนขึ้นก่อน **ไม่แสดงจำนวนเงิน** ในหน้าเว็บ 3 อันดับแรกใช้สีทอง/เงิน/ทองแดงเดียวกับ `/ranking`
- ผลงาน (`getAuthorWorks()`): เฉพาะ PUBLISHED แท็บ `?tab=novels|comics` มีจำนวนตอน วิว จำนวนคอมเมนต์ (ไม่นับ `BANNED`) หมวดหมู่ และป้าย "จบแล้ว" จาก `novels/comics.is_completed` (ติ๊กในฟอร์ม `WorkFormModal`, API รับ `isCompleted: boolean`) ป้ายนี้แสดงบน `StoryCard` และหน้าเรื่องด้วย
- เทสต์อยู่ใน `tests/e2e/profiles.test.mjs` (นักเขียน ติดตาม สนับสนุน แฟนตัวยง) และ `profile-page.test.mjs` (หน้าเดียวกันทุกคน แท็บของเจ้าของ แก้ไขโปรไฟล์ เช็ก username)

**หมวดหมู่** (`lib/categories.ts`, ตาราง `novel_categories`/`comic_categories`):
- เรื่องละ 0-5 หมวด (`MAX_CATEGORIES`) เก็บลำดับที่ผู้เขียนเลือกใน `sort_order` หมวดแรกคือหมวดหลัก
- **อ่านหมวดจากตารางเชื่อมเท่านั้น** คอลัมน์ `novels.category_id`/`comics.category_id` เก็บไว้เป็นสำเนาของหมวดแรก (ให้โค้ด/ข้อมูลสำรองเก่ายังใช้ได้) `setStoryCategories()` เขียนทั้งสองที่ใน transaction ของผู้เรียก ห้ามแก้คอลัมน์นี้ตรงๆ
- API รับ `categoryIds: string[]` (POST สร้าง / PATCH แก้ไข ไม่ส่ง = ไม่เปลี่ยน, `[]` = ล้าง) ยังรับ `categoryId` เดี่ยวแบบเก่าได้ ตรวจด้วย `parseCategoryIds()` (ไม่เกิน 5, ต้องมีอยู่จริง, ตัดตัวซ้ำ) ผิดได้ 400 และไม่บันทึกอะไรเลย
- ทุกแถวจาก `lib/ranking.ts`, `/api/novels/[id]`, `/api/comics/[id]`, `/api/author/novels|comics` มี `categories: { id, name, slug }[]` (ต่อด้วย `withCategories()`/`getCategoriesFor()`) ไม่มี `category_name` แล้ว
- กรอง: `/api/novels|comics?categoryId=a&categoryId=b` (หรือ `a,b`) คืนเฉพาะเรื่องที่มี**ทุก**หมวดที่เลือก หน้า `/search?category=a,b` ใช้ `components/CategoryPicker.tsx`
- ป้ายหมวด `components/CategoryTags.tsx` ลิงก์ไป `/category/[slug]` (นิยาย+การ์ตูนในหมวดนั้น เรียงตาม `SEARCH_SORTS`) อยู่บน `StoryCard` (นอกลิงก์หลักของการ์ด เพราะห้ามซ้อน `<a>`) และหน้าเรื่อง ส่วนหน้า `/ranking` แสดงเป็นข้อความเพราะทั้งแถวเป็นลิงก์
- ฟอร์มสร้าง/แก้ไขคือ `WorkFormModal` (เลือกด้วย `CategoryPicker` แบบ `max={5}`)
- แอดมินลบหมวดที่มีเรื่องใช้อยู่ได้: หมวดนั้นหายจากทุกเรื่อง (FK cascade) และ `category_id` ย้ายไปหมวดถัดไปของเรื่องนั้นก่อน
- เทสต์อยู่ใน `tests/e2e/categories.test.mjs` (รวมการรันสคริปต์ migration)

**จัดอันดับและแนะนำ** (`lib/ranking.ts`, ทุก query คืนเฉพาะ `PUBLISHED`):
- `baseSql()` รวมสถิติต่อเรื่องด้วย derived table: `rating_avg`/`rating_count` (ไม่นับผู้ใช้ `BANNED` เหมือน `/api/ratings`), `sales` (จำนวนแถวใน `purchases` ของบท/ตอนในเรื่อง), `bookmarks` ลำดับการเรียงอยู่ใน `SORTS` เท่านั้น (รับจาก input ผ่าน `isSortKey()` ห้ามต่อ ORDER BY จาก input)
- `/ranking?type=novel|comic&sort=views|rating|sales|bookmarks` (`RANKING_SORTS`) 50 อันดับ เป็นอันดับรวมตลอดกาล (ถ้าจะทำรายสัปดาห์ต้องมีตารางเก็บวิวรายวัน) ลิงก์อยู่ใน Navbar และ "ดูอันดับทั้งหมด" ในหน้าแรก
- `/api/novels`, `/api/comics` รับ `?sort=newest|views|rating` (`SEARCH_SORTS`, ค่าอื่น = newest) และทุกแถวมีสถิติข้างบน หน้า `/search` มี dropdown เรียงลำดับ (`SORT_OPTIONS` ในหน้า ต้องตรงกับ `SEARCH_SORTS` เพราะ import `lib/ranking.ts` ใน client ไม่ได้)
- `getSimilarStories()`: "เรื่องที่คล้ายกัน" ในหน้า `/novel/[id]`, `/comic/[id]` เรียงตามจำนวนหมวดที่ตรงกันมากสุดก่อน แล้วเติมด้วยเรื่องที่วิวสูง
- `getRecommendations()`: "แนะนำสำหรับคุณ" ในหน้าแรก (เฉพาะคนล็อกอินที่มีประวัติ) ทุกหมวดของเรื่องที่บุ๊กมาร์กได้น้ำหนัก 2 ของเรื่องใน `reading_history` ได้ 1 (รวมนิยายกับการ์ตูน) คะแนนของเรื่อง = ผลรวมน้ำหนักของทุกหมวดที่มัน ตัดเรื่องที่อ่าน/บุ๊กมาร์กแล้วและเรื่องของตัวเองออก
- การ์ดปกใช้ `components/StoryCard.tsx` ร่วมกัน เทสต์อยู่ใน `tests/e2e/ranking.test.mjs` (ใช้ยอดวิวหลักพันล้านให้เรื่องทดสอบอยู่บนสุดเหนือข้อมูลจริง)

**กราฟแดชบอร์ด** (`lib/analytics.ts`, `components/TimeSeriesChart.tsx` ใช้ recharts):
- `?range=30d|12m` (ค่าอื่น = 30d) แบ่งเป็นรายวัน 30 จุดหรือรายเดือน 12 จุด key ของแต่ละจุดสร้างจาก `CURDATE()` ของ MySQL ให้ตรงกับ `DATE_FORMAT()` ใน query และเติม 0 ให้ช่วงที่ไม่มีข้อมูล (`seriesByBucket()`)
- `GET /api/admin/analytics` (ADMIN): ยอดเติมเหรียญเฉพาะ `APPROVED` (นับตามเวลาที่อนุมัติคือ `updated_at`), ยอดใช้เหรียญ (`sales_amount`) = SUM(`purchases.price`) + SUM(`supports.amount`), ส่วนแบ่งเว็บ = ยอดนั้น − `author_earning`, ผู้ใช้ใหม่ และยอดรวม + จำนวนสลิปรอตรวจ
- `GET /api/author/analytics`: รายได้ของผู้เขียนตามช่วงเวลา (รวม supports แต่ `sales` นับเฉพาะการซื้อตอน) และสถิติรายเรื่องของตัวเอง (ทุกสถานะ) คือ จำนวนตอน วิว ขายได้ รายได้ คะแนน คอมเมนต์ บุ๊กมาร์ก (ไม่นับคะแนน/คอมเมนต์ของผู้ใช้ `BANNED`) แสดงใน `components/author/DashboardPanel.tsx`
- สีกราฟใช้ `SERIES_COLORS` (indigo `#6366F1`, pink `#EC4899` ผ่านการเช็กตาบอดสีและ contrast ทั้งพื้นสว่างและมืดแล้ว) ถ้าเพิ่ม series ต้องเลือกสีที่ผ่านการเช็กเดียวกัน ทุกกราฟมี "ดูเป็นตาราง" และไม่ใช้กราฟสองแกน y
- เทสต์อยู่ใน `tests/e2e/analytics.test.mjs` (เทียบค่าก่อน/หลังใส่ข้อมูล เพราะ DB มีข้อมูลจริงปนอยู่)

**ยอดวิว** (`lib/views.ts`): `recordView()` ถูกเรียกในหน้าอ่านทั้งสองหน้าคู่กับ `recordRead()` เฉพาะเมื่อผ่าน `canAccess()` แล้ว เพิ่มทั้งบท/ตอนและนิยาย/การ์ตูนแม่ใน UPDATE เดียว (ยอดของเรื่อง = ผลรวมของบท) ผู้อ่านที่ไม่ได้ล็อกอินก็นับ หน้า paywall และเจ้าของเรื่องอ่านเองไม่นับ ยังไม่กันการกดรีเฟรชซ้ำ (เปิดหน้าเดิมกี่ครั้งก็นับทุกครั้ง) ถ้า error จะ log แล้วให้อ่านได้ตามปกติ เทสต์อยู่ใน `tests/e2e/views.test.mjs`

**ประวัติการอ่าน** (`lib/readingHistory.ts`, ตาราง `reading_history`):
- 1 แถวต่อคนต่อเรื่อง เก็บบท/ตอนล่าสุดที่เปิด (`chapter_id`/`episode_id`) และ `read_at` (`TIMESTAMP(3)`)
- `recordRead()` ถูกเรียกในหน้า `app/read/[chapterId]` และ `app/comic/[id]/read/[episodeId]` เฉพาะเมื่อผ่าน `canAccess()` แล้ว (หน้า paywall ไม่บันทึก) ถ้า error จะ log แล้วยังให้อ่านได้ตามปกติ
- `GET /api/history?page=` (ล่าสุดก่อน หน้าละ 20) ซ่อนเรื่องที่ไม่ได้ `PUBLISHED` ยกเว้นเรื่องของตัวเอง (กฎเดียวกับ bookmarks) และ `DELETE /api/history` (`{ content_type, content_id }` หรือ `{ all: true }`) หน้า UI คือแท็บ "ประวัติการอ่าน" ในโปรไฟล์ของตัวเอง (`/history` redirect ไป) ซึ่งมีปุ่ม "อ่านต่อ"
- ถ้าบทถูกลบ แถวยังอยู่แต่ `chapter_id` เป็น NULL (ปุ่มอ่านต่อจะพาไปหน้าเรื่องแทน) `novelsRead`/`comicsRead` ใน `/api/profile` นับจากตารางนี้
- `recordRead()` บันทึกลงตาราง `item_reads` ด้วย (1 แถวต่อคนต่อบท/ตอน ไว้ทำเครื่องหมาย "อ่านแล้ว") ทั้งสองตารางแยก try/catch กัน การลบประวัติ (`DELETE /api/history`) ลบ `item_reads` ของเรื่องนั้น/ทั้งหมดด้วย ผ่าน `clearReadItems()`

**ตั้งค่าการอ่าน (ปุ่ม Aa)** เฉพาะหน้าอ่านนิยาย `/read/[chapterId]` (ไม่มีในหน้าอ่านการ์ตูน):
- ค่าที่ตั้งได้และการตรวจอยู่ใน `lib/readerSettings.ts` (ไม่มี import ใช้ได้ทั้ง client/server): ขนาดตัวอักษร 7 ระดับ (`FONT_SIZES` 16-28px แผงแสดงเลข px), ระยะบรรทัด แคบ/ปกติ/กว้าง, แบบอักษร มีหัว (Sarabun) / ไม่มีหัว (Noto Sans Thai) โหลดด้วย `next/font` ใน `components/reader/fonts.ts`, สีพื้น ขาว/ซีเปีย/มืด, ความกว้างคอลัมน์ แคบ/ปกติ/กว้าง (ซ่อนบนมือถือ) ค่าผิดหรือขาดจะใช้ค่าเริ่มต้น (`parseReaderSettings()`)
- UI คือ `components/reader/ReaderSettings.tsx`: `ReaderSettingsProvider` ครอบทั้งหน้าและตั้ง CSS variables (`--reader-size`, `--reader-leading`, `--reader-width`) + `data-reader-font`/`data-reader-theme` ที่ `.reader-root` ซึ่งกฎ `.reader-text`/`.reader-column`/`.reader-bar`/`.reader-divider` ใน `globals.css` อ่านไปใช้ `ReaderSettingsButton` เปิดแผงผ่าน portal (เหตุผลเดียวกับปุ่มเลือกตอน) จอคอมเป็นการ์ดใต้แถบบน มือถือเป็นแผงจากล่าง ไม่มีฉากหลังมืดบนจอคอมเพื่อให้เห็นผลทันที
- **"มืด" คือ dark mode ของทั้งเว็บ** (next-themes): เลือกมืด = `setTheme('dark')` เลือกขาว/ซีเปีย = `setTheme('light')` และกดปุ่ม 🌙 ข้างๆ ก็อัปเดตค่าตาม ซีเปียใช้ได้เฉพาะตอนธีมสว่าง (`html:not(.dark)` ใน CSS) ตอนเปิดหน้า ถ้าผู้ใช้เคยบันทึกค่าไว้ ธีมของเว็บจะถูกตั้งตามค่านั้น
- **ที่เก็บ**: ล็อกอินอยู่ → `users.reader_settings` (JSON) ผ่าน `GET/PUT/DELETE /api/reader-settings` (PUT ต้องครบทั้ง 5 ค่าและถูกต้อง ไม่งั้น 400, ส่งหลังหยุดปรับ 600ms) server ส่งค่าที่บันทึกมากับหน้าเลย ไม่ล็อกอิน → localStorage `loveread:reader-settings` และมี inline script ใน provider ตั้งค่าก่อน paint แรก (ตัวหนังสือไม่กระโดดจากขนาดเริ่มต้น) script นี้ใส่ด้วย `dangerouslySetInnerHTML` ได้เพราะสร้างจากค่าคงที่ใน `lib/readerSettings.ts` เท่านั้น **ห้ามใส่ข้อมูลจากผู้ใช้หรือ DB ลงไป** รีเซ็ตจะลบทั้งสองที่แต่ไม่เปลี่ยนธีมของเว็บ
- เทสต์อยู่ใน `tests/e2e/reader-settings.test.mjs`

**ปุ่มเลือกตอน** (`components/EpisodePicker.tsx`, `lib/episodeList.ts`): อยู่ในแถบบนและระหว่างปุ่มก่อนหน้า/ถัดไปของหน้าอ่านทั้งสองหน้า (การ์ตูนแทนลิงก์ "รายการตอน" เดิม และบนมือถือปุ่มก่อนหน้า/ถัดไปของแถบบนจะซ่อน เหลือแถบล่าง)
- server ส่งรายการผ่าน `getEpisodeList()` เท่านั้น ซึ่งมีแค่ id/เลข/ชื่อ/ราคา/`locked`/`read` **ห้ามใส่ `content`** เพราะ props ถูก serialize ลงในหน้า ส่วน `locked` ใช้กฎเดียวกับ `canAccess()` (เจ้าของ/แอดมินไม่ล็อก) ถ้าเรื่องไม่ใช่ `PUBLISHED` (คือ `ARCHIVED` ที่คนซื้อเปิดได้) คนอื่นจะเห็นเฉพาะตอนที่ซื้อแล้ว ตอนอื่นจะเป็น 404
- กดตอนที่ล็อกจะไปหน้าอ่านตอนนั้นซึ่งแสดง paywall ตามเดิม ต้อง render ด้วย `key={currentId}` เพื่อให้ปิดและล้างช่องค้นหาเมื่อเปลี่ยนตอน
- แผง "สารบัญ": จอ `md` ขึ้นไปเลื่อนออกจากขวา สูงเต็มจอใต้ Navbar (`top-16`) มือถือเลื่อนขึ้นจากล่าง (สูงสุด 85dvh) มีช่องค้นหาเลขหรือชื่อตอนเสมอ (Enter = ไปตอนที่เลขตรงพอดี หรือผลเดียวที่เหลือ) เปิดแล้วเลื่อนรายการ (ไม่ใช่หน้า) ให้ตอนปัจจุบันอยู่กลางและไฮไลต์ ปิดด้วยฉากหลัง ปุ่ม X หรือ Esc แล้วโฟกัสกลับที่ปุ่ม
- **แผงต้อง render ผ่าน `createPortal(..., document.body)`** เพราะแถบบน/ล่างของหน้าอ่านมี `backdrop-blur` ซึ่งทำให้ `position: fixed` ข้างในยึดกับแถบแทนหน้าจอ (เคยเด้งไปกลางจอด้านบนและถูก Navbar บัง) z-index `100` เท่ากับ ConfirmDialog
- แถบบนของหน้าอ่านทั้งสองหน้าเป็น `sticky top-16 z-40` (อยู่ใต้ Navbar ที่ `sticky top-0 z-50`) ถ้าเป็น `top-0` จะถูก Navbar บังเมื่อเลื่อนหน้า
- เทสต์อยู่ใน `tests/e2e/episode-picker.test.mjs` (อ่าน props จาก RSC payload ในหน้า HTML)

**แจ้งเตือน** (`lib/notifications.ts`, ตาราง `notifications`):
- สร้างผ่าน `notify(recipients, { type, message, link }, actorId)` / `notifyAdmins()` / `notifyNewItem()` เท่านั้น `type` ต้องอยู่ใน `NOTIFICATION_TYPES` (เก็บเป็น VARCHAR) `message` เป็น plain text ที่ server เขียน (ตัดข้อความจากผู้ใช้ด้วย `short()`) `link` เป็น path ภายในเว็บ
- เรียกหลังงานหลักสำเร็จ (หลัง commit) และ error จะถูก log แล้วกลืน แจ้งเตือนต้องไม่ทำให้งานหลักล้ม
- `actorId` = คนที่ทำให้เกิด: ไม่แจ้งเตือนตัวเอง และ `actor_id ON DELETE CASCADE` ทำให้ลบผู้ใช้แล้วแจ้งเตือนที่เขาก่อหายด้วย (เทสต์อาศัยข้อนี้ ไม่ให้แอดมินจริงได้แจ้งเตือนขยะ) ฝั่งแอดมินส่งให้ ADMIN ทุกคน
- จุดที่สร้าง: บท/ตอนใหม่ของเรื่อง PUBLISHED → คนที่บุ๊กมาร์กและผู้ติดตามนักเขียน, เรื่องใหม่ (DRAFT → PUBLISHED ครั้งแรก) → ผู้ติดตาม, สนับสนุน → นักเขียน (มีชื่อผู้ส่ง), คอมเมนต์ → เจ้าของเรื่อง, ตอบกลับ → เจ้าของคอมเมนต์หลัก, ให้คะแนนครั้งแรก → เจ้าของเรื่อง (ไม่ระบุชื่อผู้ให้), ขายตอน → นักเขียน (ไม่ระบุชื่อผู้ซื้อ), ผลเติมเหรียญ / คำขอนักเขียน / การถอน / แอดมินปรับเหรียญ → เจ้าของ, แอดมินซ่อน/แบนเรื่อง → นักเขียน, สลิปเติมเหรียญ / คำขอนักเขียน / คำขอถอน / รายงาน → แอดมิน
- API: `GET /api/notifications` (`?page=` หรือ `?limit=`), `GET /api/notifications/count`, `PATCH /api/notifications/[id]` (อ่านแล้ว เฉพาะของตัวเอง), `POST /api/notifications/read-all` UI คือ `components/NotificationBell.tsx` ใน Navbar (poll ทุก 30 วินาทีเฉพาะตอนแท็บเปิดอยู่) และหน้า `/notifications`
- `/admin` และ `/author` รับ `?tab=` เพื่อเปิดแท็บตรงจากลิงก์แจ้งเตือน

**ระบบเหรียญและขายตอน** (logic หลักอยู่ใน `lib/coins.ts`):
- 1 เหรียญ = 1 บาท ยอดเหรียญของผู้อ่านอยู่ที่ `users.coins` แต่ละบท/ตอนมี `price` (0 = ฟรี)
- **เติมเหรียญ**: ผู้อ่านอัปโหลดสลิปที่ `/coins` → แถวใน `coin_topups` (PENDING) → แอดมินอนุมัติที่ `/admin` แท็บการเงิน แล้วเหรียญจึงเพิ่ม
- **ซื้อตอน**: `purchaseItem()` ทำใน transaction ที่ lock แถว user (`FOR UPDATE`) แล้วบันทึกลง `purchases` พร้อม `author_earning` = ราคา × `system_settings.author_share_percent` ณ ตอนซื้อ (เปลี่ยนส่วนแบ่งแล้วไม่มีผลย้อนหลัง)
- **ยอดของนักเขียนคำนวณสดเสมอ** ด้วย `getAuthorBalance()` = SUM(`purchases.author_earning`) + SUM(`supports.author_earning`) − SUM(`withdrawals` ที่เป็น PENDING/APPROVED) ไม่มีคอลัมน์ยอดคงเหลือ ถ้าปฏิเสธการถอน เงินจะกลับเข้ายอดเอง
- **ถอนเงิน**: ต้องมี `writer_profiles` ที่อนุมัติแล้วและกรอกบัญชีธนาคาร แอดมินโอนเงินแล้วแนบสลิปเพื่ออนุมัติ
- **การเปลี่ยนสถานะเงินทุกแบบ** (อนุมัติเติมเหรียญ, อนุมัติ/ปฏิเสธการถอน) ต้องมีเงื่อนไข `WHERE status = 'PENDING'` เพื่อกันการทำซ้ำ
- `canAccess()` ไม่ให้คนอื่นนอกจากเจ้าของ/แอดมินเปิดบท/ตอนที่ `moderation_status` ไม่ใช่ `APPROVED` (query ที่ส่งให้ต้องมี `moderation_status` ด้วย ไม่งั้นจะถูกปฏิเสธเสมอ) `purchaseItem()` ก็ขายได้เฉพาะ `APPROVED`
- **ทุกที่ที่ส่งเนื้อหาบท/ตอนออกไป** ต้องผ่าน `canAccess()` และ `needsAgeGate()` (`lib/ageGate.ts`)ได้แก่ `app/read/[chapterId]`, `app/comic/[id]/read/[episodeId]`, `/api/chapters`, `/api/novels/[id]/chapters` (ส่ง `content` ให้เฉพาะเจ้าของ), `/api/comics/[id]/episodes/[episodeId]` และ `.../pages` ถ้าเพิ่ม endpoint ใหม่ที่คืนเนื้อหา ต้องเช็กเหมือนกัน
- รูปหน้าการ์ตูนส่งผ่าน `/api/media/...` ซึ่งเช็กสิทธิ์ก่อนส่งไฟล์ (ดูหัวข้อ "อัปโหลดไฟล์")

**ตรวจเนื้อหาด้วย API (ข้อ 12)** (`lib/moderation.ts`, Gemini ผ่าน REST `generateContent` + JSON schema ไม่มี SDK):
- นักเขียนติดป้ายเรื่องเอง (ทั่วไป/18+ = `is_mature`) แล้ว**ทุกบท/ตอนใหม่และที่แก้ไข**ถูกตรวจซ้ำ: นิยายส่งชื่อบท+ข้อความ (ตัดช่วงละ 60,000 ตัวอักษร) การ์ตูนส่งชื่อตอน+รูปหลายหน้าต่อคำขอ (ไม่เกิน 10 รูป/12MB ต่อคำขอ มีเลขหน้ากำกับ) แก้แค่ราคาไม่ตรวจซ้ำ เพิ่มหน้าการ์ตูนตรวจเฉพาะหน้าใหม่
- `chapters.moderation_status`/`comic_episodes.moderation_status`: `APPROVED` (เผยแพร่) / `PENDING` (รอแอดมิน) / `BLOCKED` (ถูกระงับ รอแอดมิน) / `REJECTED` (แอดมินปฏิเสธ) มีแต่ `APPROVED` ที่ผู้อ่านเห็น (404 ทั้งหน้าและ API, ไม่อยู่ในรายการตอน/ปุ่มเลือกตอน/ก่อนหน้า-ถัดไป, ไม่นับใน `item_count`/อัปเดตล่าสุด/หน้าแรก) เจ้าของ/แอดมินเห็นทั้งหมดพร้อมป้ายสถานะ (`ModerationBadge`/`ModerationNotice`) route สร้างบท/ตอนบันทึกเป็น `PENDING` ก่อนแล้วเรียก `moderateItem()` ซึ่งตั้งสถานะจริง response มี `moderation: { status, background, verdict, message }`
- ผล API → `verdict` (`SAFE | MATURE | EXPLICIT | ILLEGAL | MINOR | REFUSED | ERROR`) → `decide()`: ตรงป้ายและปลอดภัย = เผยแพร่ / ป้ายทั่วไปแต่เจอ 18+ = รอแอดมิน / โป๊โจ่งแจ้ง ผิดกฎหมาย หรือ `MINOR` (ทางเพศกับตัวละครที่ดูเป็นเด็ก ไม่สนป้าย) = `BLOCKED` / API ล่ม ไม่มี key หรือ `REFUSED` = รอแอดมิน
- **`REFUSED` ไม่ใช่ผลร้ายแรง**: Gemini ตอบ `finishReason: PROHIBITED_CONTENT` กับข้อความธรรมดาได้ จึง retry 1 ครั้งแล้วค่อยส่งให้แอดมิน ไม่บล็อกและไม่นับเป็นปัญหาของนักเขียน 429/5xx ก็ retry 1 ครั้ง (timeout 45 วินาทีสำหรับข้อความ 90 วินาทีสำหรับรูป)
- **ห้ามตั้ง `temperature: 0` และห้ามเขียน prompt บรรยายเนื้อหาทางเพศกับผู้เยาว์ละเอียด** (เจอ 2026-10-29): ทั้งสองอย่างทำให้ `gemini-3.1-flash-lite` ตอบ `PROHIBITED_CONTENT` กับข้อความธรรมดาเกือบทุกครั้ง (เรื่องเด็กไปตลาดกับยาย, รถติดแล้วสบถ) ถ้าแก้ prompt ให้ลองกับข้อความใน `moderation-gemini.test.mjs` ซ้ำหลายรอบ
- **นักเขียนที่เชื่อถือได้** (`isTrustedAuthor()`): มีบท/ตอนที่ยังอยู่และผ่านอัตโนมัติ (`CLEARED`) ครบ `TRUSTED_AFTER` = 10 และไม่เคยมีปัญหา (ถูกปฏิเสธ, ผลร้ายแรง หรือติดป้ายผิดที่แอดมินไม่ได้อนุมัติ) → เผยแพร่ทันทีแล้วตรวจเบื้องหลังด้วย `after()` ถ้าเจอปัญหาจะซ่อนตอน (`PENDING`/`BLOCKED`) และแจ้ง `MODERATION_HELD` ถ้า API ล่มจะปล่อยไว้แต่เข้าคิว
- ตาราง `moderation_checks` (1 แถวต่อการตรวจ, `analysis` = JSON `{ summary, issues: [{ page, category, reason }] }` ภาษาไทยจาก API) `status`: `CHECKING` → `CLEARED` (ผ่านเอง) / `PENDING` (คิว) → `APPROVED`/`REJECTED` (แอดมิน) และ `SUPERSEDED` เมื่อมีการแก้ไขใหม่กว่า (ผลของการตรวจเก่าที่เสร็จทีหลังจะไม่ทับ) `chapter_id`/`episode_id` เป็น `ON DELETE SET NULL` เพื่อเก็บประวัติไว้ใช้กับกฎ 10 ตอน คิว = `QUEUE_SQL` (PENDING + CHECKING ที่ค้างเกิน 10 นาที ไม่รวมตอนที่ถูกลบ)
- **แอดมิน** แท็บ "คิวตรวจเนื้อหา" (`components/admin/ModerationPanel.tsx`, `GET /api/admin/moderation?status=PENDING|CLEARED|APPROVED|REJECTED|all&page=`) แสดงป้ายที่นักเขียนเลือก ผล API เหตุผลภาษาไทย หน้าการ์ตูนที่มีปัญหา (กดดูรูปได้) หรือตัวอย่างข้อความ `PATCH /api/admin/moderation/[id]` `{ action: 'approve' | 'mark_mature' | 'reject', reason }`: ปฏิเสธต้องมีเหตุผล อนุมัติผลร้ายแรงต้องมีเหตุผล `mark_mature` = ปรับเรื่องเป็น 18+ แล้วอนุมัติ ทุกแบบแจ้งนักเขียน (`MODERATION_APPROVED`/`MODERATION_REJECTED`) บันทึก admin log (`MODERATION_*`) และแจ้งผู้อ่านเรื่องตอนใหม่ตอนที่เผยแพร่ (`notifyNewItem()` ส่งครั้งเดียวต่อบท/ตอน) ถูกปฏิเสธแล้วนักเขียนเห็นเหตุผลในหน้าจัดการตอน และแก้ไขเพื่อส่งตรวจใหม่ได้
- เรื่อง 18+ ที่มีตอนผ่านการตรวจว่าเป็น 18+ (หรือแอดมินปรับให้) นักเขียนเปลี่ยนกลับเป็นทั่วไปเองไม่ได้ (400)
- **ผู้อ่านรายงานว่าติดป้ายผิด** (`components/MislabelReportButton.tsx` ล่างหน้าอ่านทั้งสองหน้า, `POST /api/moderation/report` `{ item_type, item_id }`, ต้องล็อกอิน) ส่งตอนกลับเข้าคิวพร้อมตรวจด้วย API ใหม่ (เข้าคิวเสมอแม้ API บอกว่าปลอดภัย) ตอนยังเปิดอ่านได้ ยกเว้น API ยืนยันว่ามีปัญหา รายการละ 1 คิวที่ค้าง ผู้ใช้ละ 10 ครั้ง/ชั่วโมง รายงานตอนของตัวเองไม่ได้
- ข้อความ/รูปที่ส่งให้ API ถือเป็นข้อมูลที่ไม่น่าเชื่อถือ (prompt สั่งให้ไม่ทำตามคำสั่งในเนื้อหา) label ภาษาไทยของทุกค่าอยู่ใน `lib/moderationLabels.ts` (ไม่มี import ฝั่ง server ใช้ใน client ได้)
- ยังไม่ได้ตรวจคอมเมนต์ ชื่อเรื่อง เรื่องย่อ และปก
- เทสต์อยู่ใน `tests/e2e/moderation.test.mjs` (ผลจำลอง) และ `moderation-gemini.test.mjs` (API จริง ถ้า Gemini หมดเวลา/503 จะขึ้นเป็น skip พร้อมเหตุผล ไม่ใช่ fail)

**ยืนยันอายุ 18+** (`lib/ageGate.ts`, `lib/age.ts`, `components/AgeGate.tsx`):
- เรื่องที่ `is_mature` ทั้งหน้าเรื่องและหน้าอ่าน (นิยาย/การ์ตูน) แสดงหน้ายืนยันอายุแทนเนื้อหา (ปกเบลอ+ป้าย 18+ แบบเดียวกับการ์ด ข้อความเตือน dropdown วัน/เดือน/ปี พ.ศ.) เจ้าของและแอดมินไม่ต้องยืนยัน ยังไม่ผ่านก็ไม่นับวิว/ประวัติ
- `POST /api/age-verification` `{ day, month, year }` (ปี พ.ศ.) คำนวณอายุฝั่ง server → `{ allowed }` ถึง 18 (นับวันเกิดวันนี้) → ตั้ง cookie `loveread-age-ok` (httpOnly, 1 ปี) และถ้าล็อกอินอยู่เก็บ `users.birth_date` (ใช้ได้ทุกเบราว์เซอร์) ไม่ถึง 18 ไม่เก็บอะไร วันที่ผิด/อนาคต = 400
- เช็กฝั่ง server ด้วย `needsAgeGate()` ทุกที่: หน้าเรื่อง หน้าอ่าน `/api/chapters?chapterId=` `/api/comics/[id]/episodes/[episodeId]` และ `.../pages` (403 `age_required`) และรูปหน้าการ์ตูนใน `/api/media/comic-pages` (404)
- เทสต์อยู่ใน `tests/e2e/age-gate.test.mjs`

## ข้อควรระวังตอนพัฒนา

- **หลัง `git checkout` หรือ `git pull` ให้รีสตาร์ท `npm run dev` หนึ่งครั้ง** ถ้า `next.config.ts` ถูกเปลี่ยนหลายครั้งติดกันเร็วๆ dev server อาจค้างใช้ config เก่า (เคยเกิดแล้ว: เทสต์ open proxy fail ทั้งที่โค้ดถูก แก้ได้ด้วยการ `touch next.config.ts`)
- **ไฟล์ใน `public/uploads/` เคยถูก track ใน git** จนถึง commit `627e644` ซึ่ง `git rm` ออกไป ทำให้ไฟล์ในเครื่องหายด้วย (ปก/รูปเก่าขึ้น 404) การ checkout commit ก่อนหน้านั้นแล้วกลับมาก็ทำให้หายได้อีก กู้คืนได้ด้วย `git archive 627e644^ public/uploads | tar -x --skip-old-files` (ไฟล์ที่อัปโหลดหลังจากนั้นไม่อยู่ใน git ต้องสำรองเอง)
- `npm run lint` ต้องไม่มีทั้ง error และ warning (`npm run build` รัน lint ด้วย ถ้ามี error จะ build ไม่ผ่าน) ห้ามใช้ `any` ให้ใช้ type จริงหรือ `RowDataPacket` แทน ฟังก์ชันที่เรียกใน `useEffect` ให้ห่อด้วย `useCallback` แล้วใส่ใน dependency
- ข้อความทั้งหมดใน UI (รวม toast, confirm, title, placeholder และข้อความ error จาก API ที่แสดงให้ผู้ใช้เห็น) เป็นภาษาไทย ค่า enum ที่แสดงในตารางให้แปลงผ่าน label map (เช่น `ROLE_LABEL` ใน `app/admin/page.tsx`) ไม่แสดงค่าดิบ
- **dev server แก้ไฟล์ไปหลายรอบแล้วหน้าอ่านขึ้น 500 `useToast must be used inside <ToastProvider>` สลับกับปกติ** (เจอ 2026-10-29): Turbopack ถือ `components/Toast.tsx` ไว้สองชุดหลัง hot reload ไม่ใช่บั๊กในโค้ด แก้ด้วยการปิด dev ลบ `.next` แล้วเปิดใหม่ ก่อนรันเทสต์ทั้งชุดหลังแก้ไฟล์เยอะๆ ควรทำแบบนี้
- **อย่ารัน `npm run build` ขณะที่ `npm run dev` เปิดอยู่**เพราะทั้งคู่เขียนลง `.next/` ให้ปิด dev ก่อน แล้วลบ `.next` ก่อนเปิด dev ใหม่

## งานที่เหลือ (อัปเดตล่าสุด 2026-10-29)

**สถานะ branch**: ทุกอย่างอยู่บน `main` และ push ขึ้น `origin/main` แล้ว ไม่มีงานค้างในเครื่อง

**งานวันที่ 2026-10-29** (push แล้วทั้งหมด): ตรวจเนื้อหาด้วย Gemini + คิวตรวจของแอดมิน + ยืนยันอายุ 18+ (`7b2f91f`) และหน้าโปรไฟล์แบบเดียวกันทุกคน + หน้าแก้ไขโปรไฟล์ (commit ถัดมา) เทสต์ผ่าน 184/184 (รวม 2 เทสต์ที่เรียก Gemini จริง)
- **หน้าโปรไฟล์ตรวจด้วย Chrome headless แล้ว** (โปรไฟล์ตัวเอง/คนอื่น/นักเขียน, แท็บบุ๊กมาร์ก/ประวัติ/เหรียญ, หน้าแก้ไข × 320/390/1280px × สว่าง/มืด ไม่มีหน้าไหนเลื่อนซ้ายขวา) แต่ยังไม่ได้ลองอัปโปรไฟล์/ปกจริงผ่านหน้าเว็บ และยังไม่ได้ลองช่อง @username แบบพิมพ์จริงในเบราว์เซอร์ (API และกฎผ่านเทสต์แล้ว)
- **ยังไม่ได้ตรวจในเบราว์เซอร์**: หน้า "คิวตรวจเนื้อหา" ในแอดมิน หน้ายืนยันอายุ 18+ และตัวเลือกระดับเนื้อหา (ทั่วไป/18+) ในฟอร์มสร้างเรื่อง รวมถึงหน้า `/admin` ที่ปรับเมื่อ 2026-10-28
- สคริปต์ถ่ายภาพหน้าจอด้วย headless Chrome อยู่ใน scratchpad ชั่วคราว ไม่ได้เก็บใน repo วิธีคือ: เปิด `chrome.exe --headless=new --remote-debugging-port=9334 --user-data-dir=<โฟลเดอร์ชั่วคราว>` (ใช้เวลาเปิดเกิน 10 วินาที ต้องรอ) สร้างผู้ใช้ด้วย `createUsers()` ใส่ cookie ของ `Client` ด้วย `Network.setCookie` แล้ว `Page.captureScreenshot` และวัด `scrollWidth - innerWidth` เพื่อหาการเลื่อนซ้ายขวา จบแล้ว `cleanupUsers()`

**งานวันที่ 2026-10-28** (push แล้วทั้งหมด): ปรับหน้าแอดมิน (`752c2c2`), หน้าแรกใหม่ + ป้าย 18+ (`f8a17bc`), ปุ่มเลือกตอนเป็นแผงข้าง/ล่าง (`747f74c`), ตั้งค่าการอ่าน Aa (`52aa1e5`) เทสต์ผ่าน 152/152
- Chrome extension เชื่อมต่อไม่ได้ทั้งวัน หน้าแรก ปุ่มเลือกตอน และแผง Aa จึงตรวจด้วย Chrome headless ผ่าน DevTools Protocol แทน (จอคอม 1280 / แท็บเล็ต 768 / มือถือ 390 และ 320 × สว่าง/มืด, กดปุ่มจริง, วัดตำแหน่ง/ค่า CSS จริง) วิธีจดไว้ในหัวข้อ "หน้าแรก" สคริปต์ที่ใช้อยู่ใน scratchpad ชั่วคราว ไม่ได้เก็บใน repo
- **ยังไม่ได้ตรวจในเบราว์เซอร์: หน้า `/admin` ที่ปรับใหม่ทุกแท็บ** (ผ่าน lint/tsc/e2e แล้ว) ควรเปิดดูทั้งโหมดสว่าง/มืด จอคอม/มือถือ ตามกฎข้างล่าง ถ้าใช้ headless ต้องล็อกอินก่อน: ใช้ `Client.login()` ใน `tests/e2e/helpers.mjs` กับผู้ใช้ทดสอบ แล้วใส่ cookie ด้วย `Network.setCookie`
- หน้าแรกบน DB เครื่องนี้มีแค่นิยาย 5 / การ์ตูน 4 เรื่อง บางแถวจึงมีที่ว่างด้านขวา และส่วน "เรื่องที่จบแล้ว" ไม่แสดงเพราะยังไม่มีเรื่องไหนติ๊กจบแล้ว ถ้าจะพรีเซนต์ควรเพิ่มเรื่อง/ปก/ติ๊กจบแล้วสักเรื่องก่อน

**ตรวจการแสดงผลในเบราว์เซอร์แล้ว 2026-10-27** (Chrome, ทุกหน้า × สว่าง/มืด × จอคอม 1280px/มือถือ 390px × ยังไม่ล็อกอิน/ผู้อ่าน/ผู้สมัครนักเขียน/นักเขียน/แอดมิน รวม popup, dropdown, modal, หน้า error และหน้าที่ไม่มีข้อมูล) ไม่มีข้อความที่ contrast ต่ำกว่า WCAG AA และไม่มีหน้าไหนต้องเลื่อนซ้ายขวา กฎที่ได้จากการตรวจ:
- **ห้ามใส่ `@media (prefers-color-scheme)` ใน `globals.css`** ธีมมืดต้องมาจากคลาส `.dark` ของ next-themes เท่านั้น (เคยทำให้เลือกธีมสว่างบน OS ที่เป็นธีมมืด แล้วพื้น body เป็นสีดำ ตัวอักษรที่ไม่ได้กำหนดสีจึงกลืนกับการ์ดสีขาว)
- สีขอบเริ่มต้นตั้งไว้ใน `@layer base` ของ `globals.css` (ปกติ gray-200/700, ช่องกรอก gray-400/500) เพราะ Tailwind v4 ใช้ `currentColor` เป็นค่าเริ่มต้น
- ตัวอักษรรองบนพื้นสว่างใช้ `text-gray-500 dark:text-gray-400` (ห้ามใช้ gray-400 บนพื้นขาว ได้ contrast แค่ 2.5:1) ส่วนสีเน้น/สถานะบนพื้นขาวหรือพื้นสีอ่อนใช้ระดับ -700 แล้วใช้ `dark:` ระดับ -400 ปุ่มตัวอักษรขาวห้ามใช้พื้น green-600/amber-500 (ใช้ green-700 หรือ amber-400 กับตัวอักษร amber-950)
- dev server (Turbopack) อาจไม่รับการแก้ `globals.css` ถ้า CSS ไม่เปลี่ยน ให้ปิด dev ลบ `.next` แล้วเปิดใหม่
- ยังมีเรื่องทดสอบ 30 ตอน (ปุ่ม "เลือกตอน") ใน DB เครื่องนี้ที่ `/read/95b71236-8285-4819-b1b7-63b8fbdcc20c` ถ้าไม่ใช้แล้วลบด้วย
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
   npx tsx scripts/add_story_categories.ts    # หลายหมวดต่อเรื่อง (คัดลอกหมวดเดิมมาให้)
   npx tsx scripts/add_author_profiles.ts     # โปรไฟล์นักเขียน ติดตาม สนับสนุน ป้ายจบแล้ว
   npx tsx scripts/add_admin_tools.ts         # แบนพร้อมเหตุผล ปรับเหรียญ ประวัติการทำงานของแอดมิน
   npx tsx scripts/add_mature_flag.ts         # ป้าย 18+ (หน้าแรกใหม่)
   npx tsx scripts/add_reader_settings.ts     # ตั้งค่าการอ่าน (ปุ่ม Aa)
   npx tsx scripts/add_moderation.ts          # ตรวจเนื้อหาด้วย API + ยืนยันอายุ 18+
   ```
   DB ที่เก่ากว่านั้นให้รันสคริปต์ก่อนหน้าตามลำดับใน README ก่อน ส่วน DB ใหม่ใช้ `schema.sql` ได้เลยไม่ต้องรันพวกนี้
3. ลบ `.next` แล้วเปิด `npm run dev` ใหม่ จากนั้นรัน `npm run test:e2e` เพื่อเช็ก (184 เทสต์ ต้องผ่านทั้งหมด ยกเว้น 2 เทสต์ใน `moderation-gemini.test.mjs` ที่อาจ skip เมื่อ Gemini ไม่ว่าง)

**ผู้ดูแลต้องทำเอง**:
- กรอก "ข้อมูลการชำระเงิน" ที่ `/admin` → ตั้งค่า (เครื่องนี้ยังเป็นข้อความตัวอย่างอยู่) ถ้ายังไม่กรอก ผู้อ่านจะเติมเหรียญไม่ได้
- สำรอง `storage/` และ `public/uploads/` ซึ่งไม่อยู่ใน git (ไฟล์สำรองเก่า `storage-2026-10-17.zip` ย้ายไปไว้ที่ `D:\loveR-backups\` แล้ว)
- ถ้ามั่นใจแล้วว่ารูปการ์ตูนใน storage ใช้ได้: `npx tsx scripts/move_comic_pages_private.ts --delete-originals` (URL เก่าใน `public/uploads/` ยังเปิดได้จนกว่าจะรัน)
- ใส่ `GEMINI_API_KEY` ใน `.env` ของเครื่องที่ใช้งานจริง (ไม่มี key = ทุกบท/ตอนใหม่ต้องรอแอดมินอนุมัติ)
- ตอน deploy: ให้ reverse proxy (เช่น nginx) ตั้ง `x-forwarded-for`ไม่งั้น limit ต่อ IP ของการล็อกอินและการสมัครจะไม่ทำงาน (IP เป็น `'unknown'`)

**งานพัฒนา** (เรียงตามความสำคัญ ข้อ 1-2 คือหัวข้อในขอบเขตโปรเจกต์ที่ยังไม่ครบ ดูตารางในหัวข้อถัดไป):
1. **ข้อ 12 ส่วนที่ยังไม่ทำ** (ทำบท/ตอน + ยืนยันอายุแล้ว 2026-10-29): ตรวจคอมเมนต์ ชื่อเรื่อง/เรื่องย่อ และรูปปกด้วย API ยังไม่ได้ทำ ถ้าทำให้ใช้ `analyse()` ใน `lib/moderation.ts` ซ้ำ และยังไม่ได้ตรวจหน้าที่เกี่ยวข้องในเบราว์เซอร์ (ดูงานวันที่ 2026-10-29 ข้างบน)
2. **ข้อ 14 เก็บงาน UX** (⚠️): งานในโค้ดเสร็จแล้ว (2026-10-27: `/admin` บนมือถือ, เลิกใช้ `prompt()`, error จาก API เป็นภาษาไทย, ตรวจการแสดงผลทุกหน้า) เหลือผลทดสอบกับผู้ใช้จริง (เช่น แบบสอบถาม SUS) สำหรับรายงาน
3. **ลบแจ้งเตือนเก่า**: ตาราง `notifications` ยังไม่มีการลบอัตโนมัติ ถ้าใช้งานนานควรลบที่เก่ากว่า ~90 วัน (เช่นใน `notify()` นานๆ ครั้ง หรือ cron)
4. **dependency ที่มีช่องโหว่** (อัปเกรด next เป็น 15.5.28 และรัน `npm audit fix` แล้วเมื่อ 2026-10-21): ที่เหลือแก้ได้ทางเดียวคือขึ้น Next 16 (breaking) ได้แก่ `postcss` ที่ next ฝังมาเอง (ใช้ตอน build CSS ของเราเอง ไม่ได้รับ input จากผู้ใช้) และ `braces`/`micromatch`/`fast-glob` ใต้ `eslint-config-next` (dev เท่านั้น) อย่าใช้ `npm audit fix --force` เพราะจะอัปเกรดแบบ breaking
5. **object storage**: จำเป็นเฉพาะถ้าจะ deploy บน Vercel/serverless ตอนนี้ไฟล์ทั้งหมดเขียนลงดิสก์ (`lib/upload.ts` เป็นจุดเดียวที่ต้องแก้)
6. **ความเร็ว/ความแม่นของการตรวจ**: นักเขียนที่ยังไม่ได้รับความเชื่อถือต้องรอผลก่อนได้ response ปกติ 2-20 วินาที แต่วันที่ทดสอบ (2026-10-29) Gemini ช้าเป็นช่วงๆ บางครั้งถึง 45 วินาทีแล้วหมดเวลา (บท/ตอนจะไปรอแอดมิน) ถ้าเป็นปัญหาให้เปลี่ยนเป็นตรวจเบื้องหลังแล้วให้หน้าจัดการตอนแสดง "กำลังตรวจ" ใช้ `gemini-3.1-flash-lite` เพราะตอบเร็วที่สุดตอนทดสอบ โมเดลใหญ่กว่า (`gemini-3.8-flash`) ช้า 15-90 วินาทีหรือได้ 503ถ้าต้องการความแม่นกว่าให้ตั้ง `GEMINI_MODEL` แล้วลองกับเนื้อหาจริง เรื่องที่ตั้งเป็น 18+ ไปแล้วนักเขียนเปลี่ยนกลับเองไม่ได้ ต้องให้แอดมินแก้ใน DB (ยังไม่มีปุ่ม)
7. **หน้าโปรไฟล์ที่อาจทำต่อ**: ชื่อในรายการแฟนตัวยงยังไม่ลิงก์ไปโปรไฟล์ของคนนั้น (ตอนนี้ผู้อ่านมีโปรไฟล์แล้ว ทำได้ แต่ต้องคิดเรื่องความเป็นส่วนตัวก่อน) ผู้ใช้ทุกคนใน DB เครื่องนี้ยังเป็น `user_xxxx` จึงเห็นกล่องแนะนำตั้งชื่อ ถ้าจะพรีเซนต์ควรตั้ง @username ให้บัญชีตัวอย่างก่อน รูปที่อัปโหลดแล้วเปลี่ยนใหม่ ไฟล์เก่าใน `public/uploads/` ไม่ถูกลบ
8. **เล็กน้อยที่เจอระหว่างทำ** (ยังไม่ได้แก้): แถบหมวดหมู่ใต้แบนเนอร์และแถวต่างๆ ไม่มีตัวบอกว่าเลื่อนได้บนมือถือนอกจากการ์ดที่โผล่ขอบขวา, แผง Aa ยังไม่มีในหน้าอ่านการ์ตูน (ตามที่สั่ง), อันดับยังเป็นแบบรวมตลอดกาล (รายสัปดาห์ต้องมีตารางวิวรายวัน)

## ตรวจตามขอบเขตโปรเจกต์ที่เสนออาจารย์ (ตรวจจากโค้ด 2026-10-23)

| # | หัวข้อ | สถานะ | หน้าที่ใช้โชว์ | ไฟล์หลัก |
|---|---|---|---|---|
| 1 | อ่านนิยายและสลับตอน | ✅ | `/novel/[id]`, `/read/[chapterId]`, `/comic/[id]/read/[episodeId]` | `app/read/[chapterId]/page.tsx`, `app/comic/[id]/read/[episodeId]/page.tsx` |
| 2 | ที่คั่นหน้าและประวัติการอ่าน | ✅ | `/profile?tab=bookmarks`, `/profile?tab=history` |`api/bookmarks`, `api/history`, `lib/readingHistory.ts`, `components/BookmarkButton.tsx` |
| 3 | เติมเหรียญ | ✅ | `/coins` → `/admin?tab=payments` | `api/coins/topup`, `api/admin/topups/[id]`, `components/admin/PaymentsPanel.tsx` |
| 4 | กระเป๋าเหรียญ | ✅ | `/coins`, `/author?tab=wallet` | `api/coins`, `components/author/WalletPanel.tsx` |
| 5 | ซื้อตอนด้วยเหรียญ | ✅ | `/read/[chapterId]` (ตอนที่มีราคา) | `lib/coins.ts` (`purchaseItem`, `canAccess`), `components/Paywall.tsx`, `api/purchases` |
| 6 | แบ่งรายได้ให้ผู้เขียน | ✅ | `/author?tab=earnings`, `/admin` → ตั้งค่า (ส่วนแบ่ง %) | `lib/coins.ts` (`getAuthorBalance`), `api/author/earnings`, `api/author/withdrawals` |
| 7 | ระบบผู้เขียน (เพิ่ม/แก้ไขตอน + สถิติ) | ✅ | `/author` (กราฟรายได้ + สถิติรายเรื่อง), `/author/novel/[id]/chapters`, `/author/comic/[id]/episodes` | `components/author/*`, `api/author/stats`, `api/author/analytics` |
| 8 | การจัดเก็บและแสดงผล Dashboard | ✅ | `/admin` (ภาพรวม: การ์ดยอดเงิน + กราฟ 30 วัน/12 เดือน), `/author` (ภาพรวม) | `lib/analytics.ts`, `components/TimeSeriesChart.tsx`, `components/admin/AnalyticsPanel.tsx`, `components/author/DashboardPanel.tsx` |
| 9 | ผู้ดูแลระบบ | ✅ | `/admin` ทุกแท็บ | `app/admin/page.tsx`, `app/api/admin/**` |
| 10 | รีวิว/คอมเมนต์และให้คะแนน | ✅ | ล่างหน้า `/novel/[id]`, `/comic/[id]` | `components/CommentSection.tsx`, `components/RatingStars.tsx`, `api/comments`, `api/ratings` |
| 11 | จัดอันดับและแนะนำ | ✅ (อันดับรวมตลอดกาล) | `/ranking`, `/` (แนะนำสำหรับคุณ + ยอดนิยม), ล่างหน้า `/novel/[id]` (เรื่องที่คล้ายกัน), `/search` (เรียงตาม) | `lib/ranking.ts`, `app/ranking/page.tsx`, `components/StoryCard.tsx` |
| 12 | ตรวจสอบเนื้อหาเบื้องต้นด้วย API | ✅ (บท/ตอน + ยืนยันอายุ) | ลงตอนใหม่ที่ `/author` → `/admin?tab=moderation`, เปิดเรื่อง 18+ | `lib/moderation.ts`, `lib/ageGate.ts`, `components/admin/ModerationPanel.tsx`, `components/AgeGate.tsx` |
| 13 | รักษาความปลอดภัย | ✅ | `/login` (ล็อกอินผิดเกิน 5 ครั้ง), เปิดตอนที่ยังไม่ซื้อ | `lib/auth.ts`, `lib/loginThrottle.ts`, `lib/upload.ts`, `lib/visibility.ts`, `tests/e2e/security.test.mjs` |
| 14 | ทดสอบระบบและปรับ UX/UI | ⚠️ | `npm run test:e2e` (184 เทสต์) | `tests/e2e/` |

**สิ่งที่ขาด**:
- ~~ยอดวิวไม่เคยเพิ่ม~~ **แก้แล้ว 2026-10-23** (ดูหัวข้อ "ยอดวิว" ในสถาปัตยกรรม) ยอดวิวเก่าก่อนวันนั้นของนิยาย/บท/การ์ตูนยังเป็น 0 เพราะไม่มีข้อมูลย้อนหลัง
- **ข้อ 7**: **ทำแล้ว 2026-10-23** (กราฟรายได้และสถิติรายเรื่องในแท็บภาพรวมของ `/author`)
- **ข้อ 8**: **ทำแล้ว 2026-10-23** ส่วน "รูปแบบการจัดเก็บ" ใช้ `schema.sql`/`prisma/schema.prisma` ทำ ER diagram ใส่รายงานได้
- **ข้อ 11**: **ทำแล้ว 2026-10-23** เหลือเพิ่มได้ถ้าต้องการ: อันดับรายสัปดาห์/รายเดือน (ต้องมีตารางเก็บวิวรายวัน) และกันการกดรีเฟรชซ้ำในการนับวิว
- **ข้อ 12**: **ทำแล้ว 2026-10-29** ด้วย Gemini (ผู้ใช้เลือก) แบบนักเขียนติดป้ายเอง แล้ว API ตรวจซ้ำ ดูหัวข้อ "ตรวจเนื้อหาด้วย API" ในสถาปัตยกรรม ทางเลือกอื่นที่เคยพิจารณา (ใช้เขียนรายงานได้) API ที่ตรวจภาษาไทย(ราคาเปลี่ยนบ่อย เช็กหน้า pricing ก่อนเขียนรายงาน):
  - **OpenAI Moderation API** (`omni-moderation-latest`): ฟรี รองรับหลายภาษารวมไทย ตรวจได้ทั้งข้อความและรูป (ใช้กับหน้าการ์ตูนได้) ใช้ง่าย / ข้อเสีย: แม่นกับภาษาไทยน้อยกว่าอังกฤษ (คำแสลง คำหยาบเลี่ยงตัวสะกด) หมวดตายตัว ปรับนโยบายเองไม่ได้ ส่งข้อมูลออกไปต่างประเทศ
  - **LLM (เช่น Claude Haiku) + prompt นโยบายของเว็บ**: เข้าใจภาษาไทยและบริบทนิยายดีที่สุด กำหนดหมวดเองได้ (18+, ด่าทอ, สแปม/ลิงก์พนัน) และให้เหตุผลภาษาไทยกลับมาได้ / ข้อเสีย: เสียเงินตาม token (บทนิยายยาว ต้องตัดเป็นช่วงหรือตรวจเฉพาะคอมเมนต์+ชื่อเรื่อง+เรื่องย่อ) ช้ากว่า ผลไม่ deterministic
  - **Azure AI Content Safety**: ตรวจข้อความ+รูป มีระดับความรุนแรง มี free tier / ข้อเสีย: ภาษาไทยไม่อยู่ในกลุ่มภาษาที่ train หลัก (ใช้ได้แต่คุณภาพต่ำกว่า) ต้องมีบัญชี Azure
  - **Google Cloud Vision SafeSearch** (เฉพาะรูป): ตรวจรูปโป๊/รุนแรง มีโควตาฟรีต่อเดือน แล้วคิดต่อรูป / ข้อเสีย: ไม่ตรวจข้อความ
  - **รายการคำต้องห้ามภาษาไทยในเครื่อง** (ตัดคำด้วย `Intl.Segmenter('th')`): ฟรี เร็ว ไม่ส่งข้อมูลออก / ข้อเสีย: ไม่ใช่ API จับบริบทไม่ได้ ใช้เป็นด่านแรกคู่กับ API
  - ข้อเสนอ: OpenAI Moderation (ฟรี, ข้อความ+รูป) + รายการคำต้องห้ามไทย ถ้าต้องการความแม่นภาษาไทยให้ใช้ LLM เฉพาะคอมเมนต์/เรื่องย่อ ผลที่ถูกตีธงให้สร้างแถวใน `reports` (PENDING) ให้แอดมินตัดสิน ไม่บล็อกอัตโนมัติ และถ้า API ล่มต้องให้โพสต์ได้ตามปกติ (แบบเดียวกับ `notify()`)
- **ข้อ 13** (ครบแล้ว เพิ่มได้ถ้าต้องการ): security headers (CSP, `X-Frame-Options`) ใน `next.config.ts`, ลืมรหัสผ่าน/ยืนยันอีเมล
- **ข้อ 14**: งานในโค้ดเสร็จแล้ว 2026-10-27 (`/admin` บนมือถือ, dialog แทน `prompt()`, error ภาษาไทย, ตรวจการแสดงผลทุกหน้าในเบราว์เซอร์) เหลือผลทดสอบกับผู้ใช้จริง (เช่น แบบสอบถาม SUS) สำหรับรายงาน ซึ่งไม่อยู่ในโค้ด
