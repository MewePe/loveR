import { redirect } from 'next/navigation';

// The writer profile form is the "ข้อมูลนักเขียน" tab of the author dashboard.
export default function LegacyWriterProfilePage() {
    redirect('/author');
}
