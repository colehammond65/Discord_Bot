const Discord = require("discord.js");
request = require('superagent');
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

    if(command === "lock"){
        lock();
    }

    if(command === "unlock"){
        unlock();
    }
});

//Check if Marshy is live
client.on("presenceUpdate", (oldPresence, newPresence) => {
    if(newPresence.user.tag != "MMarshyellow#2705") return;
    if (!newPresence.activities){
        unlock();
    }
    newPresence.activities.forEach(activity => {
        if (activity.type == "STREAMING" && isLive == false) {
            lock();
            return;
        }
        else{
            unlock();
        }
    });
});

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