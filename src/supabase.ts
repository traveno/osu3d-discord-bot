import { createClient, RealtimeClient, SupabaseClient } from '@supabase/supabase-js';

export class SupabaseWatcher {
  private _supabase: SupabaseClient;

  constructor(publicURL: string, serviceKey: string) {
    this._supabase = createClient(publicURL, serviceKey, { auth: { persistSession: false } });
    this._supabase.auth.onAuthStateChange(change => console.log('Auth state change', change));
  }

  monitorTable(tableName: string, callback: (payload: any) => void) {
    this._supabase
      .channel(`${tableName}-db-changes`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: tableName
        },
        payload => callback(payload)
      )
      .subscribe((info, error) => {
        if (error) throw new Error(error.message);
        console.log(tableName, info);
      });
  }

  monitorChannel(channelName: string, callback: (payload: any) => void) {
    this._supabase
      .channel(`${channelName}-channel`)
      .on(
        'broadcast',
        {
          event: channelName,
        },
        message => callback(message.payload)
      )
      .subscribe((info, error) => {
        if (error) throw new Error(error.message);
        console.log(channelName, info);
      });
  }

  getUserLevel(userUUID: string) {
    return this._supabase
      .from('user_levels')
      .select('level')
      .eq('user_id', userUUID)
      .maybeSingle();
  }

  getDiscordName(userUUID: string) {
    return this._supabase
      .from('profiles')
      .select('discord')
      .eq('user_id', userUUID)
      .maybeSingle();
  }

  getFaultInfo(faultId: string) {
    return this._supabase
    .from('faults')
    .select(`
        *,
        machine: machine_id (
            *,
            machine_def: machine_defs_id (*)
        ),
        created_by: created_by_user_id (*)
    `)
    .eq('id', faultId)
    .maybeSingle();
  }
}