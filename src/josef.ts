import { Client, Events, GatewayIntentBits, EmbedBuilder, Guild, TextChannel, RoleResolvable } from 'discord.js';
import { SupabaseWatcher } from './supabase';
import { debugMode } from './index';
import Timeout from 'smart-timeout';

export enum PermCategory {
  TIER_1 = 0,
  TIER_2 = 1,
  TIER_3 = 2,
  USERS = 3,
  MACHINES = 4,
  MAINTENANCE = 5,
  INVENTORY = 6,
  SPECIAL = 7
}

export enum PermFlag {
  FIRST,
  SECOND,
  THIRD,
  FOURTH
}

export function getPermCategory(perms: number, category: PermCategory) {
  return (perms >>> 0) >> (4 * (category >>> 0));
}

export function hasPermission(perms: number | null | undefined, category: PermCategory, flag: PermFlag) {
  if (perms === null || perms === undefined) return false;
  return ((getPermCategory(perms, category) & (1 << flag)) > 0) || ((getPermCategory(perms, PermCategory.SPECIAL) & (1 << PermFlag.FIRST)) > 0); // if admin bit is set, always return true
}

export function getPermissionBit(category: PermCategory, flag: PermFlag) {
  return (1 << flag) << (4 * category);
}

export class Josef {
  private _botToken: string;

  private _guildId: string;
  private _debugChannelId: string;

  private _discordClient: Client | undefined;
  private _discordGuild: Guild | undefined;
  private _discordDebugChannel: TextChannel | undefined;
  private _discordMachineEventChannel: TextChannel | undefined;

  private _TIER_1_ROLE_ID?: string;
  private _TIER_2_ROLE_ID?: string;
  private _TIER_3_ROLE_ID?: string;

  private _supabaseWatcher: SupabaseWatcher;

  constructor(botToken: string, guildId: string, debugChannelId: string, supabase: SupabaseWatcher) {
    this._botToken = botToken;
    this._guildId = guildId;
    this._debugChannelId = debugChannelId;
    this._supabaseWatcher = supabase;

    this._TIER_1_ROLE_ID = debugMode ? process.env.TEST_TIER_1_ROLE_ID : process.env.PROD_TIER_1_ROLE_ID;
    this._TIER_2_ROLE_ID = debugMode ? process.env.TEST_TIER_2_ROLE_ID : process.env.PROD_TIER_2_ROLE_ID;
    this._TIER_3_ROLE_ID = debugMode ? process.env.TEST_TIER_3_ROLE_ID : process.env.PROD_TIER_3_ROLE_ID;

    if (!this._TIER_1_ROLE_ID || !this._TIER_2_ROLE_ID || !this._TIER_3_ROLE_ID)
      throw new Error('One or more Discord role IDs are not defined, check the .env');

    this._createClient();
  }

  private _registerEvents() {
    this._supabaseWatcher.monitorTable('user_levels', payload => this._onUserLevelCRUD(payload));
    this._supabaseWatcher.monitorTable('machine_events', payload => this._onMachineEventCRUD(payload));
    this._supabaseWatcher.monitorTable('profiles', payload => this._onProfilesCRUD(payload));
    this._supabaseWatcher.monitorChannel('discord-ping', payload => this._pingDiscordUser(payload));
    this._supabaseWatcher.monitorTable('prints', payload => this._onPrintsCRUD(payload));
    this._supabaseWatcher.monitorTable('inv_changes', payload => this._onInvChangeCRUD(payload));
  }

