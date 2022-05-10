const { Client, Intents } = require('discord.js');
const fetch = require('node-fetch');
const fs = require('fs');
const jsonfile = require('jsonfile')
const config = require("./config.json");
const RolesJson = "./roles.json";
const package = require("./package.json");
var client_id = config.client_id;
var twitch_token;
var server;
var channel;
var logChannel;
var supportChannel;
var isLocked = false;
var ready = false;
var readWriteRoles = new Array();
var readOnlyRoles = new Array();
var serverAccessRoleId = config.serverAccessRoleId;

//#region DJS Setup
const client = new Client({ intents: ["GUILDS", "GUILD_MEMBERS", "GUILD_MESSAGES", "DIRECT_MESSAGES"], partials: ["USER", "CHANNEL", "GUILD_MEMBER", "MESSAGE", "REACTION", "GUILD_SCHEDULED_EVENT"] });

//Login to DiscordAPI
client.login(config.discord_token);

//Bot startup
client.on('ready', () => {
    try {
        //Set vars
        server = client.guilds.cache.get(config.serverID);
        channel = server.channels.cache.get(config.channelID);
        logChannel = server.channels.cache.get(config.logChannelID);
        supportChannel = server.channels.cache.get(config.supportChannelID);

        var readWriteRolesJson = config.readWriteRoleIds;
        for(var i = 0; i < readWriteRolesJson.length; i++) {
            readWriteRoles[i] = server.roles.cache.find(role => role.id === readWriteRolesJson[i]);
        }

        var readOnlyRolesJson = config.readOnlyRoleIds;
        for(var i = 0; i < readOnlyRolesJson.length; i++) {
            readOnlyRoles[i] = server.roles.cache.find(role => role.id === readOnlyRolesJson[i]);
        }

        //check if roles.json exists
        if (!fs.existsSync(RolesJson)) {
            console.log("Roles.json does not exist, creating...");
            jsonfile.writeFileSync(RolesJson, {"users":[]});
        }

        //Log startup
        console.log(`Promo Discord Bot - version ${package.version} connected to server ${server.name} as ${client.user.tag}`);
        logChannel.send(`Promo Discord Bot - version ${package.version} connected to server ${server.name} as ${client.user.tag}`);
        ready = true;
        }
    catch (e) {
        console.log(e); // pass exception object to error handler
    }
});

// Automatically reconnect if the bot disconnects due to inactivity
client.on('disconnect', function(erMsg, code) {
    try {
        //Log disconnects and reconnect
        bot.connect();
        console.log(`Promo Discord Bot - version ${package.version}` + ' disconnected from Discord with code ' + code + ' for reason:' + erMsg);
        logChannel.send(`Promo Discord Bot - version ${package.version}` + ' disconnected from Discord with code ' + code + ' for reason:' + erMsg);
        //Log startup
        console.log(`Promo Discord Bot - version ${package.version} Reconnected to server ${server.name} as ${client.user.tag}. Version ${package.version}`);
        logChannel.send(`Promo Discord Bot - version ${package.version} Reconnected to server ${server.name} as ${client.user.tag}. Version ${package.version}`);
    }
    catch (e) {
        console.log(e); // pass exception object to error handler
    }
});

//Check if someone sent a command
client.on("messageCreate", function(message) {
    try {
        // Set prefix var
        const prefix = config.prefix;

        //Check if message is from myself
        if (message.author.bot) return;
        if (message.channel != logChannel) return; 

        //Check if message has command prefix
        if (!message.content.startsWith(prefix)) return;

        const commandBody = message.content.slice(prefix.length);
        const args = commandBody.split(' ');
        const command = args.shift().toLowerCase();
        console.log("Command received: " + command);

        if (command === "version") message.reply(`Promo Discord Bot connected as ${client.user.tag}. Version ${package.version}`);
        if (command === "status" && isLocked) message.reply(`Channel : ${channel.name} is currently LOCKED`)
        if (command === "status" && !isLocked) message.reply(`Channel : ${channel.name} is currently UNLOCKED`)
    }
    catch (e) {
        console.log(e); // pass exception object to error log
    }
});

//#endregion

//#region Twitch Checker

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

