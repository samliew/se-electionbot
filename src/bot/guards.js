import { allMatch, noneMatch, someMatch } from "../shared/utils/expressions.js";

/**
 * @typedef {import("chatexchange/dist/User").default} User
 * @typedef {import("chatexchange/dist/Browser").IProfileData} ChatProfile
 *
 * @typedef {(text: string) => boolean} MessageGuard
 */

/**
 * @summary checks if the message asked how or where to nominate
 * @type {MessageGuard}
 */
export const isAskedForNominatingInfo = (text) => {
    return someMatch([
        /^(?:how|where)(?:\s+can\s+I)?(?:\s+to)?\s+(?:nominate|submit|register|enter|apply|elect)(?!\s+(?:an)?others?|\s+some(?:one|body))/i,
        /^(?:how|where)\s+(?:to |can\s+I\s+)?be(?:come)?(?:\s+a)?\s+mod(?:erator)?/i
    ], text);
};

/**
 * @summary checks if the message asked if they can nominate others
 * @type {MessageGuard}
 */
export const isAskedIfCanNominateOthers = (text) => {
    return someMatch([
        /^(?:how\s+can|can|how\s+to)(?:\s+one|\s+i)?(?:\s+users?)?\s+(?:nominate|register)\s+(?:(?:an)?others?(?:\s+users?)?|some(?:one|body))/i
    ], text);
};

/**
 * @summary checks if the message asked why a nomination was removed
 * @type {MessageGuard}
 */
export const isAskedWhyNominationRemoved = (text) => {
    return allMatch([
        /^(?:why|what)\b/i,
        /\b(?:nomination|nominee|candidate)s?\b/i,
        /\b(?:deleted?|vanish(?:ed)?|erased?|removed?|unpublish(?:ed)?|cancel(?:led)?|withdrawn?|fewer|less(?:er)?|resign)\b/i,
    ], text);
};

/**
 * @summary checks if the message asked why would one want to be a mod
 * @type {MessageGuard}
 */
export const isAskedWhyBeAMod = (text) => {
    return someMatch([
        /^why(?:\s+would\s+(?:i|(?:any|some)(?:body|one))\s+(?:want|wish)\s+to)?\s+be(?:come)?\s+a\s+mod(?:erator)?/i
    ], text);
};

/**
 * @summary checks if the message asked if mods are paid
 * @type {MessageGuard}
 */
export const isAskedIfModsArePaid = (text) => {
    return /^(?:why|what|are|how|do)\b/.test(text) &&
        /\b(?:reward|rewarded|paid|compensat(?:ed|ion)|money)\b/.test(text) &&
        /\b(?:mods|moderators)\b/.test(text);
};

/**
 * @summary checks if the message asked what do moderators do or what privileges they have
 * @type {MessageGuard}
 */
export const isAskedAboutModsOrModPowers = (text) => {
    return someMatch([
        /^what\s+(?:do(?:es)?|are|is)(?:\s+(?:a|the))?\s+(?:mod(?:erator)?'?s?'?)(?:\s+(?:doe?|responsibilit(?:ie|y)|power)s?)?(?:$|\?)/i,
        /^(?:why\s+)?should\s+i\s+(?:be(?:come)?)(?:\s+a)?\s+(?:mod(?:erator)?)/i,
        /^what(?:\s+are)?(?:\s+(?:a|the))?\s+(?:power|responsibilit(?:ie|y)|power)s?\s+(?:do(?:es)?|of)(?:\s+(?:a|the))?\s+mod(?:erator)?s?(?:\s+ha(?:ve|s))?/i,
    ], text);
};

/**
 * @summary checks if the message asked how or where to vote
 * @type {MessageGuard}
 */
export const isAskedAboutVoting = (text) => {
    return someMatch([
        /^what\s+is\s+voting/i,
        /^(?:where|how)\s+(?:do(?:es)?|can)\s+(?:i|one)\s+vote/i,
    ], text);
};

/**
 * @summary checks if the message asked to tell who the current mods are
 * @param {string} text message text
 * @param {string|null} apiSlug current site's apiSlug
 * @returns {boolean}
 */
