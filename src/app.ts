import {Message, Client, ClientUser} from "discord.js"
import config from './config.json';
import {removePrefix} from './util/utilsStreamBot';
import {StreamYT} from './stream/StreamYT';


const bot = new Client();
let  streadmYT :StreamYT;

bot.login(config.tokens.tokenSaliere);

bot.on("ready",()=> {
    streadmYT = new StreamYT(bot.user);

    console.log(`Bot logged as ${bot.user.tag}.`);

});


bot.on('message', (message : Message) => {

    if(message.content.startsWith(config.prefix)) {
        let command = removePrefix(message.content, config.prefix);
        let arg:string;

        switch (command) {

            //Stream audio youtube
            case "yt":
                arg = message.content.replace('//yt', '').trim();
                streadmYT.handleArg(message,arg,false);
                break;

            // Stream audio youtube sans afficher le titre
            case "yts":
                arg = message.content.replace('//yts', '').trim();
                streadmYT.handleArg(message,arg,true);
                break;

            // Affiche la file d'attente de lecture
            case "queue":
                streadmYT.showQueueEmbed(message);
                break;

            // Saute la lecture en cours
            case "skip":
                streadmYT.skip(message);
                break;

            // is alive ? :)
            case "ping":
                return message.channel.send('Pong! (le retour :hap: )').catch(console.error);
                break;

            // Envoi un DM ( la commande n'existe pas )
            default :
                return message.author.createDM().then(message => {
                    return message.send(`La commande "${command}" n'existe pas.`)
                });

        }
    }
});
