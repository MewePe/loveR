import sharp from 'sharp';
import { CategorySlug, COMIC_LINES, DemoStory } from './data';

// Generated images for the demo data: story covers with their own pattern per category, comic pages and slips.
// Everything is drawn as SVG and rendered by sharp, so it works offline and comes out the same every run.

const W = 600;
const H = 900;
const FONT = `'Leelawadee UI', Tahoma, 'Noto Sans Thai', sans-serif`;

const escapeXml = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Small seeded generator (mulberry32), so a story always gets the same artwork
export function randomFrom(seed: string) {
    let h = 1779033703;
    for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    return () => {
        h = (h + 0x6d2b79f5) | 0;
        let t = Math.imul(h ^ (h >>> 15), 1 | h);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

// Vowel and tone marks sit above or below a letter and take no width
const visibleLength = (text: string) => [...text.replace(/[ัิ-ฺ็-๎]/g, '')].length;

// Thai has no spaces, so lines can only break at word boundaries the segmenter finds
function wrapThai(text: string, maxChars: number, maxLines: number) {
    const lines: string[] = [];
    let line = '';
    for (const { segment } of new Intl.Segmenter('th', { granularity: 'word' }).segment(text)) {
        if (line && visibleLength(line + segment) > maxChars) {
            lines.push(line.trim());
            line = '';
        }
        line += segment;
    }
    if (line.trim()) lines.push(line.trim());
    return lines.slice(0, maxLines);
}

type Palette = { from: string; to: string; ink: string; accent: string };

// Each category picks one of its palettes per story, so two stories in a category still differ
const PALETTES: Record<CategorySlug, Palette[]> = {
    romance: [{ from: '#9d174d', to: '#4c0519', ink: '#fff1f2', accent: '#fda4af' }, { from: '#be185d', to: '#581c87', ink: '#fdf2f8', accent: '#f9a8d4' }, { from: '#b45309', to: '#831843', ink: '#fff7ed', accent: '#fdba74' }],
    horror: [{ from: '#1f2937', to: '#030712', ink: '#fef2f2', accent: '#dc2626' }, { from: '#14532d', to: '#020617', ink: '#ecfdf5', accent: '#84cc16' }, { from: '#3b0764', to: '#09090b', ink: '#faf5ff', accent: '#a855f7' }],
    fantasy: [{ from: '#1e3a8a', to: '#0f172a', ink: '#eff6ff', accent: '#fbbf24' }, { from: '#065f46', to: '#022c22', ink: '#ecfdf5', accent: '#fcd34d' }, { from: '#4c1d95', to: '#1e1b4b', ink: '#f5f3ff', accent: '#c4b5fd' }],
    'sci-fi': [{ from: '#0e7490', to: '#082f49', ink: '#ecfeff', accent: '#22d3ee' }, { from: '#312e81', to: '#020617', ink: '#eef2ff', accent: '#818cf8' }, { from: '#115e59', to: '#042f2e', ink: '#f0fdfa', accent: '#5eead4' }],
    action: [{ from: '#b91c1c', to: '#111827', ink: '#fef2f2', accent: '#f97316' }, { from: '#c2410c', to: '#1c1917', ink: '#fff7ed', accent: '#fbbf24' }, { from: '#1d4ed8', to: '#111827', ink: '#eff6ff', accent: '#ef4444' }],
    comedy: [{ from: '#d97706', to: '#9a3412', ink: '#fffbeb', accent: '#fef08a' }, { from: '#0f766e', to: '#134e4a', ink: '#f0fdfa', accent: '#fde047' }, { from: '#7c3aed', to: '#be185d', ink: '#fdf4ff', accent: '#fde68a' }],
    drama: [{ from: '#57534e', to: '#1c1917', ink: '#fafaf9', accent: '#d6b98c' }, { from: '#475569', to: '#0f172a', ink: '#f8fafc', accent: '#cbd5e1' }, { from: '#78350f', to: '#292524', ink: '#fffbeb', accent: '#fcd34d' }],
    system: [{ from: '#0369a1', to: '#0c1a2e', ink: '#f0f9ff', accent: '#38bdf8' }, { from: '#15803d', to: '#052e16', ink: '#f0fdf4', accent: '#4ade80' }, { from: '#a16207', to: '#1c1917', ink: '#fefce8', accent: '#facc15' }],
    isakai: [{ from: '#0d9488', to: '#1e1b4b', ink: '#f0fdfa', accent: '#fde68a' }, { from: '#2563eb', to: '#3b0764', ink: '#eff6ff', accent: '#f0abfc' }, { from: '#65a30d', to: '#134e4a', ink: '#f7fee7', accent: '#fef08a' }],
};

const repeat = (count: number, draw: (i: number) => string) => Array.from({ length: count }, (_, i) => draw(i)).join('');

// The pattern behind the title, one idea per category
const PATTERNS: Record<CategorySlug, (r: () => number, p: Palette) => string> = {
    romance: (r, p) => repeat(26, () => {
        const x = r() * W, y = r() * 620, s = 10 + r() * 34;
        return `<path transform="translate(${x} ${y}) rotate(${r() * 360}) scale(${s / 20})" d="M0 6C-4-6-20-4-20 8-20 18-8 24 0 34 8 24 20 18 20 8 20-4 4-6 0 6Z" fill="${p.accent}" opacity="${0.12 + r() * 0.3}"/>`;
    }),
    horror: (r, p) => {
        const trees = repeat(13, (i) => {
            const x = (i * W) / 12 + r() * 30 - 15, h = 280 + r() * 330, top = H - 240 - h;
            return `<path d="M${x - 9} ${H}L${x - 4} ${top}L${x + 4} ${top}L${x + 9} ${H}Z M${x} ${top + 90}l${50 + r() * 40} -${40 + r() * 50} M${x} ${top + 170}l-${50 + r() * 50} -${30 + r() * 50}" fill="#000" stroke="#000" stroke-width="6" opacity="0.85"/>`;
        });
        return `<circle cx="${180 + r() * 240}" cy="${150 + r() * 80}" r="${70 + r() * 30}" fill="${p.accent}" opacity="0.75"/>${trees}`;
    },
    fantasy: (r, p) => {
        const stars = repeat(70, () => `<circle cx="${r() * W}" cy="${r() * 520}" r="${0.8 + r() * 2.2}" fill="${p.accent}" opacity="${0.3 + r() * 0.7}"/>`);
        const peaks = [0, 1].map((layer) => {
            let d = `M0 ${H}L0 ${520 + layer * 90}`;
            for (let x = 60; x <= W + 60; x += 70) d += `L${x} ${430 + layer * 110 + r() * 150}`;
            return `<path d="${d}L${W + 60} ${H}Z" fill="#000" opacity="${0.3 + layer * 0.25}"/>`;
        }).join('');
        return stars + peaks;
    },
    'sci-fi': (r, p) => {
        const cx = 120 + r() * 360, cy = 220 + r() * 160;
        const orbits = repeat(6, (i) => `<ellipse cx="${cx}" cy="${cy}" rx="${70 + i * 62}" ry="${24 + i * 22}" transform="rotate(${-24} ${cx} ${cy})" fill="none" stroke="${p.accent}" stroke-width="2" opacity="${0.75 - i * 0.1}"/>`);
        const grid = repeat(16, (i) => `<path d="M${i * 44 - 30} ${H}L${W / 2 + (i - 7.5) * 8} 560" stroke="${p.accent}" stroke-width="1" opacity="0.25"/>`)
            + repeat(8, (i) => `<path d="M0 ${570 + i * i * 6.5}H${W}" stroke="${p.accent}" stroke-width="1" opacity="0.25"/>`);
        return `<circle cx="${cx}" cy="${cy}" r="56" fill="${p.accent}" opacity="0.9"/>${orbits}${grid}`;
    },
    action: (r, p) => repeat(11, (i) => {
        const y = -160 + i * 92 + r() * 40, t = 8 + r() * 46;
        return `<path d="M-60 ${y + 340}L${W + 60} ${y}l0 ${t}L-60 ${y + 340 + t}Z" fill="${i % 3 ? '#000' : p.accent}" opacity="${0.16 + r() * 0.42}"/>`;
    }),
    comedy: (r, p) => {
        let dots = '';
        for (let y = 20; y < H; y += 34) for (let x = (y % 68 ? 17 : 0); x < W; x += 34) dots += `<circle cx="${x}" cy="${y}" r="${3 + (y / H) * 10}" fill="${p.accent}" opacity="0.22"/>`;
        return `${dots}<path transform="translate(${130 + r() * 340} ${220 + r() * 120}) scale(${2.1 + r() * 1.1})" d="M0-60L14-22 56-34 30 0 56 34 14 22 0 60-14 22-56 34-30 0-56-34-14-22Z" fill="${p.accent}" opacity="0.9"/>`;
    },
    drama: (r, p) => repeat(9, (i) => {
        const y = 130 + i * 72, a = 26 + r() * 50, s = r() * 200;
        return `<path d="M-20 ${y}C${140 + s} ${y - a} ${300 - s / 2} ${y + a} ${W + 20} ${y - 10}" fill="none" stroke="${p.accent}" stroke-width="${1 + r() * 3}" opacity="${0.15 + r() * 0.35}"/>`;
    }),
    system: (r, p) => {
        const hexes = repeat(34, () => {
            const x = r() * W, y = r() * 600, s = 14 + r() * 34;
            const pts = Array.from({ length: 6 }, (_, k) => `${x + s * Math.cos((k * Math.PI) / 3)},${y + s * Math.sin((k * Math.PI) / 3)}`).join(' ');
            return `<polygon points="${pts}" fill="${r() < 0.3 ? p.accent : 'none'}" stroke="${p.accent}" stroke-width="2" opacity="${0.14 + r() * 0.4}"/>`;
        });
        const bars = repeat(4, (i) => `<rect x="64" y="${88 + i * 34}" width="${120 + r() * 300}" height="12" rx="6" fill="${p.accent}" opacity="0.8"/>`);
        return hexes + bars;
    },
    isakai: (r, p) => {
        const cx = 160 + r() * 280, cy = 300 + r() * 80;
        const rings = repeat(7, (i) => `<circle cx="${cx}" cy="${cy}" r="${48 + i * 44}" fill="none" stroke="${p.accent}" stroke-width="${i % 2 ? 2 : 5}" stroke-dasharray="${i % 2 ? '4 14' : '40 16'}" opacity="${0.8 - i * 0.09}"/>`);
        return `<circle cx="${cx}" cy="${cy}" r="42" fill="${p.accent}" opacity="0.9"/>${rings}`;
    },
};

// index = how many generated covers this category already has, so stories in a category get different palettes
export async function generateCover(story: DemoStory, authorName: string, index: number) {
    const category = story.categories[0];
    const r = randomFrom(story.key);
    const palettes = PALETTES[category];
    const palette = palettes[index % palettes.length];
    const titleLines = wrapThai(story.title, 14, 4);
    const size = titleLines.length > 3 ? 56 : 64;
    const top = H - 170 - (titleLines.length - 1) * (size + 14);
    const title = titleLines.map((line, i) => `<text x="${W / 2}" y="${top + i * (size + 14)}" text-anchor="middle" font-size="${size}" font-weight="700" font-family="${FONT}" fill="${palette.ink}">${escapeXml(line)}</text>`).join('');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
        <defs>
            <linearGradient id="bg" x1="0" y1="0" x2="${(r() * 0.8).toFixed(2)}" y2="1"><stop offset="0" stop-color="${palette.from}"/><stop offset="1" stop-color="${palette.to}"/></linearGradient>
            <linearGradient id="shade" x1="0" y1="0" x2="0" y2="1"><stop offset="0.45" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.72"/></linearGradient>
        </defs>
        <rect width="${W}" height="${H}" fill="url(#bg)"/>
        ${PATTERNS[category](r, palette)}
        <rect width="${W}" height="${H}" fill="url(#shade)"/>
        <rect x="${W / 2 - 34}" y="${top - size - 26}" width="68" height="5" rx="2" fill="${palette.accent}"/>
        ${title}
        <text x="${W / 2}" y="${H - 62}" text-anchor="middle" font-size="26" font-family="${FONT}" fill="${palette.ink}" opacity="0.85">${escapeXml(authorName)}</text>
    </svg>`;
    return sharp(Buffer.from(svg)).jpeg({ quality: 86 }).toBuffer();
}

// One simple character: a coloured body and hair so the cast can be told apart, with a face looking at the reader
function character(x: number, base: number, size: number, body: string, hair: string, r: () => number) {
    const headY = base - size * 2.1, head = size * 0.62;
    return `<path d="M${x - size} ${base}C${x - size} ${base - size * 1.7} ${x + size} ${base - size * 1.7} ${x + size} ${base}Z" fill="${body}" stroke="#111827" stroke-width="4"/>
        <circle cx="${x}" cy="${headY}" r="${head}" fill="#fde7d3" stroke="#111827" stroke-width="4"/>
        <path d="M${x - head} ${headY}A${head} ${head} 0 0 1 ${x + head} ${headY}C${x + head * 0.4} ${headY - head * (0.1 + r() * 0.3)} ${x - head * 0.4} ${headY - head * 0.2} ${x - head} ${headY}Z" fill="${hair}" stroke="#111827" stroke-width="4"/>
        <circle cx="${x - head * 0.35}" cy="${headY + head * 0.2}" r="4" fill="#111827"/><circle cx="${x + head * 0.35}" cy="${headY + head * 0.2}" r="4" fill="#111827"/>
        <path d="M${x - 9} ${headY + head * 0.55}q9 ${r() < 0.5 ? 8 : -6} 18 0" fill="none" stroke="#111827" stroke-width="3"/>`;
}

// A comic page: three rows of panels, each with a backdrop, one or two characters and speech bubbles.
// Clearly placeholder art, but it reads as a comic and shows how the paged reader works.
export async function generateComicPage(story: DemoStory, episode: number, page: number) {
    const PW = 800, PH = 1200, M = 22, ROWS = 3;
    const category = story.categories[0];
    const r = randomFrom(`${story.key}:${episode}:${page}`);
    const cast = randomFrom(story.key);
    const palette = PALETTES[category][Math.floor(cast() * PALETTES[category].length)];
    const hero = { body: palette.from, hair: '#1f2937' };
    const friend = { body: palette.accent, hair: `hsl(${Math.floor(cast() * 360)} 45% 35%)` };
    const rowH = (PH - M * (ROWS + 1)) / ROWS;
    const lines = COMIC_LINES[category];
    let panels = '', clip = '';
    let n = 0;
    for (let row = 0; row < ROWS; row++) {
        const split = r() < 0.7 ? 0.38 + r() * 0.24 : 1;
        const y = M + row * (rowH + M);
        const inner = PW - M * 3;
        const cells = split === 1 ? [[M, PW - M * 2]] : [[M, inner * split], [M * 2 + inner * split, inner * (1 - split)]];
        for (const [x, w] of cells) {
            const id = `p${n++}`;
            const night = r() < 0.4;
            const sky = night ? palette.to : '#e5e7eb';
            const ground = y + rowH - 46;
            const skyline = repeat(Math.ceil(w / 60), (i) => {
                const h = 50 + r() * 130;
                return `<rect x="${x + i * 60}" y="${ground - h}" width="${44 + r() * 16}" height="${h}" fill="${night ? palette.from : '#cbd5e1'}" opacity="0.8"/>`;
            });
            const size = 62 + r() * 18;
            const two = w > 300 && r() < 0.75;
            const people = two
                ? character(x + w * 0.3, y + rowH + 8, size, hero.body, hero.hair, r) + character(x + w * 0.72, y + rowH + 8, size * 0.95, friend.body, friend.hair, r)
                : character(x + w * (0.35 + r() * 0.3), y + rowH + 8, size, hero.body, hero.hair, r);
            const say = lines[Math.floor(r() * lines.length)];
            const bw = Math.min(w - 36, 64 + [...say].length * 22), bx = x + 18 + r() * Math.max(0, w - bw - 36), by = y + 18;
            const tail = bx + bw / 2;
            const bubble = `<path d="M${tail - 14} ${by + 62}L${tail + 6} ${by + 98}L${tail + 20} ${by + 62}Z" fill="#fff" stroke="#111827" stroke-width="3"/>
                <rect x="${bx}" y="${by}" width="${bw}" height="70" rx="30" fill="#fff" stroke="#111827" stroke-width="3"/>
                <rect x="${tail - 12}" y="${by + 58}" width="30" height="9" fill="#fff"/>
                <text x="${bx + bw / 2}" y="${by + 45}" text-anchor="middle" font-size="27" font-family="${FONT}" fill="#111827">${escapeXml(say)}</text>`;
            clip += `<clipPath id="${id}"><rect x="${x}" y="${y}" width="${w}" height="${rowH}"/></clipPath>`;
            panels += `<g clip-path="url(#${id})"><rect x="${x}" y="${y}" width="${w}" height="${rowH}" fill="${sky}"/>${skyline}<rect x="${x}" y="${ground}" width="${w}" height="46" fill="${night ? '#111827' : '#94a3b8'}"/>${people}${bubble}</g>
                <rect x="${x}" y="${y}" width="${w}" height="${rowH}" fill="none" stroke="#111827" stroke-width="5"/>`;
        }
    }
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${PW}" height="${PH}"><defs>${clip}</defs><rect width="${PW}" height="${PH}" fill="#fff"/>${panels}</svg>`;
    return sharp(Buffer.from(svg)).jpeg({ quality: 80 }).toBuffer();
}

export async function generateSlip(amount: number) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="640"><rect width="480" height="640" fill="#f8fafc"/>
        <rect x="24" y="24" width="432" height="592" rx="20" fill="#fff" stroke="#cbd5e1" stroke-width="2"/>
        <text x="240" y="120" text-anchor="middle" font-size="32" font-weight="700" font-family="${FONT}" fill="#15803d">โอนเงินสำเร็จ</text>
        <text x="240" y="280" text-anchor="middle" font-size="60" font-weight="700" font-family="${FONT}" fill="#111827">${amount.toLocaleString()} บาท</text>
        <text x="240" y="500" text-anchor="middle" font-size="26" font-family="${FONT}" fill="#b91c1c">สลิปตัวอย่างสำหรับพรีเซนต์</text></svg>`;
    return sharp(Buffer.from(svg)).jpeg({ quality: 75 }).toBuffer();
}

// A picture from demo-covers/ or demo-data/photos/ at cover size. Throws on anything that isn't an image.
export const coverFromFile = (file: string) => sharp(file).resize(W, H, { fit: 'cover' }).jpeg({ quality: 84 }).toBuffer();
