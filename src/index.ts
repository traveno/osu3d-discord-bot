import * as dotenv from 'dotenv';
import { Josef } from "./josef";
import { SupabaseWatcher } from './supabase';

export let debugMode = true;

function main() {
  dotenv.config();

  if (process.env.NODE_ENV === 'production')
    debugMode = false;
  else
    console.log('--- RUNNING IN DEBUG MODE ---');

  const supabaseURL = debugMode ? process.env.TEST_SUPABASE_URL : process.env.PROD_SUPABASE_URL;
  const supabaseKey = debugMode ? process.env.TEST_SUPABASE_SERVICE_KEY : process.env.PROD_SUPABASE_SERVICE_KEY;

  console.log('Connecting to', supabaseURL);

  if (supabaseURL === undefined || supabaseKey === undefined) {
    console.error('Could not pull supabase URL or anon key from process.env');
    return;
  }

  const watcher = new SupabaseWatcher(supabaseURL, supabaseKey);

  const botToken = process.env.BOT_TOKEN;
  const guildId = debugMode ? process.env.DISCORD_TEST_SERVER : process.env.DISCORD_OSU_SERVER;
  const debugChannelId = debugMode ? process.env.DISCORD_TEST_CHANNEL : process.env.DISCORD_OSU_TEST_CHANNEL;

  if (botToken === undefined || guildId === undefined || debugChannelId === undefined) {
    console.error('Could not pull bot token, guild ID, or debug channel ID from process.env');
    return;
  }

  const josef = new Josef(botToken, guildId, debugChannelId, watcher);
}

main();