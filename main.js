const { Client, Intents } = require('discord.js');
const fetch = require('node-fetch');
const config = require("./config.json");
const package = require("./package.json");
const myIntents = new Intents();
var client_id = config.client_id;
var twitch_token;
var server;
var channel;
var logChannel;
var isLocked;
var subs;
var vips;
var everyone;

myIntents.add(Intents.FLAGS.GUILD_PRESENCES, Intents.FLAGS.GUILD_MEMBERS);
const client = new Client({ intents: ["GUILDS", "GUILD_MESSAGES"] })

//Set TwitchCheck to fire every checkTime ms
setInterval(TwitchCheck, config.checkTime)

//Login to Twitch API and get oauth2 token
fetch('https://id.twitch.tv/oauth2/token?client_id=' + client_id + "&client_secret=" + config.client_secret + "&grant_type=client_credentials", {
    method: 'POST',
})
.then(res => res.json())
.then(res => {
    twitch_token = res.access_token;
});

//Login to DiscordAPI
client.login(config.discord_token);

//Bot startup
client.on('ready', () => {
    //Set vars
    server = client.guilds.cache.get(config.serverID);
    channel = server.channels.cache.get(config.channelID);
    logChannel = server.channels.cache.get(config.logChannelID);
    subs = server.roles.cache.find(role => role.name === "Twitch Subscriber");
    vips = server.roles.cache.find(role => role.name === "VIP");
    everyone = server.roles.everyone;
    //Log startup
    console.log(`Connected to server ${server.name} as ${client.user.tag}. Version ${package.version}`);
    logChannel.send(`Connected to server ${server.name} as ${client.user.tag}. Version ${package.version}`);
});

// Automatically reconnect if the bot disconnects due to inactivity
client.on('disconnect', function(erMsg, code) {
    //Log disconnects and reconnect
    bot.connect();
    console.log('Bot disconnected from Discord with code ' + code + ' for reason:' + erMsg);
    logChannel.send('Bot disconnected from Discord with code ' + code + ' for reason:' + erMsg);
    //Log startup
    console.log(`Connected to server ${server.name} as ${client.user.tag}. Version ${package.version}`);
    logChannel.send(`Connected to server ${server.name} as ${client.user.tag}. Version ${package.version}`);
});

//Check if someone sent a command
client.on("messageCreate", function(message) {
    // Set prefix var
    const prefix = config.prefix;

    //Check if message is from myself
    if (message.author.bot) return;

    //Check if message has command prefix
    if (!message.content.startsWith(prefix)) return;

    const commandBody = message.content.slice(prefix.length);
    const args = commandBody.split(' ');
    const command = args.shift().toLowerCase();
    console.log("Command received: " + command);

    if (command === "version") message.reply(`${package.version}`);
});

//Check if streamer is live
function TwitchCheck(){
    //Get user data from Twitch API
    fetch('https://api.twitch.tv/helix/streams?user_login=' + config.streamer, {
        method: 'GET',
        headers: {
            'Client-ID': config.client_id,
            'Authorization': 'Bearer ' + twitch_token
        }
    })
    //Convert to json
    .then(res => res.json())
    //trigger channel lock/unlock if needed. '{"data":[],"pagination":{}}' returned when streamer isnt live
    .then(res => {
        //Streamer is live, lock
        if(JSON.stringify(res) != '{"data":[],"pagination":{}}') lock();
        //Streamer isnt live, unlock
        else unlock();
    });
}

//Lock the discord channel
function lock(){
    //Check if that channel is already locked, if so, return
    if(isLocked) return;
    //Edit permissions to lock the channel
    channel.overwritePermissions([
        {id: subs.id, deny: ['SEND_MESSAGES', 'VIEW_CHANNEL'],},
        {id: vips.id, deny: ['SEND_MESSAGES', 'VIEW_CHANNEL'],},
        {id: everyone.id, deny: ['VIEW_CHANNEL', 'SEND_MESSAGES']},
    ]);
    //Set isLocked and log channel changes
    isLocked = true;
    console.log("Locked " + channel.name);
    logChannel.send("Locked " + channel.name);
}

//Unlock the discord channel
function unlock(){
    //Check if that channel is already unlocked, if so, return
    if(!isLocked) return;
    //Edit permissions to unlock the channel
    channel.overwritePermissions([
        {id: subs.id, allow: ['SEND_MESSAGES', 'VIEW_CHANNEL'],},
        {id: vips.id, allow: ['SEND_MESSAGES', 'VIEW_CHANNEL'],},
        {id: everyone.id, allow: ['VIEW_CHANNEL'], deny: ['SEND_MESSAGES']},
    ]);
    //Set isLocked and log channel changes
    isLocked = false;
    console.log("Unlocked " + channel.name);
    logChannel.send("Unlocked " + channel.name);
}