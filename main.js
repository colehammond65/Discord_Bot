const Discord = require("discord.js");
request = require('superagent');
const config = require("./config.json");
const package = require("./package.json");
const client = new Discord.Client();
const prefix = config.prefix;
var serverID = config.serverID;
var channelID = config.channelID;
var logChannelID = config.logChannelID;
var _streamer = config.streamer;
var checkTime = config.checkTime;

var firstPass = true;
var isLive;
var isLocked;
var channel;
var logChannel;
var server;

//Repeat tasks
setInterval(() => getStreamInfo(_streamer), checkTime);

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
    console.log("Command recieved");
    logChannel.send("Command recieved");

    const commandBody = message.content.slice(prefix.length);
    const args = commandBody.split(' ');
    const command = args.shift().toLowerCase();

    if (command === "version"){
        message.reply(`${package.version}`);
        return;
    }

    else{
        message.reply(`Command not found`);
        return;
    }
});

// Get/output the streamer's details
function getStreamInfo(streamer){
    // Make the streamer/program globally accessible
    _streamer = streamer;

    // Store the header to use for all requests
    const header = {
        'Client-ID': '3zzmx0l2ph50anf78iefr6su9d8byj8',
        'Accept':    'application/vnd.twitchtv.v5+json'
    };

    // Store the URL to request users...
    const usersURL = 'https://api.twitch.tv/kraken/users?login=' + streamer
    // ... and make the request
    request.get(usersURL).set(header).end((err, res) => {
        // If an error occured, log a failure
        if (err) return failure(err);

        // Next, get the users array from the response body...
        const { users } = res.body;

        // Next, get the user's ID...
        const { _id: id } = users[0],
            // ... store the URL to request a stream,...
            streamsURL = 'https://api.twitch.tv/kraken/streams/' + id;
        // ... and make the final request
        request.get(streamsURL).set(header).end(response);
    });
};

// Handle the request response
function response(error, response) {
    return error ? failure(error) : success(response);
}

// Handle request success
function success(response) {
    // Attempt to get stream information from the response
    stream = JSON.parse(response.text).stream;
    // If there's no stream, let the user know the streamer is not streaming
    if (!stream) {
        isLive = false;
        if(isLocked || firstPass){
            unlock();
        }
        return;
    }
    if (stream) {
        isLive = true;
        if(!isLocked || firstPass){
            lock();
        }
        return;
    }
    else {
        console.log("Stream didnt return live status correctly");
        logChannel.send("Stream didnt return live status correctly");
    }
}

// Handle request failure
function failure(error) {
    console.log("An error occured!: " + error);
    logChannel.send("An error occured!: " + error);
    return process.exit(1);
}

//Lock the discord channel
function lock(){
    let Subs = server.roles.cache.find(role => role.name === "Twitch Subscriber");
    let VIPs = server.roles.cache.find(role => role.name === "VIP");
    let everyone = server.roles.everyone;
    firstPass = false;
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
    let Subs = server.roles.cache.find(role => role.name === "Twitch Subscriber");
    let VIPs = server.roles.cache.find(role => role.name === "VIP");
    let everyone = server.roles.everyone;
    firstPass = false;
    channel.overwritePermissions([
        {id: Subs.id, allow: ['SEND_MESSAGES', 'VIEW_CHANNEL'],},
        {id: VIPs.id, allow: ['SEND_MESSAGES', 'VIEW_CHANNEL'],},
        {id: everyone.id, allow: ['VIEW_CHANNEL'], deny: ['SEND_MESSAGES']},
    ]);
    isLocked = false;
    console.log("Unlocked " + channel.name);
    logChannel.send("Unlocked " + channel.name);
}