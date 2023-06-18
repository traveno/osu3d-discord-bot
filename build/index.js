"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv = __importStar(require("dotenv"));
const josef_1 = require("./josef");
const supabase_1 = require("./supabase");
function main() {
    dotenv.config();
    let supabaseURL = process.env.PUBLIC_SUPABASE_URL;
    let supabaseAnonKey = process.env.PUBLIC_SUPABASE_ANON_KEY;
    if (supabaseURL === undefined || supabaseAnonKey === undefined) {
        console.error('Could not pull supabase URL or anon key from process.env');
        return;
    }
    const watcher = new supabase_1.SupabaseWatcher(supabaseURL, supabaseAnonKey);
    let botToken = process.env.BOT_TOKEN;
    let guildId;
    let debugChannelId;
    if (process.env.NODE_ENV === 'development') {
        guildId = process.env.DISCORD_TEST_SERVER;
        debugChannelId = process.env.DISCORD_TEST_CHANNEL;
    }
    else if (process.env.NODE_ENV === 'production') {
        guildId = process.env.DISCORD_OSU_SERVER;
        debugChannelId = process.env.DISCORD_OSU_TEST_CHANNEL;
    }
    if (botToken === undefined || guildId === undefined || debugChannelId === undefined) {
        console.error('Could not pull bot token, guild ID, or debug channel ID from process.env');
        return;
    }
    const josef = new josef_1.Josef(botToken, guildId, debugChannelId);
    josef.registerEvents(watcher);
    console.log('Done?');
}
main();