  private _createClient() {
    this._discordClient = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });
    this._discordClient.login(this._botToken)
    this._discordClient.once(Events.ClientReady, client => this._onceClientReady(client));
  }

  private async _onInvChangeCRUD(payload: any) {
    if (debugMode) console.log('_onInventoryChange()', payload);
    if (payload.eventType !== 'INSERT') return;

    const { data: invItem } = await this._supabaseWatcher.getInventoryItemInfo(payload.new.inv_item_id);
    if (!invItem) return;

    if (invItem.current_stock < invItem.minimum) {
      const embed = new EmbedBuilder()
      .setColor(0xFF5555)
      .setTitle(`Inventory Alert for ${invItem.name}`)
      .addFields(
          { name: 'Current Stock', value: `${invItem.current_stock}` },
          { name: 'Alert Threshold', value: `${invItem.minimum}` },
      )
      .setTimestamp()
      .setURL(`${process.env.PROD_URL}/inventory/${invItem.id}`)
      .setTimestamp(new Date(invItem.created_at))

      this._discordDebugChannel?.send({ embeds: [embed] });
    }
  }

  private async _scheduleUserNotification(print_id: string, user_id: string, message: string, timeout: number) {
    const discordName = (await this._supabaseWatcher.getDiscordName(user_id)).data?.discord as string | null;
    if (!discordName) return;

    Timeout.set(print_id, () => this._sendUserNotification(discordName, message), timeout);
  }

  private async _onPrintsCRUD(payload: any) {
    if (debugMode) console.log('_onPrintsCRUD()', payload);

    // Set up a notification for the user when print completes
    if (payload.eventType === 'INSERT') {
      const timeout = new Date(payload.new.done_at).getTime() - new Date().getTime();
      this._scheduleUserNotification(payload.new.id, payload.new.created_by_user_id, '[OSU3D] One of your prints has completed!', timeout);
      return;
    }
  }

  private async _onceClientReady(client: Client) {
    client.user!.setActivity('with my MK4');

    this._discordGuild = client.guilds.cache.get(this._guildId);
    this._discordDebugChannel = client.channels.cache.get(this._debugChannelId) as TextChannel;

    if (!debugMode) {
      this._discordMachineEventChannel = client.channels.cache.get(process.env.DISCORD_OSU_MACHINE_EVENT_CHANNEL!) as TextChannel;
    }

    this._registerEvents();
  }

  private async _pingDiscordUser(payload: any) {
    if (debugMode) console.log('_pingDiscordUser()', payload);
    const discordName = payload.discord;

    const allMembers = await this._discordGuild!.members.fetch();
    const user = allMembers.find(m => m.user.username === discordName);

    user?.send('[OSU3D] Ping! If you can read this, your username is correct.');
  }

  private async _onUserLevelCRUD(payload: any) {
    if (debugMode) console.log('_onUserLevelCRUD()', payload);
    if (payload.new.level !== payload.old.level) {
      const discordName = (await this._supabaseWatcher.getDiscordName(payload.new.user_id)).data?.discord as string | null;
      if (discordName !== null)
        this._updatePermission(payload.new.user_id, discordName, undefined);
    }
  }

  private async _sendUserNotification(discordName: string, message: string) {
    const allMembers = await this._discordGuild!.members.fetch();
    const user = allMembers.find(m => m.user.username === discordName);
    user?.send(message);
  }

  private async _onProfilesCRUD(payload: any) {
    if (debugMode) console.log('_onProfilesCRUD()', payload);
    if (payload.new.discord === payload.old.discord) return;

    if (payload.new.discord !== null)
      this._updatePermission(payload.new.user_id, payload.new.discord);
    if (payload.old.discord !== null)
      this._updatePermission(payload.old.user_id, payload.old.discord, []);
  }

  private async _updatePermission(userUUID: string, discordName: string, roleIds?: RoleResolvable[]) {
    const allMembers = await this._discordGuild!.members.fetch();
    const user = allMembers.find(m => m.user.username === discordName);
    if (!user) return;

    // Get the user level from the db
    const userLevel = (await this._supabaseWatcher.getUserLevel(userUUID)).data?.level as number | null;

    // Remove all related roles
    await user.roles.remove([this._TIER_1_ROLE_ID!, this._TIER_2_ROLE_ID!, this._TIER_3_ROLE_ID!]);

    if (hasPermission(userLevel, PermCategory.TIER_3, PermFlag.FIRST))
      user.roles.add(this._TIER_3_ROLE_ID!);
    
    if (hasPermission(userLevel, PermCategory.TIER_2, PermFlag.FIRST))
      user.roles.add(this._TIER_2_ROLE_ID!);
    
    if (hasPermission(userLevel, PermCategory.TIER_1, PermFlag.FIRST))
      user.roles.add(this._TIER_1_ROLE_ID!);

    if (roleIds !== undefined)
      await user.roles.add(roleIds);

    user.send('[OSU3D] Your profile has changed! Any related Discord roles have been applied.');
  }

  private async _onMachineEventCRUD(payload: any) {
    if (debugMode) console.log('_onMachineEventCRUD()', payload);

    if (payload.eventType !== 'INSERT') return;
    if (payload.new.resolved === payload.old.resolved) return;

    // Do not announce STOP code
    if (payload.new.event_type === 'STOP') {
      if (payload.new.print_id === null) return;

      const { data } = await this._supabaseWatcher.getMachineEventInfo(payload.new.id);
      const discordName = data?.print?.created_by.discord;
      
      if (discordName) {
        this._sendUserNotification(discordName, '[OSU3D] One of your prints was canceled.');
        Timeout.clear(payload.new.print_id);
      }

      return;
    }
    
    const { data: event } = await this._supabaseWatcher.getMachineEventInfo(payload.new.id);
    if (!event) return;

    const embed = new EmbedBuilder()
      .setColor(0xFF5555)
      .setTitle(`Fault Alert for ${event.machine?.machine_def?.model} (Tier ${event.machine?.tier.toString()})`)
      .addFields(
          { name: 'Printer Type', value: `${event.machine?.machine_def?.make ?? ''} ${event.machine?.machine_def?.model ?? ''}` },
          { name: 'Issuer', value: event.created_by?.full_name ?? 'no account name' },
          { name: 'Provided Description', value: event.description ?? '' }
      )
      .setTimestamp();

    if (debugMode)
      this._discordDebugChannel?.send({ embeds: [embed] });
    else
      this._discordMachineEventChannel?.send({ embeds: [embed] });
  }
}

function getBadQuip() {
  return badQuips[Math.floor(Math.random() * badQuips.length)];
}

const badQuips = [
  'Houston, we have a problem :dizzy_face:',
  'Another one bites the dust :dizzy_face:',
  'I come bearing bad news :dizzy_face:',
  'Is it a Prusa? I can\'t look! :dizzy_face:',
  'Frustrating times at the 3D print club :dizzy_face:',
  'I\'ll just leave this here :dizzy_face:',
  'So who\'s the VP of Operations again? :dizzy_face:',
  'Here\'s something for the to-do (to-fix) list :dizzy_face:',
  'This just in :dizzy_face:'
];