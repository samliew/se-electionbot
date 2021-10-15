import { chatMarkdownToHtml, parseBoolEnv, parseIds, parseNumEnv } from "./utils.js";

/**
 * @typedef {import("chatexchange/dist/Client").Host} Host
 */

export class BotConfig {

    /**
     * @summary bot chat room id
     * @type {number}
     */
    chatRoomId;

    /**
     * @summary chat server (Host)
     * @type {Host}
     */
    chatDomain;

    /**
     * @param {Host} host chat host server
     * @param {number} roomId room id this configuration is for
     */
    constructor(host, roomId) {
        this.chatDomain = host;
        this.chatRoomId = roomId;
    }

    scriptInitDate = new Date();

    keepAlive = process.env.KEEP_ALIVE === 'true';

    // Bot instance identifier, base hostname for dashboard, also where keep-alive will ping
    // Ensure url starts with http and does not end with a slash, or keep it empty
    get scriptHostname() {
        const url = process.env.SCRIPT_HOSTNAME?.trim().replace(/\/?$/, '') || '';
        return url.startsWith('http') ? url : '';
    }

    /* Low activity count variables */

    // Variable to trigger an action only after this amount of minimum messages
    minActivityCountThreshold = +(process.env.LOW_ACTIVITY_COUNT_THRESHOLD || 20);

    get roomReachedMinimumActivityCount() {
        const { activityCounter, minActivityCountThreshold: minActivityCountThreshold } = this;
        return activityCounter >= minActivityCountThreshold;
    }

    // Variable to determine how long the room needs to be quiet to be idle - used by roomBecameIdleAWhileAgo
    shortIdleDurationMins = +(process.env.SHORT_IDLE_DURATION_MINS || 3);
    // Variable to determine how long the room needs to be quiet to be idle - used by roomBecameIdleHoursAgo
    longIdleDurationHours = +(process.env.LONG_IDLE_DURATION_HOURS || 12);
    // Variable to trigger greeting only after this time of inactivity - used by botHasBeenQuiet
    lowActivityCheckMins = +(process.env.LOW_ACTIVITY_CHECK_MINS || 5);

    get roomBecameIdleAWhileAgo() {
        return this.lastActivityTime + (this.shortIdleDurationMins * 6e4) < Date.now();
    }

    get roomBecameIdleHoursAgo() {
        return this.lastActivityTime + (this.longIdleDurationHours * 60 * 6e4) < Date.now();
    }

    get botHasBeenQuiet() {
        return this.lastMessageTime + (this.lowActivityCheckMins * 6e4) < Date.now();
    }

    /* Bot variables */

    // To stop bot from replying to too many messages in a short time, maintain a throttle with minimum
    minThrottleSecs = 1;
    _throttleSecs = +(process.env.THROTTLE_SECS || this.minThrottleSecs);

    get throttleSecs() {
        return this._throttleSecs;
    }
    set throttleSecs(newValue) {
        this._throttleSecs = newValue > this.minThrottleSecs ? newValue : this.minThrottleSecs;
    }

    // determines if the bot will listen to messages from self
    ignoreSelf = JSON.parse(process.env.IGNORE_SELF?.toLowerCase() || "true");

    // Variable to store time of last message in the room (by anyone, including bot), for idle checking purposes
    lastActivityTime = Date.now();
    // Variable to store time of last bot sent message, for throttling and muting purposes
    lastMessageTime = -1;
    // Variable to store last message to detect duplicate responses within a short time
    lastBotMessage = "";
    // Variable to track activity count in the room, to see if it reached minActivityCountThreshold
    activityCounter = 0;
    // Variable of rescrape interval of election page
    scrapeIntervalMins = parseNumEnv("scrape_interval_mins", 2);
    // Response when bot tries to post the exact same response again
    duplicateResponseText = "Please read my previous message...";

    /**
     * @summary gets last bot message HTML string
     * @returns {string}
     */
    get lastBotMessageHtml() {
        return chatMarkdownToHtml(this.lastBotMessage);
    }

