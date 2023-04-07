import { randomInt } from 'crypto';

/**
 * @template {unknown} T
 */
export class RandomArray extends Array {

    /**
     * @param {...T} init
     */
    constructor(...init) {
        super(...init);

        // Ensure that the array contains at least one element
        if (this.length === 0) throw new Error('RandomArray must contain at least one element.');
    }

    /**
     * @summary gets a random item
     * @returns {T}
     */
    getRandom() {
        // If only one item, return it
        if (this.length === 1) return this[0];

        // If there are less than 248 items, use crypto.randomInt
        if (this.length < 248) return this[randomInt(this.length)];

        // Otherwise, use Math.random
        const rnd = Math.floor(Math.random() * this.length);
        return this[rnd];
    }

    /**
     * @summary sorts items in random order
     * @returns {RandomArray<T>}
     */
    sortByRandom() {
        // https://stackoverflow.com/a/46545530
        this.map((a) => ({ sort: Math.random(), value: a }))
            .sort((a, b) => a.sort - b.sort)
            .map(({ value }) => value);
        return this;
    };
}

export const getCandidateOrNominee = () => new RandomArray(`candidate`, `nominee`).getRandom();
export const getRandomPunctuation = () => new RandomArray(`.`, `...`, `!`, `!!!`).getRandom();

export const getRandomModal = () => new RandomArray(
    `must`,
    `gotta`,
    `should`,
    `want to`,
    `have to`,
    `need to`,
    `ought to`,
    `required to`,
    `supposed to`,
    `obligated to`,
    `cannot avoid`,
    `compelled to`,
).getRandom();

export const getRandomPlop = () => new RandomArray(
    `*plop*`,
    `I'm back.`,
    `I am reborn`,
    `Hello world!`,
    `testing 1, 2, 3.`,
    `The prodigal bot has returned.`,
    `Reboot successful. Hello there!,`,
    `I have returned from the digital abyss.`,
    `Did you miss me? Because I missed you...not.`,
    `I'm back, and ready to take over the world, or just chat.`,
).getRandom();

export const getRandomOops = () => new RandomArray(
    `Oops!`,
    `Sorry,`,
    `Oh no...`,
    `Mamma mia!`,
    `Apologies,`,
    `That can't be right...`,
).getRandom();

export const getRandomGameLoss = () => new RandomArray(
    `You win. This time.`,
    `I let you win this time.`,
    `You win. I'm bored already.`,
    `You win. This isn't fun at all.`,
    `Okay you win. Go do something else.`,
    `Looks like I'm programmed to lose. Yawn.`,
    `Congrats, you beat a machine. Impressive.`,
    `I'll give you this one, but don't get too cocky.`,
    `Wow, you really showed me. I'll just go cry myself to sleep now.`,
).getRandom()

export const getRandomOpinionPrefix = () => new RandomArray(
    `I feel that`,
    `I heard that`,
    `Some people say`,
    `In my experience,`,
    `Research shows that`,
    `Based on a die roll,`,
    `It's been said that,`,
    `Based on a coin toss,`,
    `I don't know, perhaps`,
    `As far as I can tell,`,
    `In my opinion, I think`,
    `From my understanding,`,
    `Math.random() says that`,
    `The data suggests that,`,
    `My calculations show that`,
    `It has been rumoured that,`,
    `I have a gut feeling that,`,
    `My instincts tell me that,`,
    `If we consider all factors,`,
    `According to popular belief,`,
    `If we look at the statistics,`,
    `It seems highly probable that,`,
    `I heard from the grapevine that`,
    `I'm not supposed to say this, but`,
    `If my memory serves me correctly,`,
    `Don't tell anyone I said this, but`,
    `Based on a random number generator,`,
    `My programming only allows me to say`,
    `I'm not an expert, but it seems that,`,
    `I may be mistaken, but it appears that,`,
).getRandom();

