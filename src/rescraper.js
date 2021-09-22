import { sayHI } from "./messages.js";
import { sendMessage } from "./queue.js";
import { makeURL } from "./utils.js";

/**
 * @typedef {import("./config.js").BotConfig} BotConfig
 * @typedef {import("./election.js").default} Election
 * @typedef {import("chatexchange/dist/Room").default} Room
 * @typedef {import("./ScheduledAnnouncement.js").default} Announcement
 */

/**
 * @summary rescrapes election data and processes updates
 */
export default class Rescraper {

    /**
     * @summary next reschedule timout
     * @type {NodeJS.Timeout|void}
     */
    timeout;

    /**
     * @summary elections announcer
     * @type {Announcement|undefined}
     */
    announcement;

    isStackOverflow = false;

    /**
     * @param {BotConfig} config bot config
     * @param {Room} room chatroom the bot is connected to
     * @param {Election} election current election
     * @param {Announcement} [announcement] announcer instance
     */
    constructor(config, room, election, announcement) {
        this.config = config;
        this.election = election;
        this.announcement = announcement;
        this.room = room;
    }

    /**
     * @summary Function to rescrape election data, and process election or chat room updates
     */
    async rescrape() {
        const { election, config, announcement, room } = this;

        await election.scrapeElection(config);

        const roomLongIdleDuration = this.isStackOverflow ? 3 : 12; // short idle duration for SO, half a day on other sites
        const { roomReachedMinimumActivityCount } = config;
        const roomBecameIdleAShortWhileAgo = config.lastActivityTime + (4 * 6e4) < Date.now();
        const roomBecameIdleAFewHoursAgo = config.lastActivityTime + (roomLongIdleDuration * 60 * 6e4) < Date.now();
        const botHasBeenQuiet = config.lastMessageTime + (config.lowActivityCheckMins * 6e4) < Date.now();
        const lastMessageIsPostedByBot = config.lastActivityTime === config.lastMessageTime;

        const idleDoSayHi = (roomBecameIdleAShortWhileAgo && roomReachedMinimumActivityCount && botHasBeenQuiet) ||
            (roomBecameIdleAFewHoursAgo && !lastMessageIsPostedByBot);

        if (config.verbose) {
            console.log('SCRAPE', election.updated, election);
        }

        if (config.debug) {
            const { arrNominees, arrWinners, phase } = election;

            console.log(`Election candidates: ${arrNominees.map(x => x.userName).join(', ')}`);

            if (phase === 'ended') {
                console.log(`Election winners: ${arrWinners.map(x => x.userName).join(', ')}`);
            }

            console.log(`Idle?
                - roomReachedMinimumActivityCount: ${roomReachedMinimumActivityCount}
                - roomBecameIdleAShortWhileAgo: ${roomBecameIdleAShortWhileAgo}
                - roomBecameIdleAFewHoursAgo: ${roomBecameIdleAFewHoursAgo}
                - botHasBeenQuiet: ${botHasBeenQuiet}
                - lastMessageIsPostedByBot: ${lastMessageIsPostedByBot}
                - idleDoSayHi: ${idleDoSayHi}`);
        }

        // No previous scrape results yet, do not proceed
        if (typeof election.prev === 'undefined') return;

        // Previously had no primary, but after rescraping there is one
        if (!announcement.hasPrimary && election.datePrimary != null) {
            announcement.initPrimary(election.datePrimary);
            await sendMessage(config, room, `There will be a primary phase before the election now, as there are more than ten candidates.`);
        }

        // After rescraping the election was cancelled
        if (election.phase === 'cancelled' && election.isNewPhase()) {
            await announcement.announceCancelled(room, election);
        }

        // After rescraping we have winners
        else if (election.phase === 'ended' && election.newWinners.length) {
            await announcement.announceWinners(room, election);
            this.stop();
        }

        // After rescraping, the election is over but we do not have winners yet
        else if (election.phase === 'ended' && !election.newWinners.length) {

            // Reduce scrape interval further
            config.scrapeIntervalMins = 0.5;
        }

        // The election is ending within the next 10 minutes or less, do once only
        else if (election.isEnding() && !config.flags.saidElectionEndingSoon) {

            // Reduce scrape interval
            config.scrapeIntervalMins = 2;

            // Announce election ending soon
            await sendMessage(config, room, `The ${makeURL('election', election.electionUrl)} is ending soon. This is the final moment to cast your votes!`);
            config.flags.saidElectionEndingSoon = true;

            // Record last sent message time so we don't flood the room
            config.updateLastMessageTime();
        }

        // New nominations
        else if (election.phase == 'nomination' && election.newNominees.length) {
            await announcement.announceNewNominees();
        }

        // Remind users that bot is around to help when:
        //    1. Room is idle, and there was at least some previous activity, and last message more than lowActivityCheckMins minutes ago
        // or 2. If on SO-only, and no activity for a few hours, and last message was not posted by the bot
        else if (idleDoSayHi) {

            console.log(`Room is inactive with ${config.activityCount} messages posted so far (min ${config.lowActivityCountThreshold}).`,
                `Last activity ${config.lastActivityTime}; Last bot message ${config.lastMessageTime}`);

            await sendMessage(config, room, sayHI(election), null, true);

            // Reset last activity count
            config.activityCount = 0;
        }

        this.start();
    };

    /**
     * @summary stops the rescraper
     */
    stop() {
        this.timeout &&= clearTimeout(this.timeout);
    }

    /**
     * @summary starts the rescraper
     */
    start() {
        const { config: { scrapeIntervalMins } } = this;
        this.timeout = setTimeout(this.rescrape.bind(this), scrapeIntervalMins * 60000);
    }
}
