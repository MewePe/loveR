"use client";
import { Check } from 'lucide-react';

type Option = { id: string; name: string };

const ACCENTS = {
    indigo: 'bg-indigo-600 border-indigo-600 text-white',
    pink: 'bg-pink-600 border-pink-600 text-white',
};

// Toggle chips for choosing categories. `value` keeps the order they were picked in (the first one is the
// story's main category). With `max`, unpicked chips are disabled once the limit is reached.
export default function CategoryPicker({ options, value, onChange, max, accent = 'indigo', label }: {
    options: Option[]; value: string[]; onChange: (ids: string[]) => void; max?: number;
    accent?: keyof typeof ACCENTS; label: string;
}) {
    const full = max !== undefined && value.length >= max;

    function toggle(id: string) {
        if (value.includes(id)) onChange(value.filter((v) => v !== id));
        else if (!full) onChange([...value, id]);
    }

    if (options.length === 0) {
        return <p className="text-sm text-gray-500 dark:text-gray-400">ยังไม่มีหมวดหมู่</p>;
    }

    return (
        <div role="group" aria-label={label}>
            <div className="flex flex-wrap gap-2">
                {options.map((option) => {
                    const selected = value.includes(option.id);
                    const disabled = !selected && full;
                    return (
                        <button
                            key={option.id}
                            type="button"
                            aria-pressed={selected}
                            disabled={disabled}
                            onClick={() => toggle(option.id)}
                            className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full border text-sm transition ${selected
                                ? ACCENTS[accent]
                                : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white dark:disabled:hover:bg-gray-800'}`}
                        >
                            {selected && <Check className="w-3.5 h-3.5" />}
                            {option.name}
                        </button>
                    );
                })}
            </div>
            {max !== undefined && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2" aria-live="polite">
                    เลือกแล้ว {value.length}/{max} {full && '(ครบแล้ว กดหมวดที่เลือกไว้เพื่อเอาออก)'}
                </p>
            )}
        </div>
    );
}
