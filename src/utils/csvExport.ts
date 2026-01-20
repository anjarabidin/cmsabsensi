/**
 * CSV Export Utilities
 * Handles formal CSV generation with escaping and metadata headers.
 */

interface CSVOptions {
    filename: string;
    title: string;
    period?: string;
    generatedBy?: string;
}

/**
 * Escapes a cell value for CSV
 */
const escapeCSV = (value: any): string => {
    if (value === null || value === undefined) return '""';
    const stringValue = String(value);
    // If value contains comma, quotes or newlines, wrap in quotes and escape internal quotes
    if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n') || stringValue.includes('\r')) {
        return `"${stringValue.replace(/"/g, '""')}"`;
    }
    return `"${stringValue}"`;
};

/**
 * Generates and downloads a formal CSV file
 */
export const downloadFormalCSV = (
    headers: string[],
    rows: any[][],
    options: CSVOptions
) => {
    const now = new Date().toLocaleString('id-ID');

    // 1. Meta Header Section (Industry Standard)
    const metaLines = [
        [`REPORT: ${options.title.toUpperCase()}`],
        [`PERIODE: ${options.period?.toUpperCase() || '-'}`],
        [`TANGGAL CETAK: ${now}`],
        [`DICETAK OLEH: ${options.generatedBy || 'System'}`],
        [''], // Spacer
    ];

    // 2. Data Section
    const dataLines = [
        headers,
        ...rows
    ];

    // Combine and format
    const csvContent = [
        ...metaLines,
        ...dataLines
    ].map(line => line.map(escapeCSV).join(',')).join('\r\n');

    // Create and download blob
    const BOM = '\uFEFF'; // Add BOM for Excel UTF-8 support
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', options.filename.endsWith('.csv') ? options.filename : `${options.filename}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};
