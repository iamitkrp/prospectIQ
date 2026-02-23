require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function check() {
    const { data: campaign } = await supabase.from('campaigns').select('*').limit(1).order('created_at', { ascending: false });
    console.log('Latest Campaign:', campaign);

    if (campaign && campaign.length > 0) {
        const cId = campaign[0].id;
        const { data: steps } = await supabase.from('campaign_steps').select('*').eq('campaign_id', cId);
        console.log('Steps:', steps);

        const { data: log } = await supabase.from('email_logs').select('*').eq('campaign_id', cId);
        console.log('Email Logs:', log);
    }
}

check().catch(console.error);