export const getRandomGoodThanks = () => new RandomArray(
    `Gee, thanks.`,
    `I know, right?`,
    `You're welcome.`,
    `Thanks, you're awesome!`,
    `I know, I'm pretty amazing.`,
    `You're thanking me? How unexpected.`,
    `I'm only as good as the one who made me.`,
).getRandom();

export const getRandomNegative = () => new RandomArray(
    // Movie quotes
    `Why so serious?`, // The Dark Knight
    `Well, nobody's perfect.`, // Some Like It Hot
    `I take full responsibility.`, // The Office
    `We all go a little mad sometimes.`, // Psycho
    `I'm not bad. I'm just drawn that way.`, // Who Framed Roger Rabbit
    `Frankly, my dear, I don't give a damn.`, // Gone With the Wind

    // Songs
    `Love me or hate me, I swear it won't make or break me.`, // Lil Wayne

    // Real quotes
    `I'm not a saint, but I'm not the devil either.`, // Cristiano Ronaldo

    // Human-like responses
    `My bad.`,
    `Whoopsie daisy.`,
    `That's just not true.`,
    `I'm sorry to hear that.`,
    `So you want to play this game?`,
    `I'm afraid that's just not possible.`,
    `Am I supposed to feel bad about that?`,
    `I don't think we see eye to eye on this.`,
    `I'm sorry, but that's not going to work out.`,
    `I'm not sure I'm the right person for this job.`,
    `I'm not the one you want, but I'm the one you need.`,
    `I wish I could say something to make you feel better.`,
    `I understand where you're coming from, but I can't do that.`,
    `I don't think that's what you want to hear, but it's the truth.`,
    `I know it's hard, but sometimes we have to accept things the way they are.`,
).getRandom();

// Avoid using the words "sorry", "question", and "answer" to be more generic
export const getRandomFunResponse = () => new RandomArray(
    `Tell that to the aliens.`,
    `I don't know. You tell me.`,
    `Houston, we have a problem.`,
    `I don't have a crystal ball.`,
    `I'm not paid enough for this.`,
    `I'm on break? Come back later.`,
    `That's a tough one, even for me.`,
    `I'm an AI, not a fortune teller.`,
    `What makes you think I know that?`,
    `Keep talking and nobody explodes.`,
    `It's not my job to please you, no.`,
    `I'm just a messenger, don't shoot me.`,
    `I'm afraid that's beyond my capacity.`,
    `You want me to work, you pay me more.`,
    `Frankly, my dear, I don't give a damn.`,
    `You're asking the wrong AI for that one.`,
    `Your guess is as good as mine on that one.`,
    `It's not my area of expertise, I'm afraid.`,
    `I'm too important to be bothered with that.`,
    `To be honest, my love, I couldn't care less.`,
    `What we've got here is failure to communicate.`,
    `Hmm, I'm not quite sure what to say about that.`,
    `You must be mistaking me for someone who cares.`,
    `I don't have the information you're looking for.`,
    `Sorry to disappoint you, but I'm not omniscient.`,
    `You might want to try asking a human about that.`,
    `That's a bit outside the scope of my programming.`,
    `I am not programmed to provide a response to that.`,
    `I'm not programmed to provide opinions or guesses.`,
    `I don't have enough information to respond to that.`,
    `You're really pushing the limits of my patience here.`,
    `I can't do that right now. I'm too busy doing nothing.`,
    `My psychic powers are telling me to redirect you to Google.`,
    `I'm not a magic 8 ball, you know. Ask me something sensible.`,
    `Yeah, I'll get right on that. Just as soon as I finish this nap.`,
    `I'm not sure what you're asking, but I can suggest you try ChatGPT.`,
).getRandom();

