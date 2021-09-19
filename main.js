const Discord = require("discord.js");
request = require('superagent');
const config = require("./config.json");
const package = require("./package.json");
const client = new Discord.Client();
const prefix = config.prefix;
var serverID = config.serverID;
var channelID = config.channelID;
var _streamer = config.streamer;
var checkTime = config.checkTime;

var isLive = false;
var isLocked = false;
var channel;
var server;

//Repeat tasks
setInterval(() => getStreamInfo(_streamer), checkTime);

//Login to DiscordAPI
client.login(config.token);

//Bot startup
client.on('ready', () => {
    server = client.guilds.cache.get(serverID);
    console.log(`Logged in as ${client.user.tag} to server ${server.name}`);
    channel = server.channels.cache.get(channelID);
});

// Automatically reconnect if the bot disconnects due to inactivity
client.on('disconnect', function(erMsg, code) {
    console.log('Bot disconnected from Discord with code ' + code + ' for reason:' + erMsg);
    bot.connect();
});

//Check if someone sent a command
client.on("message", function(message) {
    //Check if message is from myself
    if (message.author.bot) return;

    //Check if message has command prefix
    if (!message.content.startsWith(prefix)) return;
    console.log('Command recieved');

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

// Converts the first character of a string to uppercase
function firstUp(string) {
    return string.substr(0,1).toUpperCase() + string.substr(1);
}

// Handle the request response
function response(error, response) {
    return error ? failure(error) : success(response);
}

// Handle request success
function success(response) {
    // Attempt to get stream information from the response
    const streamer = firstUp(_streamer),
    stream = JSON.parse(response.text).stream;
    // If there's no stream, let the user know the streamer is not streaming
    if (!stream) {
        isLive = false;
        if(isLocked){
            unlockChannel();
        }
    }
    else{
        isLive = true;
        if(!isLocked){
            lockChannel();
        }
    }
    console.log("Live: " + isLive);
}

// Handle request failure
function failure(error) {
    output('red', 'An error occured!', error);
    return process.exit(1);
}

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

//Lock Channel 
function lockChannel(){
    channel.overwritePermissions([
        {
            id: server.roles.everyone.id,
            deny: ['SEND_MESSAGES', 'VIEW_CHANNEL'],
        },
    ]);
    isLocked = true;
    console.log("Channel Locked");
}

//Unlock Channel
function unlockChannel(){
    channel.overwritePermissions([
        {
            id: server.roles.everyone.id,
            allow: ['SEND_MESSAGES', 'VIEW_CHANNEL'],
        },
    ]);
    isLocked = false;
    console.log("Channel Unlocked");
}