import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';

// Failed-login rate limiting. Only failures are stored (login_attempts); a successful login clears the email's count.
export const LOGIN_WINDOW_MINUTES = 15;
const MAX_FAILURES_PER_EMAIL = 5;
const MAX_FAILURES_PER_IP = 20;

// Behind a reverse proxy the client IP is in x-forwarded-for. Without one this header can be spoofed, which is
// why the per-email limit (not spoofable) is the main protection and the per-IP limit is only a second layer.
export function clientIp(req?: Request): string {
    const forwarded = req?.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
    return (forwarded || req?.headers.get('x-real-ip') || 'unknown').slice(0, 64);
}

const normalize = (email: string) => email.trim().toLowerCase().slice(0, 255);

export async function isLoginBlocked(email: string, ip: string): Promise<boolean> {
    const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT
            SUM(email = ?) AS by_email,
            SUM(ip = ?) AS by_ip
         FROM login_attempts
         WHERE created_at > NOW() - INTERVAL ? MINUTE AND (email = ? OR ip = ?)`,
        [normalize(email), ip, LOGIN_WINDOW_MINUTES, normalize(email), ip]
    );
    if (Number(rows[0].by_email) >= MAX_FAILURES_PER_EMAIL) return true;
    // Without a proxy header every request is 'unknown'; limiting that would lock everyone out at once
    return ip !== 'unknown' && Number(rows[0].by_ip) >= MAX_FAILURES_PER_IP;
}

export async function recordFailedLogin(email: string, ip: string) {
    await pool.query('INSERT INTO login_attempts (email, ip) VALUES (?, ?)', [normalize(email), ip]);
    // Keep the table small; old rows no longer affect any limit
    await pool.query('DELETE FROM login_attempts WHERE created_at < NOW() - INTERVAL 1 DAY');
}

export async function clearFailedLogins(email: string) {
    await pool.query('DELETE FROM login_attempts WHERE email = ?', [normalize(email)]);
}
