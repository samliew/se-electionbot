import { expect } from "chai";
import { listify, parseIds, pluralize, fetchChatTranscript, getSiteDefaultChatroom } from "../../src/utils.js";
import { getMockBotConfig } from "../mocks/bot.js";

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
    
    this.timeout(10e3); // fetching transcript can be slow

    describe('fetchChatTranscript', async () => {

        it('should fetch chat transcript correctly', async () => {
            const transcriptUrl = "https://chat.stackoverflow.com/transcript/190503/2019/3/20";
            const chatMessages = await fetchChatTranscript(getMockBotConfig(), transcriptUrl);

            expect(chatMessages).to.not.be.empty;
            expect(chatMessages[0].message).to.equal("how do I vote?");
        });

    });

    describe('getSiteDefaultChatroom', async () => {

        it('should fetch a site\'s default chat room correctly', async () => {
            const chatroom = await getSiteDefaultChatroom(getMockBotConfig(), "https://stackoverflow.com");

            expect(chatroom.chatRoomId).to.equal(197438);
            expect(chatroom.chatDomain).to.equal("stackoverflow.com");
            
            const chatroom2 = await getSiteDefaultChatroom(getMockBotConfig(), "https://superuser.com");

            expect(chatroom2.chatRoomId).to.equal(118);
            expect(chatroom2.chatDomain).to.equal("stackexchange.com");
        });

    });

});