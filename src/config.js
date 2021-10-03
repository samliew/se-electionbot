import { parseIds } from "./utils.js";

export class BotConfig {

    scriptInitDate = new Date();

    /**
     * @param {import("chatexchange/dist/Client").Host} host chat host server
     * @param {number} roomId room id this configuration is for
     */
    constructor(host, roomId) {
        // Bot to later join live chat room if not in debug mode
        this.chatRoomId = roomId;
        this.chatDomain = host;
    }

    /* Low activity count variables */

    // Variable to trigger an action only after this time of inactivity
    lowActivityCheckMins = +(process.env.LOW_ACTIVITY_CHECK_MINS || 15);
    // Variable to trigger an action only after this amount of minimum messages
    minActivityCountThreshold = +(process.env.LOW_ACTIVITY_COUNT_THRESHOLD || 30);

    get roomReachedMinimumActivityCount() {
        const { activityCount, minActivityCountThreshold: minActivityCountThreshold } = this;
        return activityCount >= minActivityCountThreshold;
    }

    /* Bot variables */

    // To stop bot from replying to too many messages in a short time, maintain a throttle with minimum
    minThrottleSecs = 1.5;
    _throttleSecs = +(process.env.THROTTLE_SECS || this.minThrottleSecs);

    get throttleSecs() {
        return this._throttleSecs;
    }
    set throttleSecs(newValue) {
        this._throttleSecs = newValue > this.minThrottleSecs ? newValue : this.minThrottleSecs;
    }

    // Variable to store time of last message in the room (by anyone, including bot), for idle checking purposes
    lastActivityTime = Date.now();
    // Variable to store time of last bot sent message, for throttling and muting purposes
    lastMessageTime = -1;
    // Variable to store last message to detect duplicate responses within a short time
    lastMessageContent = "";
    // Variable to track activity count in the room, to see if it reached minActivityCountThreshold
    activityCount = 0;
    // Variable of rescrape interval of election page
    scrapeIntervalMins = +(process.env.SCRAPE_INTERVAL_MINS || 5);
    // Response when bot tries to post the exact same response again
    duplicateResponseText = "Please read my previous message...";

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
    funMode = JSON.parse(process.env.FUN_MODE?.toLowerCase() || "true");
    // Debug mode
    debug = JSON.parse(process.env.DEBUG?.toLowerCase() || "false");
    // Verbose logging
    verbose = JSON.parse(process.env.VERBOSE?.toLowerCase() || "false");

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

    updateLastMessageTime(lastMessageTime = Date.now()) {
        this.lastMessageTime = lastMessageTime;
        this.lastActivityTime = lastMessageTime;
    }

    updateLastMessage(content, lastMessageTime = Date.now()) {
        this.updateLastMessageTime(lastMessageTime);
        this.lastMessageContent = content;
    }

    checkSameResponseAsPrevious(newContent) {
        // Unable to repost same message within 30 seconds
        return this.lastMessageContent === newContent && Date.now() - 30e4 < this.lastMessageTime;
    }
};

export default BotConfig;