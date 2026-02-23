import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing env vars');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    console.log("Checking DB...");
    const { data: logs, error: logsError } = await supabase.from('email_logs').select('*').order('created_at', { ascending: false }).limit(2);
    console.log("Recent email logs:", logsError ? logsError : logs);

    const { data: c, error: cErr } = await supabase.from('campaigns').select('id, name, status, created_at').order('created_at', { ascending: false }).limit(2);
    console.log("Recent campaigns:", cErr ? cErr : c);

}
run();
