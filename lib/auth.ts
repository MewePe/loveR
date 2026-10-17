import NextAuth, { CredentialsSignin } from "next-auth"
import Credentials from "next-auth/providers/credentials"
import pool from "@/lib/db"
import bcrypt from "bcryptjs"
import { RowDataPacket } from "mysql2"
import { clearFailedLogins, clientIp, isLoginBlocked, recordFailedLogin } from "@/lib/loginThrottle"

// Surfaces to the client as signIn(...) result `code: "rate_limited"`
class TooManyAttempts extends CredentialsSignin {
    code = "rate_limited"
}

interface User extends RowDataPacket {
    id: string;
    name: string;
    email: string;
    password?: string;
    role: string;
    image?: string;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
    providers: [
        Credentials({
            credentials: {
                email: { label: "Email", type: "email" },
                password: { label: "Password", type: "password" },
            },
            authorize: async (credentials, request) => {
                if (!credentials?.email || !credentials?.password) return null;
                const email = String(credentials.email);
                const ip = clientIp(request);

                // Checked before the password so a blocked account can't be brute-forced at all.
                // If the throttle table is unavailable (migration not run) we log it and still check the password.
                let blocked = false;
                try {
                    blocked = await isLoginBlocked(email, ip);
                } catch (error) {
                    console.error("Login throttle unavailable (run scripts/add_login_attempts.ts):", error);
                }
                if (blocked) throw new TooManyAttempts();

                try {
                    const [rows] = await pool.query<User[]>(
                        "SELECT * FROM users WHERE email = ?",
                        [email]
                    );

                    const user = rows[0];

                    // Unknown emails count as failures too, so the limit doesn't reveal which accounts exist
                    const isValid = !!user?.password && await bcrypt.compare(credentials.password as string, user.password);
                    if (!isValid) {
                        await recordFailedLogin(email, ip).catch((e) => console.error("Failed to record login attempt:", e));
                        return null;
                    }
                    await clearFailedLogins(email).catch((e) => console.error("Failed to clear login attempts:", e));

                    if (user.role === "BANNED") return null;

                    return {
                        id: user.id,
                        name: user.name,
                        email: user.email,
                        image: user.image,
                        role: user.role,
                    };
                } catch (error) {
                    console.error("Auth error:", error);
                    return null;
                }
            },
        }),
    ],
    callbacks: {
        async jwt({ token, user }) {
            if (user) {
                token.role = user.role;
                token.id = user.id as string; // always set by authorize()
            } else if (token.email) {
                // Fetch fresh role from DB to ensure it's up to date
                try {
                    const [rows] = await pool.query<User[]>("SELECT role FROM users WHERE email = ?", [token.email]);
                    // Returning null ends the session: banned or deleted users are logged out on their next request
                    if (!rows[0] || rows[0].role === "BANNED") return null;
                    token.role = rows[0].role;
                } catch (error) {
                    console.error("Error fetching fresh role:", error);
                }
            }
            return token;
        },
        async session({ session, token }) {
            if (session.user) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                session.user.role = (token as any).role;
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                session.user.id = (token as any).id;
            }
            return session;
        },
    },
    pages: {
        signIn: '/login',
    },
})
