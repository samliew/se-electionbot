import { HerokuClient } from "./herokuClient.js";
import { sayBusyGreeting, sayIdleGreeting } from "./messages/greetings.js";
import { sayElectionSchedule } from "./messages/phases.js";
import { sendMessage, sendMessageList } from "./queue.js";
import { makeURL } from "./utils.js";

/**
 * @typedef {import("./config.js").BotConfig} BotConfig
 * @typedef {import("./election.js").default} Election
 * @typedef {import("chatexchange/dist/Room").default} Room
 * @typedef {import("./announcement.js").default} Announcement
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
            const rescraped = await election.scrapeElection(config);
            const { status, errors } = election.validate();

            if (!status || !rescraped) {
                console.error(`RESCRAPER - Invalid election data:\n${errors.join("\n")}`);
                return this.start();
            }

            if (config.verbose) {
                console.log('RESCRAPER -', election.updated, election);
            }

            if (config.debugOrVerbose) {
                const { arrNominees, arrWinners, phase } = election;

                console.log(`RESCRAPER - Candidates: ${arrNominees.map(x => x.userName).join(', ')}`);

                if (phase === 'ended') {
                    console.log(`RESCRAPER - Winners: ${arrWinners.map(x => x.userName).join(', ')}`);
                }

                const {
                    roomReachedMinActivityCount, roomBecameIdleAWhileAgo,
                    roomBecameIdleHoursAgo, botHasBeenQuiet, botSentLastMessage,
                    canIdleGreet: idleCanSayHi
                } = config;

                console.log(`RESCRAPER - IDLE? idleCanSayHi: ${idleCanSayHi}
                    ----------- reachedMinActivity: ${roomReachedMinActivityCount};
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

            // New nominations
            if (election.phase === 'nomination' && election.hasNewNominees) {
                await announcement?.announceNewNominees();
                console.log(`RESCRAPER - New nominees announced.`);
            }

            // Withdrawn nominations
            if (['nomination', 'primary', 'election'].some(phase => phase === election.phase) && election.newlyWithdrawnNominees.length > 0) {
                await announcement?.announceWithdrawnNominees();
                console.log(`RESCRAPER - Withdrawn nominees announced.`);
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

                await sendMessageList(
                    config, room, true,
                    `The ${makeURL("election", election.electionUrl)} dates have changed:`,
                    sayElectionSchedule(election)
                );
            }

            // The election was cancelled
            if (election.phase === 'cancelled' && election.isNewPhase()) {
                await announcement?.announceCancelled(room, election);
                console.log(`RESCRAPER - Election was cancelled.`);

                // Scale Heroku dynos to free (restarts app)
                const heroku = new HerokuClient(config);
                await heroku.scaleFree();
            }

            // Official results out
            if (election.phase === 'ended' && election.hasNewWinners) {
                await announcement?.announceWinners(room, election);
                console.log(`RESCRAPER - Winners announced.`);
            }

            // Election is over but there are no winners
            else if (election.phase === 'ended' && election.numWinners === 0) {

                // Reduce scrape interval further
                config.scrapeIntervalMins = 0.25;

                if (config.debugOrVerbose) {
                    console.log(`RESCRAPER - Election ended with no results - Scrape interval reduced to ${config.scrapeIntervalMins}.`);
                }
            }

            // The election is ending within the next 10 minutes or less, do once only
            else if (election.isEnding() && !config.flags.saidElectionEndingSoon) {

                config.flags.saidElectionEndingSoon = true;

                // Reduce scrape interval
                config.scrapeIntervalMins = 1;

                // Scale Heroku dynos to paid (restarts app)
                const heroku = new HerokuClient(config);
                await heroku.scaleHobby();

                // Announce election ending soon
                // Update index.js as well if message changes
                await sendMessage(config, room, `The ${makeURL('election', election.electionUrl)} is ending soon. This is the final chance to cast or modify your votes!`);

                if (config.debugOrVerbose) {
                    console.log(`RESCRAPER - Election ending - Scrape interval reduced to ${config.scrapeIntervalMins}.`);
                }
            }

            // If room is idle, remind users that bot is around to help
            else if (config.canIdleGreet) {
                await sayIdleGreeting(config, election, room);
            }
            else if (config.canBusyGreet) {
                await sayBusyGreeting(config, election, room);
            }
            // The election is over
            else if (election.phase === 'ended' || election.phase === 'cancelled' && config.scrapeIntervalMins !== 10) {

                // Increase scrape interval since we don't need to scrape often
                config.scrapeIntervalMins = 10;

                // Scale Heroku dynos to free (restarts app)
                const heroku = new HerokuClient(config);
                await heroku.scaleFree();

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
