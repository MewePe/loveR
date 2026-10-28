// Shared helpers for the end-to-end tests. They run against a live dev server (npm run dev) and the
// MySQL database in .env, create their own e2e-*@test.local users/content, and delete everything afterwards.
import fs from 'node:fs';
import path from 'node:path';
import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { v4 as uuid } from 'uuid';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
dotenv.config({ path: path.join(ROOT, '.env'), quiet: true });

export { uuid };
export const BASE = process.env.E2E_BASE_URL || 'http://localhost:3000';
export const PASSWORD = 'e2e-pass-123';
export const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==', 'base64');
export const png = () => new Blob([PNG], { type: 'image/png' });
export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// These tests write to the database, so only run them against a local server unless explicitly allowed
if (!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(BASE) && !process.env.E2E_ALLOW_REMOTE) {
    throw new Error(`Refusing to run E2E tests against ${BASE}. Set E2E_ALLOW_REMOTE=1 if you really mean it.`);
}

export async function connectDb() {
    return mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'loveread_db',
    });
}

export async function ensureServer() {
    try {
        const res = await fetch(`${BASE}/api/categories`);
        if (res.status === 503) throw new Error('maintenance mode is on');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } catch (error) {
        throw new Error(`Dev server not usable at ${BASE} (${error.message}). Start it with "npm run dev" and make sure MySQL is running.`);
    }
}

// Cookie-keeping HTTP client that can log in through NextAuth's credentials provider
export class Client {
    // extraHeaders are sent with every request, e.g. { 'x-forwarded-for': '203.0.113.7' } to simulate a client IP
    constructor(extraHeaders = {}) {
        this.cookies = {};
        this.extraHeaders = extraHeaders;
        this.lastLoginCode = null; // NextAuth error code of the last failed login, e.g. 'credentials' or 'rate_limited'
    }

    cookieHeader() { return Object.entries(this.cookies).map(([k, v]) => `${k}=${v}`).join('; '); }

    store(res) {
        for (const c of res.headers.getSetCookie()) {
            const [kv] = c.split(';');
            const i = kv.indexOf('=');
            this.cookies[kv.slice(0, i)] = kv.slice(i + 1);
        }
    }

    // body: object (sent as JSON) or FormData (sent as multipart)
    async req(method, url, body) {
        const headers = { ...this.extraHeaders, cookie: this.cookieHeader() };
        let payload;
        if (body instanceof FormData) payload = body;
        else if (body !== undefined) { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }
        const res = await fetch(BASE + url, { method, headers, body: payload, redirect: 'manual' });
        this.store(res);
        const buf = Buffer.from(await res.arrayBuffer());
        const text = buf.toString('utf8');
        let json = null;
        try { json = JSON.parse(text); } catch { /* not JSON */ }
        return { status: res.status, text, json, buf, headers: res.headers };
    }

    get(url) { return this.req('GET', url); }
    post(url, body) { return this.req('POST', url, body); }
    patch(url, body) { return this.req('PATCH', url, body); }
    del(url, body) { return this.req('DELETE', url, body); }

    async login(email, password = PASSWORD) {
        const csrf = await this.get('/api/auth/csrf');
        const res = await fetch(`${BASE}/api/auth/callback/credentials`, {
            method: 'POST',
            headers: { ...this.extraHeaders, cookie: this.cookieHeader(), 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ csrfToken: csrf.json.csrfToken, email, password }),
            redirect: 'manual',
        });
        this.store(res);
        const location = res.headers.get('location');
        this.lastLoginCode = location ? new URL(location, BASE).searchParams.get('code') : null;
        const session = await this.get('/api/auth/session');
        return session.json?.user?.email === email;
    }
}

export function form(fields) {
    const fd = new FormData();
    for (const [k, v] of Object.entries(fields)) fd.append(k, v);
    return fd;
}

// Create users like { reader: 'READER', author: 'AUTHOR' } and log each one in.
// Returns { ids, emails, clients }.
export async function createUsers(db, spec, { coins = 0 } = {}) {
    const hash = await bcrypt.hash(PASSWORD, 10);
    const ids = {}, emails = {}, clients = {};
    const tag = uuid().slice(0, 8);
    for (const [key, role] of Object.entries(spec)) {
        ids[key] = uuid();
        emails[key] = `e2e-${key}-${tag}@test.local`;
        await db.query('INSERT INTO users (id, name, email, password, role, coins) VALUES (?, ?, ?, ?, ?, ?)',
            [ids[key], `E2E ${key}`, emails[key], hash, role, coins]);
    }
    for (const key of Object.keys(spec)) {
        clients[key] = new Client();
        if (!(await clients[key].login(emails[key]))) throw new Error(`login failed for ${key}`);
    }
    return { ids, emails, clients };
}

// Delete everything the given test users created, including their private files
export async function cleanupUsers(db, userIds) {
    if (userIds.length === 0) return;
    // Admin log entries by test admins or about test users (admin_id is ON DELETE SET NULL, so they'd stay otherwise)
    await db.query('DELETE FROM admin_logs WHERE admin_id IN (?) OR target_id IN (?)', [userIds, userIds]);
    await db.query('DELETE FROM reports WHERE reporter_id IN (?)', [userIds]);
    await db.query('DELETE FROM purchases WHERE user_id IN (?) OR author_id IN (?)', [userIds, userIds]);
    await db.query('DELETE FROM supports WHERE user_id IN (?) OR author_id IN (?)', [userIds, userIds]);
    await db.query('DELETE FROM withdrawals WHERE user_id IN (?)', [userIds]);
    await db.query('DELETE FROM coin_topups WHERE user_id IN (?)', [userIds]);
    await db.query('DELETE FROM comics WHERE author_id IN (?)', [userIds]);
    await db.query('DELETE FROM novels WHERE author_id IN (?)', [userIds]);
    await db.query('DELETE FROM users WHERE id IN (?)', [userIds]);
    for (const id of userIds) {
        fs.rmSync(path.join(ROOT, 'storage', 'comic-pages', id), { recursive: true, force: true });
        for (const category of ['writer-docs', 'topup-slips', 'withdrawal-slips']) {
            fs.rmSync(path.join(ROOT, 'storage', 'private', category, id), { recursive: true, force: true });
        }
    }
}

export function storagePath(...parts) {
    return path.join(ROOT, 'storage', ...parts);
}

export function publicPath(...parts) {
    return path.join(ROOT, 'public', ...parts);
}