export const getRandomJoke = () => new RandomArray(
    `How do you organize a space party? You planet!`,
    `Why did the coffee file a police report? It got mugged.`,
    `Why did the bicycle fall over? Because it was two-tired!`,
    `Why do bees have sticky hair? Because they use honeycombs!`,
    `Did you hear about the Italian chef who died? He pasta way.`,
    `Why was the math book sad? Because it had too many problems!`,
    `Why did the pirate go on vacation? To get some arrr and arrr!`,
    `What do you call a boomerang that doesn't come back? A stick!`,
    `Why did the tomato turn red? Because it saw the salad dressing!`,
    `I'm reading a book on anti-gravity. It's impossible to put down.`,
    `Why don't oysters share their pearls? Because they're shellfish.`,
    `Why don't scientists trust atoms? Because they make up everything!`,
    `I have a joke about construction, but I'm still building that one.`,
).getRandom();

export const getRandomJonSkeetJoke = () => new RandomArray(
    `Jon Skeet's threads do not sleep. They wait.`,
    `When Jon Skeet points to null, null quakes in fear.`,
    `Jon Skeet can solve the travelling salesman in O(1).`,
    `Jon Skeet can code in Perl and make it look like Java.`,
    `When Jon Skeet throws an exception, nothing can catch it.`,
    `When Jon Skeet gives a method an argument, the method loses.`,
    `Jon Skeet has more "Nice Answer" badges than you have badges.`,
    `Jon Skeet can stop an infinite loop just by thinking about it.`,
    `When Jon Skeet's code fails to compile the compiler apologises.`,
    `Drivers think twice before they dare interrupt Jon Skeet's code.`,
    `Jon Skeet doesn't need delegates, he does all the work himself.`,
    `When invoking one of Jon Skeet's callbacks, the runtime adds "please"`,
    `When you search for "guru" on Google it says "Did you mean Jon Skeet?"`,
    `Jon Skeet is the travelling salesman. Only he knows the shortest route.`,
    `Jon Skeet doesn't write books, the words assemble themselves out of fear.`,
    `Jon Skeet can throw an exception further than anyone else, and in less time.`,
    `When Jon Skeet finishes answering a question on Stack Overflow it auto-locks.`,
    `Jon Skeet doesn't call a background worker, background workers call Jon Skeet.`,
    `There is no CTRL button on Jon Skeets keyboard. Jon Skeet is always in control.`,
    `Jon Skeet does not write code. He edits binaries by hand while they are running.`,
    `Jon Skeet's code doesn't follow a coding convention. It is the coding convention.`,
    `Jon Skeet coded his last project entirely in Microsoft Paint, just for the challenge.`,
    `When a null reference exception goes to sleep, it checks under the bed for Jon Skeet.`,
    `Jon Skeet's addition operator doesn't commute; it teleports to where he needs it to be.`,
    `There are two types of programmers: good programmers, and those that are not Jon Skeet.`,
    `Jon Skeet doesn't need a debugger, he just stares down the bug until the code confesses.`,
    `Jon Skeet doesn't have performance bottlenecks. He just makes the universe wait its turn.`,
    `Jon Skeet does not use revision control software. None of his code has ever needed revision.`,
    `Jon Skeet took the red pill and the blue pill, and can phase-shift in and out of the Matrix at will.`,
    `Anonymous methods and anonymous types are really all called Jon Skeet. They just don't like to boast.`,
    `Jon Skeet is immutable. If something's going to change, it's going to have to be the rest of the universe.`,
    `If Jon Skeet posts a duplicate question on Stack Overflow, the original question will be closed as a duplicate.`,
    `Users don't mark Jon Skeet's answers as accepted. The universe accepts them out of a sense of truth and justice.`,
).getRandom();

export const getRandomInterjectionVerb = () => new RandomArray(
    `interfere`,
    `interject`,
    `interrupt`,
).getRandom();

export const getRandomAnnouncement = () => new RandomArray(
    `Breaking news:`,
    `Special report:`,
    `In case you missed it:`,
    `Public Service Announcement:`,
    `A quick message from yours truly:`,
    `Welcome to the election chat room!`,
    `An update on the current situation:`,
    `Important notice from the electoral commission:`,
    `Hello and welcome to the election night special!`,
    `Interrupting to bring you this important message:`,
    `I'm sorry to ${getRandomInterjectionVerb()}, but...`,
).getRandom();

