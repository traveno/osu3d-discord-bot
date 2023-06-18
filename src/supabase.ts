import { createClient, SupabaseClient } from '@supabase/supabase-js';

export class SupabaseWatcher {
    private _supabase: SupabaseClient;

    constructor(publicURL: string, anonKey: string) {
        this._supabase = createClient(publicURL, anonKey);
    }

    monitorTable(tableName: string, callback: (payload: any) => void) {
        this._supabase
            .channel('table-db-changes')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: tableName,
                },
                callback
            )
            .subscribe();
    }
}