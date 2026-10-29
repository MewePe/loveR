// Birth date / age helpers for the 18+ age check. No imports, so the age gate form (client) and the API share them.

export const MIN_AGE = 18;
// Years are entered in the Buddhist era (พ.ศ.) = CE + 543
export const BE_OFFSET = 543;
export const THAI_MONTHS = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
export const OLDEST_AGE = 120;

export interface BirthDate { year: number; month: number; day: number } // CE year, month 1-12

// Day/month/BE year from a form → a real CE date that isn't in the future, or null
export function parseBirthDate(day: unknown, month: unknown, yearBE: unknown, today = new Date()): BirthDate | null {
    const d = Number(day), m = Number(month), y = Number(yearBE) - BE_OFFSET;
    if (![d, m, y].every(Number.isInteger)) return null;
    if (m < 1 || m > 12 || d < 1 || d > 31) return null;
    if (y < today.getFullYear() - OLDEST_AGE || y > today.getFullYear()) return null;
    const date = new Date(y, m - 1, d);
    if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return null; // e.g. 31 Feb
    if (date > today) return null;
    return { year: y, month: m, day: d };
}

// Whole years old on `today` (birthday counted from the start of the day)
export function ageOn(birth: BirthDate, today = new Date()) {
    let age = today.getFullYear() - birth.year;
    const beforeBirthday = today.getMonth() + 1 < birth.month || (today.getMonth() + 1 === birth.month && today.getDate() < birth.day);
    if (beforeBirthday) age--;
    return age;
}

export const toIsoDate = (b: BirthDate) => `${b.year}-${String(b.month).padStart(2, '0')}-${String(b.day).padStart(2, '0')}`;
