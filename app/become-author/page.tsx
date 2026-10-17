"use client";
import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { FileText, Send, CheckCircle, AlertCircle, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function BecomeAuthorPage() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [existingRequest, setExistingRequest] = useState<any>(null);
    const [reapplying, setReapplying] = useState(false);
    const [formData, setFormData] = useState({
        prefix: 'นาย',
        firstName: '',
        lastName: '',
        idCardNumber: '',
        address: '',
        province: '',
        district: '',
        subDistrict: '',
        postalCode: '',
        phone: ''
    });

    useEffect(() => {
        if (status === 'unauthenticated') {
            router.push('/login');
        } else if (status === 'authenticated') {
            checkExistingRequest();
        }
    }, [status]);

    async function checkExistingRequest() {
        setLoading(true);
        try {
            const res = await fetch('/api/author/profile', { credentials: 'include' });
            if (res.ok) {
                const data = await res.json();
                if (data.status) {
                    setExistingRequest(data);
                    setReapplying(false);
                    // Prefill the form so a rejected applicant can fix and resubmit
                    setFormData({
                        prefix: data.title || 'นาย',
                        firstName: data.first_name || '',
                        lastName: data.last_name || '',
                        idCardNumber: data.id_card_number || '',
                        address: data.address || '',
                        province: data.province || '',
                        district: data.district || '',
                        subDistrict: data.sub_district || '',
                        postalCode: data.postal_code || '',
                        phone: data.phone_number || ''
                    });
                }
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setSubmitting(true);

        try {
            const body = new FormData();
            body.append('title', formData.prefix);
            body.append('first_name', formData.firstName);
            body.append('last_name', formData.lastName);
            body.append('id_card_number', formData.idCardNumber);
            body.append('address', formData.address);
            body.append('province', formData.province);
            body.append('district', formData.district);
            body.append('sub_district', formData.subDistrict);
            body.append('postal_code', formData.postalCode);
            body.append('phone_number', formData.phone);

            const res = await fetch('/api/author/profile', {
                method: 'POST',
                body,
                credentials: 'include'
            });

            if (res.ok) {
                alert('ส่งคำขอเรียบร้อย! กรุณารอการอนุมัติจากแอดมิน');
                checkExistingRequest();
            } else {
                const data = await res.json();
                alert(data.error || 'เกิดข้อผิดพลาด');
            }
        } catch (error) {
            console.error(error);
            alert('เกิดข้อผิดพลาด');
        } finally {
            setSubmitting(false);
        }
    }

    if (status === 'loading' || loading) {
        return (
            <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
            </div>
        );
    }

    // Already an author
    if (session?.user?.role === 'AUTHOR' || session?.user?.role === 'ADMIN') {
        return (
            <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8 max-w-md text-center">
                    <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
                        <CheckCircle className="w-10 h-10 text-green-600" />
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">คุณเป็นนักเขียนแล้ว!</h1>
                    <p className="text-gray-600 dark:text-gray-400 mb-6">คุณสามารถเริ่มสร้างนิยายและการ์ตูนได้เลย</p>
                    <Link href="/author" className="block w-full bg-indigo-600 text-white py-3 rounded-lg font-medium hover:bg-indigo-700 transition">
                        ไปหน้านักเขียน
                    </Link>
                </div>
            </div>
        );
    }

    // Has existing request
    if (existingRequest && !reapplying) {
        const statusColors: any = {
            PENDING: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300',
            APPROVED: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',
            REJECTED: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
        };
        const statusText: any = {
            PENDING: 'รอการอนุมัติ',
            APPROVED: 'อนุมัติแล้ว',
            REJECTED: 'ไม่อนุมัติ'
        };

        return (
            <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8 max-w-md text-center">
                    <div className={`w-20 h-20 ${existingRequest.status === 'PENDING' ? 'bg-yellow-100 dark:bg-yellow-900/30' : existingRequest.status === 'APPROVED' ? 'bg-green-100 dark:bg-green-900/30' : 'bg-red-100 dark:bg-red-900/30'} rounded-full flex items-center justify-center mx-auto mb-6`}>
                        {existingRequest.status === 'PENDING' ? (
                            <AlertCircle className="w-10 h-10 text-yellow-600" />
                        ) : existingRequest.status === 'APPROVED' ? (
                            <CheckCircle className="w-10 h-10 text-green-600" />
                        ) : (
                            <AlertCircle className="w-10 h-10 text-red-600" />
                        )}
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">สถานะคำขอ</h1>
                    <span className={`inline-block px-4 py-2 rounded-full text-sm font-medium ${statusColors[existingRequest.status]}`}>
                        {statusText[existingRequest.status]}
                    </span>
                    {existingRequest.rejection_reason && (
                        <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg text-left">
                            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">หมายเหตุจากแอดมิน:</p>
                            <p className="text-gray-700 dark:text-gray-300">{existingRequest.rejection_reason}</p>
                        </div>
                    )}
                    <p className="text-gray-600 dark:text-gray-400 mt-6 text-sm">
                        ส่งเมื่อ: {new Date(existingRequest.updated_at || existingRequest.created_at).toLocaleDateString('th-TH')}
                    </p>
                    {existingRequest.status === 'REJECTED' && (
                        <button
                            onClick={() => setReapplying(true)}
                            className="block w-full bg-indigo-600 text-white py-3 rounded-lg font-medium hover:bg-indigo-700 transition mt-6"
                        >
                            แก้ไขข้อมูลและส่งคำขอใหม่
                        </button>
                    )}
                    <Link href="/" className="block w-full border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 py-3 rounded-lg font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition mt-6">
                        กลับหน้าแรก
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12">
            <div className="container mx-auto px-4 max-w-2xl">
                {/* Header */}
                <div className="mb-8">
                    <Link href="/" className="inline-flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-indigo-600 mb-4">
                        <ArrowLeft className="w-4 h-4" />
                        กลับหน้าแรก
                    </Link>
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white">สมัครเป็นนักเขียน</h1>
                    <p className="text-gray-600 dark:text-gray-400 mt-2">กรอกข้อมูลเพื่อส่งคำขอเป็นนักเขียนบน LoveRead</p>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border dark:border-gray-700 p-6">
                    <div className="flex items-center gap-3 mb-6 pb-4 border-b dark:border-gray-700">
                        <FileText className="w-6 h-6 text-indigo-600" />
                        <h2 className="text-lg font-bold text-gray-900 dark:text-white">ข้อมูลส่วนตัว</h2>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">คำนำหน้า*</label>
                            <select
                                required
                                value={formData.prefix}
                                onChange={(e) => setFormData({ ...formData, prefix: e.target.value })}
                                className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                            >
                                <option value="นาย">นาย</option>
                                <option value="นาง">นาง</option>
                                <option value="นางสาว">นางสาว</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">ชื่อ*</label>
                            <input
                                type="text"
                                required
                                value={formData.firstName}
                                onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                                className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                                placeholder="ชื่อจริง"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">นามสกุล*</label>
                            <input
                                type="text"
                                required
                                value={formData.lastName}
                                onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                                className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                                placeholder="นามสกุล"
                            />
                        </div>
                    </div>

                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">หมายเลขบัตรประชาชน*</label>
                        <input
                            type="text"
                            required
                            maxLength={13}
                            value={formData.idCardNumber}
                            onChange={(e) => setFormData({ ...formData, idCardNumber: e.target.value.replace(/\D/g, '') })}
                            className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                            placeholder="1234567890123"
                        />
                    </div>

                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">ที่อยู่ตามบัตรประชาชน*</label>
                        <textarea
                            required
                            rows={3}
                            value={formData.address}
                            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                            className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
                            placeholder="บ้านเลขที่ หมู่ ซอย ถนน"
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">จังหวัด*</label>
                            <input
                                type="text"
                                required
                                value={formData.province}
                                onChange={(e) => setFormData({ ...formData, province: e.target.value })}
                                className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                                placeholder="จังหวัด"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">อำเภอ/เขต*</label>
                            <input
                                type="text"
                                required
                                value={formData.district}
                                onChange={(e) => setFormData({ ...formData, district: e.target.value })}
                                className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                                placeholder="อำเภอ/เขต"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">ตำบล/แขวง*</label>
                            <input
                                type="text"
                                required
                                value={formData.subDistrict}
                                onChange={(e) => setFormData({ ...formData, subDistrict: e.target.value })}
                                className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                                placeholder="ตำบล/แขวง"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">รหัสไปรษณีย์*</label>
                            <input
                                type="text"
                                required
                                maxLength={5}
                                value={formData.postalCode}
                                onChange={(e) => setFormData({ ...formData, postalCode: e.target.value.replace(/\D/g, '') })}
                                className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                                placeholder="10110"
                            />
                        </div>
                    </div>

                    <div className="mb-6">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">เบอร์โทรศัพท์*</label>
                        <input
                            type="tel"
                            required
                            maxLength={10}
                            value={formData.phone}
                            onChange={(e) => setFormData({ ...formData, phone: e.target.value.replace(/\D/g, '') })}
                            className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                            placeholder="0812345678"
                        />
                    </div>

                    <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-6">
                        <p className="text-sm text-yellow-800 dark:text-yellow-300">
                            <strong>หมายเหตุ:</strong> ข้อมูลของคุณจะถูกเก็บเป็นความลับและใช้เพื่อการยืนยันตัวตนเท่านั้น
                        </p>
                    </div>

                    <button
                        type="submit"
                        disabled={submitting}
                        className="w-full bg-indigo-600 text-white py-3 rounded-lg font-medium hover:bg-indigo-700 transition flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                        <Send className="w-5 h-5" />
                        {submitting ? 'กำลังส่ง...' : 'ส่งคำขอ'}
                    </button>
                </form>
            </div>
        </div>
    );
}
