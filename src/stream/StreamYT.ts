import {ClientUser, Message, RichEmbed, StreamDispatcher, User, VoiceConnection} from "discord.js";
import ytdl from 'ytdl-core';
import * as Collections from 'typescript-collections';
import youtubeSearch from 'youtube-search';
import config from '../config.json';
import {nbAverageChannel} from "../util/utilsStreamBot";

interface streamQueue {
    idUser : string
    title : string
    url : string
    duration : number
    username : string
    sneaky : boolean
}

export class StreamYT {

    private currentStream: streamQueue | undefined;
    private isSpeaking = false;
    private streamQueue: Collections.Queue<streamQueue> = new Collections.Queue<streamQueue>();
    private bot: ClientUser;
    private streamDispatcher : StreamDispatcher;

    //Skip
    private initializedSkipVote : boolean = false;
    private voterList : Collections.LinkedList<User> = new Collections.LinkedList<User>();

    constructor(bot: ClientUser) {
        this.bot = bot;
    }

    /**
     * Traite l'argument après la commande yt.s ( url ou mots clés )
     * @param message
     * @param arg
     * @param hideStreamInfo
     */
    public handleArg(message: Message, arg: string, hideStreamInfo: boolean): void {

        // Stream uniquement si le message est écrit au sein d'une guild et que l'utilisateur y est connecté
        if (message.guild && message.member.voiceChannel) {


            if (hideStreamInfo) message.delete(10);

            let opts: youtubeSearch.YouTubeSearchOptions = {
                maxResults: 1,
                key: config.youtubeAPIKey
            };

            youtubeSearch(arg, opts, ((err, result) => {
                if (err) throw err;
                // console.log(result[0].link);
                if (result.length) {
                    this.addYTQueueAndJoin(message, result[0].link, hideStreamInfo)
                } else {

                    if(hideStreamInfo) {
                        return message.author.createDM().then(message => {
                            message.send(`Aucun résultat pour ${arg} ... :'(`)
                        });
                    }
                    return message.channel.send(`Aucun résultat pour ${arg} ... :'(`);
                }
            }));

        } else message.reply('cette commande est disponible uniquement si vous êtes connecté à un salon vocal.');
    }

    /**
     * Ajoute la lecture en file d'atente
     * @param message
     * @param url
     * @param hideStreamInfo
     */
    private addYTQueueAndJoin(message: Message, url: string, hideStreamInfo: boolean) {

        ytdl.getInfo(url, (err, info) => {
            if (err) throw err;

            let addToQueue: streamQueue = {
                idUser : message.author.id,
                title: info.title,
                url: url,
                duration: parseInt(info.length_seconds),
                username: message.author.username,
                sneaky: hideStreamInfo
            };

            this.streamQueue.add(addToQueue);
            console.log("added! " + info.title);
            if (!this.isSpeaking) {
                message.member.voiceChannel.join().then((connection: VoiceConnection) => {
                    this.playStream(connection);
                })
            }
        })
    }

    /**
     * Recursive function to play stream queue
     * @param connection
     */
    private playStream(connection: VoiceConnection): void {

        this.currentStream = this.streamQueue.dequeue();
        this.streamDispatcher = connection.playStream(ytdl(this.currentStream.url, {quality: "highestaudio"}));
        this.streamDispatcher.setVolume(0.15);
        //Si sneaky (yts), cache le nom du titre
        let nameStream: string = (this.currentStream.sneaky) ? `La surprise de ${this.currentStream.username}` : this.currentStream.title;

        this.bot.setPresence({game: {name: nameStream}, status: "dnd"})
        this.isSpeaking = true;

        this.streamDispatcher.on('end', (reason => {
            console.log(reason);
            this.isSpeaking = false;
            this.currentStream = undefined;
            this.initializedSkipVote = false;
            if (!this.streamQueue.isEmpty()) return this.playStream(connection);
            this.bot.setPresence({game: {name: "rien"}, status: "online"});
        }));
    }

