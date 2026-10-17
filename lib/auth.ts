import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import pool from "@/lib/db"
import bcrypt from "bcryptjs"
import { RowDataPacket } from "mysql2"

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
            authorize: async (credentials) => {
                if (!credentials?.email || !credentials?.password) return null;

                try {
                    const [rows] = await pool.query<User[]>(
                        "SELECT * FROM users WHERE email = ?",
                        [credentials.email]
                    );

                    const user = rows[0];

                    if (!user || !user.password) return null;

                    const isValid = await bcrypt.compare(
                        credentials.password as string,
                        user.password
                    );

                    if (!isValid) return null;

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
                    if (rows[0]) {
                        token.role = rows[0].role;
                    }
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
