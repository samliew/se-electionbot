import { HerokuClient } from "./herokuClient.js";
import { sayElectionSchedule, sayHI } from "./messages.js";
import { sendMessage } from "./queue.js";
import { makeURL, wait } from "./utils.js";

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
     * @summary next reschedule timeout
     * @type {NodeJS.Timeout|void}
     */
    timeout;

    /**
     * @summary elections announcer
     * @type {Announcement|undefined}
     */
    announcement;

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
     * @summary convenience method for updating Announcement
     * @param {Announcement} announcement announcement instance
     */
    setAnnouncement(announcement) {
        this.announcement = announcement;
    }

    /**
     * @summary Function to rescrape election data, and process election or chat room updates
     */
    async rescrape() {
        const { election, config, announcement, room } = this;

        if (config.debugOrVerbose) {
            console.log(`RESCRAPER - Rescrape function called.`);
        }

        try {
            await election.scrapeElection(config);

            const longIdleDuration = election.isStackOverflow ? 3 : 12; // short idle duration for SO, half a day on other sites
            const { roomReachedMinimumActivityCount, lastActivityTime, lastMessageTime, lowActivityCheckMins, botSentLastMessage } = config;
            const roomBecameIdleAWhileAgo = lastActivityTime + (4 * 6e4) < Date.now();
            const roomBecameIdleHoursAgo = lastActivityTime + (longIdleDuration * 60 * 6e4) < Date.now();
            const botHasBeenQuiet = lastMessageTime + (lowActivityCheckMins * 6e4) < Date.now();

            const idleDoSayHi = (roomBecameIdleAWhileAgo && roomReachedMinimumActivityCount && botHasBeenQuiet) ||
                (roomBecameIdleHoursAgo && !botSentLastMessage);

            if (config.verbose) {
                console.log('RESCRAPER -', election.updated, election);
            }

            if (config.debugOrVerbose) {
                const { arrNominees, arrWinners, phase } = election;

                console.log(`RESCRAPER - Candidates: ${arrNominees.map(x => x.userName).join(', ')}`);

                if (phase === 'ended') {
                    console.log(`RESCRAPER - Winners: ${arrWinners.map(x => x.userName).join(', ')}`);
                }

                console.log(`RESCRAPER - IDLE? idleDoSayHi: ${idleDoSayHi}
                    ----------- reachedMinActivity: ${roomReachedMinimumActivityCount};
                    ----------- roomBecameIdleAWhileAgo: ${roomBecameIdleAWhileAgo}; roomBecameIdleHoursAgo: ${roomBecameIdleHoursAgo}
                    ----------- botHasBeenQuiet: ${botHasBeenQuiet}; botSentLastMessage: ${botSentLastMessage}`
                );
            }

            // No previous scrape results yet, do not proceed (prev can be null)
            if (!election.prev) {

                if (config.debug) {
                    console.log(`RESCRAPER - No previous scrape.`);
                }
                return;
            }

            // Election chat room has changed
            if (election.electionChatRoomChanged) {

                // Restart Heroku dyno via API
                const heroku = new HerokuClient(config);
                return await heroku.restartApp() || process.exit(1);
            }

            // Primary phase was activated (due to >10 candidates)
            if (!announcement?.hasPrimary && election.datePrimary != null) {
                announcement?.initPrimary(election.datePrimary);
                await sendMessage(config, room, `There will be a **${makeURL("primary", election.electionUrl + "?tab=primary")}** phase before the election now, as there are more than ten candidates.`);
            }

            // Election dates has changed (manually by CM)
            if (election.electionDatesChanged) {
                announcement?.stopAll();
                announcement?.initAll();
                await sendMessage(config, room, `The ${makeURL("election", election.electionUrl)} dates have changed:`);
                await wait(1);
                await sendMessage(config, room, sayElectionSchedule(election));
            }

            // The election was cancelled
            if (election.phase === 'cancelled' && election.isNewPhase()) {
                await announcement?.announceCancelled(room, election);

                if (config.debugOrVerbose) {
                    console.log(`RESCRAPER - Election was cancelled.`);
                }
            }

            // New nominations
            else if (election.phase == 'nomination' && election.hasNewNominees) {
                await announcement?.announceNewNominees();

                if (config.debugOrVerbose) {
                    console.log(`RESCRAPER - New nominees announced.`);
                }
            }

            // Official results out
            else if (election.phase === 'ended' && election.hasNewWinners) {
                await announcement?.announceWinners(room, election);
                this.stop();

                if (config.debugOrVerbose) {
                    console.log(`RESCRAPER - No previous scrape.`);
                }
            }

            // Election is over but there are no winners
            else if (election.phase === 'ended' && election.numWinners === 0) {

                // Reduce scrape interval further
                config.scrapeIntervalMins = 0.5;

                if (config.debugOrVerbose) {
                    console.log(`RESCRAPER - Scrape interval reduced to ${config.scrapeIntervalMins}.`);
                }
            }

            // The election is ending within the next 10 minutes or less, do once only
            else if (election.isEnding() && !config.flags.saidElectionEndingSoon) {

                // Reduce scrape interval
                config.scrapeIntervalMins = 2;

                // Announce election ending soon
                await sendMessage(config, room, `The ${makeURL('election', election.electionUrl)} is ending soon. This is the final chance to cast your votes!`);
                config.flags.saidElectionEndingSoon = true;

                if (config.debugOrVerbose) {
                    console.log(`RESCRAPER - Scrape interval reduced to ${config.scrapeIntervalMins}.`);
                }
            }

            // Remind users that bot is around to help when:
            //    1. Room is idle, and there was at least some previous activity, and last message more than lowActivityCheckMins minutes ago
            // or 2. If on SO-only, and no activity for a few hours, and last message was not posted by the bot
            else if (idleDoSayHi) {

                console.log(`RESCRAPER - Room is inactive with ${config.activityCount} messages posted so far (min ${config.minActivityCountThreshold}).`,
                    `----------- Last activity ${config.lastActivityTime}; Last bot message ${config.lastMessageTime}`);

                await sendMessage(config, room, sayHI(election), null, true);

                // Reset last activity count
                config.activityCount = 0;
            }

            // The election is over
            if (election.phase === 'ended' || election.phase === 'cancelled' && config.scrapeIntervalMins !== 10) {

                // Increase scrape interval since we don't need to scrape often
                config.scrapeIntervalMins = 10;

                if (config.debugOrVerbose) {
                    console.log(`RESCRAPER - Scrape interval increased to ${config.scrapeIntervalMins}.`);
                }
            }

            this.start();
        } catch (error) {
            console.error(`RESCRAPER - Failure`, error);
        }

        if (config.debugOrVerbose) {
            console.log(`RESCRAPER - Rescrape function completed.`);
        }
    };

    /**
     * @summary stops the rescraper
     */
    stop() {
        const { config, timeout } = this;

        if (timeout) this.timeout = clearTimeout(timeout);

        if (config.debugOrVerbose) {
            console.log(`RESCRAPER - Next rescrape cleared.`);
        }
    }

    /**
     * @summary starts the rescraper
     */
    start() {
        const { config } = this;
        this.timeout = setTimeout(this.rescrape.bind(this), config.scrapeIntervalMins * 60000);

        if (config.debugOrVerbose) {
            console.log(`RESCRAPER - Next rescrape scheduled in ${config.scrapeIntervalMins} mins.`);
        }
    }
}
