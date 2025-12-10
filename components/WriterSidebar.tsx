"use client";
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, BookOpen, DollarSign, Wallet, User, LogOut } from 'lucide-react';
import { signOut } from 'next-auth/react';

const menuItems = [
    { name: 'ภาพรวมนักเขียน', href: '/author/dashboard', icon: LayoutDashboard },
    { name: 'นิยายของฉัน', href: '/author/novels', icon: BookOpen },
    { name: 'รายได้ของฉัน', href: '/author/earnings', icon: DollarSign },
    { name: 'กระเป๋าเงินนักเขียน', href: '/author/wallet', icon: Wallet },
    { name: 'ข้อมูลนักเขียน', href: '/author/profile', icon: User },
];

export default function WriterSidebar() {
    const pathname = usePathname();

    return (
        <div className="w-64 bg-white dark:bg-gray-800 h-screen shadow-md flex flex-col fixed left-0 top-0 z-40">
            <div className="p-6 flex items-center gap-3 border-b dark:border-gray-700">
                <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold">
                    W
                </div>
                <span className="text-xl font-bold text-gray-800 dark:text-white">Writer Center</span>
            </div>

            <nav className="flex-1 p-4 space-y-2">
                {menuItems.map((item) => {
                    const isActive = pathname === item.href;
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${isActive
                                    ? 'bg-indigo-600 text-white'
                                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                                }`}
                        >
                            <item.icon className="w-5 h-5" />
                            <span className="font-medium">{item.name}</span>
                        </Link>
                    );
                })}
            </nav>

            <div className="p-4 border-t dark:border-gray-700">
                <button
                    onClick={() => signOut({ callbackUrl: '/' })}
                    className="flex items-center gap-3 px-4 py-3 w-full text-left text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                >
                    <LogOut className="w-5 h-5" />
                    <span className="font-medium">ออกจากระบบ</span>
                </button>
            </div>
        </div>
    );
}
