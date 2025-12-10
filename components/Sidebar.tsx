"use client";
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const links = [
    { href: '/author/dashboard', label: 'Dashboard', icon: '📊' },
    { href: '/author/novels', label: 'My Novels', icon: '📚' },
    { href: '/author/comics', label: 'My Comics', icon: '🎨' },
    { href: '/author/analytics', label: 'Analytics', icon: '📈' },
];

export default function Sidebar() {
    const pathname = usePathname();

    return (
        <aside className="w-64 bg-white dark:bg-gray-900 border-r dark:border-gray-800 hidden md:flex flex-col h-[calc(100vh-64px)] sticky top-16">
            <div className="p-6">
                <h2 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Writer Studio</h2>
            </div>
            <nav className="flex-1 px-4 space-y-1">
                {links.map((link) => {
                    const isActive = pathname === link.href;
                    return (
                        <Link
                            key={link.href}
                            href={link.href}
                            className={`flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition ${isActive
                                ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400'
                                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-indigo-600 dark:hover:text-indigo-400'
                                }`}
                        >
                            <span>{link.icon}</span>
                            {link.label}
                        </Link>
                    );
                })}
            </nav>
            <div className="p-4 border-t dark:border-gray-800">
                <Link href="/" className="flex items-center gap-3 px-4 py-3 text-gray-500 dark:text-gray-400 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 text-sm">
                    &larr; Back to Home
                </Link>
            </div>
        </aside>
    );
}
