import { createClient, RealtimeClient, SupabaseClient } from '@supabase/supabase-js';
import { Database } from './db-defs';

export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row'];
export type Enums<T extends keyof Database['public']['Enums']> = Database['public']['Enums'][T];

export type Print = Tables<'prints'> & {
  created_by: Tables<'profiles'>
  status: Enums<'print_status'>
}

export type MachineEvent = Tables<'machine_events'> & {
created_by: Tables<'profiles'> | null
resolved_by: Tables<'profiles'> | null
machine?: Machine
print?: Print
}

export type Machine = Tables<'machines'> & {
  machine_def: Tables<'machine_defs'>
  prints: Print[]
  status: Enums<'machine_status'>
  events: MachineEvent[]
}

export type User = Tables<'profiles'> & {
  perms: Tables<'user_levels'>
}

export type UserLevel = Tables<'user_levels'>;

export type InventoryItem = Tables<'inv_items'> & {
  changes: InventoryChange[]
  created_by: Tables<'profiles'>
  inv_category: Tables<'inv_categories'>
  current_stock: number
}

export type InventoryChange = Tables<'inv_changes'> & {
  created_by: Tables<'profiles'>
  running_total: number // this is calculated client side
}

export type InventoryCategory = Tables<'inv_categories'>;

export class SupabaseWatcher {
  private _supabase: SupabaseClient<Database>;

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

  getMachineEventInfo(id: string) {
    return this._supabase
      .from('machine_events')
      .select(`
        *,
        machine: machines_view (
          *,
          machine_def: machine_defs_id (*)
        ),
        print: prints_view (
          *,
          created_by: created_by_user_id (*)
        ),
        created_by: created_by_user_id (*),
        resolved_by: resolved_by_user_id (*)
      `)
      .eq('id', id)
      .returns<MachineEvent[]>()
      .maybeSingle();
  }

  getPrintsInProgress() {
    return this._supabase
      .from('prints_view')
      .select(`
        *,
        created_by: created_by_user_id (*)
      `)
      .eq('status', 'WORKING')
      .returns<Print[]>();
  }

  getInventoryItemInfo(id: string) {
    return this._supabase
      .from('inv_items_view')
      .select(`
        *,
        changes: inv_changes_view (*)
      `)
      .eq('id', id)
      .returns<InventoryItem[]>()
      .maybeSingle();
  }
}