    // pool of API keys
    apiKeyPool = process.env.STACK_API_KEYS?.split('|')?.filter(Boolean) || [];

    // Checks if the bot is currently muted
    get isMuted() {
        return Date.now() < this.lastMessageTime + this.throttleSecs * 1000;
    }

    // Returns if the bot posted the last message in the room
    get botSentLastMessage() {
        return this.lastActivityTime === this.lastMessageTime;
    }

    // Can the bot send an idle greeting
    //    1. Room is idle, and there was at least some previous activity, and last bot message more than lowActivityCheckMins minutes ago
    // or 2. If no activity for a few hours, and last message was not posted by the bot
    get idleCanSayHi() {
        const { roomBecameIdleAWhileAgo, roomReachedMinimumActivityCount, botHasBeenQuiet, roomBecameIdleHoursAgo, botSentLastMessage } = this;

        return (roomBecameIdleAWhileAgo && roomReachedMinimumActivityCount && botHasBeenQuiet) ||
            (roomBecameIdleHoursAgo && !botSentLastMessage);
    }

    /**
     * Maximum length a single message can have
     */
    maxMessageLength = 500;

    /**
     * Maximum number of parts a bot can split a message into
     */
    maxMessageParts = 3;

    /* Debug variables */

    // Fun mode
    funMode = parseBoolEnv("fun_mode", true);
    // Debug mode
    debug = parseBoolEnv("debug", false);
    // Verbose logging
    verbose = parseBoolEnv("verbose", false);

    // Keep track of fun responses so we can impose a limit
    funResponseCounter = 0;
    maxFunResponses = parseNumEnv("max_fun_responses", 2);

    get canSendFunResponse() {
        return this.funResponseCounter < this.maxFunResponses;
    }

    /**
     * @summary returns whether the bot is in increased logging mode
     */
    get debugOrVerbose() {
        return this.debug || this.verbose;
    }

    /* User groups */

    devIds = new Set(parseIds(process.env.DEV_IDS || ""));
    adminIds = new Set(parseIds(process.env.ADMIN_IDS || ''));
    ignoredUserIds = new Set(parseIds(process.env.IGNORED_USERIDS || ''));

    /* Flags and bot-specific utility functions */

    flags = {
        saidElectionEndingSoon: false,
        announcedWinners: false,
    };

    /* dashboard variables */

    /**
     * @summary controls how many transcript messages will be shown in the dashboard
     */
    showTranscriptMessages = parseNumEnv("transcript_size", 20);

    /**
     * @summary adds a user as a bot administrator
     * @param {number} chatUserId chat id of the user
     */
    addAdmin(chatUserId) {
        this.adminIds.add(chatUserId);
        console.log(`User ${chatUserId} temporarily added as admin`);
    }

    /**
     * @summary adds an ignored user
     * @param {number} chatUserId chat id of the user
     */
    addIgnoredUser(chatUserId) {
        this.adminIds.add(chatUserId);
        console.log(`User ${chatUserId} temporarily ignored`);
    }

    // If called without params, resets active mutes (future-dated lastMessageTime)
    // If called with a future-dated time, is considered a mute until then
    updateLastMessageTime(lastMessageTime = Date.now()) {
        this.lastMessageTime = lastMessageTime;
        this.lastActivityTime = lastMessageTime;
    }

    updateLastMessage(content, lastMessageTime = Date.now()) {
        this.updateLastMessageTime(lastMessageTime);
        this.lastBotMessage = content;
    }

    checkSameResponseAsPrevious(newContent) {
        // Unable to repost same message within 30 seconds
        return this.lastBotMessage === newContent && Date.now() - 30e4 < this.lastMessageTime;
    }

    toJSON() {
        const proto = Object.getPrototypeOf(this);
        const json = { ...this };

        Object.entries(Object.getOwnPropertyDescriptors(proto))
            .filter(([_key, { get }]) => typeof get === "function")
            .forEach(([key]) => (json[key] = this[key]));

        return json;
    }
};

export default BotConfig;