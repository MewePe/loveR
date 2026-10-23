"use client";

import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

// Series colors are the site's indigo and pink (checked for color-blind separation and contrast on the
// light and dark card backgrounds). Add a series only with a color that passes the same check.
export const SERIES_COLORS = { indigo: "#6366F1", pink: "#EC4899" } as const;

export type ChartSeries = { key: string; label: string; color: string };
type Point = { bucket: string } & Record<string, number | string>;

interface TimeSeriesChartProps {
    data: Point[];
    series: ChartSeries[];
    kind?: "bar" | "line";
    unit?: string; // shown after values in the tooltip and table, e.g. "บาท"
    height?: number;
}

// Bucket keys are "YYYY-MM-DD" (daily) or "YYYY-MM" (monthly), from lib/analytics.ts
export function bucketLabel(bucket: string, long = false) {
    const [y, m, d] = bucket.split("-").map(Number);
    const date = new Date(y, m - 1, d || 1);
    return d
        ? date.toLocaleDateString("th-TH", { day: "numeric", month: "short", ...(long ? { year: "numeric" } : {}) })
        : date.toLocaleDateString("th-TH", { month: "short", year: long ? "numeric" : "2-digit" });
}

export type ChartRange = "30d" | "12m";

// 30-day / 12-month switch shown in the dashboard headers
export function RangeToggle({ value, onChange }: { value: ChartRange; onChange: (range: ChartRange) => void }) {
    const options: { key: ChartRange; label: string }[] = [{ key: "30d", label: "30 วัน" }, { key: "12m", label: "12 เดือน" }];
    return (
        <div className="inline-flex bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg p-1 shadow-sm" role="group" aria-label="ช่วงเวลา">
            {options.map((o) => (
                <button
                    key={o.key}
                    type="button"
                    onClick={() => onChange(o.key)}
                    aria-pressed={value === o.key}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${value === o.key ? "bg-indigo-600 text-white" : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"}`}
                >
                    {o.label}
                </button>
            ))}
        </div>
    );
}

const formatValue = (value: number) => value.toLocaleString("th-TH", { maximumFractionDigits: 2 });

function ChartTooltip({ active, payload, label, series, unit }: {
    active?: boolean; payload?: readonly { dataKey?: unknown; value?: unknown }[]; label?: string; series: ChartSeries[]; unit?: string;
}) {
    if (!active || !payload?.length || !label) return null;
    return (
        <div className="rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm shadow-lg">
            <p className="font-medium text-gray-900 dark:text-white mb-1">{bucketLabel(label, true)}</p>
            {series.map((s) => {
                const value = Number(payload.find((p) => p.dataKey === s.key)?.value ?? 0);
                return (
                    <p key={s.key} className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
                        <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: s.color }} />
                        {s.label}: <span className="font-medium text-gray-900 dark:text-white">{formatValue(value)}{unit && ` ${unit}`}</span>
                    </p>
                );
            })}
        </div>
    );
}

// Bar or line chart over the dashboard date buckets, with a legend when there's more than one series
// and a table view underneath for exact numbers.
export default function TimeSeriesChart({ data, series, kind = "bar", unit, height = 260 }: TimeSeriesChartProps) {
    const axis = { stroke: "#9CA3AF", fontSize: 12, tickLine: false, axisLine: false };
    const commonChildren = [
        <CartesianGrid key="grid" vertical={false} stroke="#9CA3AF" strokeOpacity={0.2} />,
        <XAxis key="x" dataKey="bucket" tickFormatter={(b: string) => bucketLabel(b)} minTickGap={16} {...axis} />,
        <YAxis key="y" allowDecimals={false} width={48} tickFormatter={formatValue} {...axis} />,
        <Tooltip key="tip" cursor={{ fill: "#9CA3AF", fillOpacity: 0.12, stroke: "#9CA3AF", strokeOpacity: 0.4 }}
            content={(props) => <ChartTooltip {...props} label={props.label as string | undefined} series={series} unit={unit} />} />,
    ];

    return (
        <div>
            {series.length > 1 && (
                <div className="flex flex-wrap gap-4 mb-3 text-sm text-gray-600 dark:text-gray-300">
                    {series.map((s) => (
                        <span key={s.key} className="flex items-center gap-2">
                            <span className={`inline-block w-3 ${kind === "line" ? "h-0.5" : "h-3 rounded-sm"}`} style={{ backgroundColor: s.color }} />
                            {s.label}
                        </span>
                    ))}
                </div>
            )}
            <div style={{ height }}>
                <ResponsiveContainer width="100%" height="100%">
                    {kind === "line" ? (
                        <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                            {commonChildren}
                            {series.map((s) => (
                                <Line key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={s.color} strokeWidth={2}
                                    dot={false} activeDot={{ r: 5, strokeWidth: 2, stroke: "var(--chart-surface, #fff)" }} />
                            ))}
                        </LineChart>
                    ) : (
                        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barGap={2}>
                            {commonChildren}
                            {series.map((s) => (
                                <Bar key={s.key} dataKey={s.key} name={s.label} fill={s.color} radius={[4, 4, 0, 0]} maxBarSize={24} />
                            ))}
                        </BarChart>
                    )}
                </ResponsiveContainer>
            </div>
            <details className="mt-3 text-sm">
                <summary className="cursor-pointer text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">ดูเป็นตาราง</summary>
                <div className="mt-2 max-h-64 overflow-auto rounded-lg border dark:border-gray-700">
                    <table className="w-full text-left">
                        <thead className="bg-gray-50 dark:bg-gray-900/50 text-gray-500 dark:text-gray-400 text-xs sticky top-0">
                            <tr>
                                <th className="px-3 py-2">ช่วงเวลา</th>
                                {series.map((s) => <th key={s.key} className="px-3 py-2 text-right">{s.label}</th>)}
                            </tr>
                        </thead>
                        <tbody className="divide-y dark:divide-gray-700 text-gray-700 dark:text-gray-300">
                            {data.map((row) => (
                                <tr key={row.bucket}>
                                    <td className="px-3 py-1.5">{bucketLabel(row.bucket, true)}</td>
                                    {series.map((s) => (
                                        <td key={s.key} className="px-3 py-1.5 text-right tabular-nums">{formatValue(Number(row[s.key]))}{unit && ` ${unit}`}</td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </details>
        </div>
    );
}
