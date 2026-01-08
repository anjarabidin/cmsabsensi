export type Holiday = {
    date: string; // YYYY-MM-DD
    name: string;
};

export const holidays: Holiday[] = [
    // --- 2025 ---
    { date: '2025-01-01', name: 'Tahun Baru Masehi' },
    { date: '2025-01-27', name: 'Isra Mikraj Nabi Muhammad SAW' },
    { date: '2025-01-29', name: 'Tahun Baru Imlek 2576 Kongzili' },
    { date: '2025-03-29', name: 'Hari Suci Nyepi Tahun Baru Saka 1947' },
    { date: '2025-03-31', name: 'Idul Fitri 1446 Hijriah' },
    { date: '2025-04-01', name: 'Idul Fitri 1446 Hijriah' },
    { date: '2025-04-18', name: 'Wafat Isa Al Masih' },
    { date: '2025-04-20', name: 'Kebangkitan Isa Al Masih (Paskah)' },
    { date: '2025-05-01', name: 'Hari Buruh Internasional' },
    { date: '2025-05-12', name: 'Hari Raya Waisak 2569 BE' },
    { date: '2025-05-29', name: 'Kenaikan Isa Al Masih' },
    { date: '2025-06-01', name: 'Hari Lahir Pancasila' },
    { date: '2025-06-06', name: 'Idul Adha 1446 Hijriah' },
    { date: '2025-06-27', name: 'Tahun Baru Islam 1447 Hijriah' },
    { date: '2025-08-17', name: 'Hari Kemerdekaan RI' },
    { date: '2025-09-05', name: 'Maulid Nabi Muhammad SAW' },
    { date: '2025-12-25', name: 'Hari Raya Natal' },

    // --- 2026 ---
    { date: '2026-01-01', name: 'Tahun Baru Masehi' },
    { date: '2026-01-16', name: 'Isra Mikraj Nabi Muhammad SAW' },
    { date: '2026-02-17', name: 'Tahun Baru Imlek 2577 Kongzili' },
    { date: '2026-03-19', name: 'Hari Suci Nyepi Tahun Baru Saka 1948' },
    { date: '2026-03-20', name: 'Idul Fitri 1447 Hijriah' },
    { date: '2026-03-21', name: 'Idul Fitri 1447 Hijriah' },
    { date: '2026-04-03', name: 'Wafat Isa Al Masih' },
    { date: '2026-04-05', name: 'Kebangkitan Isa Al Masih (Paskah)' },
    { date: '2026-05-01', name: 'Hari Buruh Internasional' },
    { date: '2026-05-14', name: 'Kenaikan Isa Al Masih' },
    { date: '2026-05-27', name: 'Idul Adha 1447 Hijriah' },
    { date: '2026-06-01', name: 'Hari Lahir Pancasila' },
    { date: '2026-06-02', name: 'Hari Raya Waisak 2570 BE' },
    { date: '2026-07-16', name: 'Tahun Baru Islam 1448 Hijriah' },
    { date: '2026-08-17', name: 'Hari Kemerdekaan RI' },
    { date: '2026-09-24', name: 'Maulid Nabi Muhammad SAW' },
    { date: '2026-12-25', name: 'Hari Raya Natal' },
];

export function isHoliday(date: Date): string | null {
    const dateString = date.toISOString().split('T')[0];
    const holiday = holidays.find(h => h.date === dateString);
    return holiday ? holiday.name : null;
}

export function isWeekend(date: Date): boolean {
    const day = date.getDay();
    return day === 0 || day === 6; // 0 = Sunday, 6 = Saturday
}

export function issunday(date: Date): boolean {
    return date.getDay() === 0;
}
