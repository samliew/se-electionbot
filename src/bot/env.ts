import { all } from "../shared/utils/booleans.js";

export interface BotEnvironment {
    ACCOUNT_EMAIL?: string;
    ACCOUNT_PASSWORD?: string;
    AUTO_LEAVE_ROOM?: string;
    AUTOSCALE_HEROKU?: string;
    CHAT_DOMAIN?: string;
    CHAT_ROOM_ID?: string;
    CONTROL_ROOM_ID?: string;
    DEFAULT_ELECTION_TIME?: string;
    ELECTION_AFTERPARTY_MINS?: string;
    ELECTION_URL?: string;
    HIGH_ACTIVITY_COUNT_THRESHOLD?: string;
    IGNORE_SELF?: string;
    KEEP_ALIVE?: string;
    LONG_BUSY_DURATION_HOURS?: string;
    LONG_IDLE_DURATION_HOURS?: string;
    LOW_ACTIVITY_CHECK_MINS?: string;
    LOW_ACTIVITY_COUNT_THRESHOLD?: string;
    MAX_FUN_RESPONSES?: string;
    MAINTAINERS?: string;
    PASSWORD?: string;
    REPO_URL?: string;
    SCRAPE_INTERVAL_MINS?: string;
    SHORT_IDLE_DURATION_MINS?: string;
    SHORT_BUSY_DURATION_MINS?: string;
    SHOW_PRIMARY_COUNTDOWN_AFTER?: string;
    STACK_API_KEYS?: string;
    TRANSCRIPT_SIZE?: string;
}

export default class BotEnv<T extends BotEnvironment | NodeJS.ProcessEnv> {

    #env: T;

    /**
     * @param env parsed .env
     */
    constructor(env: T) {
        this.#env = env;
    }

    /**
     * @summary parses a given env {@link key} as a boolean
     * @param key key to parse
     * @param def default value
     */
    bool(key: Lowercase<keyof T & string>, def?: boolean) {
        const v = this.#env[key.toUpperCase()];
        return v === void 0 ? !!def : v === "true" ? true : v === "false" ? false : !!v;
    }

    /**
     * @summary parses a given env {@link key} as a JSON object
     * @param key key to parse
     * @param def default value
     */
    json<U extends object>(key: Lowercase<keyof T & string>, def?: U): U {
        const v = this.#env[key.toUpperCase()];
        return v !== void 0 && v !== "" ? JSON.parse(v) : def;
    }

    /**
     * @summary parses a given env {@link key} as a number
     * @param key key to parse
     * @param def default value
     */
    num(key: Lowercase<keyof T & string>, def: number): number;
    num(key: Lowercase<keyof T & string>): number | undefined;
    num(key: Lowercase<keyof T & string>, def?: number) {
        const v = this.#env[key.toUpperCase()];
        return v !== void 0 && v !== "" ? +v : def;
    }

    /**
     * @summary parses a given env {@link key} as a string
     * @param key key to parse
     * @param def default value
     */
    str(key: Lowercase<keyof T & string>, def: string): string;
    str(key: Lowercase<keyof T & string>): string | undefined;
    str(key: Lowercase<keyof T & string>, def?: string) {
        const v = this.#env[key.toUpperCase()];
        return v !== void 0 && v !== "" ? v.toString().trim() : def;
    }

    /**
     * @summary parses a given env {@link key} as an array
     * @param key key to parse
     */
    or(key: Lowercase<keyof T & string>): string[] {
        const v = this.#env[key.toUpperCase()];
        return v?.split('|')?.filter(Boolean) || [];
    }

    /**
     * @summary checks if a given env {@link key} exists
     * @param key key to check
     */
    has(key: string): key is Lowercase<keyof T & string> {
        const env = this.#env;
        return key.toUpperCase() in env;
    }

    /**
     * @summary gets a parsed env value
     * @param key key to get
     */
    parsed(key: Lowercase<keyof T & string>): string | number | boolean | string[] | object | undefined {
        const env = this.#env;
        const val: string = env[key.toUpperCase()];

        try {
            return JSON.parse(val);
        } catch (error) {
            return all(
                val.includes("|"),
                !val.startsWith("|"),
                !val.endsWith("|"),
            ) ? this.or(key) : val;
        }
    }

    /**
     * @summary sets a given env {@link key}
     * @param key key to set
     * @param value value to set
     */
    set(key: Lowercase<keyof T & string>, value: unknown) {
        const env = this.#env;
        const ukey = key.toUpperCase();

        env[ukey] = Array.isArray(value) ?
            value.join("|") :
            typeof value === "string" ? value :
                JSON.stringify(value);
    }

    /**
     * @summary gets the type of a parsed env value
     * @param key key to get the type of
     */
    type(key: Lowercase<keyof T & string>) {
        return typeof this.parsed(key);
    }
}