const SUPABASE_URL = "https://gdykbtgpjmvpuqnbzldk.supabase.co";

const SUPABASE_PUBLISHABLE_KEY =
    "sb_publishable_3oLbVMZBoVARF5vbIPgaQg_-NYwja3V";


window.supabaseClient =
    window.supabase.createClient(
        SUPABASE_URL,
        SUPABASE_PUBLISHABLE_KEY
    );
