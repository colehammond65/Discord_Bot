const Discord = require("discord.js");
const fetch = require('node-fetch');
const config = require("./config.json");
const package = require("./package.json");
const client = new Discord.Client();
const prefix = config.prefix;
var serverID = config.serverID;
var channelID = config.channelID;
var logChannelID = config.logChannelID;
var isLive;
var isLocked;
var channel;
var logChannel;
var server;
var Subs
var VIPs
var token;

//#region Setup

setInterval(TwitchCheck, config.checkTime)

fetch('https://id.twitch.tv/oauth2/token?client_id=' + config.client_id + "&client_secret=" + config.client_secret + "&grant_type=client_credentials", {
    method: 'POST',
})
.then(res => res.json())
.then(res => {
    token = res.access_token;
});

//Login to DiscordAPI
client.login(config.token);

//Bot startup
client.on('ready', () => {
    //Set vars
    server = client.guilds.cache.get(serverID);
    channel = server.channels.cache.get(channelID);
    logChannel = server.channels.cache.get(logChannelID);
    //Log startup
    console.log(`Logged in as ${client.user.tag} to server ${server.name}`);
    logChannel.send(`Logged in as ${client.user.tag} to server ${server.name}`);

    Subs = server.roles.cache.find(role => role.name === "Twitch Subscriber");
    VIPs = server.roles.cache.find(role => role.name === "VIP");
});

// Automatically reconnect if the bot disconnects due to inactivity
client.on('disconnect', function(erMsg, code) {
    //Log disconnects and reconnect
    console.log('Bot disconnected from Discord with code ' + code + ' for reason:' + erMsg);
    logChannel.send('Bot disconnected from Discord with code ' + code + ' for reason:' + erMsg);
    bot.connect();
});

//#endregion

//Check if someone sent a command
client.on("message", function(message) {
    //Check if message is from myself
    if (message.author.bot) return;

    //Check if message has command prefix
    if (!message.content.startsWith(prefix)) return;

    const commandBody = message.content.slice(prefix.length);
    const args = commandBody.split(' ');
    const command = args.shift().toLowerCase();
    console.log("Command received: " + command);

    if (command === "version"){
        message.reply(`${package.version}`);
    }
});

function TwitchCheck(){
    fetch('https://api.twitch.tv/helix/streams?user_login=' + config.streamer, {
        method: 'GET',
        headers: {
            'Client-ID': config.client_id,
            'Authorization': 'Bearer ' + token
        }
    })
    .then(res => res.json())
    .then(res => {
        if(JSON.stringify(res) != '{"data":[],"pagination":{}}'){
            lock();
        }
        else{
            unlock();
        }
    });
    
}

//#region Lock/Unlock

//Lock the discord channel
function lock(){
    if(isLocked) return;
    isLive = true;
    let everyone = server.roles.everyone;
    channel.overwritePermissions([
        {id: Subs.id, deny: ['SEND_MESSAGES', 'VIEW_CHANNEL'],},
        {id: VIPs.id, deny: ['SEND_MESSAGES', 'VIEW_CHANNEL'],},
        {id: everyone.id, deny: ['VIEW_CHANNEL', 'SEND_MESSAGES']},
    ]);
    isLocked = true;
    console.log("Locked " + channel.name);
    logChannel.send("Locked " + channel.name);
}

//Unlock the discord channel
function unlock(){
    if(!isLocked) return;
    isLive = false;
    let everyone = server.roles.everyone;
    channel.overwritePermissions([
        {id: Subs.id, allow: ['SEND_MESSAGES', 'VIEW_CHANNEL'],},
        {id: VIPs.id, allow: ['SEND_MESSAGES', 'VIEW_CHANNEL'],},
        {id: everyone.id, allow: ['VIEW_CHANNEL'], deny: ['SEND_MESSAGES']},
    ]);
    isLocked = false;
    console.log("Unlocked " + channel.name);
    logChannel.send("Unlocked " + channel.name);
}

//#endregion