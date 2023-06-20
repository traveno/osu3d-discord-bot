import { createClient, RealtimeClient, SupabaseClient } from '@supabase/supabase-js';

export class SupabaseWatcher {
    private _supabase: SupabaseClient;

    constructor(publicURL: string, anonKey: string) {
        this._supabase = createClient(publicURL, anonKey);
    }

    monitorTable(tableName: string, callback: (payload: any) => void) {
        console.log('Monitoring', tableName);
        this._supabase
            .channel(`${tableName}-db-changes`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: tableName,
                },
                payload => callback(payload)
            )
            .subscribe();
    }

    getUserLevel(userUUID: string) {
        return this._supabase
            .from('user_levels')
            .select('level')
            .eq('user_id', userUUID)
            .single();
    }

    getDiscordName(userUUID: string) {
        return this._supabase
            .from('profiles')
            .select('discord')
            .eq('id', userUUID)
            .single();
    }
}