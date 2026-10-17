import { mkdir, readFile, writeFile } from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

export const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB

// Paid comic pages live outside public/ and are served through /api/media/comic-pages/... after an access check
const PRIVATE_COMIC_DIR = path.join(process.cwd(), 'storage', 'comic-pages');
export const PRIVATE_COMIC_URL_PREFIX = '/api/media/comic-pages/';

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const PRIVATE_FILE_RE = new RegExp(`^${UUID}\\.(jpg|png|webp|gif)$`);
const USER_ID_RE = new RegExp(`^${UUID}$`);

export const IMAGE_CONTENT_TYPES: Record<string, string> = {
    jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif',
};

// Detect image type from file content (magic bytes) instead of trusting the client's filename/MIME
function detectImageExtension(buffer: Buffer): string | null {
    if (buffer.length < 12) return null;
    if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return '.jpg';
    if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return '.png';
    if (buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') return '.webp';
    if (buffer.toString('ascii', 0, 4) === 'GIF8') return '.gif';
    return null;
}

type SaveResult = { url: string } | { error: string; status: number };

async function validateAndWrite(file: File, dir: string): Promise<{ filename: string } | { error: string; status: number }> {
    if (file.size > MAX_IMAGE_SIZE) {
        return { error: 'File too large (max 10MB)', status: 413 };
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const ext = detectImageExtension(buffer);
    if (!ext) {
        return { error: 'Only JPG, PNG, WEBP and GIF images are allowed', status: 415 };
    }

    const filename = `${uuidv4()}${ext}`;
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, filename), buffer);
    return { filename };
}

// Validate and save an uploaded image under public/uploads[/subdir]
export async function saveImageUpload(file: File, subdir = ''): Promise<SaveResult> {
    const result = await validateAndWrite(file, path.join(process.cwd(), 'public/uploads', subdir));
    if ('error' in result) return result;
    return { url: `/uploads/${subdir ? `${subdir}/` : ''}${result.filename}` };
}

// Validate and save a comic page privately, namespaced by the uploading author
export async function savePrivateComicPage(file: File, userId: string): Promise<SaveResult> {
    if (!USER_ID_RE.test(userId)) return { error: 'Invalid user', status: 400 };
    const result = await validateAndWrite(file, path.join(PRIVATE_COMIC_DIR, userId));
    if ('error' in result) return result;
    return { url: `${PRIVATE_COMIC_URL_PREFIX}${userId}/${result.filename}` };
}

// Read a private comic page; returns null for invalid names (no path traversal) or missing files
export async function readPrivateComicPage(userId: string, filename: string) {
    if (!USER_ID_RE.test(userId) || !PRIVATE_FILE_RE.test(filename)) return null;
    try {
        const data = await readFile(path.join(PRIVATE_COMIC_DIR, userId, filename));
        return { data, contentType: IMAGE_CONTENT_TYPES[filename.split('.').pop()!] };
    } catch {
        return null;
    }
}

// Cover images / avatars must be files uploaded to this app (blocks external tracking/phishing image URLs)
export function isPublicUploadUrl(url: unknown): url is string {
    return typeof url === 'string' && /^\/uploads\/[\w.-]+$/.test(url);
}

// Personal documents (ID card / bank book scans, payment slips) are private to their owner and admins.
// Served by /api/media/private/<category>/<ownerId>/<file>.
export const PRIVATE_DOC_CATEGORIES = ['writer-docs', 'topup-slips', 'withdrawal-slips'] as const;
export type PrivateDocCategory = typeof PRIVATE_DOC_CATEGORIES[number];
const PRIVATE_DOC_DIR = path.join(process.cwd(), 'storage', 'private');

export async function savePrivateDocument(file: File, category: PrivateDocCategory, ownerId: string): Promise<SaveResult> {
    if (!USER_ID_RE.test(ownerId)) return { error: 'Invalid user', status: 400 };
    const result = await validateAndWrite(file, path.join(PRIVATE_DOC_DIR, category, ownerId));
    if ('error' in result) return result;
    return { url: `/api/media/private/${category}/${ownerId}/${result.filename}` };
}

export async function readPrivateDocument(category: string, ownerId: string, filename: string) {
    if (!(PRIVATE_DOC_CATEGORIES as readonly string[]).includes(category)) return null;
    if (!USER_ID_RE.test(ownerId) || !PRIVATE_FILE_RE.test(filename)) return null;
    try {
        const data = await readFile(path.join(PRIVATE_DOC_DIR, category, ownerId, filename));
        return { data, contentType: IMAGE_CONTENT_TYPES[filename.split('.').pop()!] };
    } catch {
        return null;
    }
}

// Page image URLs an author may attach to their episode: their own private uploads, or legacy public /uploads files.
// Blocks pointing a free episode at another author's private (paid) page.
export function validatePageUrls(urls: unknown, userId: string): string | null {
    if (!Array.isArray(urls)) return 'Invalid page list';
    for (const url of urls) {
        if (typeof url !== 'string') return 'Invalid page URL';
        const ownPrivate = url.startsWith(`${PRIVATE_COMIC_URL_PREFIX}${userId}/`)
            && PRIVATE_FILE_RE.test(url.slice(`${PRIVATE_COMIC_URL_PREFIX}${userId}/`.length));
        const legacyPublic = /^\/uploads\/[\w.-]+$/.test(url);
        if (!ownPrivate && !legacyPublic) return 'Invalid page URL';
    }
    return null;
}
