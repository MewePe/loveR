"use client";
import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { CheckCircle, XCircle, Eye } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';

interface WriterRequest {
    user_id: string;
    first_name: string;
    last_name: string;
    email: string;
    id_card_number: string;
    phone_number: string;
    id_card_image: string;
    bank_book_image: string;
    created_at: string;
}

export default function AdminWriters() {
    const { data: session } = useSession();
    const [requests, setRequests] = useState<WriterRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedRequest, setSelectedRequest] = useState<WriterRequest | null>(null);

    useEffect(() => {
        if (session?.user?.role !== 'ADMIN') return;
        fetchRequests();
    }, [session]);

    async function fetchRequests() {
        try {
            const res = await fetch('/api/admin/writers');
            if (res.ok) {
                const data = await res.json();
                setRequests(data);
            }
        } finally {
            setLoading(false);
        }
    }

    async function handleAction(id: string, status: 'APPROVED' | 'REJECTED') {
        const reason = status === 'REJECTED' ? prompt('Enter rejection reason:') : null;
        if (status === 'REJECTED' && !reason) return;

        try {
            const res = await fetch(`/api/admin/writers/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status, reason }),
            });

            if (res.ok) {
                alert(`Request ${status.toLowerCase()} successfully`);
                fetchRequests();
                setSelectedRequest(null);
            } else {
                alert('Failed to update request');
            }
        } catch (error) {
            console.error(error);
        }
    }

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
            <div className="max-w-6xl mx-auto">
                <div className="flex justify-between items-center mb-8">
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Writer Registration Requests</h1>
                    <Link href="/admin" className="text-indigo-600 hover:underline">Back to Dashboard</Link>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border dark:border-gray-700 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-gray-50 dark:bg-gray-900/50 text-gray-500 dark:text-gray-400 text-xs uppercase">
                                <tr>
                                    <th className="px-6 py-3">Name</th>
                                    <th className="px-6 py-3">Email</th>
                                    <th className="px-6 py-3">Phone</th>
                                    <th className="px-6 py-3">Date</th>
                                    <th className="px-6 py-3 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y dark:divide-gray-700">
                                {requests.map((req) => (
                                    <tr key={req.user_id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                        <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">
                                            {req.first_name} {req.last_name}
                                        </td>
                                        <td className="px-6 py-4 text-gray-500 dark:text-gray-400">
                                            {req.email}
                                        </td>
                                        <td className="px-6 py-4 text-gray-500 dark:text-gray-400">
                                            {req.phone_number}
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                                            {new Date(req.created_at).toLocaleDateString()}
                                        </td>
                                        <td className="px-6 py-4 text-right space-x-2">
                                            <button
                                                onClick={() => setSelectedRequest(req)}
                                                className="text-gray-400 hover:text-blue-600 transition"
                                                title="View Details"
                                            >
                                                <Eye className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => handleAction(req.user_id, 'APPROVED')}
                                                className="text-gray-400 hover:text-green-600 transition"
                                                title="Approve"
                                            >
                                                <CheckCircle className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => handleAction(req.user_id, 'REJECTED')}
                                                className="text-gray-400 hover:text-red-600 transition"
                                                title="Reject"
                                            >
                                                <XCircle className="w-4 h-4" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                {requests.length === 0 && !loading && (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                                            No pending requests.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Detail Modal */}
                {selectedRequest && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                        <div className="bg-white dark:bg-gray-800 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
                            <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">Request Details</h2>
                            <div className="grid grid-cols-2 gap-4 mb-6">
                                <div>
                                    <label className="text-sm text-gray-500">ID Card Number</label>
                                    <div className="font-medium dark:text-white">{selectedRequest.id_card_number}</div>
                                </div>
                                <div>
                                    <label className="text-sm text-gray-500">Phone</label>
                                    <div className="font-medium dark:text-white">{selectedRequest.phone_number}</div>
                                </div>
                                <div className="col-span-2">
                                    <label className="text-sm text-gray-500">ID Card Image</label>
                                    <div className="relative h-48 w-full mt-2 bg-gray-100 dark:bg-gray-900 rounded-lg">
                                        {selectedRequest.id_card_image ? (
                                            <Image src={selectedRequest.id_card_image} alt="ID Card" fill className="object-contain" />
                                        ) : (
                                            <div className="flex items-center justify-center h-full text-gray-400">No Image</div>
                                        )}
                                    </div>
                                </div>
                                <div className="col-span-2">
                                    <label className="text-sm text-gray-500">Bank Book Image</label>
                                    <div className="relative h-48 w-full mt-2 bg-gray-100 dark:bg-gray-900 rounded-lg">
                                        {selectedRequest.bank_book_image ? (
                                            <Image src={selectedRequest.bank_book_image} alt="Bank Book" fill className="object-contain" />
                                        ) : (
                                            <div className="flex items-center justify-center h-full text-gray-400">No Image</div>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <div className="flex justify-end gap-3">
                                <button
                                    onClick={() => setSelectedRequest(null)}
                                    className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                                >
                                    Close
                                </button>
                                <button
                                    onClick={() => handleAction(selectedRequest.user_id, 'REJECTED')}
                                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                                >
                                    Reject
                                </button>
                                <button
                                    onClick={() => handleAction(selectedRequest.user_id, 'APPROVED')}
                                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                                >
                                    Approve
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
