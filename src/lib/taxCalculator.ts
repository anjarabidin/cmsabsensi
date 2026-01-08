import { supabase } from '@/integrations/supabase/client';
import { PPh21TerRate, PtkpTerMapping } from '@/types';

/**
 * Calculates PPh 21 TER based on Gross Income and PTKP status.
 * Formula: Gross Income * TER Rate %
 * @param grossIncome Total gross income for the month (gaji + tunjangan + lembur)
 * @param ptkpStatus e.g., 'TK/0', 'K/1'
 */
export async function calculatePPh21TER(grossIncome: number, ptkpStatus: string): Promise<number> {
    if (!ptkpStatus || grossIncome <= 0) return 0;

    try {
        // 1. Get TER Category for the PTKP status
        const { data: mapping, error: mappingError } = await (supabase
            .from('ptkp_ter_mappings' as any) as any)
            .select('ter_category')
            .eq('ptkp_status', ptkpStatus)
            .single();

        if (mappingError || !mapping) {
            console.error('PTKP mapping not found for:', ptkpStatus);
            return 0;
        }

        const category = mapping.ter_category;

        // 2. Find the applicable rate for the gross income in that category
        const { data: rates, error: rateError } = await (supabase
            .from('pph21_ter_rates' as any) as any)
            .select('rate_percentage')
            .eq('category_code', category)
            .lte('min_gross_income', grossIncome)
            .gte('max_gross_income', grossIncome)
            .order('rate_percentage', { ascending: false })
            .limit(1);

        if (rateError || !rates || rates.length === 0) {
            // Some systems use the last rate if above max, or 0 if below min.
            // Our seed data usually covers 0 to "infinity".
            console.warn('No TER rate found for income:', grossIncome, 'category:', category);
            return 0;
        }

        const rate = rates[0].rate_percentage;
        return Math.floor(grossIncome * rate);

    } catch (error) {
        console.error('Error calculating PPh21 TER:', error);
        return 0;
    }
}

/**
 * Gets all TER categories and rates for reference/display (optional utility)
 */
export async function getTerReference() {
    const { data: codes } = await (supabase.from('pph21_ter_codes' as any) as any).select('*');
    const { data: rates } = await (supabase.from('pph21_ter_rates' as any) as any).select('*').order('min_gross_income');
    return { codes, rates };
}
