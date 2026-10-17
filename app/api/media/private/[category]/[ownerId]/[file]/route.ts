import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { isOwnerOrAdmin } from '@/lib/visibility';
import { readPrivateDocument } from '@/lib/upload';

// GET - Serve a personal document (ID card / bank book scan, payment slip) to its owner or an admin only
export async function GET(_req: Request, { params }: { params: Promise<{ category: string; ownerId: string; file: string }> }) {
    const { category, ownerId, file } = await params;
    const session = await auth();

    if (!isOwnerOrAdmin(session?.user, ownerId)) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const doc = await readPrivateDocument(category, ownerId, file);
    if (!doc) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return new NextResponse(new Uint8Array(doc.data), {
        headers: {
            'Content-Type': doc.contentType,
            'Cache-Control': 'private, no-store',
            'X-Content-Type-Options': 'nosniff',
        },
    });
}
