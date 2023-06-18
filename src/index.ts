import * as dotenv from 'dotenv';
import { Josef } from "./josef";
import { SupabaseWatcher } from './supabase';


function main() {
    dotenv.config();

    let supabaseURL = process.env.PUBLIC_SUPABASE_URL;
    let supabaseAnonKey = process.env.PUBLIC_SUPABASE_ANON_KEY;

    if (supabaseURL === undefined || supabaseAnonKey === undefined) {
        console.error('Could not pull supabase URL or anon key from process.env');
        return;
    }

    const watcher = new SupabaseWatcher(supabaseURL, supabaseAnonKey);

    let botToken = process.env.BOT_TOKEN;
    let guildId: string | undefined;
    let debugChannelId: string | undefined;

    if (process.env.NODE_ENV === 'development') {
        guildId = process.env.DISCORD_TEST_SERVER;
        debugChannelId = process.env.DISCORD_TEST_CHANNEL;
    } else if (process.env.NODE_ENV === 'production') {
        guildId = process.env.DISCORD_OSU_SERVER;
        debugChannelId = process.env.DISCORD_OSU_TEST_CHANNEL;
    }

    if (botToken === undefined || guildId === undefined || debugChannelId === undefined) {
        console.error('Could not pull bot token, guild ID, or debug channel ID from process.env');
        return;
    }

    const josef = new Josef(botToken, guildId, debugChannelId);
    josef.registerEvents(watcher);
}

main();





