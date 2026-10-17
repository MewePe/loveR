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
npx tsx scripts/update_schema.ts   # รัน schema.sql (CREATE TABLE IF NOT EXISTS)
```

`reset_db.ts` และ `drop_old_db.ts` ลบข้อมูล

## Environment

ใช้ MySQL/MariaDB บนเครื่อง (XAMPP) ใน `.env` ต้องมี `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` (ค่าเริ่มต้น `loveread_db`) และ `AUTH_SECRET` ส่วน `DATABASE_URL` ใช้เฉพาะกับเครื่องมือของ Prisma

## สถาปัตยกรรม

**เข้าถึงข้อมูลด้วย raw SQL ผ่าน `mysql2` ไม่ใช่ Prisma** ทุก API route และ `lib/auth.ts` ใช้ pool จาก `lib/db.ts` ในรูปแบบ `pool.query<RowDataPacket[]>(sql, params)` และใช้ placeholder `?` ไฟล์ `lib/prisma.ts` มีอยู่แต่ไม่มีที่ไหน import ส่วน `prisma/schema.prisma` (introspect มาจาก DB) อธิบายตารางได้ครบที่สุด `schema.sql` เป็น SQL สำหรับสร้างตารางเริ่มต้น ตาราง `author_requests` (มีใน `schema.prisma` แต่ไม่มีใน `schema.sql`) เลิกใช้แล้ว ข้อมูลย้ายไป `writer_profiles` ด้วย `scripts/migrate_author_requests.ts` เมื่อแก้ schema ให้แก้ทั้ง `schema.sql` และ `schema.prisma` ให้ตรงกัน

- Primary key เป็น UUID แบบ `VARCHAR(36)` สร้างในโค้ดด้วย `v4()` จากแพ็กเกจ `uuid` ชื่อคอลัมน์เป็น snake_case
- enum สถานะเนื้อหา: `DRAFT | PUBLISHED | ARCHIVED | BANNED` endpoint สาธารณะที่แสดงรายการจะใช้ `PUBLISHED` เป็นค่าเริ่มต้น
- ลำดับชั้นเนื้อหา: `novels → chapters` (`chapter_order`), `comics → comic_episodes` (`episode_order`) `→ comic_pages` (`page_order`, `image_url`)

**Auth** (`lib/auth.ts`): NextAuth v5 beta, Credentials provider กับ bcrypt, session แบบ JWT callback `jwt` จะอ่าน `role` จาก DB ใหม่ทุก request ทำให้เปลี่ยน role แล้วมีผลทันทีโดยไม่ต้องล็อกอินใหม่ type ของ `session.user.id` และ `session.user.role` อยู่ใน `types/next-auth.d.ts` หน้า sign-in คือ `/login`

**API routes** (`app/api/**/route.ts`) เขียนตามรูปแบบเดียวกัน: `const session = await auth()` แล้วเช็ก role หรือความเป็นเจ้าของ รัน SQL แล้วคืน `NextResponse.json(...)` กรณี error คืน `{ error }` พร้อม status route ฝั่งแอดมินใน `app/api/admin/` เช็ก `session?.user?.role !== 'ADMIN'` เองทุกไฟล์ ไม่มี middleware params ของ dynamic route มี type เป็น `{ params: Promise<{ id: string }> }` และต้อง await (Next 15)

**Pages** เกือบทั้งหมดเป็น client component (`"use client"`) ที่ดึงข้อมูลจาก `/api/*` ส่วน `components/Providers.tsx` ครอบแอปด้วย `SessionProvider` + `next-themes` (dark mode แบบ `attribute="class"` ใช้คลาส `dark:` ของ Tailwind v4)

**ส่วนนักเขียน**: `app/author/page.tsx` เป็นแดชบอร์ดไฟล์เดียวขนาดใหญ่แบบแท็บ (dashboard/novels/comics/earnings/wallet/profile) `/author/dashboard` แค่ redirect ไป `/author` หน้าแก้ไขบท/ตอน/หน้าการ์ตูนอยู่ใน route ย่อยใต้ `app/author/novel/[id]/...` และ `app/author/comic/[id]/...`

**การสมัครเป็นนักเขียน** ใช้ตาราง `writer_profiles` ตารางเดียว (1 แถวต่อ user, key คือ `user_id`) ผ่าน `/api/author/profile` (GET/POST แบบ multipart) ทั้งหน้า `/become-author` และฟอร์มข้อมูลนักเขียนใน `/author` + `/author/profile`
- ถ้า READER เป็นคนส่ง ถือเป็นการสมัคร: ต้องกรอกข้อมูลส่วนตัวครบ และระบบตั้ง `status = 'PENDING'` ให้ (ถ้าเคยถูกปฏิเสธก็ส่งใหม่ได้)
- ถ้า AUTHOR/ADMIN เป็นคนส่ง แค่แก้ข้อมูล ไม่เปลี่ยนสถานะ
- ฟิลด์ที่ผู้ใช้ตั้งเองได้ถูกจำกัดด้วย whitelist (`TEXT_FIELDS`/`FILE_FIELDS`) ห้ามสร้างชื่อคอลัมน์จาก input โดยตรง
- แอดมินอนุมัติหรือปฏิเสธผ่าน `PATCH /api/admin/writers/[userId]` (`{ status, reason }`) ถ้าอนุมัติจะเปลี่ยน `users.role` เป็น `AUTHOR` ใน transaction เดียวกัน

**อัปโหลดไฟล์**: ใช้ `saveImageUpload(file, subdir)` ใน `lib/upload.ts` ทุกครั้งที่รับไฟล์รูป ฟังก์ชันนี้รับเฉพาะ JPG/PNG/WEBP/GIF ไม่เกิน 10MB ตรวจชนิดจาก magic bytes และตั้งนามสกุลตามชนิดที่ตรวจได้ `POST /api/upload` (multipart field `file`, ต้องล็อกอิน) คืน `{ url: "/uploads/..." }` เอกสารนักเขียนเก็บใน `public/uploads/writers/` และ `public/uploads/` ไม่ถูก track ใน git

## ส่วนที่ยังไม่เสร็จ

- แท็บรายได้และกระเป๋าเงินใน `app/author/page.tsx` เป็นแค่ UI ที่ฝังค่า (`฿0.00`) ตาราง `withdrawals` ยังไม่มี API
- แอดมินดูและจัดการรายงานได้ แต่ยังไม่มี endpoint ให้ผู้ใช้ส่งรายงาน
- `system_settings.maintenance_mode` บันทึกได้ แต่ยังไม่มีการบังคับใช้จริง
- `app/author/novel/create/page.tsx` ใช้รูปปกชั่วคราวและไม่ได้ดึงหมวดหมู่จาก DB
