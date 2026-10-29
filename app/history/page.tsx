import { redirect } from 'next/navigation';

// Reading history now lives in the "ประวัติการอ่าน" tab of your own profile (components/profile/HistoryTab.tsx)
export default function HistoryPage() {
    redirect('/profile?tab=history');
}
