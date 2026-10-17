import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

export const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB

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

// Validate and save an uploaded image under public/uploads[/subdir]
export async function saveImageUpload(file: File, subdir = ''): Promise<SaveResult> {
    if (file.size > MAX_IMAGE_SIZE) {
        return { error: 'File too large (max 10MB)', status: 413 };
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const ext = detectImageExtension(buffer);
    if (!ext) {
        return { error: 'Only JPG, PNG, WEBP and GIF images are allowed', status: 415 };
    }

    const filename = `${uuidv4()}${ext}`;
    const uploadDir = path.join(process.cwd(), 'public/uploads', subdir);

    await mkdir(uploadDir, { recursive: true });
    await writeFile(path.join(uploadDir, filename), buffer);

    return { url: `/uploads/${subdir ? `${subdir}/` : ''}${filename}` };
}
