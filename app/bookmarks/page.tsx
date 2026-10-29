import { redirect } from 'next/navigation';

// Bookmarks now live in the "บุ๊กมาร์ก" tab of your own profile (components/profile/BookmarksTab.tsx)
export default function BookmarksPage() {
    redirect('/profile?tab=bookmarks');
}
