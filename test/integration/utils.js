import { expect } from "chai";
import dotenv from "dotenv";
import { test } from "mocha";
import BotEnv from "../../src/bot/env.js";
import {
    fetchChatTranscript,
    fetchRoomOwners,
    getSiteDefaultChatroom,
    searchChat
} from "../../src/bot/utils.js";
import { getMockBotConfig } from "../mocks/bot.js";

describe("Stack Exchange Chat integration", function () {
    dotenv.config();

    const env = new BotEnv(process.env);
    const apiKeyPool = env.or("stack_api_keys");

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
            const transcriptUrl = "https://chat.stackoverflow.com/transcript/190503";
            const config = getMockBotConfig({ showTranscriptMessages: 7 });
            const messages = await fetchChatTranscript(config, transcriptUrl, {
                order: "asc",
                transcriptDate: new Date(Date.UTC(2019, 2, 20, 23, 59, 59, 999)),
            });

            expect(messages).to.not.be.empty;

            const [first, second, third, fourth, fifth, sixth, seventh] = messages;

            expect(first.username).to.equal("Samuel Liew");
            expect(first.chatUserId).to.equal(584192);
            expect(first.message).to.equal("how do I vote?");
            expect(first.date).to.equal(1553052480000);
            expect(first.messageId).to.equal(45689273);

            expect(second.date).to.equal(1553052481000);
            expect(third.date).to.equal(1553052482000);
            expect(fourth.date).to.equal(1553052483000);
            expect(fifth.date).to.equal(1553052484000);
            expect(sixth.date).to.equal(1553052485000);

            expect(seventh.date).to.equal(1553053320000);
            expect(seventh.message).to.equal("how do I vote?  This is a test link");
            expect(seventh.messageMarkup).to.equal("**how do *I* vote?**  [This is a test link](https://stackoverflow.com/election)");
        });
    });

    describe(searchChat.name, async () => {
        testIf('should be able to search chat correctly', async () => {
            const chatMessages = await searchChat(getMockBotConfig(), "We have a new nomination Please welcome our latest candidate", 238039);

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
            expect(owners.some(user => user.id === 584192)).to.be.true;
        });
    });
});