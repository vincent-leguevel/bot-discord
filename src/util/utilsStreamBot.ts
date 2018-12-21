import {VoiceChannel} from "discord.js";

/**
 * Retire le prefix de la commande
 * @param message
 * @param prefix
 */
export function removePrefix(message: String, prefix: String) : String {
    return message.split(' ')[0].substr(prefix.length,message.length);
};


export function nbAverageChannel (voiceChannel : VoiceChannel) : number {

    let nbUser : number = 0;
    voiceChannel.members.forEach(member => {
        if(!member.user.bot) nbUser++
    });
    let average = Math.ceil(nbUser/2);
    if(average % 1 !== 0) return ++average;
    else return average;
}