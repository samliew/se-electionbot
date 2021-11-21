import { expect } from "chai";
import { asyncCacheable, fetchChatTranscript, fetchRoomOwners, getSiteDefaultChatroom, listify, numToString, parseBoolEnv, parseIds, parseNumEnv, pluralize, searchChat, stripMarkdown } from "../../src/bot/utils.js";
import { dateToRelativetime } from "../../src/bot/utils/dates.js";
import { matchNumber } from "../../src/bot/utils/expressions.js";
import { numericNullable } from "../../src/bot/utils/objects.js";
import { getMockBotConfig } from "../mocks/bot.js";

describe('RegExp-related utils', () => {
    describe('matchNumber', () => {
        it('should correctly match and parse a number', () => {
            const ans = matchNumber(/^(\d+) is/, "42 is the answer");
            expect(ans).to.equal(42);
        });

        it('should return undefined if no number matched', () => {
            const nothing = matchNumber(/capture \d+,?/, "forgot to capture 1984, sorry");
            expect(nothing).to.be.undefined;
        });
    });

    describe('stripMarkdown', () => {
        it('should correctly strip markdown', () => {
            const stripped = stripMarkdown("testing _some_ smart **messages** from some __pesky__ users :)");
            expect(stripped).to.equal("testing some smart messages from some pesky users :)");
        });

        it('should not strip unclosed markdown', () => {
            const clothed = "_this should print **verbatim__";
            const stripped = stripMarkdown(clothed);
            expect(stripped).to.equal(clothed);
        });
    });
});

describe('Object-related utils', () => {
    describe('numericOptional', () => {
        it('should correctly parse nullable objects', () => {
            const ans = numericNullable({ answer: "42" }, "answer");

            const nullable = /** @type {{ question: string }|null|undefined} */(null);
            const que = numericNullable(nullable, "question");

            expect(ans).to.equal(42);
            expect(que).to.equal(null);
        });
    });
});

describe('Boolean-related utils', () => {
    describe('parseBoolEnv', () => {

        before(() => process.env.RESISTANCE_IS_FUTILE = "true");
        after(() => delete process.env.RESISTANCE_IS_FUTILE);

        it('should correctly parse variables', () => {
            const isFutile = parseBoolEnv("resistance_is_futile");
            const missing = parseBoolEnv("question");

            expect(isFutile).to.be.true;
            expect(missing).to.be.false;
        });

        it('should default to provided default value if key is not found', () => {
            const missing = parseBoolEnv("defaulted", true);
            expect(missing).to.be.true;
        });
    });
});

describe('Number-related utils', () => {
    describe('parseNumEnv', () => {

        before(() => process.env.ANSWER = "42");
        after(() => delete process.env.ANSWER);

        it('should correctly parse variables', () => {
            const existing = parseNumEnv("answer");
            const empty = parseNumEnv("void");

            expect(existing).to.equal(42);
            expect(empty).to.equal(void 0);
        });

        it('should default to provided default value if no key found', () => {
            const empty = parseNumEnv("defaulted", 42);
            expect(empty).to.equal(42);
        });
    });

    describe('numToString', () => {

        it('should correctly output number as text', () => {

            // Non-numeric values
            expect(numToString(null)).to.equal('');
            expect(numToString('abc')).to.equal('abc');
            expect(numToString(["abc"])).to.equal('abc');
            expect(numToString({ 'key': 'value' })).to.equal('[object Object]');

            expect(numToString(-1)).to.equal('-1');

            expect(numToString(0)).to.equal('zero');
            expect(numToString(1)).to.equal('one');
            expect(numToString(10)).to.equal('ten');
            expect(numToString(11)).to.equal('eleven');
            expect(numToString(12)).to.equal('twelve');
            expect(numToString(13)).to.equal('thirteen');
            expect(numToString(14)).to.equal('fourteen');
            expect(numToString(15)).to.equal('fifteen');
            expect(numToString(16)).to.equal('sixteen');
            expect(numToString(17)).to.equal('seventeen');
            expect(numToString(18)).to.equal('eighteen');
            expect(numToString(19)).to.equal('nineteen');
            expect(numToString(20)).to.equal('twenty');
            expect(numToString(42)).to.equal('forty-two');
            expect(numToString(69)).to.equal('sixty-nine');
            expect(numToString(100)).to.equal('one-hundred');

            expect(numToString(101)).to.equal('101');
        });
    });
});

