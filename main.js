const { Client, GatewayIntentBits, Partials, EmbedBuilder } = require('discord.js');
const fetch = require('node-fetch');
const fs = require('fs');
const config = require("./config.json");
const RolesJson = "./roles.json";
const package = require("./package.json");
const { debug } = require('console');
var client_id = config.client_id;
var twitch_token;
var server;
var channel;
var logChannel;
var streamannouncementChannel;
var supportChannel;
var letsTalkChannel;
var isLocked = false;
var ready = false;
var prefix = config.prefix;
var readWriteRoles = new Array();
var readOnlyRoles = new Array();
var serverAccessRoleId = config.serverAccessRoleId;

//#region DJS Setup
const client = new Client({
    intents: [ GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildMessages, GatewayIntentBits.DirectMessages, GatewayIntentBits.MessageContent ], 
    partials: [ Partials.User, Partials.Channel, Partials.GuildMember, Partials.Message, Partials.Reaction ] 
});


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
        letsTalkChannel = server.channels.cache.get(config.letsTalkChannelID);
        streamannouncementChannel = server.channels.cache.get(config.streamannouncementID);

        var readWriteRolesJson = config.readWriteRoleIds;
        for(var i = 0; i < readWriteRolesJson.length; i++) {readWriteRoles[i] = server.roles.cache.find(role => role.id === readWriteRolesJson[i]);}

        var readOnlyRolesJson = config.readOnlyRoleIds;
        for(var i = 0; i < readOnlyRolesJson.length; i++) {readOnlyRoles[i] = server.roles.cache.find(role => role.id === readOnlyRolesJson[i]);}

        //check if roles.json exists
        if (!fs.existsSync(RolesJson)) {
            console.log("Roles.json does not exist, creating...");
            var setupString = '{"users":[]}';
            fs.writeFileSync(RolesJson, setupString);
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

//#region Misc

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

//#endregion

//#region Commands

//Check if someone sent a command
client.on("messageCreate", function(message) {
    try {
        if (!ready) return;

        //Check if message is from myself
        if (message.author.bot) return;

        //Check if message has command prefix
        if (!message.content.startsWith(prefix)) return;

        const commandBody = message.content.slice(prefix.length);
        const args = commandBody.split(' ');
        const command = args.shift().toLowerCase();
        console.log("Command received: " + command);

        if (command === "version") message.reply(`Promo Discord Bot connected as ${client.user.tag}. Version ${package.version}`)
        else if (command === "status" && isLocked) message.reply(`Channel : ${channel.name} is currently LOCKED`)
        else if (command === "status" && !isLocked) message.reply(`Channel : ${channel.name} is currently UNLOCKED`)
        else if (command === "whitelist") AddUserToWhitelist(message)
        else if (command === "talk") Talk(message)
        else if (command === "help") message.reply(`Commands: \n\n ${prefix}version - returns version \n ${prefix}status - returns status \n ${prefix}whitelist - adds user to whitelist \n ${prefix}talk - sends message to #lets-talk \n ${prefix}help - returns this message`)
        else {message.reply("Command: (" + command + ") not found or is not yet implemented. Please use !help to see a list of commands."); console.log("Command " + command + " not found or is not yet implemented. Please use !help to see a list of commands.");}
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
            if(JSON.stringify(res) != '{"data":[],"pagination":{}}') lock(res);
            //Streamer isnt live, unlock
            else unlock();
        });
    }
    catch (e) {
        console.log(e); // pass exception object to error handler
    }
}

