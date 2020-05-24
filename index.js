/// Base skeleton code by Lumpy

const dotenv = require('dotenv');
dotenv.config();

const Discord = require('discord.js');
const bot = new Discord.Client();

const token = process.env.TOKEN;

var players = [];
var votes = [];

//Add Lynch
bot.on('message', msg=>{
    if(msg.content.startsWith("/lynch ")) {
        var parts = msg.content.split(' ');
        var mentions = msg.mentions.users;

        console.log(mentions.array());
    }
})

bot.login(token);