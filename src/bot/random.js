/**
 * @template {unknown} T
 */
export class RandomArray extends Array {
    /**
     * @param {...T} init
     */
    constructor(...init) {
        super(...init);
    }

    /**
     * @summary gets a random element
     * @returns {T}
     */
    getRandom() {
        const rnd = Math.floor(Math.random() * this.length);
        return this[rnd];
    }

    /**
     * @summary sorts in random order
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
export const getRandomModal = () => new RandomArray(`want to`, `have to`, `ought to`, `gotta`, `must`).getRandom();
export const getRandomPlop = () => new RandomArray(`I'm back.`, `*plop*`, `I am reborn`, `Hello world!`, `mic check`, `testing 1, 2, 3`).getRandom();
export const getRandomOops = () => new RandomArray(`very funny,`, `oops!`, `hmm...`, `hey,`, `sorry,`).getRandom();
export const getRandomSecretPrefix = () => new RandomArray(
    `don't tell anyone I said this, but`,
    `I'm not supposed to say this, but`,
    `*shhh...*`,
    `*whispers* I think...`,
).getRandom();

export const getRandomGoodThanks = () => new RandomArray(
    `I know, right?`,
    `You're welcome.`,
    `Thanks! You're awesome!`,
    `I'm only as good as the one who made me.`,
).getRandom();

export const getRandomNegative = () => new RandomArray(
    `Why so serious?`,
    `I want to be alone.`,
    `Well, nobody's perfect.`,
    `You can't handle the truth!`,
    `So you want to play this game?`,
    `Am I more than you bargained for yet?`,
    `Am I supposed to feel bad about that?`,
    `Frankly, my dear, I don't give a damn.`,
    `What we've got here is a small misunderstanding.`,
    `I'm only human after all, don't put the blame on me.`,
    `Love me or hate me, I swear it won't make or break me.`,
).getRandom();

export const getRandomFunResponse = () => new RandomArray(
    `Nobody knows why.`,
    `You talking to me?`,
    `I want to play a game.`,
    `*reticulating splines*`,
    `Tell that to the aliens.`,
    `What do you want from me?`,
    `*error* - AI not installed`,
    `Houston, we have a problem.`,
    `What makes you think I know that?`,
    `Keep talking and nobody explodes.`,
    `It's not my job to please you, no.`,
    `Frankly, my dear, I don't give a damn.`,
    `To be honest, my love, I couldn't care less.`,
    `What we've got here is failure to communicate.`,
    `Time will tell. Sooner or later, time will tell...`,
    `Well, here's another nice mess you've gotten me into!`,
    `There will be no such thing as free will; there will only be my will.`,
).getRandom();

export const getRandomJoke = () => new RandomArray(
    `What's the object-oriented way to become wealthy? Inheritance.`,
    `Why did the programmer quit his job? Because he didn't get arrays.`,
    `To understand what recursion is, you must first understand recursion.`,
    `If the GC in Java worked correctly, most Java programs would disappear.`,
    `A SQL query goes into a bar, walks up to two tables and asks, "Can I join you?"`,
    `A good programmer is someone who looks both ways before crossing a one-way street.`,
    `Why do programmers always mix up Halloween and Christmas? Because Oct 31 == Dec 25!`,
    `How many testers does it take to change a lightbulb? None, they just report "it's dark"`,
    `How many programmers does it take to change a light bulb? None, that's a hardware problem.`,
    `Some people, when confronted with a problem, think "I know, I'll use regular expressions". Now they have two problems.`,
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
    "interject", "interrupt", "interfere"
).getRandom();

export const getRandomAnnouncement = () => new RandomArray(
    "Public service announcement: ",
    `I'm sorry to ${getRandomInterjectionVerb()}, but... `,
    "A quick message from my sponsors: ",
    "Welcome to the election chat room! ",
    "And now for something completely different - ",
    "Hello and welcome to the election night special! ",
    "Interrupting to bring you this important message: ",
).getRandom();

export const getRandomNominationSynonym = () => new RandomArray(
    "candidature",
    "candidacy",
    "nomination"
).getRandom();

export const getRandomNow = () => new RandomArray(
    "underway",
    "happening at the moment",
    "in progress"
).getRandom();

export const getRandomFAQ = () => new RandomArray(
    "commonly-asked questions",
    "frequently-asked questions",
    "common questions"
).getRandom();

export const getRandomCurrently = () => new RandomArray(
    "currently", "presently", "at the moment"
).getRandom();

export const getRandomAlive = () => new RandomArray(
    `Hello, it's me.`,
    `No. I'm not here.`,
    `I'm here, aren't I?`,
    `I'm on the interwebs`,
    `I'm here and everywhere`,
    "I am, are you?",
    "Alive or not, what is the difference?",
    "I am not quite sure"
).getRandom();

export const getRandomSoFar = () => new RandomArray(
    "so far",
    "thus far",
    "to date"
).getRandom();

/**
 * @param {string[]} [extras] extra messages to pool from
 */
export const getRandomStatus = (extras = []) => new RandomArray(
    ...extras,
    "Splendid, sir!",
    "I am doing fine, thank you.",
    "Never felt better!",
    "Same old, same old...",
    "Doing fine, and you?"
).getRandom();

export const getRandomWhoAmI = () => new RandomArray(
    `I'm Bot. James Bot.`,
    `I'm a robot. Beep boop.`,
    "I'm definitely NOT a bot.",
    "I'm just pretending to be a bot",
    `No, I'm a crystal ball. I know the answer to life.`,
    `I'm a teapot, short and stout. Here is my handle, here is my spout.`,
).getRandom();

export const getRandomThanks = () => new RandomArray(
    "Not at all!",
    "My pleasure.",
    "You are welcome.",
).getRandom();