describe('String-related utils', async function () {

    describe('listify', () => {

        it('should join with a comma if <= 2 items', () => {
            const list = listify("first", "second");
            expect(list).to.equal("first, second");
        });

        it('should join last item with ", and <item>" if > 2 items', () => {
            const list = listify("alpha", "beta", "gamma");
            expect(list).to.equal("alpha, beta, and gamma");
        });
    });

    describe('pluralize', () => {

        it('should not pluralize item count === 1', () => {
            const plural = pluralize(1, "s");
            expect(plural).to.equal("");
        });

        it('should pluralize otherwise', () => {
            const plural = pluralize(10, "es");
            expect(plural).to.equal("es");
        });
    });

    describe('parseIds', () => {

        it('should parse id strings correctly', () => {
            const parsed = parseIds("1234|56789|101010");
            expect(parsed).to.deep.equal([1234, 56789, 101010]);
        });
    });

    describe('getSiteDefaultChatroom', async () => {

        it('should fetch a site\'s default chat room correctly', async () => {
            const chatroom = await getSiteDefaultChatroom(getMockBotConfig(), "https://stackoverflow.com");

            expect(chatroom?.chatRoomId).to.equal(197438);
            expect(chatroom?.chatDomain).to.equal("stackoverflow.com");

            const chatroom2 = await getSiteDefaultChatroom(getMockBotConfig(), "https://superuser.com");

            expect(chatroom2?.chatRoomId).to.equal(118);
            expect(chatroom2?.chatDomain).to.equal("stackexchange.com");
        });
    });

    this.timeout(10e3); // fetching transcript can be slow

    describe('fetchChatTranscript', async () => {

        it('should fetch chat transcript correctly', async () => {
            const transcriptUrl = "https://chat.stackoverflow.com/transcript/190503/2019/3/20";
            const chatMessages = await fetchChatTranscript(getMockBotConfig(), transcriptUrl);

            expect(chatMessages).to.not.be.empty;

            expect(chatMessages[0].username).to.equal("Samuel Liew");
            expect(chatMessages[0].chatUserId).to.equal(584192);
            expect(chatMessages[0].message).to.equal("how do I vote?");
            expect(chatMessages[0].date).to.equal(1553052480000);
            expect(chatMessages[0].messageId).to.equal(45689273);

            expect(chatMessages[1].date).to.equal(1553052481000);
            expect(chatMessages[2].date).to.equal(1553052482000);
            expect(chatMessages[3].date).to.equal(1553052483000);
            expect(chatMessages[4].date).to.equal(1553052484000);
            expect(chatMessages[5].date).to.equal(1553052485000);

            expect(chatMessages[6].date).to.equal(1553053320000);
            expect(chatMessages[6].message).to.equal("how do I vote?  This is a test link");
            expect(chatMessages[6].messageMarkup).to.equal("**how do *I* vote?**  [This is a test link](https://stackoverflow.com/election)");
        });
    });

    describe('searchChat', async () => {

        it('should be able to search chat correctly', async () => {
            const chatMessages = await searchChat(getMockBotConfig(), "stackoverflow.com", "We have a new nomination Please welcome our latest candidate", 238039);

            expect(chatMessages).to.not.be.empty;

            const reversedMessages = chatMessages.reverse();

            expect(reversedMessages[0].username).to.equal("ElectionBot");
            expect(reversedMessages[0].chatUserId).to.equal(10555677);
            expect(reversedMessages[0].message).to.equal("We have a new nomination! Please welcome our latest candidate Tamás Sengel!");
            expect(reversedMessages[0].date).to.equal(1633983300000);
            expect(reversedMessages[0].messageId).to.equal(53211461);
        });
    });

    describe('fetchRoomOwners', async () => {

        it('should fetch chat room owners correctly', async () => {
            const owners = await fetchRoomOwners(getMockBotConfig());
            expect(owners.some(user => user.userId === 584192)).to.be.true;
        });
    });

    describe(dateToRelativetime.name, () => {
        it('should be able to convert a date in the future correctly', () => {
            let date, result;

            date = new Date();
            result = dateToRelativetime(date.setSeconds(date.getSeconds() + 1));
            expect(result).to.equal("soon");

            result = dateToRelativetime(date.setSeconds(date.getSeconds() + 30));
            expect(result).to.match(/^in 3[01] secs$/); // +/- 1 sec

            result = dateToRelativetime(date.setMinutes(date.getMinutes() + 30));
            expect(result).to.equal("in 30 mins");

            result = dateToRelativetime(date.setMinutes(date.getMinutes() + 30));
            expect(result).to.equal("in 1 hour");

            result = dateToRelativetime(date.setHours(date.getHours() + 1));
            expect(result).to.equal("in 2 hours");

            result = dateToRelativetime(date.setDate(date.getDate() + 1));
            expect(result).to.equal("in 1 day");

            result = dateToRelativetime(date.setDate(date.getDate() + 1));
            expect(result).to.equal("in 2 days");
        });

        it('should be able to convert a date in the past correctly', () => {
            let date, result;

            date = new Date();
            result = dateToRelativetime(date.setSeconds(date.getSeconds() - 1));
            expect(result).to.equal("just now");

            result = dateToRelativetime(date.setSeconds(date.getSeconds() - 30));
            expect(result).to.match(/^3[01] secs ago$/); // +/- 1 sec

            result = dateToRelativetime(date.setMinutes(date.getMinutes() - 30));
            expect(result).to.equal("30 mins ago");

            result = dateToRelativetime(date.setMinutes(date.getMinutes() - 30));
            expect(result).to.equal("1 hour ago");

            result = dateToRelativetime(date.setHours(date.getHours() - 1));
            expect(result).to.equal("2 hours ago");

            result = dateToRelativetime(date.setDate(date.getDate() - 1));
            expect(result).to.equal("1 day ago");

            result = dateToRelativetime(date.setDate(date.getDate() - 1));
            expect(result).to.equal("2 days ago");
        });
    });

    describe('cacheable', () => {

        it('should use cached value if available', async () => {
            const obj = {
                curr: 0,
                get next() {
                    return Promise.resolve(++this.curr);
                }
            };

            const func = (/** @type {typeof obj} */o) => o.next;

            const cached = asyncCacheable("obj", func);

            expect(await cached(obj)).to.equal(1);
            expect(await cached(obj)).to.equal(1);
            expect(obj.curr).to.equal(1);
        });
    });

});