require('dotenv').config();

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.PUBLIC_SUPABASE_URL, process.env.PUBLIC_SUPABASE_ANON_KEY);

const { Client, Events, GatewayIntentBits } = require('discord.js');
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });

client.once(Events.ClientReady, async c => {
    console.log('Ready! Logged in as', c.user.tag);

    const osuGuild = client.guilds.cache.get(process.env.DISCORD_TEST_SERVER);

    osuGuild.members.fetch({ cache: false }).then(allMembers => {
        const user = allMembers.find(m => m.user.tag === process.env.DISCORD_MY_TAG);
        console.log(user);

        if (user)
            user.send('Hi it\'s me');
    });

    const supabaseChannel = supabase
        .channel('table-db-changes')
        .on(
            'postgres_changes',
            {
                event: 'INSERT',
                schema: 'public',
                table: 'fault_log',
            },
            payload => announceFault(payload.new.id)
        )
        .subscribe();


    const announceFault = async faultId => {
        const { data: fault } = await supabase
            .from('fault_log')
            .select(`
                *,
                machine: machine_id (*),
                created_by: created_by_id (*)
            `)
            .eq('id', faultId)
            .single();

        console.log(fault);

        channel.send(`${fault.created_by.full_name} has reported a fault!`);
    }
});

client.on('message', message => {
    console.log(message);
});

client.login(process.env.BOT_TOKEN);