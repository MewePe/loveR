"use client";
import Link from 'next/link';
import { useSession, signIn, signOut } from 'next-auth/react';
import { useState, useEffect } from 'react';
import { Home, Search, Bookmark, Coins, History } from 'lucide-react';
import ThemeToggle from './ThemeToggle';

interface UserProfile {
    name: string;
    image: string | null;
    role: string;
    coins: number;
}

export default function Navbar() {
    const { data: session, status } = useSession();
    const [isOpen, setIsOpen] = useState(false);
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

    useEffect(() => {
        if (status === 'authenticated') {
            fetchProfile();
        }
    }, [status]);

    async function fetchProfile() {
        try {
            const res = await fetch('/api/profile', { credentials: 'include' });
            if (res.ok) {
                const data = await res.json();
                setUserProfile({
                    name: data.user.name,
                    image: data.user.image,
                    role: data.user.role,
                    coins: data.user.coins ?? 0
                });
            }
        } catch (error) {
            console.error(error);
        }
    }

    // Use profile data if available, otherwise fallback to session
    const displayName = userProfile?.name || session?.user?.name || 'User';
    const displayImage = userProfile?.image || session?.user?.image || `https://ui-avatars.com/api/?name=${displayName}`;
    const displayRole = userProfile?.role || session?.user?.role || 'READER';

    return (
        <nav className="bg-white dark:bg-gray-900 shadow-sm border-b dark:border-gray-800 sticky top-0 z-50">
            <div className="container mx-auto px-4">
                <div className="flex justify-between items-center h-16">
                    {/* Logo */}
                    <Link href="/" className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
                        LoveRead
                    </Link>

                    {/* Desktop Menu */}
                    <div className="hidden md:flex items-center space-x-6">
                        <Link href="/" className="flex items-center gap-1 text-gray-600 hover:text-indigo-600 dark:text-gray-300 dark:hover:text-indigo-400 font-medium"><Home className="w-4 h-4" /> Home</Link>
                        <Link href="/search" className="flex items-center gap-1 text-gray-600 hover:text-indigo-600 dark:text-gray-300 dark:hover:text-indigo-400 font-medium"><Search className="w-4 h-4" /> </Link>

                        <div className="flex items-center gap-4">
                            <ThemeToggle />
                            {session ? (
                                <div className="relative">
                                    <button
                                        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                                        className="flex items-center space-x-2 text-gray-700 hover:text-indigo-600 dark:text-gray-200 dark:hover:text-indigo-400 focus:outline-none"
                                    >
                                        <img
                                            src={displayImage}
                                            alt="Profile"
                                            className="w-8 h-8 rounded-full object-cover"
                                        />
                                        <span className="font-medium">{displayName} ({displayRole})</span>
                                    </button>

                                    {/* Dropdown */}
                                    {isDropdownOpen && (
                                        <>
                                            <div
                                                className="fixed inset-0 z-10"
                                                onClick={() => setIsDropdownOpen(false)}
                                            />
                                            <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-md shadow-lg py-1 border dark:border-gray-700 z-20">
                                                <Link
                                                    href="/profile"
                                                    className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                                                    onClick={() => setIsDropdownOpen(false)}
                                                >
                                                    โปรไฟล์
                                                </Link>
                                                <Link
                                                    href="/bookmarks"
                                                    className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                                                    onClick={() => setIsDropdownOpen(false)}
                                                >
                                                    <Bookmark className="w-4 h-4 text-yellow-500" />
                                                    ชั้นหนังสือ
                                                </Link>
                                                <Link
                                                    href="/history"
                                                    className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                                                    onClick={() => setIsDropdownOpen(false)}
                                                >
                                                    <History className="w-4 h-4 text-blue-500" />
                                                    ประวัติการอ่าน
                                                </Link>
                                                <Link
                                                    href="/coins"
                                                    className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                                                    onClick={() => setIsDropdownOpen(false)}
                                                >
                                                    <Coins className="w-4 h-4 text-amber-500" />
                                                    เหรียญ ({userProfile?.coins ?? 0})
                                                </Link>
                                                {(displayRole === 'AUTHOR' || displayRole === 'ADMIN') && (
                                                    <Link
                                                        href="/author"
                                                        className="block px-4 py-2 text-sm text-indigo-600 dark:text-indigo-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                                                        onClick={() => setIsDropdownOpen(false)}
                                                    >
                                                        หน้านักเขียน
                                                    </Link>
                                                )}
                                                {displayRole === 'ADMIN' && (
                                                    <Link
                                                        href="/admin"
                                                        className="block px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                                                        onClick={() => setIsDropdownOpen(false)}
                                                    >
                                                        แอดมิน
                                                    </Link>
                                                )}
                                                <button
                                                    onClick={() => {
                                                        setIsDropdownOpen(false);
                                                        signOut();
                                                    }}
                                                    className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                                                >
                                                    ออกจากระบบ
                                                </button>
                                            </div>
                                        </>
                                    )}
                                </div>
                            ) : (
                                <div className="space-x-4">
                                    <button onClick={() => signIn()} className="text-gray-600 hover:text-indigo-600 dark:text-gray-300 dark:hover:text-indigo-400 font-medium">เข้าสู่ระบบ</button>
                                    <Link href="/register" className="bg-indigo-600 text-white px-4 py-2 rounded-full font-medium hover:bg-indigo-700 transition">
                                        สมัครสมาชิก
                                    </Link>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Mobile Menu Button */}
                    <div className="md:hidden flex items-center gap-2">
                        <ThemeToggle />
                        <button onClick={() => setIsOpen(!isOpen)} className="text-gray-600 dark:text-gray-300 focus:outline-none">
                            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={isOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"} />
                            </svg>
                        </button>
                    </div>
                </div>
            </div>

            {/* Mobile Menu */}
            {isOpen && (
                <div className="md:hidden bg-white dark:bg-gray-900 border-t dark:border-gray-800">
                    <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
                        <Link href="/" className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 dark:text-gray-200 hover:text-indigo-600 hover:bg-gray-50 dark:hover:bg-gray-800">Home</Link>
                        <Link href="/search" className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 dark:text-gray-200 hover:text-indigo-600 hover:bg-gray-50 dark:hover:bg-gray-800">Browse</Link>
                        {session ? (
                            <>
                                <div className="flex items-center gap-3 px-3 py-2 border-t dark:border-gray-700 mt-2 pt-4">
                                    <img src={displayImage} alt="Profile" className="w-10 h-10 rounded-full object-cover" />
                                    <div>
                                        <p className="font-medium text-gray-900 dark:text-white">{displayName}</p>
                                        <p className="text-sm text-gray-500 dark:text-gray-400">{displayRole}</p>
                                    </div>
                                </div>
                                <Link href="/profile" className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 dark:text-gray-200 hover:text-indigo-600 hover:bg-gray-50 dark:hover:bg-gray-800">โปรไฟล์</Link>
                                <Link href="/bookmarks" className="flex items-center gap-2 px-3 py-2 rounded-md text-base font-medium text-gray-700 dark:text-gray-200 hover:text-indigo-600 hover:bg-gray-50 dark:hover:bg-gray-800"><Bookmark className="w-4 h-4 text-yellow-500" />ชั้นหนังสือ</Link>
                                <Link href="/history" className="flex items-center gap-2 px-3 py-2 rounded-md text-base font-medium text-gray-700 dark:text-gray-200 hover:text-indigo-600 hover:bg-gray-50 dark:hover:bg-gray-800"><History className="w-4 h-4 text-blue-500" />ประวัติการอ่าน</Link>
                                <Link href="/coins" className="flex items-center gap-2 px-3 py-2 rounded-md text-base font-medium text-gray-700 dark:text-gray-200 hover:text-indigo-600 hover:bg-gray-50 dark:hover:bg-gray-800"><Coins className="w-4 h-4 text-amber-500" />เหรียญ ({userProfile?.coins ?? 0})</Link>
                                {(displayRole === 'AUTHOR' || displayRole === 'ADMIN') && (
                                    <Link href="/author" className="block px-3 py-2 rounded-md text-base font-medium text-indigo-600 dark:text-indigo-400 hover:bg-gray-50 dark:hover:bg-gray-800">หน้านักเขียน</Link>
                                )}
                                <button onClick={() => signOut()} className="block w-full text-left px-3 py-2 rounded-md text-base font-medium text-gray-700 dark:text-gray-200 hover:text-indigo-600 hover:bg-gray-50 dark:hover:bg-gray-800">ออกจากระบบ</button>
                            </>
                        ) : (
                            <button onClick={() => signIn()} className="block w-full text-left px-3 py-2 rounded-md text-base font-medium text-indigo-600 hover:bg-gray-50 dark:hover:bg-gray-800">เข้าสู่ระบบ</button>
                        )}
                    </div>
                </div>
            )}
        </nav>
    );
}

