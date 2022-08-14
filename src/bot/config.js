import { chatMarkdownToHtml } from "../shared/utils/markdown.js";
import { getNetworkAccountIdFromChatId as getNetworkIdFromChatId, parseBoolEnv, parseIds } from "./utils.js";

const MS_IN_SECOND = 1e3;
const MS_IN_MINUTE = 60 * MS_IN_SECOND;
const MS_IN_HOUR = 60 * MS_IN_MINUTE;

/**
 * @typedef {import("./commands/access.js").AccessLevel} AccessLevel
 * @typedef {import("./env").default<BotEnvironment>} BotEnv
 * @typedef {import("./env").BotEnvironment} BotEnvironment
 * @typedef {import("./commands/user.js").User} BotUser
 * @typedef {import("chatexchange/dist/User").default} ChatUser
 * @typedef {import("chatexchange/dist/Client").Host} Host
 * @typedef {import("./index").MessageBuilder} MessageBuilder
 * @typedef {import("./utils").RoomUser} RoomUser
 */

export class BotConfig {

    /** @type {BotEnv} */
    #env;

    /**
     * @summary bot chat room id
     * @type {number}
     */
    chatRoomId;

    /**
     * @summary bot control chat room id
     * @type {number|undefined}
     */
    get controlRoomId() {
        return this.#env.num("control_room_id");
    }

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
     * @summary cached Heroku dyno data, since it can't change while the application is running (has to restart on scale)
     * @type {import("./herokuClient.js").Formation[]}
     */
    herokuDynos = [];

    /**
     * @param {Host} host chat host server
     * @param {number} roomId room id this configuration is for
     * @param {BotEnv} env bot environment
     */
    constructor(host, roomId, env) {
        this.chatDomain = host;
        this.chatRoomId = roomId;
        this.#env = env;
    }

    scriptInitDate = new Date();

    /**
     * @summary current date and time override for timetravel
     * @type {Date|undefined}
     */
    nowOverride;