//Lock the discord channel
function lock(json){
    try {
        if (!ready) return;
        if (isLocked) return;
        if (!Array.isArray(readWriteRoles) || !readWriteRoles.length) return;
        if (!Array.isArray(readOnlyRoles) || !readOnlyRoles.length) return;
        //Edit permissions to lock the channel
        for(var i = 0; i < readWriteRoles.length; i++) {
            channel.permissionOverwrites.edit(readWriteRoles[i].id, { ViewChannel: false });
        }
        for(var i = 0; i < readOnlyRoles.length; i++) {
            channel.permissionOverwrites.edit(readOnlyRoles[i].id, { ViewChannel: false });
        }
        //Set isLocked and log channel changes
        isLocked = true;
        console.log("Locked " + channel.name);
        logChannel.send("Locked " + channel.name);

/*         var streamTitle = json.data[0].title;
        var thumbnailUrl = json.data[0].thumbnail_url;
        thumbnailUrl = thumbnailUrl.replace("{width}", "960");
        thumbnailUrl = thumbnailUrl.replace("{height}", "540"); */

        //Send notification
        const liveEmbed = new EmbedBuilder()
        .setColor('#ffffbb')
        .setTitle(streamTitle)
        .setURL('https://www.twitch.tv/mmarshyellow')
        .setAuthor({ name: 'mmarshyellow', iconURL: 'https://static-cdn.jtvnw.net/jtv_user_pictures/d4a7ce64-728f-4495-8270-5ea2f0096834-profile_image-150x150.png', url: 'https://www.twitch.tv/mmarshyellow' })
        .setDescription('Marshy is live!')
        .setThumbnail('https://static-cdn.jtvnw.net/jtv_user_pictures/d4a7ce64-728f-4495-8270-5ea2f0096834-profile_image-300x300.png')
        .setImage("https://static-cdn.jtvnw.net/previews-ttv/live_user_mmarshyellow-960x540.jpg")

        streamannouncementChannel.send({
            content: 'Hey @everyone, MMarshyellow, is now live https://www.twitch.tv/mmarshyellow ~ Come keep her company!',
            embeds: [liveEmbed],
        });
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
            channel.permissionOverwrites.edit(readWriteRoles[i].id, { ViewChannel: true });
        }
        for(var i = 0; i < readOnlyRoles.length; i++) {
            channel.permissionOverwrites.edit(readOnlyRoles[i].id, { ViewChannel: true });
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
    try {
        var UnixTimeSeconds = Math.floor(Date.now());
        return UnixTimeSeconds
    }
    catch (e) {
        console.log(e); // pass exception object to error handler
    }
}


function AddUserToWhitelist(message){
    try {
        if (!ready) return;

        if (!message.member.roles.cache.has('720572310393847848')) return;

        var member = message.mentions.members.first();
        var role = server.roles.cache.find(role => role.id ==  serverAccessRoleId)
        member.roles.add(role);

        //Create json array with user id and current time
        var expiryTime = UnixTimeSeconds() + 2592000000;
        var user = {"id": member.id, "time": expiryTime};

        const dateObject = new Date(expiryTime);

        //User was added to Server Access Role
        supportChannel.send("<@" + member.user.id + "> You have been added to the server whitelist, Please check <#851348122746880000> for server details");
        logChannel.send(member.user.tag + " was added to Server Access Role, their access with expire on " + dateObject);
        console.log(member.user.tag + " was added to Server Access Role, their access with expire on " + dateObject);

        //cache current roles.json and parse
        var roles = JSON.parse(fs.readFileSync("./roles.json"));

        //Add user to json
        roles.users.push(user);

        //Write json to file
        fs.writeFileSync("./roles.json", JSON.stringify(roles));
    }
    catch (e) {
        console.log(e); // pass exception object to error handler
    }
}

async function ExpiryCheck(){
    var user;
    var roles = JSON.parse(fs.readFileSync("./roles.json"));
    var i;
    try {
        //check if the bot is ready
        if (!ready) return;
        //cache current roles.json and parse
        //Loop through users in roles.json
        for(i= 0; i < roles.users.length; i++) {
            //Check if user has been in server for more than expiryTime
            if(UnixTimeSeconds() > roles.users[i].time){
                //Time has expired, remove user from server access
                user = await server.members.fetch(roles.users[i].id);
                user.roles.remove(serverAccessRoleId);
                //remove user from roles.json
                roles.users.splice(i, 1);
                //Write json to file
                fs.writeFileSync("./roles.json", JSON.stringify(roles));
                console.log("Removed " + user.user.tag + " from Server Access Role \nRoles.json updated");
            }
        }
    }
    catch (e) {
        //console.log(e); // pass exception object to error handler
        roles.users.splice(i, 1);
        //Write json to file
        fs.writeFileSync("./roles.json", JSON.stringify(roles));
        
    }
}

//#endregion

//#region Talk channel

function Talk(message){
    try {
        if (!ready) return;
        async function clear() {
            msg.delete();
            const fetched = await msg.channel.fetchMessages({limit: 99});
            msg.channel.bulkDelete(fetched);
        }

        var member = message.mentions.members.first();

        letsTalkChannel.permissionOverwrites.set([
            {
                id: 720572310393847848,
                allow: [Permissions.FLAGS.VIEW_CHANNEL],
            },
            {
                id: 720605380257906758,
                allow: [Permissions.FLAGS.VIEW_CHANNEL],
            },
            {
                id: 720637902555447348,
                allow: [Permissions.FLAGS.VIEW_CHANNEL],
            },
            {
                id: member.id,
                allow: [Permissions.FLAGS.VIEW_CHANNEL],
            }
        ]);
    }
    catch (e) {
        console.log(e); // pass exception object to error handler
    }
}