import { BookOpen, Image as ImageIcon } from 'lucide-react';
import type { ContentType } from '@/lib/contentRef';

// Stable hue per story, so every story without a cover gets its own colour. FNV-1a plus a final mix: a plain
// `h * 31 + c` hash puts most UUIDs on nearly the same hue.
export function hueOf(id: string) {
    let h = 0x811c9dc5;
    for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 0x01000193);
    h ^= h >>> 16;
    h = Math.imul(h, 0x45d9f3b);
    h ^= h >>> 16;
    return (h >>> 0) % 360;
}

// A story's cover filling its (relatively positioned) parent. Without an uploaded image it draws one from
// the title on a gradient whose colour comes from the story id (dark enough for white text on every hue).
// 18+ covers are blurred behind a badge. Images load lazily unless `eager` (the first banner slide).
export default function StoryCover({ id, title, src, type, mature = false, eager = false, compact = false }: {
    id: string; title: string; src?: string | null; type: ContentType; mature?: boolean; eager?: boolean; compact?: boolean;
}) {
    const hue = hueOf(id);
    const Icon = type === 'novel' ? BookOpen : ImageIcon;
    return (
        <div className="absolute inset-0 overflow-hidden">
            {src ? (
                <img
                    src={src}
                    alt=""
                    loading={eager ? 'eager' : 'lazy'}
                    decoding="async"
                    fetchPriority={eager ? 'high' : undefined}
                    className={`w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 motion-reduce:transition-none ${mature ? 'blur-xl scale-110' : ''}`}
                />
            ) : (
                <div
                    className={`w-full h-full flex flex-col justify-between text-white ${compact ? 'p-2' : 'p-3'} ${mature ? 'blur-md' : ''}`}
                    style={{ backgroundImage: `linear-gradient(150deg, hsl(${hue} 62% 30%), hsl(${(hue + 45) % 360} 70% 17%))` }}
                >
                    {/* Decorative rings so the generated cover isn't a flat block */}
                    <span aria-hidden="true" className="absolute -right-6 -top-6 w-24 h-24 rounded-full border-[10px] border-white/10" />
                    <span aria-hidden="true" className="absolute -left-8 bottom-10 w-20 h-20 rounded-full bg-white/5" />
                    <Icon aria-hidden="true" className={`relative opacity-70 ${compact ? 'w-4 h-4' : 'w-5 h-5'}`} />
                    <span className={`relative font-bold leading-snug break-words ${compact ? 'text-xs line-clamp-3' : 'text-base line-clamp-4'}`}>{title}</span>
                    <span aria-hidden="true" className="relative h-1 w-8 rounded-full bg-white/60" />
                </div>
            )}
            {mature && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                    <span className={`rounded-full bg-red-700 text-white font-bold ${compact ? 'text-xs px-2 py-0.5' : 'text-sm px-3 py-1'}`}>18+</span>
                </div>
            )}
        </div>
    );
}
