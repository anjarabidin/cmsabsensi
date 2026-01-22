
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function checkData() {
    const { data: positions, error: pError } = await supabase.from('job_positions').select('id, title, department_id');
    const { data: departments, error: dError } = await supabase.from('departments').select('id, name');

    console.log('Positions count:', positions?.length || 0);
    console.log('Positions samples:', positions?.slice(0, 5));
    console.log('Departments count:', departments?.length || 0);
    console.log('Departments samples:', departments?.slice(0, 5));

    if (pError) console.error('P Error:', pError);
    if (dError) console.error('D Error:', dError);
}

checkData();
