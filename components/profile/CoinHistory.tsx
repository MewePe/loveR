import Link from 'next/link';
import AuthorLink from '@/components/AuthorLink';

// The coin history lists from /api/coins: top-ups, chapters/episodes bought, supports sent.
// Used by /coins and the "กระเป๋าเหรียญ" tab of your own profile.
export interface Topup { id: string; amount: number; status: string; rejection_reason: string | null; created_at: string; }
export interface SupportSent { id: string; amount: number; message: string | null; created_at: string; author_id: string; author_name: string | null; author_username: string | null; }
export interface Purchase { id: string; item_title: string; price: number; created_at: string; chapter_id: string | null; episode_id: string | null; comic_id: string | null; }

const statusText: Record<string, string> = { PENDING: 'รอตรวจสอบ', APPROVED: 'สำเร็จ', REJECTED: 'ไม่อนุมัติ' };
const statusColors: Record<string, string> = {
    PENDING: 'text-yellow-700 dark:text-yellow-400',
    APPROVED: 'text-green-700 dark:text-green-400',
    REJECTED: 'text-red-600 dark:text-red-400',
};

function Section({ title, empty, children, bare }: { title: string; empty: boolean; children: React.ReactNode; bare?: boolean }) {
    return (
        <section className={bare ? '' : 'bg-white dark:bg-gray-800 rounded-xl shadow-sm border dark:border-gray-700 p-6'}>
            <h2 className={`font-bold text-gray-900 dark:text-white mb-3 ${bare ? 'text-base' : 'text-lg'}`}>{title}</h2>
            {empty ? <p className="text-gray-500 dark:text-gray-400 text-sm">ยังไม่มีรายการ</p> : <ul className="divide-y dark:divide-gray-700">{children}</ul>}
        </section>
    );
}

// `bare`: no card around each list (inside another card, e.g. the profile tab)
export default function CoinHistory({ topups, purchases, supports, bare = false }: {
    topups: Topup[]; purchases: Purchase[]; supports: SupportSent[]; bare?: boolean;
}) {
    return (
        <>
            <Section title="ประวัติการเติมเหรียญ" empty={topups.length === 0} bare={bare}>
                {topups.map((t) => (
                    <li key={t.id} className="py-3 flex justify-between gap-4 text-sm">
                        <span className="text-gray-600 dark:text-gray-300">{new Date(t.created_at).toLocaleString('th-TH')}</span>
                        <span className="text-right">
                            <span className="font-semibold text-gray-900 dark:text-white">+{t.amount}</span>{' '}
                            <span className={statusColors[t.status]}>{statusText[t.status] ?? t.status}</span>
                            {t.rejection_reason && <span className="block text-xs text-gray-500 dark:text-gray-400">{t.rejection_reason}</span>}
                        </span>
                    </li>
                ))}
            </Section>

            <Section title="ตอนที่ซื้อแล้ว" empty={purchases.length === 0} bare={bare}>
                {purchases.map((p) => {
                    const href = p.chapter_id ? `/read/${p.chapter_id}` : p.episode_id && p.comic_id ? `/comic/${p.comic_id}/read/${p.episode_id}` : null;
                    return (
                        <li key={p.id} className="py-3 flex justify-between gap-4 text-sm">
                            <span className="min-w-0 text-gray-700 dark:text-gray-200">
                                {href ? <Link href={href} className="hover:text-indigo-600 break-words">{p.item_title}</Link> : <span className="text-gray-500 dark:text-gray-400">{p.item_title} (ถูกลบแล้ว)</span>}
                                <span className="block text-xs text-gray-500 dark:text-gray-400">{new Date(p.created_at).toLocaleString('th-TH')}</span>
                            </span>
                            <span className="font-semibold text-gray-900 dark:text-white">-{p.price}</span>
                        </li>
                    );
                })}
            </Section>

            <Section title="เหรียญที่ส่งสนับสนุนนักเขียน" empty={supports.length === 0} bare={bare}>
                {supports.map((s) => (
                    <li key={s.id} className="py-3 flex justify-between gap-4 text-sm">
                        <span className="min-w-0 text-gray-700 dark:text-gray-200">
                            สนับสนุน <AuthorLink id={s.author_id} username={s.author_username} name={s.author_name} className="font-medium text-gray-900 dark:text-white" />
                            {s.message && <span className="block text-gray-600 dark:text-gray-300 break-words">&ldquo;{s.message}&rdquo;</span>}
                            <span className="block text-xs text-gray-500 dark:text-gray-400">{new Date(s.created_at).toLocaleString('th-TH')}</span>
                        </span>
                        <span className="font-semibold text-gray-900 dark:text-white">-{s.amount}</span>
                    </li>
                ))}
            </Section>
        </>
    );
}
