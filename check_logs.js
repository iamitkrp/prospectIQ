// eslint-disable-next-line @typescript-eslint/no-require-imports
const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://kmudtavmnvvxqyqshtvp.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImttdWR0YXZtbnZ2eHF5cXNodHZwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDg2ODIxOSwiZXhwIjoyMDg2NDQ0MjE5fQ.si8tIQ0A-LsIctQCSzNs8GV5gBQRfRuz0dbOIfKhvLY';
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    const { data, error } = await supabase
        .from('email_logs')
        .select('id, prospect_id, status, subject, body, qstash_message_id, sent_at')
        .order('sent_at', { ascending: false, nullsFirst: false })
        .limit(5);

    if (error) {
        console.error('Error:', error);
    } else {
        console.log(JSON.stringify(data, null, 2));
    }
}

check();
