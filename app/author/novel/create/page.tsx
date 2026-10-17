import { redirect } from 'next/navigation';

// Novels are created from the "นิยายของฉัน" tab of the author dashboard
export default function CreateNovelRedirect() {
    redirect('/author');
}
