import { redirect } from 'next/navigation';

// Admin tools live in the tabbed dashboard at /admin; this old standalone page was a duplicate.
export default function LegacyAdminPage() {
    redirect('/admin');
}