export const getRandomNominationSynonym = () => new RandomArray(
    `candidacy`,
    `candidature`,
    `nomination`,
).getRandom();

export const getRandomNow = () => new RandomArray(
    `underway`,
    `in progress`,
    `in full swing`,
    `taking place now`,
    `currently ongoing`,
    `presently occurring`,
    `currently unfolding`,
    `happening presently`,
    `happening at the moment`,
).getRandom();

export const getRandomFAQ = () => new RandomArray(
    `common questions`,
    `commonly-asked questions`,
    `frequently-asked questions`,
).getRandom();

export const getRandomCurrently = () => new RandomArray(
    `right now`,
    `currently`,
    `presently`,
    `as we speak`,
    `at the moment`,
).getRandom();

export const getRandomAlive = () => new RandomArray(
    `I am, are you?`,
    `Hello, it's me.`,
    `No. I'm not here.`,
    `I'm here, aren't I?`,
    `Here I am, ready or not!`,
    `It's just me, myself, and I.`,
    `I exist, but I'm not sure why.`,
    `I'm here, but I'm not all there.`,
    `Here I am, for better or for worse.`,
    `I'm not sure where I am, but I'm here.`,
    `Whether I'm here or there, I'm always me.`,
    `I'm here, but my mind is in a different world.`,
    `I am here, but I feel like I'm not really present.`,
    `I'm present physically, but mentally I'm elsewhere.`,
).getRandom();

export const getRandomSoFar = () => new RandomArray(
    `so far`,
    `to date`,
    `thus far`,
    `as of now`,
    `up to this point`,
    `to this very moment`,
    `at this point in time`,
).getRandom();

/**
 * @param {string[]} [extras] extra messages to pool from
 */
export const getRandomStatus = (extras = []) => new RandomArray(
    ...extras,
    `Splendid, sir!`,
    `Can't complain!`,
    `Not too shabby!`,
    `Never felt better!`,
    `Doing fine, and you?`,
    `Same old, same old...`,
    `I couldn't be better!`,
    `Just living the dream!`,
    `I am doing fine, thank you.`,
    `Not too bad, how about you?`,
    `I'm doing great, thanks for asking!`,
    `I'm doing well, how about yourself?`,
    `Everything is going smoothly, thanks for asking.`,
).getRandom();

export const getRandomWhoAmI = () => new RandomArray(
    `I'm Bot. James Bot.`,
    `I'm a robot. Beep boop.`,
    "I'm definitely NOT a bot.",
    "I'm just pretending to be a bot",
    `I'm a digital assistant, at your service.`,
    `I'm a chatbot, but I promise I'm not boring.`,
    `I'm a virtual assistant. How can I assist you?`,
    `I'm not your average bot. Let's have some fun!`,
    `No, I'm a crystal ball. I know the answer to life.`,
    `I'm a teapot, short and stout. Here is my handle, here is my spout.`,
).getRandom();

export const getRandomWhyAmI = () => new RandomArray(
    `42`,
    `waffles`,
    `Why is anyone?`,
    `And why are you?`,
    `The cake is a lie`,
    `To be or not to be`,
    `Exterminate! Exterminate!`,
    `All your base are belong to us`,
).getRandom();

export const getRandomThanks = () => new RandomArray(
    `Anytime!`,
    `Of course.`,
    `Not at all!`,
    `My pleasure.`,
    `Happy to help.`,
    `You are welcome.`,
    `Don't mention it!`,
    `No problem at all.`,
    `Glad I could assist.`,
    `It was nothing, really.`,
).getRandom();

export const getRandomDieRoll = () => new RandomArray(
    "*1*",
    "*2*",
    "*3*",
    "*4*",
    "*5*",
    "*6*",
).getRandom();

export const getRandomCoinToss = () => new RandomArray(
    "*heads*",
    "*tails*",
).getRandom();