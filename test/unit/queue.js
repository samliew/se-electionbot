import { expect } from "chai";
import Client, { ChatEventType } from "chatexchange";
import Room from "chatexchange/dist/Room.js";
import WebsocketEvent from "chatexchange/dist/WebsocketEvent.js";
import sinon from "sinon";
import { sendMultipartMessage } from "../../src/bot/queue.js";
import { getMockBotConfig } from "../mocks/bot.js";

describe('Message Queue', () => {
    describe(sendMultipartMessage.name, () => {

        const client = new Client["default"]("stackexchange.com");

        beforeEach(() => sinon.restore());

        /** @type {Room} */
        let room;
        beforeEach(() => room = new Room["default"](client, -1));

        /** @type {sinon.SinonFakeTimers} */
        let clock;
        beforeEach(() => clock = sinon.useFakeTimers());
        afterEach(() => clock.restore());

        /** @type {ReturnType<typeof getMockBotConfig>} */
        let config;
        beforeEach(() => config = getMockBotConfig());

        /** @type {WebsocketEvent} */
        let message;
        beforeEach(() => {
            message = new WebsocketEvent["default"](client, {
                event_type: ChatEventType.MESSAGE_POSTED,
                id: 1,
                room_id: room.id,
                room_name: "Test Room",
                time_stamp: Date.now(),
                user_id: 42,
                user_name: "Douglas"
            });
        });

        it('should exit early on invalid response', async () => {
            const send = sinon.stub(room, "sendMessage");

            const response = "";

            const status = await sendMultipartMessage(config, room, response, message.id, true);

            expect(status).to.be.false;
            expect(send.calledOnce).to.be.false;
        });

        it('should split on newlines', async () => {
            config.maxMessageLength = 6;

            const send = sinon.stub(room, "sendMessage");

            const response = "first\nfifth";

            const promise = sendMultipartMessage(config, room, response, message.id, true);
            await clock.runAllAsync();
            const status = await promise;

            expect(status).to.be.true;
            expect(send.firstCall.args[0]).to.equal("first");
            expect(send.secondCall.args[0]).to.equal("fifth");
        });

        it('should split on spaces, commas, or semicolons if no newlines', async () => {
            config.maxMessageLength = 6;

            const send = sinon.stub(room, "sendMessage");

            const response = "first fifth";

            const promise = sendMultipartMessage(config, room, response, message.id, true);
            await clock.runAllAsync();
            const status = await promise;

            expect(status).to.be.true;
            expect(send.firstCall.args[0]).to.equal("first");
            expect(send.secondCall.args[0]).to.equal("fifth");
        });

        it('should send a warning if more than three message', async () => {
            config.maxMessageLength = 6;

            const send = sinon.stub(room, "sendMessage");

            const response = "first second third fourth fifth";

            const promise = sendMultipartMessage(config, room, response, message.id, true);
            await clock.runAllAsync();
            const status = await promise;

            expect(status).to.be.false;
            expect(send.calledOnce).to.be.true; // because we only sent one message - the warning itself
            expect(send.firstCall.args[0]).to.include("wrote a poem");
        });
    });
});