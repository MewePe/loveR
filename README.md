# LoveRead

เว็บอ่านนิยายและการ์ตูนออนไลน์ภาษาไทย นักเขียนลงผลงานได้ทั้งแบบฟรีและแบบขายรายตอน ผู้อ่านเติมเหรียญเพื่อปลดล็อกตอน

## ฟีเจอร์

- **ผู้อ่าน**: อ่านนิยายรายบทและการ์ตูนรายตอน, ค้นหา, ชั้นหนังสือ (bookmark), เติมเหรียญด้วยการโอนเงินแล้วแนบสลิป, ปลดล็อกตอนที่มีราคา, ให้คะแนน 1-5 ดาวและแสดงความคิดเห็นในหน้าเรื่อง, รายงานเนื้อหาหรือความคิดเห็นที่ไม่เหมาะสม
- **นักเขียน**: สมัครเป็นนักเขียน (แอดมินอนุมัติ), สร้างนิยาย/การ์ตูน, ตั้งราคาทีละบท/ตอน, ดูรายได้, ขอถอนเงินเข้าบัญชีธนาคาร, ลบความคิดเห็นในเรื่องของตัวเอง
- **แอดมิน**: จัดการผู้ใช้ (รวมถึงแบน), จัดการเนื้อหา, อนุมัติคำขอนักเขียน, อนุมัติการเติมเหรียญและการถอนเงิน, จัดการรายงาน, หมวดหมู่, ตั้งค่าเว็บ (ส่วนแบ่งรายได้, ข้อมูลรับชำระเงิน, maintenance mode)

## เทคโนโลยี

Next.js 15 (App Router) · React 19 · TypeScript · Tailwind CSS v4 · NextAuth v5 (credentials) · MySQL/MariaDB ผ่าน `mysql2` (raw SQL)

## เริ่มต้นใช้งาน

### สิ่งที่ต้องมี

- Node.js 20 ขึ้นไป
- MySQL หรือ MariaDB เช่นจาก XAMPP

### ติดตั้ง

```bash
npm install
```

สร้างไฟล์ `.env`:

```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=
DB_NAME=loveread_db
AUTH_SECRET=<สุ่มสตริงยาวๆ เช่น จาก `npx auth secret`>
# ใช้เฉพาะกับเครื่องมือของ Prisma (prisma validate / studio)
DATABASE_URL=mysql://root:@localhost:3306/loveread_db
```

### ฐานข้อมูล

**ฐานข้อมูลใหม่**: import `schema.sql` ซึ่งสร้าง database `loveread_db` และทุกตารางให้ครบ แล้วสร้างแอดมิน

```bash
mysql -u root < schema.sql
npx tsx scripts/create_admin.ts admin@example.com <รหัสผ่าน> Admin
```

**อัปเกรดฐานข้อมูลเก่า**: รันสคริปต์ตามลำดับนี้ ทุกตัวรันซ้ำได้

```bash
npx tsx scripts/migrate_author_requests.ts   # ย้ายคำขอนักเขียนเก่าไป writer_profiles
npx tsx scripts/drop_author_requests.ts      # สำรองข้อมูลแล้วลบตาราง author_requests ที่เลิกใช้
npx tsx scripts/add_coin_system.ts           # ระบบเหรียญ/ขายตอน
npx tsx scripts/add_banned_role.ts           # role BANNED
npx tsx scripts/move_comic_pages_private.ts  # ย้ายรูปหน้าการ์ตูนไปเก็บแบบ private
npx tsx scripts/add_login_attempts.ts        # จำกัดการล็อกอินผิด
npx tsx scripts/add_comments_ratings.ts      # คอมเมนต์และให้คะแนน
npx tsx scripts/add_register_attempts.ts     # จำกัดการสมัครสมาชิก
npx tsx scripts/add_reading_history.ts       # ประวัติการอ่าน
npx tsx scripts/add_notifications.ts         # แจ้งเตือน และการตอบกลับคอมเมนต์
npx tsx scripts/add_item_reads.ts            # บท/ตอนที่อ่านแล้ว (ใช้ในปุ่มเลือกตอน)
npx tsx scripts/add_story_categories.ts      # หลายหมวดต่อเรื่อง (คัดลอกหมวดเดิมของทุกเรื่องมาให้)
npx tsx scripts/add_author_profiles.ts       # โปรไฟล์นักเขียนสาธารณะ ระบบติดตาม การสนับสนุน และป้าย "จบแล้ว"
npx tsx scripts/add_admin_tools.ts           # แบนพร้อมเหตุผล ปรับยอดเหรียญ และประวัติการทำงานของแอดมิน
npx tsx scripts/add_mature_flag.ts           # ป้าย 18+ ของนิยาย/การ์ตูน
npx tsx scripts/add_reader_settings.ts       # ตั้งค่าการอ่าน (ปุ่ม Aa) ของผู้ใช้ที่ล็อกอิน
```

### รัน

```bash
npm run dev      # http://localhost:3000
npm run build && npm start
```

หลังรันครั้งแรก ให้เข้า `/admin` → **Settings** แล้วกรอก "ข้อมูลการชำระเงิน" (เลขบัญชี/PromptPay) ผู้อ่านถึงจะเติมเหรียญได้

## การทดสอบ

```bash
npm run lint
npx tsc --noEmit
npm run test:e2e   # ต้องเปิด npm run dev และ MySQL ไว้
```

เทสต์ end-to-end (`tests/e2e/`) ยิงไปที่ dev server จริง สร้างผู้ใช้ทดสอบ `e2e-*@test.local` แล้วลบทิ้งเองหลังจบ และจะไม่ยอมรันกับ server ที่ไม่ใช่ localhost

## ไฟล์ที่ระบบเขียนเอง (ไม่อยู่ใน git — ต้องสำรองเอง)

| โฟลเดอร์ | เก็บอะไร |
|---|---|
| `public/uploads/` | รูปปก, รูปโปรไฟล์ (เปิดได้แบบสาธารณะ) |
| `storage/comic-pages/` | รูปหน้าการ์ตูน ส่งผ่าน `/api/media/...` หลังเช็กว่าผู้ดูมีสิทธิ์อ่านตอนนั้น |
| `storage/private/` | สำเนาบัตรประชาชน, สมุดบัญชี, สลิป (เจ้าของและแอดมินเท่านั้น) |
| `storage/backups/` | ข้อมูลสำรองจากสคริปต์ migration |

> **Deploy**: ระบบเก็บไฟล์ลงดิสก์ของเครื่อง ใช้กับ host ที่มีดิสก์ถาวรได้ (VPS ฯลฯ) แต่**ใช้กับ Vercel/serverless ไม่ได้** ต้องเปลี่ยนไปใช้ object storage (S3, R2, Cloudinary) ก่อน

## โครงสร้างโปรเจกต์

```
app/            หน้าเว็บ (App Router) และ API routes (app/api/**/route.ts)
components/     React components
lib/            auth, db pool, ระบบเหรียญ (coins.ts), สิทธิ์การมองเห็น (visibility.ts), อัปโหลด (upload.ts)
middleware.ts   maintenance mode
scripts/        สคริปต์จัดการฐานข้อมูล (รันด้วย npx tsx)
tests/e2e/      เทสต์ end-to-end
schema.sql      โครงสร้างฐานข้อมูล (prisma/schema.prisma ใช้เป็นเอกสารอ้างอิง ไม่ได้ใช้ใน runtime)
```

รายละเอียดสถาปัตยกรรมและกฎที่ต้องระวังเวลาแก้โค้ดอยู่ใน [CLAUDE.md](CLAUDE.md)
