import { addMinutes, MS_IN_SECOND, SEC_IN_MINUTE } from "../shared/utils/dates.js";
import { mapMap } from "../shared/utils/maps.js";
import { HerokuClient } from "./herokuClient.js";
import { sayBusyGreeting, sayIdleGreeting } from "./messages/greetings.js";

/**
 * @typedef {import("./config.js").BotConfig} BotConfig
 * @typedef {import("chatexchange").default} Client
 * @typedef {import("./election.js").default} Election
 * @typedef {import("chatexchange/dist/Room").default} Room
 * @typedef {import("./announcement.js").default} Announcer
 * @typedef {import("./scheduler.js").default} Scheduler
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
     * @param {BotConfig} config bot config
     * @param {Client} client ChatExchange client
     * @param {Room} room chatroom the bot is connected to
     * @param {Map<number, Election>} elections site elections
     * @param {Election} election current election
     * @param {Scheduler} scheduler announcer instance
     */
    constructor(config, client, room, elections, election, scheduler) {
        this.client = client;
        this.config = config;
        this.election = election;
        this.elections = elections;
        this.scheduler = scheduler;
        this.room = room;
    }

    /**
     * @summary convenience method for updating {@link Announcer}
     * @param {Announcer} announcement announcement instance
     */
    setAnnouncement(announcement) {
        this.announcement = announcement;
    }

    /**
     * @summary Function to rescrape election data, and process election or chat room updates
     */
    async rescrape() {
        const { client, elections, election, config, announcement, room, scheduler } = this;

        if (config.debugOrVerbose) {
            console.log(`[rescraper] rescrape function called.`);
        }

        const { nowOverride } = config;

        try {
            // Should happen before scrape call to ensure the announcement is unscheduled,
            // otherwise we may report new phase when in reality the dates are being changed.
            // Stops election phase start announcement if phase is eligible for extension.
            if (scheduler.isTaskInitialized("start") && election.isExtensionEligible(config)) {
                const status = scheduler.stopElectionStart();
                console.log(`[rescraper] election start task stop: ${status}`);
            }

            // Starts election phase announcement if phase is no longer eligible for extension.
            // TODO: it is possible to have a last-minute nomination in the extended period,
            // which can bypass the rescraper - in this case, election start can't be announced
            if (!scheduler.isTaskInitialized("start") && !election.isExtensionEligible(config)) {
                const status = scheduler.initElectionStart(election.dateElection);
                console.log(`[rescraper] election start task start: ${status}`);
            }

            const bot = await client.getMe();

            const rescraped = await election.scrapeElection(config);
            const { status, errors } = election.validate();

            if (!status || !rescraped) {
                console.log(`[rescraper] invalid election data:\n${errors.join("\n")}`);
                return this.start();
            }

            if (config.verbose) {
                console.log(`[rescraper] updated election:`, election.updated, election);
            }

            if (config.debugOrVerbose) {
                const { nominees, winners, numNominees, numWinners } = election;

                console.log(`[rescraper] candidates (${numNominees}): ${mapMap(nominees, x => x.userName).join(', ')}`);

                if (election.isEnded()) {
                    console.log(`[rescraper] winners (${numWinners}): ${mapMap(winners, x => x.userName).join(', ')}`);
                }

                const {
                    roomReachedMinActivityCount, roomBecameIdleAWhileAgo,
                    roomBecameIdleHoursAgo, botHasBeenQuiet, botSentLastMessage,
                    canIdleGreet: idleCanSayHi
                } = config;

                console.log(`[rescraper] bot state:
botHasBeenQuiet: ${botHasBeenQuiet};
botSentLastMessage: ${botSentLastMessage}
idleCanSayHi: ${idleCanSayHi}
roomReachedMinActivityCount: ${roomReachedMinActivityCount};
roomBecameIdleAWhileAgo: ${roomBecameIdleAWhileAgo};
roomBecameIdleHoursAgo: ${roomBecameIdleHoursAgo}`);
            }

            // No previous scrape results yet, do not proceed (prev can be null)
            if (!election.prev) {
                console.log(`[rescraper] no previous scrape`);
                return this.start();
            }

            if (election.electionChatRoomChanged) {
                console.log(`[rescraper] election chat room changed`);

                // Restart Heroku dyno via API
                const heroku = new HerokuClient(config);
                return await heroku.restartApp() || process.exit(1);
            }

            // New nominations
            if (election.isNomination(nowOverride)) {
                const status = await announcement?.announceNewNominees();
                console.log(`[rescraper] announced nomination: ${status}`);
            }

            // Withdrawn nominations
            if (election.isActive(nowOverride)) {
                const status = await announcement?.announceWithdrawnNominees();
                console.log(`[rescraper] announced withdrawn: ${status}`);
            }

            // Primary phase was activated (due to >10 candidates)
            if (!scheduler.hasPrimary && election.datePrimary) {
                scheduler.initPrimary(election.datePrimary);
                const status = await announcement?.announcePrimary();
                console.log(`[rescraper] announced primary: ${status}`);
            }

            // Election dates has changed (manually by CM)
            if (election.electionDatesChanged) {
                scheduler.reinitialize();
                const status = await announcement?.announceDatesChanged();
                console.log(`[rescraper] announced dates change: ${status}`);
            }

            if (election.isCancelled(nowOverride) && election.isNewPhase()) {
                scheduler.stopAll();
                const status = await announcement?.announceCancelled();
                console.log(`[rescraper] announced cancellation: ${status}`);
                this.stop();

                // Scale Heroku dynos to eco (restarts app)
                const heroku = new HerokuClient(config);
                if (config.autoscaleHeroku && await heroku.hasPaidDynos()) {
                    await heroku.scaleEco();
                }

                // After calling stop(), we need to return here otherwise start() will be called below!
                return;
            }

            // Official results out
            if (election.hasResults(nowOverride)) {
                const status = await announcement?.announceWinners();
                console.log(`[rescraper] announced winners: ${status}`);

                if (config.autoLeaveRoom) {
                    scheduler.initLeave(
                        addMinutes(nowOverride || new Date(), config.electionAfterpartyMins),
                        room,
                        async () => {
                            const heroku = new HerokuClient(config);
                            if (config.autoscaleHeroku && await heroku.hasPaidDynos()) {
                                // Scale Heroku dynos to eco (restarts app)
                                await heroku.scaleEco();
                            }
                        }
                    );
                }

                return this.stop();
            }

            // Election just over, there are no winners yet (waiting for CM)
            if (election.isEnded(nowOverride) && election.numWinners === 0) {

                // Reduce scrape interval further
                config.scrapeIntervalMins = 0.2;

                // Log this the first time only
                if (election.isNewPhase() && config.debugOrVerbose) {
                    console.log(`[rescraper] no results, scrape interval reduced to ${config.scrapeIntervalMins}.`);
                }
            }

            // The election is ending, do once only
            else if (election.isEnding() && !config.flags.saidElectionEndingSoon) {

                config.flags.saidElectionEndingSoon = true;

                // Reduce scrape interval
                config.scrapeIntervalMins = 1;

                // Scale Heroku dynos to paid (restarts app)
                if (config.autoscaleHeroku) {
                    const heroku = new HerokuClient(config);
                    await heroku.scaleBasic();
                }

                const status = await announcement?.announceElectionEndingSoon();
                console.log(`[rescraper] announce election ending soon: ${status}`);

                if (config.debugOrVerbose) {
                    console.log(`[rescraper] scrape interval reduced to ${config.scrapeIntervalMins}`);
                }
            }

            // The nomination phase is ending, do once only
            else if (election.isPhaseEnding('nomination') && !config.flags.saidNominationEndingSoon) {

                config.flags.saidNominationEndingSoon = true;

                const status = await announcement?.announceNominationEndingSoon();
                console.log(`[rescraper] announce nomination ending soon: ${status}`);
            }

            else if (election.isActive()) {
                const { canIdleGreet, canBusyGreet } = config;
                if (canIdleGreet) await sayIdleGreeting(config, elections, election, bot, room);
                if (canBusyGreet) await sayBusyGreeting(config, elections, election, bot, room);
                console.log(`[rescraper] activity greeting: idle ${canIdleGreet}, busy ${canBusyGreet}`);
            }

            else if (election.isInactive()) {
                // Set scrape interval to 5 mins since we no longer need to scrape frequently
                if (config.scrapeIntervalMins < 5) {
                    config.scrapeIntervalMins = 5;
                    console.log(`[rescraper] scrape interval increased to ${config.scrapeIntervalMins}.`);
                }
            }

            this.start();
        } catch (error) {
            console.error(`RESCRAPER - Failure`, error);
        }

        // Try rejoin room in case bot was disconnected
        client.joinRoom(room);

        if (config.debugOrVerbose) {
            console.log(`[rescraper] rescrape function completed.`);
        }
    };

    /**
     * @summary stops the rescraper
     */
    stop() {
        const { config, timeout } = this;

        if (timeout) this.timeout = clearTimeout(timeout);

        if (config.debugOrVerbose) {
            console.log(`[rescraper] next rescrape cleared.`);
        }
    }

    /**
     * @summary starts the rescraper
     */
    start() {
        const { config } = this;

        this.timeout = setTimeout(this.rescrape.bind(this), config.scrapeIntervalMins * SEC_IN_MINUTE * MS_IN_SECOND);

        if (config.debugOrVerbose) {
            console.log(`[rescraper] rescrape scheduled in ${config.scrapeIntervalMins} mins.`);
        }
    }
}
