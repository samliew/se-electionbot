const path = require('path');
const https = require('https');
const express = require('express');
const request = require('request-promise');
const bodyParser = require('body-parser');

/**
 * @summary validates and normalizes the Date
 * @param {Date|number|string} input 
 * @returns {Date}
 */
const validateDate = (input) => {

    let output = input;

    if (typeof input === 'string' || typeof input === 'number') {
        output = new Date(input);
    };

    //instanceof as normal objects will pass `typeof !== "object"` validation
    if (!(output instanceof Date)) {
        output = new Date();
    };

    return output;
};

/**
 * @summary base pluralization
 * @param {number} amount 
 * @returns {string}
 */
const pluralize = amount => amount !== 1 ? 's' : '';

const exported = {

    startServer: function (room) {
        const app = express().set('port', process.env.PORT || 5000);
        const staticPath = path.join(__dirname, '../static');

        app.use(bodyParser.urlencoded({ extended: true }));
        app.use(function (req, res, next) {
            res.header("Access-Control-Allow-Origin", "*");
            res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
            next();
        });

        app.use('/', express.static(staticPath));

        app.listen(app.get('port'), () => {
            console.log(`INIT - Node app ${staticPath} is listening on port ${app.get('port')}.`);
        });

        const shutdown = () => {
            app.close(function () {
                console.log('gracefully shutting down');
            });
        };
        process.on('SIGINT', shutdown);
        process.on('SIGTERM', shutdown);

        return app;
    },

    /**
     * @summary pings endpoint periodically to prevent idling
     * @param {string} url
     * @param {number} mins
     * @returns {void}
     */
    keepAlive: (url, mins = 20) => {
        setInterval(() => {
            https.get(url).on('error', (err) => console.error(`ERROR - Keep-alive failed. ${err.message}`));
        }, mins * 60000);
    },

    /**
     * @summary fetches the endpoint
     * @param {string} url
     * @param {boolean} [json]
     * @returns {Promise}
     */
    fetchUrl: async (url, json = false) => {
        const debug = process.env.DEBUG.toLowerCase() !== 'false'; // default to true

        try {
            const content = await request({
                gzip: true, // important: https://meta.stackexchange.com/a/446
                simple: false,
                resolveWithFullResponse: false,
                headers: {
                    'User-Agent': `Node.js/ElectionBot ver.${process.env.SOURCE_VERSION}; AccountEmail ${process.env.ACCOUNT_EMAIL}`,
                },
                uri: url,
                json: url.includes('api') || json,
            });
            console.log(`FETCH - ${url}`, debug ? (json ? JSON.stringify(content) : content) : '');
            return content;
        }
        catch (e) {
            console.error('FETCH - ERROR:', e);
            return null;
        }
    },

    /**
     * @summary formats date input into ISO 8601 format
     * 
     * @example
     *  https://www.timeanddate.com/worldclock/fixedtime.html?iso=20201231T2359
     * 
     * @param {Date|string|number} date 
     * @returns {string}
     */
    toTadParamFormat: (date) => {
        return validateDate(date).toISOString()
            .replace(/(-|:|\d\dZ)/gi, '')
            .replace(/\..*$/, '')
            .replace(/ /g, 'T');
    },

    /**
     * @summary formats date to UTC timestamp
     * @param {Date|string|number} date 
     * @returns {string}
     */
    dateToUtcTimestamp: (date) => {
        return validateDate(date).toISOString()
            .replace('T', ' ')
            .replace(/\.\d+/, '');
    },

    /**
     * @summary formats date to relative time
     * @param {Date|number|string} date 
     * @param {string} [soonText] 
     * @returns {string}
     */
    dateToRelativetime: (date, soonText = 'soon') => {

        date = validateDate(date);

        const diff = new Date(date) - Date.now();
        const daysTo = Math.floor(diff / (864e5));
        const hoursTo = Math.floor(diff / (36e5));

        if (daysTo < 1 && hoursTo < 1) {
            return soonText;
        }

        if (daysTo >= 1) {
            return `in ${daysTo} day${pluralize(daysTo)}`;
        }

        if (hoursTo >= 1) {
            return `in ${hoursTo} hour${pluralize(hoursTo)}`;
        }

        return soonText;
    },

    link: `https://www.timeanddate.com/worldclock/fixedtime.html?iso=`,

    /**
     * @summary formats date check link to relative time
     * @param {Date|number|string} date
     * @returns {string}
     */
    linkToRelativeTimestamp: (date) => {
        return `[${exported.dateToRelativetime(date)}](${exported.link}${exported.toTadParamFormat(date)})`;
    },

    /**
     * @summary formats date check link to UTC time
     * @param {Date|number|string} date
     * @returns {string}
     */
    linkToUtcTimestamp: (date) => {
        return `[${exported.dateToUtcTimestamp(date)}](${exported.link}${exported.toTadParamFormat(date)})`;
    },

    pluralize
};

module.exports = exported;