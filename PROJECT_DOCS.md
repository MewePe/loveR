# LoveRead Project Documentation

## 1. Project Structure
```
d:/loveR/
├── app/
│   ├── api/
│   │   ├── auth/
│   │   │   └── [...nextauth]/route.ts  (To be created if using API route for Auth)
│   │   ├── chapters/
│   │   │   └── route.ts
│   │   ├── novels/
│   │   │   └── route.ts
│   │   └── upload/
│   │       └── route.ts
│   ├── author/
│   │   ├── dashboard/
│   │   │   └── page.tsx
│   │   └── layout.tsx
│   ├── novel/
│   │   └── [id]/
│   │       └── page.tsx
│   ├── read/
│   │   └── [chapterId]/
│   │       └── page.tsx
│   ├── layout.tsx
│   └── page.tsx
├── components/         (UI Components)
├── lib/
│   ├── auth.ts         (NextAuth Config)
│   └── prisma.ts       (Prisma Client)
├── prisma/
│   └── schema.prisma   (Database Schema)
├── public/
├── .env                (Environment Variables)
├── next.config.ts
├── package.json
└── README.md
```

## 2. Setup Instructions

### Prerequisites
- Node.js 18+
- MySQL Database

### Installation
1. Install dependencies:
   ```bash
   npm install
   ```
2. Set up environment variables in `.env`:
   ```env
   DATABASE_URL="mysql://USER:PASSWORD@HOST:PORT/DATABASE"
   AUTH_SECRET="your-secret-key"
   ```
3. Push Prisma schema to database:
   ```bash
   npx prisma db push
   ```
4. Run development server:
   ```bash
   npm run dev
   ```

## 3. Deployment to Vercel

1. **Push to GitHub**: Commit your code and push to a GitHub repository.
2. **Import Project**: Go to Vercel Dashboard -> Add New -> Project -> Import from GitHub.
3. **Environment Variables**: Add the following in Vercel Project Settings:
   - `DATABASE_URL`: Your MySQL connection string (e.g., from PlanetScale, Supabase, or Railway).
   - `AUTH_SECRET`: A random string for NextAuth security.
   - `NEXTAUTH_URL`: Your Vercel domain (e.g., https://loveread.vercel.app).
4. **Build Settings**: Vercel automatically detects Next.js.
   - Override Build Command if needed: `npx prisma generate && next build`
5. **Deploy**: Click Deploy.

## 4. NextAuth + Prisma Setup
- We use `@auth/prisma-adapter` to link NextAuth with Prisma.
- The `User`, `Account`, and `Session` models in `schema.prisma` are required for this adapter.
- Configuration is in `lib/auth.ts`.
