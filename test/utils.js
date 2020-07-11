const { expect } = require("chai");

const { 
    dateToRelativetime,
    dateToUtcTimestamp, 
    link, 
    linkToRelativeTimestamp, 
    linkToUtcTimestamp,
    toTadParamFormat 
} = require("../src/utils.js");

/**
 * @summary test utility for reformatting ISO 8601 to UTC
 * 
 * @example
 *  20200101T111213 -> 2020-01-01T11:12:13Z
 * 
 * @param {string} datestring 
 * @returns {string}
 */
const reviveISO = (datestring) => datestring
    .replace(
        /(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(?:(\.\d{3})Z)?/,
        "$1-$2-$3T$4:$5:$6$7Z"
    );

/**
 * @summary test utility to get UTC string
 * @param {Date} date 
 * @returns {string}
 */
const getUTC = (date) => date.toISOString().replace("T", " ").replace(/\.\d{3}/, "");

describe('linkToRelativeTimestamp', function () {
    
    it('should return correctly formatted link', function () {
        const now = Date.now();
        const output = linkToRelativeTimestamp(now);
        const date = toTadParamFormat(now);
        expect(output).to.equal(`[soon](${link}${date})`)
    });

});

describe('dateToRelativetime', function () {
    
    it('text should default to "soon"', function () {
        const output = dateToRelativetime(new Date());
        expect(output).to.equal("soon");
    });

    it('should correctly pluralize', function () {
        //Plural rule #1 (2 forms)

        const tested = new Date();

        tested.setHours(tested.getHours() + 2);
        const singular = dateToRelativetime(tested);
        expect(singular).to.equal("in 1 hour");

        tested.setHours(tested.getHours() + 2);
        const multiple = dateToRelativetime(tested);
        expect(multiple).to.equal("in 3 hours");

        tested.setHours(tested.getHours() + 8);
        const eleven = dateToRelativetime(tested);
        expect(eleven).to.equal("in 11 hours");

        tested.setHours(tested.getHours() + 10);
        const twentyOne = dateToRelativetime(tested);
        expect(twentyOne).to.equal("in 21 hours");
    });

    describe('should correctly determine relations correctly:', function () {
        
        it('for more than 1 day', function () {
            const tested = new Date(Date.now() + 864e5 * 2);
            const moreThanDay = dateToRelativetime(tested);
            expect(moreThanDay).to.equal("in 2 days");
        });

        it('for less than 1 day but more than 1 hour', function () {
            const tested = new Date(Date.now() + 864e5 - 36e5 * 2);
            const moreThanDay = dateToRelativetime(tested);
            expect(moreThanDay).to.equal("in 22 hours");
        });

        it('for less than 1 hour', function () {
            const tested = new Date(Date.now() + 36e5 * 1 - 1e3);
            const moreThanDay = dateToRelativetime(tested);
            expect(moreThanDay).to.equal("soon");
        });

    });

});

describe('linkToUtcTimestamp', function () {
    
    it('should return correctly formatted link', function () {
        const now = Date.now();
        const output = linkToUtcTimestamp(now);
        const utc = dateToUtcTimestamp(now);
        const iso8601 = toTadParamFormat(now);
        expect(output).to.equal(`[${utc}](${link}${iso8601})`);
    });

});

describe('dateToUtcTimestamp', function () {

    it('should format Date instances', function () {
        const testDate = new Date();
        const output = dateToUtcTimestamp(testDate);
        const comparedTo = getUTC(testDate);
        expect(output).to.equal(comparedTo);
    });

    it('should format primitive value', function () {
        const testDate = new Date().valueOf();
        const output = dateToUtcTimestamp(testDate);
        const comparedTo = getUTC(new Date(testDate));
        expect(output).to.equal(comparedTo);
    });

    it('should format datestring', function () {
        const testDate = new Date().toISOString();
        const output = dateToUtcTimestamp(testDate);
        const comparedTo = getUTC(new Date(testDate));
        expect(output).to.equal(comparedTo);
    });

});

describe('toTadParamFormat', function () {

    it('should format Date instances', function () {
        const testDate = new Date("1948-12-04");
        const output = toTadParamFormat(testDate);
        expect(output).to.equal("19481204T000000");
    });

    it('should format primitive value', function () {
        const testDate = new Date("1984-04-12T20:00:00").valueOf();
        const output = toTadParamFormat(testDate);
        const parsedOutput = new Date(reviveISO(output));
        expect(parsedOutput).to.deep.equal(new Date(testDate));
    });

    it('should format datestring', function () {
        const testDate = new Date().toISOString();
        const output = toTadParamFormat(testDate);
        const parsedOutput = new Date(reviveISO(output));
        const compareTo = new Date(testDate);
        compareTo.setMilliseconds(0);
        expect(parsedOutput).to.deep.equal(compareTo);
    });

});