//Check if streamer is live
function TwitchCheck(){
    try {
        if (!ready) return;
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
    catch (e) {
        console.log(e); // pass exception object to error handler
    }
}

//Lock the discord channel
function lock(){
    try {
        if (!ready) return;
        if (isLocked) return;
        if (!Array.isArray(readWriteRoles) || !readWriteRoles.length) return;
        if (!Array.isArray(readOnlyRoles) || !readOnlyRoles.length) return;
        //Edit permissions to lock the channel
        for(var i = 0; i < readWriteRoles.length; i++) {
            channel.permissionOverwrites.edit(readWriteRoles[i].id, { VIEW_CHANNEL: false, SEND_MESSAGES: false});
        }
        for(var i = 0; i < readOnlyRoles.length; i++) {
            channel.permissionOverwrites.edit(readOnlyRoles[i].id, { VIEW_CHANNEL: false });
        }
        //Set isLocked and log channel changes
        isLocked = true;
        console.log("Locked " + channel.name);
        logChannel.send("Locked " + channel.name);
    }
    catch (e) {
        console.log(e); // pass exception object to error handler
    }
}

//Unlock the discord channel
function unlock(){
    try {
        if (!ready) return;
        if (!isLocked) return; 
        if (!Array.isArray(readWriteRoles) || !readWriteRoles.length) return;
        if (!Array.isArray(readOnlyRoles) || !readOnlyRoles.length) return;
        //Edit permissions to unlock the channel
        for(var i = 0; i < readWriteRoles.length; i++) {
            channel.permissionOverwrites.edit(readWriteRoles[i].id, { VIEW_CHANNEL: true, SEND_MESSAGES: true});
        }
        for(var i = 0; i < readOnlyRoles.length; i++) {
            channel.permissionOverwrites.edit(readOnlyRoles[i].id, { VIEW_CHANNEL: true });
        }
        //Set isLocked and log channel changes
        isLocked = false;
        console.log("Unlocked " + channel.name);
        logChannel.send("Unlocked " + channel.name);
    }
    catch (e) {
        console.log(e); // pass exception object to error handler
    }
}

//#endregion

//#region Expiry Roles

//Set ExpiryCheck to fire every checkTime ms
setInterval(ExpiryCheck, config.checkTime)

//Return unix time seconds
function UnixTimeSeconds() {
    return Math.floor(Date.now() / 1000);
}

client.on("guildMemberUpdate", (oldMember, newMember) => {
    // Old roles Collection is smaller in size than the new one. A role has been added.
    if (oldMember.roles.cache.size < newMember.roles.cache.size) {
        // Looping through the role and checking which role was added.
        newMember.roles.cache.forEach(role => {
            if (!oldMember.roles.cache.has(role.id)) {
                if(role == serverAccessRoleId){
                    //User was added to Server Access Role
                    supportChannel.send(newMember.user.tag + " You have been added to the server whitelist, Please check #smp-info for server details");
                    //Create json array with user id and current time
                    var expiryTime = UnixTimeSeconds() + 2592000;
                    var user = {
                        "id": newMember.id, 
                        "time": expiryTime 
                    };
                    //cache current roles.json and parse
                    var roles = JSON.parse(fs.readFileSync("./roles.json"));
                    //Add user to json
                    roles.users.push(user);
                    console.log(newMember.user.tag + " was added to Server Access Role")
                    //Write json to file
                    fs.writeFileSync("./roles.json", JSON.stringify(roles));
                    console.log("roles.json updated");
                }
            }
        });
    }
});

async function ExpiryCheck(){
    try {
        if (!ready) return;
        //cache current roles.json and parse
        var roles = JSON.parse(fs.readFileSync("./roles.json"));
        //Loop through users in roles.json
        for(var i = 0; i < roles.users.length; i++) {
            //Check if user has been in server for more than expiryTime
            if(UnixTimeSeconds() > roles.users[i].time){
                //User has expired, remove from roles.json
                //remove role from dc user
                var user = await server.members.fetch(roles.users[i].id);
                user.roles.remove(serverAccessRoleId);
                console.log("Removed " + user.user.tag + " from Server Access Role");
                //cache current roles.json and parse
                var roles = JSON.parse(fs.readFileSync("./roles.json"));
                //remove user from roles.json
                roles.users.splice(i, 1);
                //Write json to file
                fs.writeFileSync("./roles.json", JSON.stringify(roles));
                console.log("roles.json updated");
            }
        }
    }
    catch (e) {
        console.log(e); // pass exception object to error handler
    }
}

