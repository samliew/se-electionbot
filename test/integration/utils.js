import { expect } from "chai";
import dotenv from "dotenv";
import { test } from "mocha";
import {
    fetchChatTranscript,
    fetchRoomOwners,
    getSiteDefaultChatroom,
    searchChat
} from "../../src/bot/utils.js";
import { getMockBotConfig } from "../mocks/bot.js";

describe("Stack Exchange Chat integration", function () {

    dotenv.config();

    const apiKeyPool = process.env.STACK_API_KEYS?.split('|')?.filter(Boolean) || [];

    const hasCreds = apiKeyPool.length > 0;
    const testIf = hasCreds ? test : test.skip;

    if (!hasCreds) {
        console.log("Cannot test SE Chat integration with no API key, skipping");
    }

    this.timeout(10e3); // fetching transcript can be slow

    describe(getSiteDefaultChatroom.name, async () => {
        testIf('should fetch a site\'s default chat room correctly', async () => {
            const chatroom = await getSiteDefaultChatroom(getMockBotConfig(), "https://stackoverflow.com");

            expect(chatroom?.chatRoomId).to.equal(197438);
            expect(chatroom?.chatDomain).to.equal("stackoverflow.com");

            const chatroom2 = await getSiteDefaultChatroom(getMockBotConfig(), "https://superuser.com");

            expect(chatroom2?.chatRoomId).to.equal(118);
            expect(chatroom2?.chatDomain).to.equal("stackexchange.com");
        });
    });

    describe(fetchChatTranscript.name, async () => {
        testIf('should fetch chat transcript correctly', async () => {
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

    describe(searchChat.name, async () => {
        testIf('should be able to search chat correctly', async () => {
            const chatMessages = await searchChat(getMockBotConfig(), "stackoverflow.com", "We have a new nomination Please welcome our latest candidate", 238039);

            expect(chatMessages).to.not.be.empty;

            const [reversedMessage] = chatMessages.reverse();

            expect(reversedMessage.username).to.equal("ElectionBot");
            expect(reversedMessage.chatUserId).to.equal(10555677);
            expect(reversedMessage.message).to.equal("We have a new nomination! Please welcome our latest candidate Tamás Sengel!");
            expect(reversedMessage.date).to.equal(1633983300000);
            expect(reversedMessage.messageId).to.equal(53211461);
        });
    });

    describe(fetchRoomOwners.name, async () => {
        testIf('should fetch chat room owners correctly', async () => {
            const owners = await fetchRoomOwners(getMockBotConfig());
            expect(owners.some(user => user.userId === 584192)).to.be.true;
        });
    });
});