    /**
     * @summary gets a list of maintainer ids for the current {@link BotConfig.chatDomain}
     * @returns {string[]}
     */
    get maintainerChatIds() {
        /** @type {Record<Host,string[]>} */
        const allIds = this.#env.json("maintainers", {
            "stackoverflow.com": [],
            "stackexchange.com": [],
            "meta.stackexchange.com": []
        });

        return allIds[this.chatDomain];
    }

    /**
     * @summary /ping the bot server periodically?
     * @type {boolean}
     */
    get keepAlive() {
        return this.#env.bool("keep_alive");
    }

    // Bot instance identifier, base hostname for dashboard, also where keep-alive will ping
    // Ensure url starts with http and does not end with a slash, or keep it empty
    get scriptHostname() {
        const url = process.env.SCRIPT_HOSTNAME?.trim().replace(/\/?$/, '') || '';
        return url.startsWith('http') ? url : '';
    }

    /**
     * @summary minutes to wait after an election to scale back dynos (which restarts bot and leaves room)
     * @type {number}
     */
    get electionAfterpartyMins() {
        return this.#env.num("election_afterparty_mins", 30);
    }
    set electionAfterpartyMins(v) {
        this.#env.set("election_afterparty_mins", v);
    }

    /**
     * @summary lower bound of activity (only after this amount of minimum messages)
     * @type {number}
     */
    get minActivityCountThreshold() {
        return this.#env.num("low_activity_count_threshold", 30);
    }

    /**
     * @summary upper bound of activity
     * @type {number}
     */
    get maxActivityCountThreshold() {
        return this.#env.num("high_activity_count_threshold", 300);
    }

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
    get showPrimaryCountdownAfter() {
        return this.#env.num("show_primary_countdown_after", 8);
    }

    /**
     * @summary Variable to determine how long the room needs to be quiet to be idle
     * @type {number}
     * {@link BotConfg#roomBecameIdleAWhileAgo}
     */
    get shortIdleDurationMins() {
        return this.#env.num("short_idle_duration_mins", 3);
    }

    /**
     * @summary Variable to determine how long the room needs to be quiet to be idle
     * @type {number}
     * {@link BotConfg#roomBecameIdleHoursAgo}
     */
    get longIdleDurationHours() {
        return this.#env.num("long_idle_duration_hours", 12);
    }
    set longIdleDurationHours(v) {
        this.#env.set("long_idle_duration_hours", v);
    }

    /**
     * @summary Variable to trigger greeting only after this time of inactivity
     * @type {number}
     * {@link BotConfig#botHasBeenQuiet}
     */
    get lowActivityCheckMins() {
        return this.#env.num("low_activity_check_mins", 5);
    }

    /**
     * @summary lower bound of busy room status
     * @type {number}
     */
    get shortBusyDurationMinutes() {
        return this.#env.num("short_busy_duration_mins", 5);
    }

    /**
     * @summary upper bound of busy room status
     * @type {number}
     */
    get longBusyDurationHours() {
        return this.#env.num("long_busy_duration_hours", 1);
    }

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

    /**
     * @summary ignore messages from self?
     * @type {boolean}
     */
    get ignoreSelf() {
        return this.#env.bool("ignore_self", true);
    }

    // Variable to store time of last message in the room (by anyone, including bot), for idle checking purposes
    lastActivityTime = Date.now();
    // Variable to store time of last bot sent message, for throttling and muting purposes
    lastMessageTime = 0;

    /**
     * @summary last bot message to detect duplicate responses within a short time
     * @type {string}
     */
    lastBotMessage = "";

    // Variable to track activity count in the room, to see if it reached minActivityCountThreshold
    activityCounter = 0;

    /**
     * @summary periodic election rescrape interval
     * @type {number}
     */
    get scrapeIntervalMins() {
        return this.#env.num("scrape_interval_mins", 2);
    }
    set scrapeIntervalMins(v) {
        this.#env.set("scrape_interval_mins", v);
    }

    // Response when bot tries to post the exact same response again
    duplicateResponseText = "Please read my previous message...";

    /**
     * @summary user id to impersonate
     * @type {number|undefined}
     */
    impersonatingUserId;

    /**
     * @summary <userId, handler> map of actions awaiting user confirmation
     * @type {Map<number, MessageBuilder>}
     */
    awaitingConfirmation = new Map();

    /**
     * @summary gets last bot message HTML string
     * @returns {string}
     */
    get lastBotMessageHtml() {
        return chatMarkdownToHtml(this.lastBotMessage);
    }

    /**
     * @summary Feedback form URL
     * @type {string}
     */
    get feedbackUrl() {
        const formUrl = process.env.FEEDBACK_FORM_URL || '';

        // If using a Google form link ending with a prefilled field parameter, append site slug
        if (/entry\.\d+=$/.test(formUrl)) {
            const electionUrl = process.env.ELECTION_URL?.trim() || '';
            const siteSlug = electionUrl.match(/https:\/\/([^.]+)\./)?.slice(1, 2).pop() || '';
            return formUrl + encodeURIComponent(siteSlug);
        }
        return formUrl;
    }

    /**
     * @summary whether to autoscale Heroku to Hobby
     * @type {boolean}
     */
    get autoscaleHeroku() {
        return this.#env.bool("autoscale_heroku", true);
    }

    /**
     * @summary source code repository URL
     * @type {string}
     */
    get repoUrl() {
        return this.#env.str("repo_url", "https://github.com/samliew/se-electionbot");
    }

    /**
     * @summary pool of SE API keys to rotate
     * @type {string[]}
     */
    get apiKeyPool() {
        return this.#env.or("stack_api_keys");
    }

    // Checks if the bot is currently muted
    get isMuted() {
        return Date.now() < this.lastMessageTime + this.throttleSecs * 1000;
    }

    /**
     * @summary number of ms since *nix epoch for how long the bot will stay muted
     * @type {number}
     */
    get mutedFor() {
        const diff = this.lastMessageTime - Date.now();
        return diff < 0 ? 0 : diff;
    }

    /**
     * @summary number of ms since *nix epoch when the bot will unmute
     * @type {number}
     */
    get unmutesAt() {
        const { mutedFor, nowOverride } = this;
        return (nowOverride?.valueOf() || Date.now()) + mutedFor;
    }

    // Returns if the bot posted the last message in the room
    get botSentLastMessage() {
        return this.lastActivityTime === this.lastMessageTime;
    }

    /**
     * @summary checks if the bot can idle-greet either:
     * 1. Room is idle, and there was at least some previous activity, and last bot message more than lowActivityCheckMins minutes ago
     * 2. If no activity for a few hours, and last message was not posted by the bot
     */
    get canIdleGreet() {
        const { roomBecameIdleAWhileAgo, roomReachedMinActivityCount, botHasBeenQuiet, roomBecameIdleHoursAgo, botSentLastMessage } = this;

        return (roomBecameIdleAWhileAgo && roomReachedMinActivityCount && botHasBeenQuiet) ||
            (roomBecameIdleHoursAgo && !botSentLastMessage);
    }

    /**
     * @summary checks if the bot can busy-greet
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

    // Keep track of fun responses so we can impose a limit
    funResponseCounter = 0;

    /**
     * @summary max number of fun mode bot responses in a row
     * @type {number}
     */
    get maxFunResponses() {
        return this.#env.num("max_fun_responses", 2);
    }

    get canSendFunResponse() {
        return this.funResponseCounter < this.maxFunResponses;
    }

    /**
     * @summary checks if the bot can post the official meta announcement
     * @returns {boolean}
     */
    get canAnnounceMetaPost() {
        const { flags } = this;
        return !flags.announcedMetaPost;
    }

    /**
     * @summary returns whether the bot is in increased logging mode
     * @description use this when you want logging either in development or production, because you can set verbose mode in production to get more data or stealth debugging
     */
    get debugOrVerbose() {
        const { flags } = this;
        return flags.debug || flags.verbose;
    }

    /**
     * @summary returns whether the bot is in increased logging mode
     * @description use this when you want additional logging in development
     */
    get debugAndVerbose() {
        const { flags } = this;
        return flags.debug && flags.verbose;
    }

    /**
     * @summary network account ids of users with {@link AccessLevel.dev} access
     * @type {Set<number>}
     */
    devIds = new Set(parseIds(process.env.DEV_IDS || ""));

    /**
     * @summary network account ids of users with {@link AccessLevel.privileged} access
     * @type {Set<number>}
     */
    adminIds = new Set(parseIds(process.env.ADMIN_IDS || ''));

    /**
     * @summary chat user ids of users to ignore by the bot
     * @type {Set<number>}
     */
    ignoredUserIds = new Set(parseIds(process.env.IGNORED_USER_IDS || ''));

    /**
     * @type {Set<number>}
     */
    modIds = new Set();

    /**
     * @summary bot configuration flags
     */
    flags = {
        saidElectionEndingSoon: false,
        announcedWinners: false,
        announcedMetaPost: false,
        fun: parseBoolEnv("fun_mode", true),
        debug: parseBoolEnv("debug", false),
        verbose: parseBoolEnv("verbose", false),
    };

    get debug() {
        const { flags } = this;
        return flags.debug;
    }

    set debug(val) {
        this.flags.debug = val;
    }

    get fun() {
        const { flags } = this;
        return flags.fun;
    }

    set fun(val) {
        this.flags.fun = val;
    }

    get verbose() {
        const { flags } = this;
        return flags.verbose;
    }

    set verbose(val) {
        this.flags.verbose = val;
    }

    /* dashboard variables */

    /**
     * @summary controls how many transcript messages will be shown in the dashboard
     * @type {number}
     */
    get showTranscriptMessages() {
        return this.#env.num("transcript_size", 20);
    }
    set showTranscriptMessages(v) {
        this.#env.set("transcript_size", v);
    }

    /**
     * @summary abstract privileged user updater
     * @param {"add"|"delete"} action action to perform
     * @param {"admin"|"dev"} level user access level
     * @param {Array<number|ChatUser|RoomUser>|Set<number|ChatUser|RoomUser>} users list of users or network account ids
     * @returns {Promise<BotConfig>}
     */
    async #updatePrivilegedUsers(action, level, users) {
        const privilegedIds = this[`${level}Ids`];

        const { debugOrVerbose } = this;

        for (const user of users) {
            const accountId = typeof user !== "number" ?
                await getNetworkIdFromChatId(this, user.id) :
                user;

            if (accountId) privilegedIds[action](accountId);
        }

        if (debugOrVerbose) console.log(`[config] ${level} ids:`, [...privilegedIds]);
        return this;
    }

    /**
     * @summary abstract privileged user checker
     * @param {"admin"|"dev"} level user access level
     * @param {number|ChatUser|RoomUser} user user or network account id
     * @returns {Promise<boolean>}
     */
    async #isPrivilegedUser(level, user) {
        const privilegedIds = this[`${level}Ids`];

        const accountId = typeof user !== "number" ?
            await getNetworkIdFromChatId(this, user.id) :
            user;

        return !!accountId && privilegedIds.has(accountId);
    }

    /**
     * @summary adds users to the "admin" access level list
     * @param {Array<number|ChatUser|RoomUser>} users list of users or network account ids
     * @returns {Promise<BotConfig>}
     */
    async addAdmins(...users) {
        return this.#updatePrivilegedUsers("add", "admin", users);
    }

    /**
     * @summary adds users to the "dev" access level list
     * @param {Array<number|ChatUser|RoomUser>} users list of users or network account ids
     * @returns {Promise<BotConfig>}
     */
    async addDevs(...users) {
        return this.#updatePrivilegedUsers("add", "dev", users);
    }

    /**
     * @summary checks if a given chat id matches "admin" acces level
     * @param {number|ChatUser|RoomUser} user user or network account id
     * @returns {Promise<boolean>}
     */
    async isAdmin(user) {
        return this.#isPrivilegedUser("admin", user);
    }

    /**
     * @summary checks if a given chat id matches "dev" access level
     * @param {number|ChatUser|RoomUser} user user or network account id
     * @returns {Promise<boolean>}
     */
    async isDev(user) {
        return this.#isPrivilegedUser("dev", user);
    }

    /**
     * @summary removes users from the "admin" access level list
     * @param {Array<number|ChatUser|RoomUser>} users list of users or network account ids
     * @returns {Promise<BotConfig>}
     */
    async removeAdmins(...users) {
        return this.#updatePrivilegedUsers("delete", "admin", users);
    }

    /**
     * @summary removes users to the "dev" access level list
     * @param {Array<number|ChatUser|RoomUser>} users list of users or network account ids
     * @returns {Promise<BotConfig>}
     */
    async removeDevs(...users) {
        return this.#updatePrivilegedUsers("delete", "dev", users);
    }

    /**
     * @summary gets an uparsed value from the environment
     * @param {Lowercase<keyof BotEnvironment>} key key to lookup
     * @param {string} [def] optional default
     * @returns {string|undefined}
     */
    get(key, def = "") {
        return this.#env[key] || def;
    }

    /**
     * @summary updates last room message time
     * If called without params, resets active mutes (future-dated lastMessageTime)
     * If called with a future-dated time, is considered a mute until then
     * @param {number} lastMessageTime ms since *nix epoch of the last message
     * @return {BotConfig}
     */
    updateLastMessageTime(lastMessageTime = Date.now()) {
        this.lastMessageTime = lastMessageTime;
        this.lastActivityTime = lastMessageTime;
        return this;
    }

    /**
     * @summary updates last bot message
     * @param {string} content message content
     * @param {number} lastMessageTime ms since *nix epoch of the message
     * @return {BotConfig}
     */
    updateLastMessage(content, lastMessageTime = Date.now()) {
        this.updateLastMessageTime(lastMessageTime);
        this.lastBotMessage = content;
        return this;
    }

    /**
     * @summary checks if new message is the same as the old one
     * @param {string} newContent
     * @returns {boolean}
     */
    checkSameResponseAsPrevious(newContent) {
        // Unable to repost same message within 30 seconds
        return this.lastBotMessage === newContent && Date.now() - 30e4 < this.lastMessageTime;
    }

    /**
     * @summary gets confirmation handler for a given user
     * @param {number|BotUser|ChatUser|RoomUser} user user or user id
     * @returns {MessageBuilder|undefined}
     */
    getConfirmationHandler(user) {
        const { awaitingConfirmation } = this;
        const id = typeof user === "number" ? user : user.id;
        return awaitingConfirmation.get(id);
    }

    /**
     * @summary sets confirmation handler for a given user
     * @param {number|BotUser|ChatUser|RoomUser} user user or user id
     * @param {MessageBuilder} handler successful confirmation handler
     * @returns {BotConfig}
     */
    setConfirmationHandler(user, handler) {
        const { awaitingConfirmation } = this;
        const id = typeof user === "number" ? user : user.id;
        awaitingConfirmation.set(id, handler);
        return this;
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