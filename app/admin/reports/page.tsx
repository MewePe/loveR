"use client";
import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { Flag, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import Link from 'next/link';

interface Report {
    id: string;
    reporter_name: string;
    target_type: string;
    target_id: string;
    reason: string;
    status: string;
    created_at: string;
}

export default function AdminReports() {
    const { data: session } = useSession();
    const [reports, setReports] = useState<Report[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (session?.user?.role !== 'ADMIN') return;
        fetchReports();
    }, [session]);

    async function fetchReports() {
        try {
            const res = await fetch('/api/admin/reports');
            if (res.ok) {
                const data = await res.json();
                setReports(data);
            }
        } finally {
            setLoading(false);
        }
    }

    async function updateStatus(id: string, newStatus: string) {
        try {
            const res = await fetch(`/api/admin/reports/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus }),
            });

            if (res.ok) {
                fetchReports();
            } else {
                alert('Failed to update report');
            }
        } catch (error) {
            console.error(error);
        }
    }

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
            <div className="max-w-6xl mx-auto">
                <div className="flex justify-between items-center mb-8">
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Report Management</h1>
                    <Link href="/admin" className="text-indigo-600 hover:underline">Back to Dashboard</Link>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border dark:border-gray-700 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-gray-50 dark:bg-gray-900/50 text-gray-500 dark:text-gray-400 text-xs uppercase">
                                <tr>
                                    <th className="px-6 py-3">Reporter</th>
                                    <th className="px-6 py-3">Target</th>
                                    <th className="px-6 py-3">Reason</th>
                                    <th className="px-6 py-3">Status</th>
                                    <th className="px-6 py-3">Date</th>
                                    <th className="px-6 py-3 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y dark:divide-gray-700">
                                {reports.map((report) => (
                                    <tr key={report.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                        <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">
                                            {report.reporter_name}
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                                            <span className="font-semibold text-indigo-600 dark:text-indigo-400">{report.target_type}</span>: {report.target_id}
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                                            {report.reason}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                                                ${report.status === 'RESOLVED' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' :
                                                    report.status === 'IGNORED' ? 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300' :
                                                        'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
                                                }`}>
                                                {report.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                                            {new Date(report.created_at).toLocaleDateString()}
                                        </td>
                                        <td className="px-6 py-4 text-right space-x-2">
                                            {report.status === 'PENDING' && (
                                                <>
                                                    <button
                                                        onClick={() => updateStatus(report.id, 'RESOLVED')}
                                                        className="text-gray-400 hover:text-green-600 transition"
                                                        title="Resolve"
                                                    >
                                                        <CheckCircle className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => updateStatus(report.id, 'IGNORED')}
                                                        className="text-gray-400 hover:text-gray-600 transition"
                                                        title="Ignore"
                                                    >
                                                        <XCircle className="w-4 h-4" />
                                                    </button>
                                                </>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                                {reports.length === 0 && !loading && (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                                            No reports found.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}
