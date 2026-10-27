"use client";
import { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import { AlertCircle, Save, Upload } from 'lucide-react';
import { useToast } from '@/components/Toast';

// writer_profiles row from /api/author/profile (empty object if the user has none yet)
type WriterProfile = Record<string, string | null | undefined>;

// "ข้อมูลนักเขียน" tab: personal, bank and document details (POST /api/author/profile, multipart)
export default function WriterProfilePanel() {
    const toast = useToast();
    const [profile, setProfile] = useState<WriterProfile>({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [files, setFiles] = useState<{ id_card?: File, bank_book?: File }>({});
    const [previews, setPreviews] = useState<{ id_card?: string, bank_book?: string }>({});

    const fetchProfile = useCallback(async () => {
        try {
            const res = await fetch('/api/author/profile', { credentials: 'include' });
            if (res.ok) {
                const data = await res.json();
                setProfile(data);
                if (data.id_card_image) setPreviews(prev => ({ ...prev, id_card: data.id_card_image }));
                if (data.bank_book_image) setPreviews(prev => ({ ...prev, bank_book: data.bank_book_image }));
            }
        } catch (error) {
            console.error('Error fetching profile:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchProfile();
    }, [fetchProfile]);

    function handleProfileChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
        const { name, value } = e.target;
        setProfile((prev) => ({ ...prev, [name]: value }));
    }

    function handleFileChange(e: React.ChangeEvent<HTMLInputElement>, type: 'id_card' | 'bank_book') {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setFiles(prev => ({ ...prev, [type]: file }));
            setPreviews(prev => ({ ...prev, [type]: URL.createObjectURL(file) }));
        }
    }

    async function handleProfileSubmit(e: React.FormEvent) {
        e.preventDefault();
        setSaving(true);

        const formData = new FormData();
        Object.entries(profile).forEach(([key, value]) => {
            if (value != null && key !== 'id_card_image' && key !== 'bank_book_image') {
                formData.append(key, value);
            }
        });

        if (files.id_card) formData.append('id_card_image', files.id_card);
        if (files.bank_book) formData.append('bank_book_image', files.bank_book);

        try {
            const res = await fetch('/api/author/profile', {
                method: 'POST',
                body: formData,
                credentials: 'include',
            });

            if (res.ok) {
                toast.success('บันทึกข้อมูลสำเร็จ');
                fetchProfile();
            } else {
                toast.error('เกิดข้อผิดพลาดในการบันทึกข้อมูล');
            }
        } catch (error) {
            console.error(error);
            toast.error('เกิดข้อผิดพลาด');
        } finally {
            setSaving(false);
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
            </div>
        );
    }

    return (
        <div className="max-w-4xl">
            <h1 className="text-2xl font-bold mb-6 flex items-center gap-2 text-gray-900 dark:text-white">
                <span className="w-1 h-8 bg-indigo-600 rounded-full inline-block"></span>
                ข้อมูลนักเขียน
            </h1>

            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-8 flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-500" />
                <span className="text-yellow-800 dark:text-yellow-200 font-medium">
                    สถานะการลงทะเบียนนักเขียน : {profile.status === 'APPROVED' ? <span className="text-green-700 dark:text-green-400">อนุมัติแล้ว</span> : profile.status === 'REJECTED' ? <span className="text-red-700 dark:text-red-400">ถูกปฏิเสธ ({profile.rejection_reason})</span> : <span className="text-yellow-700 dark:text-yellow-400">ยังไม่ได้ลงทะเบียน / รอการตรวจสอบ</span>}
                </span>
            </div>

            <form onSubmit={handleProfileSubmit} className="space-y-8">
                {/* Personal Info */}
                <section className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border dark:border-gray-700">
                    <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white flex items-center gap-2">
                        📋 ข้อมูลส่วนบุคคล
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium mb-1 dark:text-gray-300">คำนำหน้า*</label>
                            <select name="title" value={profile.title || ''} onChange={handleProfileChange} className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white">
                                <option value="">เลือก</option>
                                <option value="นาย">นาย</option>
                                <option value="นาง">นาง</option>
                                <option value="นางสาว">นางสาว</option>
                            </select>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium mb-1 dark:text-gray-300">ชื่อ*</label>
                                <input type="text" name="first_name" value={profile.first_name || ''} onChange={handleProfileChange} className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1 dark:text-gray-300">นามสกุล*</label>
                                <input type="text" name="last_name" value={profile.last_name || ''} onChange={handleProfileChange} className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                            </div>
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium mb-1 dark:text-gray-300">หมายเลขบัตรประชาชน*</label>
                            <input type="text" name="id_card_number" value={profile.id_card_number || ''} onChange={handleProfileChange} className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium mb-1 dark:text-gray-300">ที่อยู่ตามบัตรประชาชน*</label>
                            <textarea name="address" value={profile.address || ''} onChange={handleProfileChange} rows={3} className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"></textarea>
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1 dark:text-gray-300">จังหวัด*</label>
                            <input type="text" name="province" value={profile.province || ''} onChange={handleProfileChange} className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1 dark:text-gray-300">อำเภอ/เขต*</label>
                            <input type="text" name="district" value={profile.district || ''} onChange={handleProfileChange} className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1 dark:text-gray-300">ตำบล/แขวง*</label>
                            <input type="text" name="sub_district" value={profile.sub_district || ''} onChange={handleProfileChange} className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1 dark:text-gray-300">รหัสไปรษณีย์*</label>
                            <input type="text" name="postal_code" value={profile.postal_code || ''} onChange={handleProfileChange} className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1 dark:text-gray-300">เบอร์โทรศัพท์*</label>
                            <input type="text" name="phone_number" value={profile.phone_number || ''} onChange={handleProfileChange} className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                        </div>
                    </div>
                </section>

                {/* Bank Info */}
                <section className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border dark:border-gray-700">
                    <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white flex items-center gap-2">
                        🏦 ข้อมูลบัญชีธนาคาร
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium mb-1 dark:text-gray-300">ชื่อธนาคาร*</label>
                            <select name="bank_name" value={profile.bank_name || ''} onChange={handleProfileChange} className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white">
                                <option value="">เลือกธนาคาร</option>
                                <option value="kbank">กสิกรไทย</option>
                                <option value="scb">ไทยพาณิชย์</option>
                                <option value="bbl">กรุงเทพ</option>
                                <option value="ktb">กรุงไทย</option>
                                <option value="ttb">ทีทีบี</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1 dark:text-gray-300">เลขที่บัญชีธนาคาร*</label>
                            <input type="text" name="bank_account_number" value={profile.bank_account_number || ''} onChange={handleProfileChange} className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1 dark:text-gray-300">ชื่อบัญชีธนาคาร*</label>
                            <input type="text" name="bank_account_name" value={profile.bank_account_name || ''} onChange={handleProfileChange} className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                        </div>
                    </div>
                </section>

                {/* Uploads */}
                <section className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border dark:border-gray-700">
                    <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white flex items-center gap-2">
                        📂 อัปโหลดเอกสาร
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* ID Card */}
                        <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-6 text-center hover:bg-gray-50 dark:hover:bg-gray-700/50 transition relative">
                            <input
                                type="file"
                                accept="image/*"
                                onChange={(e) => handleFileChange(e, 'id_card')}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            />
                            {previews.id_card ? (
                                <div className="relative h-40 w-full mb-2">
                                    <Image src={previews.id_card} alt="สำเนาบัตรประชาชน" fill unoptimized className="object-contain rounded-lg" />
                                </div>
                            ) : (
                                <Upload className="w-10 h-10 text-gray-500 dark:text-gray-400 mx-auto mb-2" />
                            )}
                            <p className="font-medium text-gray-700 dark:text-gray-300">สำเนาบัตรประชาชน*</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">.jpg .png .webp .gif ขนาดไม่เกิน 10MB</p>
                        </div>

                        {/* Bank Book */}
                        <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-6 text-center hover:bg-gray-50 dark:hover:bg-gray-700/50 transition relative">
                            <input
                                type="file"
                                accept="image/*"
                                onChange={(e) => handleFileChange(e, 'bank_book')}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            />
                            {previews.bank_book ? (
                                <div className="relative h-40 w-full mb-2">
                                    <Image src={previews.bank_book} alt="สำเนาบัญชีธนาคาร" fill unoptimized className="object-contain rounded-lg" />
                                </div>
                            ) : (
                                <Upload className="w-10 h-10 text-gray-500 dark:text-gray-400 mx-auto mb-2" />
                            )}
                            <p className="font-medium text-gray-700 dark:text-gray-300">สำเนาบัญชีธนาคาร*</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">.jpg .png .webp .gif ขนาดไม่เกิน 10MB</p>
                        </div>
                    </div>
                </section>

                <div className="flex justify-center pt-4">
                    <button
                        type="submit"
                        disabled={saving}
                        className="flex items-center gap-2 bg-indigo-600 text-white px-8 py-3 rounded-full font-bold hover:bg-indigo-700 transition shadow-lg disabled:opacity-50"
                    >
                        <Save className="w-5 h-5" />
                        {saving ? 'กำลังบันทึก...' : 'บันทึกข้อมูล'}
                    </button>
                </div>
            </form>
        </div>
    );
}
