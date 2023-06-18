"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SupabaseWatcher = void 0;
const supabase_js_1 = require("@supabase/supabase-js");
class SupabaseWatcher {
    constructor(publicURL, anonKey) {
        this._supabase = (0, supabase_js_1.createClient)(publicURL, anonKey);
    }
    monitorTable(tableName, callback) {
        this._supabase
            .channel('table-db-changes')
            .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: tableName,
        }, callback)
            .subscribe();
    }
}
exports.SupabaseWatcher = SupabaseWatcher;
