import { parseIds } from "./utils.js";

export class BotConfig {

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
    lowActivityCheckMins = +process.env.LOW_ACTIVITY_CHECK_MINS || 15;
    // Variable to trigger an action only after this amount of minimum messages
    lowActivityCountThreshold = +process.env.LOW_ACTIVITY_COUNT_THRESHOLD || 30;

    get roomReachedMinimumActivityCount() {
        const { activityCount, lowActivityCountThreshold } = this;
        return activityCount >= lowActivityCountThreshold;
    }

    /* Bot variables */

    // To stop bot from replying to too many messages in a short time
    throttleSecs = +(process.env.THROTTLE_SECS) || 10;
    // Variable to store time of last message in the room (by anyone, including bot)
    lastActivityTime = Date.now();
    // Variable to store time of last bot sent message for throttling purposes
    lastMessageTime = -1;
    // Variable to store last message to detect duplicate responses within a short time
    lastMessageContent = "";
    // Variable to track activity count in the room, to see if it reached lowActivityCountThreshold
    activityCount = 0;
    // Variable of rescrape interval of election page
    scrapeIntervalMins = +(process.env.SCRAPE_INTERVAL_MINS) || 5;
    // Response when bot tries to post the exact same response again
    duplicateResponseText = "Please read my previous message - I can't send the exact same message again.";

    /* Debug variables */

    // Fun mode
    funMode = JSON.parse(process.env.FUN_MODE?.toLowerCase() || "true");
    // Debug mode
    debug = JSON.parse(process.env.DEBUG?.toLowerCase() || "false");
    // Verbose logging
    verbose = JSON.parse(process.env.VERBOSE?.toLowerCase() || "false");

    /* User groups */

    devIds = new Set(parseIds(process.env.DEV_IDS || ""));
    adminIds = new Set(parseIds(process.env.ADMIN_IDS || ''));
    ignoredUserIds = new Set(parseIds(process.env.IGNORED_USERIDS || ''));

    /* Flags and bot-specific utility functions */

    flags = {
        saidElectionEndingSoon: false
    };

    updateLastMessageTime(lastMessageTime = Date.now()) {
        this.lastMessageTime = lastMessageTime;
        this.lastActivityTime = lastMessageTime;
    }

    updateLastMessage(content) {
        this.updateLastMessageTime();
        this.lastMessageContent = content;
    }

    checkSameResponseAsPrevious(newContent) {
        return this.lastMessageContent === newContent && Date.now() - 60e4 < this.lastMessageTime;
    }
};

export default BotConfig;