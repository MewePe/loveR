import { execFile } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import mysql from 'mysql2/promise';

const run = promisify(execFile);
const BACKUP_DIR = path.join(process.cwd(), 'storage', 'backups');

export function dbConfig() {
    return {
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'loveread_db',
    };
}

// Demo accounts share a known password, so they must never land on a real server
export function assertLocalDatabase() {
    const { host } = dbConfig();
    if (!['localhost', '127.0.0.1', '::1'].includes(host) && !process.env.DEMO_ALLOW_REMOTE) {
        throw new Error(`ไม่รันกับฐานข้อมูล ${host} เพราะบัญชีตัวอย่างใช้รหัสผ่านที่ทุกคนรู้ ถ้าตั้งใจจริงให้ตั้ง DEMO_ALLOW_REMOTE=1`);
    }
}

// mysqldump.exe sits next to the running server, wherever XAMPP was installed
async function findMysqldump(connection: mysql.Connection) {
    if (process.env.MYSQLDUMP_PATH) return process.env.MYSQLDUMP_PATH;
    const [rows] = await connection.query<mysql.RowDataPacket[]>('SELECT @@basedir AS basedir');
    const name = process.platform === 'win32' ? 'mysqldump.exe' : 'mysqldump';
    const beside = path.join(rows[0].basedir, 'bin', name);
    return existsSync(beside) ? beside : name;
}

// Full dump to storage/backups/ (not in git: it holds password hashes and personal data). Throws if anything looks
// wrong, so the caller stops before changing the database.
export async function backupDatabase(connection: mysql.Connection, label: string) {
    const { host, user, password, database } = dbConfig();
    mkdirSync(BACKUP_DIR, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const file = path.join(BACKUP_DIR, `${label}-${stamp}.sql`);
    const mysqldump = await findMysqldump(connection);
    await run(mysqldump, ['-h', host, '-u', user, '--single-transaction', '--default-character-set=utf8mb4', `--result-file=${file}`, database], {
        env: { ...process.env, MYSQL_PWD: password },
    });
    const tail = readFileSync(file, 'utf8').slice(-200);
    if (statSync(file).size === 0 || !tail.includes('Dump completed')) throw new Error(`ไฟล์สำรองไม่สมบูรณ์: ${file}`);
    return file;
}
