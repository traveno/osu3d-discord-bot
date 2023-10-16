import { Client, Events, GatewayIntentBits, EmbedBuilder, Guild, Channel, TextChannel, RoleResolvable } from 'discord.js';
import { SupabaseWatcher } from './supabase';
import { debugMode } from './index';


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
    this._supabaseWatcher.monitorTable('user_levels', payload => this._onUserLevelEvent(payload));
    this._supabaseWatcher.monitorTable('faults', payload => this._announceFault(payload));
    this._supabaseWatcher.monitorTable('profiles', payload => this._onProfileEvent(payload));
    this._supabaseWatcher.monitorChannel('discord-ping', payload => this._pingDiscordUser(payload));
    this._supabaseWatcher.monitorTable('prints', payload => this._onPrintUpdated(payload));
    
  }

  private _createClient() {
    this._discordClient = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });
    this._discordClient.login(this._botToken)
    this._discordClient.once(Events.ClientReady, client => this._onceClientReady(client));
  }

  private async _onPrintUpdated(payload:any) {
    if (debugMode) console.log('_onPrintUpdated()');
    if (payload.eventType !== 'UPDATE') return;
    if (payload.new.canceled === payload.old.canceled) return;
    
    const discordName = (await this._supabaseWatcher.getDiscordName(payload.new.created_by_user_id)).data?.discord as string | null;
    if (!discordName) return;

    const allMembers = await this._discordGuild!.members.fetch();
    const user = allMembers.find(m => m.user.username === discordName);

    user?.send('One of your prints was just canceled.');
  }

  private async _onceClientReady(client: Client) {
    client.user!.setActivity('with my MK4');

    this._discordGuild = client.guilds.cache.get(this._guildId);
    this._discordDebugChannel = client.channels.cache.get(this._debugChannelId) as TextChannel;

    this._registerEvents();
  }

  private async _pingDiscordUser(payload: any) {
    if (debugMode) console.log('_pingDiscordUser()');
    const discordName = payload.discord;

    const allMembers = await this._discordGuild!.members.fetch();
    const user = allMembers.find(m => m.user.username === discordName);

    user?.send('Ping! If you can read this, your username is correct.');
  }

  private async _onUserLevelEvent(payload: any) {
    if (debugMode) console.log('_onUserLevelEvent()');
    if (payload.new.level !== payload.old.level) {
      const discordName = (await this._supabaseWatcher.getDiscordName(payload.new.user_id)).data?.discord as string | null;
      if (discordName !== null)
        this._updatePermission(payload.new.user_id, discordName, undefined);
    }
  }

  private async _onProfileEvent(payload: any) {
    if (debugMode) console.log('_onProfileEvent()');
    if (payload.new.discord === payload.old.discord) return;
    console.log(payload);

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

    user.send('Hello. Your osu3d.io certifications have changed! Any related Discord roles have been applied.');
  }

  private async _announceFault(payload: any) {
    if (payload.new.resolved === payload.old.resolved)
      return;
    if (debugMode) console.log('_announceFault()');
    const { data: fault } = await this._supabaseWatcher.getFaultInfo(payload.new.id) as any;

    const embed = new EmbedBuilder()
        .setColor(0xFF5555)
        .setTitle(`Fault Report for ${fault.machine.nickname} (Tier ${fault.machine.tier.toString()})`)
        .addFields(
            { name: 'Machine Type', value: `${fault.machine.machine_def.make} ${fault.machine.machine_def.model}` },
            { name: 'Issuer', value: fault.created_by.full_name ?? 'no account name' },
            { name: 'Provided Description', value: fault.description }
        )
        .setTimestamp();

    this._discordDebugChannel?.send(this._getBadQuip());
    this._discordDebugChannel?.send({ embeds: [embed]});
  }

  private _getBadQuip() {
    return badQuips[Math.floor(Math.random() * badQuips.length)];
  }
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