    /**
     * Affiche la liste des lectures en la file d'attente
     * @param message
     */
    public showQueue(message: Message) {

        if (this.currentStream) {

            message.channel.send('Lecture en cours : ');
            //Si sneaky (yts), cache le nom du titre
            let actualStreamName: string = (this.currentStream.sneaky) ? `La surprise de ${this.currentStream.username}` : this.currentStream.title + ' - ' + this.currentStream.username;
            message.channel.send(`1 -\t ${actualStreamName} `);

            if (!this.streamQueue.isEmpty()) {
                let i = 1;
                message.channel.send('Lectures à venir :');
                this.streamQueue.forEach(item => {
                    i++;
                    //Si sneaky (yts), cache le nom du titre
                    let nextStreamNames = (item.sneaky) ? `La surprise de ${item.username}` : item.title + ' - ' + item.username;
                    message.channel.send(i + " - \t" + nextStreamNames);
                });
            }
        } else {
            message.channel.send('Aucune diffusion en cours.')
        }
    }

    /**
     * Affiche la liste des streams de la file d'attente avec style
     * @param message
     */
    public showQueueEmbed(message: Message) {

        if(this.currentStream) {

            let actualStreamInfoEmbed = new RichEmbed();
            actualStreamInfoEmbed.setAuthor("LECTURE EN COURS : ");
            this.currentStream.sneaky ? actualStreamInfoEmbed.setColor("DARK_PURPLE") : actualStreamInfoEmbed.setColor("GREEN");
            this.currentStream.sneaky ? actualStreamInfoEmbed.setTitle("1 - Une surprise ") : actualStreamInfoEmbed.setTitle("1 - "+this.currentStream.title);
            actualStreamInfoEmbed.setFooter(this.currentStream.username);

            message.channel.send(actualStreamInfoEmbed);

            if(!this.streamQueue.isEmpty()) {
                let commingStreamInfoEmbed = new RichEmbed();
                commingStreamInfoEmbed.setAuthor("A VENIR : ");
                commingStreamInfoEmbed.setColor('BLUE');
                let i = 1;
                this.streamQueue.forEach(item => {
                    i++;
                    //Si sneaky (yts), cache le nom du titre
                    item.sneaky ? commingStreamInfoEmbed.addField(i+" - Une surprise ",item.username,false) : commingStreamInfoEmbed.addField(i+" - "+item.title,item.username, false);
                });
                message.channel.send(commingStreamInfoEmbed);
            }

        } else {
            let queueEmptyMEssage = new RichEmbed()
                .setTitle('Aucun diffusion en cours.').setColor("ORANGE");
            message.channel.send(queueEmptyMEssage);
        }
    }

    /**
     * Arrete la lecture en cous et passe au morceau suivant
     * @param message
     */
    public skip(message: Message) {

        if(!message.guild && message.member.voiceChannel) {
             message.member.createDM().then( message => {
                return message.send('Cette commande est disponible uniquement si vous êtes connecté dans le salon vocal du bot.')
            });
        }

        if(!this.isSpeaking) return message.channel.send('Aucune diffusion en cours.');

        if (message.author.id === this.currentStream.idUser) {

            if (this.currentStream.sneaky) {
                message.channel.send(`La suprise de ${this.currentStream.username} sautée.`)
            } else {
                message.channel.send(`${this.currentStream.title} de ${this.currentStream.username} sautée`);
            }
            return this.streamDispatcher.end("skipped by " + message.author.username);
        }

        if (!this.initializedSkipVote) {
            message.channel.send("[Fonctionnalité en BETA] Création d'un vote pour passer la lecture en cours (" + this.currentStream.title + ")");
            this.initializedSkipVote = true;
        }
        this.handleSkipVote(message);
    }

    /**
     * Gère le vote pour passer une lecture
     * @param message
     */
    private handleSkipVote(message : Message) {

        let alreadyVoted = false;

        this.voterList.forEach(user => {
            if (user.id === message.author.id)  {
                alreadyVoted = true;
            }
        });

        if(alreadyVoted) return message.channel.send(`Tu as déjà voté ${message.author.username} ;)`);

        this.voterList.add(message.author);

        if(this.voterList.size() < nbAverageChannel(message.member.voiceChannel)) {
            return message.channel.send(`${message.author.username} a voté ! (${this.voterList.size()}/${nbAverageChannel(message.member.voiceChannel)})`);
        }
        return this.streamDispatcher.end("Voted by guild members");
    }
}