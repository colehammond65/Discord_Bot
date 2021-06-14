const Discord = require("discord.js");
const config = require("./config.json");
const package = require("./package.json");
const client = new Discord.Client();
const prefix = config.prefix;
var serverID = '848804610713976842';
var server;

const setTZ = require('set-tz');
const timeZone = 'Pacific/Auckland';
var checkTime = 5000;
var currentTime;

const lockTime = 18; //6pm
const unlockTime = 2; //2am
var channelLocked;

setTZ(timeZone);

//Repeat tasks
setInterval(() => getCurrentTime(), checkTime);

//Login to DiscordAPI
client.login(config.token);

//Bot startup
client.on('ready', () => {
    server = client.guilds.cache.get(serverID);
    console.log(`Logged in as ${client.user.tag} to server ${server.name}`);
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

    if (command === "time"){
        getCurrentTime();
        message.reply(`${currentTime}`);
        return;
    }

    if(command === "check"){
        setChannelLock();
        return;
    }

    if(command === "overridelock"){
        lockChannel();
        return;
    }

    if(command === "overrideunlock"){
        unlockChannel();
        return;
    }

    if(command === "test"){
        lockChannel();
        return;
    }

    else{
        message.reply(`Command not found`);
        return;
    }
});

//Get the current date and time
function getCurrentTime(){
    //Date Object
    let date_ob = new Date();

    // current hours
    let Hours = date_ob.getHours();

    // current hours
    let Seconds = date_ob.getMinutes();

    currentHour = string = Hours;
    currentSeconds = string = Seconds;
    currentTime = string = currentHour + ":" + currentSeconds;

    //console.log(currentHour);
}

//Lock Channel
function setChannelLock(){
    getCurrentTime()
    if(currentHour > lockTime || currentHour < unlockTime){
        if(!channelLocked){
            lockChannel();
        }
        console.log('Channel already locked')
    }
    if(currentHour < lockTime || currentHour > unlockTime){
        if(channelLocked){
            unlockChannel();
        }
        console.log('Channel already unlocked');
    }
    else{
        console.log('WTF is going on');
    }
}

//Lock Channel
function lockChannel(){

    //Lock Channel here
    let channel = client.channels.fetch('848812160213843998');
    console.log('Channel name: ' + channel.id);

    channel.updateOverwrite(server.roles.everyone, { VIEW_CHANNEL: false });

    // channelLocked = true;
    console.log('Channel locked');
}

//Unlock Channel
function unlockChannel(){

    //Unlock channel here
    
    console.log('Channel unlocked');
    channelLocked = false;
}