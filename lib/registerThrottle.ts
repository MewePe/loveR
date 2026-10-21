import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';

// Sign-up rate limiting per client IP (register_attempts). Every validated attempt counts, including ones that hit an
// existing email, so the endpoint can't be used to mass-create accounts or to probe which emails are registered.
export const REGISTER_WINDOW_MINUTES = 60;
const MAX_ATTEMPTS_PER_IP = 10;

// Records this attempt and returns true if the IP is over the limit. Uses clientIp() from lib/loginThrottle.ts;
// 'unknown' (no proxy header) is never limited, for the same reason as the login per-IP limit.
export async function hitRegisterLimit(ip: string): Promise<boolean> {
    if (ip === 'unknown') return false;
    const [rows] = await pool.query<RowDataPacket[]>(
        'SELECT COUNT(*) AS n FROM register_attempts WHERE ip = ? AND created_at > NOW() - INTERVAL ? MINUTE',
        [ip, REGISTER_WINDOW_MINUTES]
    );
    if (Number(rows[0].n) >= MAX_ATTEMPTS_PER_IP) return true;
    await pool.query('INSERT INTO register_attempts (ip) VALUES (?)', [ip]);
    // Keep the table small; old rows no longer affect the limit
    await pool.query('DELETE FROM register_attempts WHERE created_at < NOW() - INTERVAL 1 DAY');
    return false;
}
