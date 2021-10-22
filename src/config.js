import { chatMarkdownToHtml, parseBoolEnv, parseIds, parseNumEnv } from "./utils.js";

const MS_IN_SECOND = 1e3;
const MS_IN_MINUTE = 60 * MS_IN_SECOND;
const MS_IN_HOUR = 60 * MS_IN_MINUTE;

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
     * @summary bot control chat room id
     * @type {number|undefined}
     */
    controlRoomId = parseNumEnv("control_room_id");

    /**
     * @summary bot control chat room url
     * @type {string}
     */
    get controlRoomUrl() {
        const { chatDomain, controlRoomId } = this;
        return chatDomain && controlRoomId ? `https://chat.${chatDomain}/rooms/${controlRoomId}` : "";
    }

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

    /**
     * @summary lower bound of activity (only after this amount of minimum messages)
     * @type {number}
     */
    minActivityCountThreshold = parseNumEnv("low_activity_count_threshold", 30);

    /**
     * @summary upper bound of activity
     * @type {number}
     */
    maxActivityCountThreshold = parseNumEnv("high_activity_count_threshold", 300);

    /**
     * @summary checks if room has reached minimum activity count
     * @returns {boolean}
     */
    get roomReachedMinActivityCount() {
        const { activityCounter, minActivityCountThreshold } = this;
        return activityCounter >= minActivityCountThreshold;
    }

    /**
     * @summary checks if room has reached maximum activity count
     * @returns {boolean}
     */
    get roomReachedMaxActivityCount() {
        const { activityCounter, maxActivityCountThreshold } = this;
        return activityCounter >= maxActivityCountThreshold;
    }

    /**
     * @summary determines when to start showing the primary phase countdown
     * @type {number}
     */
    showPrimaryCountdownAfter = parseNumEnv("show_primary_countdown_after", 8);

    /**
     * @summary Variable to determine how long the room needs to be quiet to be idle
     * @type {number}
     * {@link BotConfg#roomBecameIdleAWhileAgo}
     */
    shortIdleDurationMins = parseNumEnv("short_idle_duration_mins", 3);

    /**
     * @summary Variable to determine how long the room needs to be quiet to be idle
     * @type {number}
     * {@link BotConfg#roomBecameIdleHoursAgo}
     */
    longIdleDurationHours = parseNumEnv("long_idle_duration_hours", 12);

    /**
     * @summary Variable to trigger greeting only after this time of inactivity
     * @type {number}
     * {@link BotConfig#botHasBeenQuiet}
     */
    lowActivityCheckMins = parseNumEnv("low_activity_check_mins", 5);

    /**
     * @summary lower bound of busy room status
     * @type {number}
     */
    shortBusyDurationMinutes = parseNumEnv("short_busy_duration_mins", 5);

    /**
     * @summary upper bound of busy room status
     * @type {number}
     */
    longBusyDurationHours = parseNumEnv("long_busy_duration_hours", 1);

    /**
     * @summary checks if the room became idle minutes ago
     * @returns {boolean}
     */
    get roomBecameIdleAWhileAgo() {
        return this.lastActivityTime + (this.shortIdleDurationMins * 6e4) < Date.now();
    }

    /**
     * @summary checks if the room became idle hours ago
     * @returns {boolean}
     */
    get roomBecameIdleHoursAgo() {
        return this.lastActivityTime + (this.longIdleDurationHours * 60 * 6e4) < Date.now();
    }

    /**
     * @summary checks if the room has been busy for minutes
     * @returns {boolean}
     */
    get roomTooBusyForMinutes() {
        const { lastMessageTime, shortBusyDurationMinutes, roomReachedMaxActivityCount } = this;
        return roomReachedMaxActivityCount && Date.now() >= lastMessageTime + shortBusyDurationMinutes * MS_IN_MINUTE;
    }

    /**
     * @summary checks if the room has been busy for hours on end
     * @returns {boolean}
     */
    get roomTooBusyForHours() {
        const { lastMessageTime, longBusyDurationHours, roomReachedMaxActivityCount } = this;
        return roomReachedMaxActivityCount && Date.now() >= lastMessageTime + longBusyDurationHours * MS_IN_HOUR;
    }

    /**
     * @summary checks if the bot has been quiet for a while according to lower bound
     * @returns {boolean}
     */
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

    // Determines if the bot will ignore messages from self
    ignoreSelf = JSON.parse(process.env.IGNORE_SELF?.toLowerCase() || "true");

    // Variable to store time of last message in the room (by anyone, including bot), for idle checking purposes
    lastActivityTime = Date.now();
    // Variable to store time of last bot sent message, for throttling and muting purposes
    lastMessageTime = 0;
    // Variable to store last message to detect duplicate responses within a short time
    lastBotMessage = "";
    // Variable to track activity count in the room, to see if it reached minActivityCountThreshold
    activityCounter = 0;
    // Variable of rescrape interval of election page
    scrapeIntervalMins = parseNumEnv("scrape_interval_mins", 2);
    // Response when bot tries to post the exact same response again
    duplicateResponseText = "Please read my previous message...";

    /**
     * @summary user id to impersonate
     * @type {number|undefined}
     */
    impersonatingUserId;

    /**
     * @summary <userId, handler> map of actions awaiting user confirmation
     * @type {Map<number, () => Promise<string>>}
     */
    awaitingConfirmation = new Map();

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
        const { roomBecameIdleAWhileAgo, roomReachedMinActivityCount, botHasBeenQuiet, roomBecameIdleHoursAgo, botSentLastMessage } = this;

        return (roomBecameIdleAWhileAgo && roomReachedMinActivityCount && botHasBeenQuiet) ||
            (roomBecameIdleHoursAgo && !botSentLastMessage);
    }

    /**
     * @summary checks if a bot can busy-greet
     * @returns {boolean}
     */
    get canBusyGreet() {
        const { roomTooBusyForMinutes, roomTooBusyForHours, botSentLastMessage } = this;
        return [
            // room is busy, and everyone is ignoring the bot
            (roomTooBusyForMinutes),
            // room is busy, and bot is not the last sender
            (roomTooBusyForHours && !botSentLastMessage)
        ].some(Boolean);
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
     * @description use this when you want logging either in development or production, because you can set verbose mode in production to get more data or stealth debugging
     */
    get debugOrVerbose() {
        return this.debug || this.verbose;
    }

    /**
     * @summary returns whether the bot is in increased logging mode
     * @description use this when you want additional logging in development
     */
    get debugAndVerbose() {
        return this.debug && this.verbose;
    }

    /* User groups */

    devIds = new Set(parseIds(process.env.DEV_IDS || ""));
    adminIds = new Set(parseIds(process.env.ADMIN_IDS || ''));
    ignoredUserIds = new Set(parseIds(process.env.IGNORED_USERIDS || ''));

    /**
     * @type {Set<number>}
     */
    modIds = new Set();

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