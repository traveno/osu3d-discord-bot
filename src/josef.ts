import { Client, Events, GatewayIntentBits, EmbedBuilder, Guild, Channel, TextChannel } from 'discord.js';
import { SupabaseWatcher } from './supabase';


export class Josef {
    private _botToken: string;
    private _guildId: string;
    private _debugChannelId: string;

    private _discordClient: Client | undefined;

    private _discordGuild: Guild | undefined;
    private _discordDebugChannel: TextChannel | undefined;

    
    constructor(botToken: string, guildId: string, debugChannelId: string) {
        this._botToken = botToken;
        this._guildId = guildId;
        this._debugChannelId = debugChannelId;

        this._createClient();
    }

    registerEvents(watcher: SupabaseWatcher) {
        watcher.monitorTable('fault_log', this._announceFault);
    }

    private _createClient() {
        this._discordClient = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });
        this._discordClient.login(this._botToken)

        this._discordClient.once(Events.ClientReady, client => this._onceClientReady(client));
    }
    
    private async _onceClientReady(client: Client) {
        client.user!.setActivity('with my MK4');

        this._discordGuild = client.guilds.cache.get(this._guildId);
        this._discordDebugChannel = client.channels.cache.get(this._debugChannelId) as TextChannel;
        // this._discordDebugChannel = await client.channels.fetch(this._debugChannelId, { cache: false }) as TextChannel;


        // this._discordDebugChannel!.send('What\'s good gang, it\'s me Josef. Happy to serve you all.');


        // this._discordGuild!.members.fetch().then(allMembers => {
        //     const user = allMembers.find(m => m.user.tag === process.env.DISCORD_MY_TAG);
        //     if (user)
        //         user.send('Hi it\'s me');
        // });

    }

    private _announceFault(payload: any) {
        console.log(payload, this._getBadQuip());
        // async payload => osuTestChannel.send({ content: getBadQuip(), embeds: [await announceFault(payload.new.id)] })

        // const { data: fault } = await supabase
        //         .from('fault_log')
        //         .select(`
        //             *,
        //             machine: machine_id (
        //                 *,
        //                 machine_def: machine_defs_id (*)
        //             ),
        //             created_by: created_by_id (*)
        //         `)
        //         .eq('id', faultId)
        //         .single();
    
        // console.log(fault);
    
        // const embed = new EmbedBuilder()
        //     .setColor(0xFF5555)
        //     .setTitle(`Fault Report for ${fault.machine.nickname} (Tier ${fault.machine.tier.toString()})`)
        //     .addFields(
        //         { name: 'Machine Type', value: `${fault.machine.machine_def.make} ${fault.machine.machine_def.model}` },
        //         { name: 'Issuer', value: fault.created_by.full_name ?? 'no account name' },
        //         { name: 'Provided Description', value: fault.description }
        //     )
        //     .setTimestamp();
        
        // return embed;
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