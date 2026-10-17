import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { saveImageUpload, savePrivateComicPage } from '@/lib/upload';

// POST - multipart `file`. With `purpose=comic-page` the image is stored privately (served via /api/media after an
// access check); everything else (covers, avatars, slips...) goes to public/uploads.
export async function POST(req: Request) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const formData = await req.formData();
        const file = formData.get('file');

        if (!file || !(file instanceof File)) {
            return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
        }

        let result;
        if (formData.get('purpose') === 'comic-page') {
            if (session.user.role !== 'AUTHOR' && session.user.role !== 'ADMIN') {
                return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
            }
            result = await savePrivateComicPage(file, session.user.id);
        } else {
            result = await saveImageUpload(file);
        }

        if ('error' in result) {
            return NextResponse.json({ error: result.error }, { status: result.status });
        }

        return NextResponse.json({
            url: result.url,
            success: true
        });
    } catch (error) {
        console.error('Upload error:', error);
        return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
    }
}