export const isAskedForCurrentMods = (text, apiSlug = null) => {
    return someMatch([
        new RegExp(`^whois ${apiSlug} mod(?:erator)?s$`),
        /^who(?: are| is|'s)(?:\s+the)?\s+(?:current|present)\s+mod(?:erator)?s?/i,
        /^how many mod(?:erator)?s? (are there|do we have)/i,
        /^how.*\bcontact\b.*mod(?:erator)?s?/i,
    ], text);
};

/**
 * @summary checks if the message asked to tell who the former mods are
 * @param {string} text message text
 * @param {string|null} apiSlug current site's apiSlug
 * @returns {boolean}
 */
export const isAskedForFormerMods = (text, apiSlug = null) => {
    return someMatch([
        new RegExp(`^whois\\s+${apiSlug}\\s+former\\s+mod(?:erator)?s$`),
        /^who(?: are| is|'s) the\s+former\s+mod(?:erator)?s?/i,
        /^how many\s+former\s+mod(?:erator)?s? (are there|do we have)/i,
        /^(?:who|which\s+mod(?:erator)?s?)(?:\s+have)?\s+(?:stepped\s+down|resigned)/i
    ], text);
};

/**
 * @summary checks if the message asked to tell who winners are
 * @type {MessageGuard}
 */
export const isAskedForCurrentWinners = (text) => {
    return someMatch([
        /^(?:who|how\s+many)\b.+?\b(?:winners|new\s+mod|will\s+win|future\s+mod)/i,
        /^(?:who(?:'s|\s+is|\s+are))?(?:\s+(?:a|the))?(?:\s+current)?\s+winners?/i,
        /^who(?:\s+ha(?:s|ve))?\s+won(?:\s+th[ei]s?)?\s+election/i,
    ], text);
};

/**
 * @summary checks if the message asked to tell how many positions are due
 * @type {MessageGuard}
 */
export const isAskedForCurrentPositions = (text) => {
    return /^how many (?:positions|mod(?:erator)?s) (?:are|were|will be)(?: being)? (?:elected|there)/.test(text);
};

/**
 * @summary checks if the message asked to tell who nominees are
 * @type {MessageGuard}
 */
export const isAskedForCurrentNominees = (text) => {
    return someMatch([
        /^(?:(?:are|is) there)?(?: ?any| a)?(?: new)? (?:nomination|nominee|candidate)s?(?: so far)?\b(?! in.+?room)/i,
        /(?:who|what) (?:are|were|was|is|has)(?: the)? (?:nomin(?:ee|ation|ated)|particip(?:ant|ated)|candidate)s?(?!\s+score)/i,
        /how many (?:nomin(?:ee|ation|ated)|participant|candidate)s?\b(?!\s+(?:score|are here|are in.+?room|(?:have|are|were) withdrawn))/i
    ], text);
};

/**
 * @summary checks if the message asked to tell who the withdrawn nominees are
 * @type {MessageGuard}
 */
export const isAskedForWithdrawnNominees = (text) => {
    return someMatch([
        /^(?:who)\b.*\b(?:withdr[ae]wn?|removed|deleted)\b.*\b(?:election|nomination)/,
        /^(?:whom?) (?:has|have|was)\b.*\b(?:withdr[ae]wn?|removed|deleted)/,
        /^(?:how many|which|was|were)\b.*\b(?:candidate|nomin(?:ee|ation))s?\b.*\b(?:withdr[ae]wn?|removed|deleted)/
    ], text);
};

/**
 * @summary checks if the message asked for current election schedule
 * @type {MessageGuard}
 */
export const isAskedForElectionSchedule = (text) => {
    return /(?:when|how|what)(?: is|'s) the election(?: scheduled)?|election schedule/.test(text);
};

/**
 * @summary checks if the message asked if anyone can edit in a ♦ in their username
 * @type {MessageGuard}
 */
export const isAskedAboutUsernameDiamond = (text) => {
    return /(?:edit|insert|add).+?(?:\u2666|diamond).+?(?:user)?name/.test(text);
};

/**
 * @summary checks if the message asked who created or maintains the bot
 * @type {MessageGuard}
 */
export const isAskedWhoMadeMe = (text) => {
    return /who(?: (?:are|is) your)?\s+(?:made|created|own(?:s|ers?)|develop(?:s|ed|ers?)|maintain(?:s|ers?))(?:\s+you)?/.test(text);
};

/**
 * @summary checks if the message asked who or what the bot is
 * @type {MessageGuard}
 */
export const isAskedWhoAmI = (text) => {
    return someMatch([
        /^(?:(?:who|what)\s+are\s+you|about)\b/i,
        /^are\s+you(?:\s+(?:a|the))?\s+(?:bot|robot|chat\s*?bot|da?emon)/i
    ], text);
};

/**
 * @mention
 * @summary checks if the message asked how the bot fares
 * @type {MessageGuard}
 */
export const isAskedHowAmI = (text) => {
    return someMatch([
        /^(?:(?:hello|hi|heya)(?:\s+bot)?,?\s+)?how\s+are\s+you(?:\s+today)?(?:$|\?)/i
    ], text);
};

/**
 * @summary checks if the message asked whether the bot is alive
 * @type {MessageGuard}
 */
export const isAskedAmIAlive = (text) => {
    return someMatch([/^(?:where\s+ar[et]\s+(?:you|thou)|alive|dead|ping)(?:$|\?)/i, /^are\s+you\s+(?:t?here|alive|dead)(?:$|\?)/i], text);
};

/**
 * @summary checks if the message asked for meaning of life
 * @type {MessageGuard}
 */
export const isAskedMeaningOfLife = (text) => {
    return someMatch([
        /^what(?:'s| is)(?:\s+the|an?)\s+(?:answer|meaning|reason)\s+(?:of|to|for)\s+life(?:$|\?)/i,
        /^what\s+is\s+42(?:$|\?)/i
    ], text);
};

/**
 * @summary checks if the message asked for one's candidate score
 * @type {MessageGuard}
 */
export const isAskedForOwnScore = (text) => {
    return /can i nominate myself/.test(text) ||
        /what(?: is|'s)\b.*\bm[ye](?: candidate)? score(?:$|\?)/.test(text);
};

/**
 * @summary checks if the message asked for candidate score of another user
 * @type {MessageGuard}
 */
export const isAskedForOtherScore = (text) => {
    return allMatch([
        /(?:(?:what)?(?: is|'s)(?: the)? |^)(?:candidate )?score (?:for |of )(?:the )?(?:(?:site )?user )?(?:@?-?\d+|https:\/\/.+\/users\/\d+.*)(?:$|\?)/
    ], text) && noneMatch([/\b(?:my|mine)\b/], text);
};

/**
 * @summary checks if the message asked for candidate score calculation formula
 * @type {MessageGuard}
 */
export const isAskedForScoreFormula = (text) => {
    return someMatch(
        [
            /^(?:what|how)\s+is(?:\s+(?:a|the))?\s+candidate\s+score\s+(?:formula|calculated)/i,
            /^what\s+is(?:\s+(?:a|the))?(\s+formula\s+for(?:\s+(?:a|the))?)?\s+candidate\s+score(?!\s+(?:of|for))/i,
        ], text
    );
};

/**
 * @summary checks if the message asked for candidate score leaderboard
 * @type {MessageGuard}
 */
export const isAskedForScoreLeaderboard = (text) => {
    return someMatch([
        /who\b.*\b(?:highest|greatest|most)\b.*\bcandidate\s+scores?/i,
        /candidate\s+scores?\s+leaderboard(?:$|\?)/i,
    ], text);
};

/**
 * @summary detects if someone is thanking the bot
 * @type {MessageGuard}
 */
export const isThankingTheBot = (text) => {
    return /thanks?(?= you|,? bot|[!?]|$)/.test(text);
};

/**
 * @summary detects if someone is praising or loving the bot
 * @type {MessageGuard}
 */
export const isLovingTheBot = (text) => {
    return [
        /\b(?:election)?bot\b/,
        /\b(?:awesome|brilliant|clever|correct|excellent|good|great|impressive|like|love|legit|marvell?ous|nice|neat|perfect|praise|right|smart|super|superb|swell|wise|wonderful)\b/,
        /\b(?:is|the|this|bot|electionbot|wow|pretty|very)\b/
    ].every((expression) => expression.test(text));
};

/**
 * @summary detects if someone is saying happy birthday
 * @type {MessageGuard}
 */
export const isSayingHappyBirthday = (text) => {
    return [
        /^happy\s+birth\s?day,?\s+.*!*$/i
    ].some((expression) => expression.test(text));
};

/**
 * @summary detects if someone hates the bot
 * @type {MessageGuard}
 */
export const isHatingTheBot = (text) => {
    return [
        /\b(?:election)?bot\b/,
        /\b(?:bad|terrible|horrible|broken|buggy|dislike|hate|detest|poor)\b/,
        /\b(?:is|the|this|bot|electionbot|wow|pretty|very)\b/
    ].every((expression) => expression.test(text));
};

/**
 * @summary detects if someone is saying the bot is insane
 * @type {MessageGuard}
 */
export const isSayingBotIsInsane = (text) => {
    return [
        /(?<=(\bbot\b).+?|)(?:insane|crazy)(?:(?!\1)|.+?\bbot\b)/i
    ].some((expression) => expression.test(text));
};

/**
 * @summary checks if the message is asking about user eligibility
 * @type {MessageGuard}
 */
export const isAskedForUserEligibility = (text) => {
    return /^(?:can|is) user \d+(?: be)? (?:eligible|nominated?|elected?)/.test(text);
};

/**
 * @fun
 * @summary checks if a message is asking how many mods it takes to change a lightbulb
 * @type {MessageGuard}
 */
export const isAskedAboutLightbulb = (text) => {
    return /how (?:many|much) mod(?:erator)?s(?: does)? it takes? to (?:change|fix|replace)(?: a| the)? light(?:\s?bulb)?/i.test(text);
};

/**
 * @fun
 * @summary checks if a message is asking for a Jon Skeet joke
 * @type {MessageGuard}
 */
export const isAskedAboutJonSkeetJokes = (text) => {
    return /(?:tell|say)\b.*\bjon\s?skeet\s?(?:joke|fact|meme)?(?:[?!]|$)/i.test(text);
};

/**
 * @fun
 * @summary checks if a message is asking for a joke
 * @type {MessageGuard}
 */
export const isAskedAboutJokes = (text) => {
    return someMatch([
        /(?:tell|make|say|humou?r)\b.+?\b(?:me|us)?\b.+?(?:(?: a)? joke|laugh)/i
    ], text) && !/jon\s?skeet/i.test(text);
};

/**
 * @summary checks if a message is asking if bot's responses are canned
 * @type {MessageGuard}
 */
export const isAskedIfResponsesAreCanned = (text) => {
    return /bot\b.+?says?\b.+?canned/i.test(text);
};

/**
 * @summary checks if a message is asking to list required badges
 * @type {MessageGuard}
 */
export const isAskedAboutRequiredBadges = (text) => {
    return someMatch([
        /^(?:what\s+are|list)(?:\s+the)?\s+(?:required|mandatory|necessary|must have)\s+badges/i,
        /^(?:what|which)(?:\s+of)?(?:\s+the)?\s+badges\s+are\s+(?:need|required?|mandatory|necessary)/i
    ], text);
};

/**
 * @summary checks if a message is asking to list badges of a certain type
 * @type {MessageGuard}
 */
export const isAskedAboutBadgesOfType = (text) => {
    return /^(?:what|list)(?: are)?(?: the)?.+?\b(participation|edit(?:ing|or)?|mod(?:eration)?)\s+badges/i.test(text);
};

/**
 * @summary checks if a message is asking how to vote or who to vote for
 * @type {MessageGuard}
 */
export const isAskedHowOrWhoToVote = (text) => {
    return someMatch([
        /^(?:whom?|how)\s+(?:should(?:n't|\s+not)?\s+i|to)\s+(?:choose|pick|decide|determine|vote\s+for)/i,
        /^how\s+do(?:es)?\s+(?:i|one)\s+vote/i,
        /^how\s+do(?:es)?\s+(?:the\s+)?voting\s+(?:process)?work/i,
    ], text);
};

/**
 * @summary checks if a message is asking how to save the votes
 * @type {MessageGuard}
 */
export const isAskedHowToSaveVotes = (text) => {
    return someMatch(
        [
            /(?:how\s+)?(?:are|can i|should i|do i|to)\s+.*\b(?:saved?|votes?|ballot)\b.+\b(?:it|saved?|votes?|ballot)\b/i,
            /^(?:is|are)\s+the.+(?:votes?|voting|ballot).+(?:saved?|submitted|sen[dt]).+automatically/i,
            /^(?:where|which)(?: button)?.+to.+click.+to.+(?:save|submit|send).+the.+(?:votes?|voting|ballot)/i,
            /^do i(?: have to click anything to)?.+\b(?:save|submit|send)\b.+(?:the|my).+(?:votes?|voting|ballot)/i,
            /^(?:which|is there a|where is the) button to (?:submit the (?:votes?|ballot)|click after voting)/i,
        ],
        text
    );
};

/**
 * @summary checks if a message is asking which badges is one missing
 * @type {MessageGuard}
 */
export const isAskedAboutMissingBadges = (text) => {
    return allMatch([
        /wh(?:ich|at)\s+badges\s+(?:am|do)\s+I\s+(?:miss(?:ing)?|not\s+have)/i
    ], text)
}

/**
 * @summary checks if a message is asking where did the nomination comments go
 * @type {MessageGuard}
 */
export const isAskedAboutMissingComments = (text) => {
    return allMatch([
        /^(where|why|are|were|did|who|how|i|is|election)\b/,
        /\b(missing|hidden|cleared|deleted?|removed?|go|election|nominations?|all|view|find|bug|see)\b/,
        /\bcomments?\b/
    ], text);
};

/**
 * @summary checks if a message is asking who is the best candidate
 * @type {MessageGuard}
 */
export const isAskedWhoIsTheBestCandidate = (text) => {
    return someMatch([
        /^(?:who(?:'s)?|what(?:'s)?|which) (?:was |were |are |is )?(?:a |the )?.*\bbest(?:est)? (?:candidate|nomination|nominee)s?/i
    ], text);
};

/**
 * @summary checks if a message is asking who is the best mod
 * @type {MessageGuard}
 */
export const isAskedWhoIsTheBestMod = (text) => {
    return someMatch([
        /^(?:who|which)\s+(?:is|are|will\s+be)(?:\s+the)?(\s+most)?\s+(?:best|coolest|loved|favou?rite)\s+(?:mod|diamond)(?:erator)?/i
    ], text);
};

/**
 * @summary checks if a message is asking about STV ranked-choice voting
 * @type {MessageGuard}
 */
export const isAskedAboutSTV = (text) => {
    return someMatch([
        /^(?:what|how).*?(?:\s+meek)?\s+s(?:ingle\s+)?t(?:ransferable\s+)?v(?:ote)?/i
    ], text);
};

/**
 * @summary checks if the bot is mentioned
 * @param {string} text  message text
 * @param {ChatProfile|User} botChatProfile
 * @returns {Promise<boolean>}
 */
export const isBotMentioned = async (text, botChatProfile) => {
    const { name } = botChatProfile;
    const normalized = (await name).replace(/\s/g, "");
    return someMatch(
        [new RegExp(`^\\s*@(?:${normalized})[:,-]? `, "i")], text
    );
};

/**
 * @summary checks if a message is asking how many mods are in the room
 * @type {MessageGuard}
 */
export const isAskedHowManyModsInTheRoom = (text) => {
    return someMatch([
        /^how\s+many\s+mod(?:erator)?s\s+are\s+(?:here|in\s+th(?:e|is)\s+room)(?:\?|$)/i
    ], text);
};

/**
 * @summary checks if a message is asking how many candidates are in the room
 * @type {MessageGuard}
 */
export const isAskedHowManyCandidatesInTheRoom = (text) => {
    return someMatch([
        /^how many (?:candidate|nominee)s are\s+(?:here|in\s+th(?:e|is)\s+room)(?:\?|$)/i,
        /^are(?:\s+there\s+)?any\s+(?:candidate|nominee)s\s+(?:here|in\s+th(?:e|is)\s+room)(?:\?|$)/i
    ], text);
};

/**
 * @summary checks if a message is asking what the bot can do
 * @type {MessageGuard}
 */
export const isAskedWhatBotCanDo = (text) => {
    return someMatch([
        /^what\s+can\s+(?:you|(?:the\s+)?bot)\s+(?:do|answer|help(?:\s+(?:me|us))?(?:\s+with)?)/i
    ], text);
};

/**
 * @summary checks if a message is asking for help
 * @type {MessageGuard}
 */
export const isAskedForHelp = (text) => {
    return someMatch([
        /^can you help(?:\s+me)?/i,
        /^(?:please\s+)?(?:h[ae]lp|info)(?:(?:\s+me)?(?:,?\s+please)?)(?:[?!]|$)/i,
    ], text);
};

/**
 * @summary checks if a message is asking for full help
 * @type {MessageGuard}
 */
export const isAskedForFullHelp = (text) => {
    return someMatch([
        /^(?:(?:help|info|topics) (full|all|complete)|(full|all|complete) (?:help|info|topics))/i,
    ], text);
};

/**
 * @summary checks if a message is asking for what an election is
 * @type {MessageGuard}
 */
export const isAskedWhatElectionIs = (text) => {
    return text.length <= 56 && someMatch([
        /^(?:what|what's) (?:is )?(?:a |an |the )?election(?:\?\!?|$)/i,
        /^how do(?:es)? (?:a |an |the )?elections? work/i
    ], text);
};

/**
 * @summary checks if a message is asking what the election status is
 * @type {MessageGuard}
 */
export const isAskedWhatIsElectionStatus = (text) => {
    return someMatch([
        /^(?:what|how)\s+is(?:\s+the)?\s+election\s+(?:stat(?:us|e)|progress(?:ing)?)(?:\?\!?|$)/i,
        /^election\s+(?:stat(?:us|e)|progress)(?:\?\!?|$)/i,
        /^what\s+is(?:\s+the)?\s+(?:stat(?:us|e)|progress)\s+of(?:\s+the)?\s+election(?:\?\!?|$)/i
    ], text);
};

/**
 * @summary checks if a message is asking when is the next phase
 * @type {MessageGuard}
 */
export const isAskedWhenIsTheNextPhase = (text) => {
    return someMatch([
        /^when(?:'s| is| does) (?:the )?next phase/i,
        /^when(?:'s| is| does) (?:the )?(?:nomination|election) (?:phase )(?:start|end|over)(?:ing|ed)?/i,
        /is (?:it|election|nomination) (?:phase )?(?:start|end)(?:ing|ed)\s?(soon|yet)?/i,
    ], text);
};

/**
 * @summary checks if a message is asking when the election ends
 * @type {MessageGuard}
 */
export const isAskedWhenTheElectionEnds = (text) => {
    return someMatch([
        /^when(?:\s+does)?(?:\s+the)?\s+(?:it|election)\s+ends?(?:\?\!?|$)/i
    ], text);
};

/**
 * @summary checks if a message is asking how many users are eligible to vote
 * @type {MessageGuard}
 */
export const isAskedHowManyAreEligibleToVote = (text) => {
    return someMatch([
        /^how many(?: (?:users|people|bots))?(?: are eligible to| can) vote/i
    ], text);
};

/**
 * @summary checks if a message is asking for the election page
 * @type {MessageGuard}
 */
export const isAskedForElectionPage = (text) => {
    return someMatch([
        /(?:what|where)\s+is(?:\s+the)?\s+(?:(?:link|url)\s+(?:to|of)(?:\s+the)?\s+election|election\s+page)/i,
        /(?:link|url)\b.*\belection\b(?:page)?\s?(?:[?!]|$)/i,
        /election (?:page )?(?:link|url)(?:[?!]|$)/i,
    ], text);
};

/**
 * @summary checks if a message is asking where can one find a ballot file
 * @type {MessageGuard}
 */
export const isAskedAboutBallotFile = (text) => {
    return someMatch([
        /^(?:where|how)\s+(?:can|is)(?:\s+i\s+find)?(\s+the)?\s+(?:ballot|blt)(?:\s+file)?/i,
        /^is(?:\s+the)?\s+(?:ballot|blt)(?:\s+file)?\s+available/i
    ], text);
};

/**
 * @summary checks if a message is asking for the list of election phases
 * @type {MessageGuard}
 */
export const isAskedAboutElectionPhases = (text) => {
    return someMatch([
        /^(?:what)\s+are(?:\s+the)?(?:\s+election(?:'s|s)?)?\s+phases(?:[?!]|$)/i,
        /^list(?:\s+the)?\s+election(?:'s|s)?\s+phases(?:[?!]|$)/i
    ], text);
};

/**
 * @summary checks if a message is asking how many users already voted
 * @type {MessageGuard}
 */
export const isAskedHowManyVoted = (text) => {
    return someMatch([
        /^how\s+(?:many|much)(?:\s+(?:people|users))?(?:\s+have)?(?:\s+not)?\s+(?:vote|participate)d/i,
        /^how\s+(?:many|much)\s+(?:participant|voter)s/i
    ], text);
};

/**
 * TODO: unused guard (intentionally, was questioned by users)
 * @summary checks if a message is asking how many mods already voted
 * @type {MessageGuard}
 */
export const isAskedHowManyModsVoted = (text) => {
    return someMatch([
        /^how\s+(?:many|much)(?:\s+mod(?:erator)?s)(?:\s+have)?\s+(?:vote|participate)d/i
    ], text);
};

/**
 * @summary checks if a message is asking if one has voted themselves
 * @type {MessageGuard}
 */
export const isAskedIfOneHasVoted = (text) => {
    return someMatch([
        /^(?:did|have)\s+i\s+voted?(?:\s+in(?:\s+th[ei]s?)\s+election)??(?:\?|$)/i
    ], text);
};

/**
 * @summary checks if a message is asking if one can vote
 * @type {MessageGuard}
 */
export const isAskedIfCanVote = (text) => {
    return someMatch([
        /^can\s+i\s+vote(?:\s+in(?:\s+th[ei]s?)?\s+election)?(?:\?|$)/i
    ], text);
};

/**
 * @summary checks if a message is asking where to find results
 * @type {MessageGuard}
 */
export const isAskedWhereToFindResults = (text) => {
    return someMatch([
        /^(?:where|how)\s+can\s+i\s+find(?:\s+th[ei]s?)?(?:\s+election)?\s+results(?:\?|$)$/i,
        /^(?:where|how)(\s+can|)?(?:\s+th[ei]s?)?(?:\s+election)?\s+results(?:\1|\s+can)?\s+be\s+found(?:\?|$)$/i
    ], text);
};

/**
 * @summary checks if a message is asking for a question from the questionnaire
 * @type {MessageGuard}
 */
export const isAskedForQuestionnaireQuestion = (text) => {
    return someMatch([
        /^what\s+is(?:\s+the)?\s+(\w+|\d+(?:st|nd|rd|th)?)(?:\s+questionn?aire)?\s+question(?:\s+of(?:\s+the)?\s+questionn?aire)?/i
    ], text);
};

/**
 * @summary checks if a message is asking for past election results
 * @type {MessageGuard}
 */
export const isAskedAboutElectionResults = (text) => {
    return someMatch([
        /^what\s+(?:are|were)(?:\s+the)?\s+election\s+(?:number\s+|#)(?:\d+)\s+results/i,
        /^what(?:\s+the)?\s+election\s+(?:number\s+|#)(?:\d+)\s+results\s+(?:are|were)/i,
        /^what\s+(?:are|were)(?:\s+the)?\s+results\s+of(?:\s+the)?\s+election\s+(?:number\s+|#)(?:\d+)/i
    ], text);
};

/**
 * @summary checks if a message is asking for the election phase duration
 * @type {MessageGuard}
 */
export const isAskedAboutElectionPhaseDuration = (text) => {
    return someMatch([
        /^how\s+long\s+(?:does|will|is)(?:\s+the)?\s+(?:election|nomination|primary)\s+phase(?:\s+lasts?)?/i
    ], text);
};

/**
 * @summary checks if a message is asking for why the bot is
 * @type {MessageGuard}
 */
export const isAskedWhyIsBot = (text) => {
    return someMatch([
        /^why\s+are\s+you(?:\?\!?|$)/i,
        /^what\s+is\s+your\s+purpose(?:\?\!?|$)/i
    ], text);
};

/**
 * @summary checks if a message is asking about bot pronouns
 * @type {MessageGuard}
 */
export const isAskedAboutBotPronouns = (text) => {
    return someMatch([
        /^what(?:'s|\s+(?:is|are))\s+your(?:\s+preferred)?\s+pronouns(?:\?\!?|$)/i
    ], text);
};

/**
 * @summary checks if a message is asking about why are elections cancelled
 * @type {MessageGuard}
 */
export const isAskedWhyAreElectionsCancelled = (text) => {
    return someMatch([
        /^why\s+(?:are|would)(?:\s+(?:some|an))?\s+elections?(?:\s+be)?\s+cancell?ed(?:\?\!?|$)/i
    ], text);
};

/**
 * @summary checks if a message is asking about will the election be cancelled
 * @type {MessageGuard}
 */
export const isAskedWillElectionBeCancelled = (text) => {
    return someMatch([
        /^(?:is|will|would)(?:\s+th(?:e|is))?\s+election(?:\s+going\s+to)?\s+be\s+cancell?ed(?:\?\!?|$)/i
    ], text);
};

/**
 * @summary checks if a message is asking about how many users visited the election page
 * @type {MessageGuard}
 */
export const isAskedHowManyVisitedElection = (text) => {
    return someMatch([
        /^how\s+many(?:\s+users)?(?:\s+have)?\s+visited(?:\s+th[ei]s?)?\s+election(?:\s+page)?(?:\?\!?|$)/i
    ], text);
};

/**
 * @summary checks if a message is asking what is the type of the election
 * @type {MessageGuard}
 */
export const isAskedWhatIsElectionType = (text) => {
    return someMatch([
        /^what\s+is(?:\s+th[ei]s?)?(?:\s+election(?:'?s)?)?\s+type(?:\s+of(?:\s+th[ei]s?)?\s+election)?/i,
        /^is\s+th[ei]s?(?:\s+election)?(?:\s+a)?\s+pro[- ]tem(?:p[ou]re)?(?:\s+election)?/i,
    ], text);
};

/**
 * @summary checks if a message is asking who of the current mods is running
 * @type {MessageGuard}
 */
export const isAskedWhatModsAreRunning = (text) => {
    return someMatch([
        /^(?:list|what|which|who)(?:\s+of)?(?:\s+the)?(?:\s+current)?\s+mod(?:erator)?s?(?:\s+that)?\s+(?:(?:are|is)\s+running|(?:ha[sv]e?\s+)?nominated)/i
    ], text);
};

/**
 * @summary checks if a message is asking if existing mods have to nominate
 * @type {MessageGuard}
 */
export const isAskedIfModsHaveToRun = (text) => {
    return someMatch([
        /(?:do|must)\s+(?:current|existing)\s+mod(?:erator)?s(?:\s+have\s+to)?\s+(?:run|nominate|step\s+down)/i
    ], text);
};