const path = require('path');
const https = require('https');
const express = require('express');
const request = require('request-promise');
const cheerio = require('cheerio');
const bodyParser = require('body-parser');

module.exports = {

    startServer: function(room) 
    {
        const app = express().set('port', process.env.PORT || 5000);
        const staticPath = path.join(__dirname, '../static');
        
        app.use(bodyParser.urlencoded({ extended: true }));
        app.use(function(req, res, next) {
            res.header("Access-Control-Allow-Origin", "*");
            res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
            next();
        });

        app.use('/', express.static(staticPath));

        app.listen(app.get('port'), () => {
            console.log(`INIT - Node app ${staticPath} is listening on port ${app.get('port')}.`);
        });

        process.on('SIGINT', function() {
            app.close(() => console.log('gracefully shutting down'));
        });

        return app;
    },

    keepAlive: function(url, mins = 30) 
    {
        // Fetch endpoint to prevent server from idling
        setInterval(function() {
            https.get(url).on('error', function(err) {
                console.error("ERROR - Keep-alive failed." + err.message);
            });
        }, mins * 60000);
    },

    fetchUrl: async function(url, json = false)
    {
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
            console.log(`FETCH - ${url}`);
            return content;
        }
        catch(e) {
            console.error('FETCH - ERROR:', e);
            return null;
        }
    },

    getSiteUserIdFromChatStackExchangeId: async function(chatUserId, siteUrl)
    {
        let userId = null;

        const chatUserPage = await module.exports.fetchUrl(`https://chat.${chatdomain}/users/${chatUserId}`);
        let $ = cheerio.load(chatUserPage);
        const linkedUserUrl = $('.user-stats a').first().attr('href');
        console.log(`Linked site user url: `, linkedUserUrl);

        // Linked site is the one we wanted, return site userid
        if(linkedUserUrl.includes(siteUrl)) {
            userId = Number(linkedUserUrl.match(/\d+/, ''));
        }

        // Linked site is not the one we wanted
        else {
                
            try {

                // Fetch linked site profile page to get network link
                const linkedUserProfilePage = await module.exports.fetchUrl(`${linkedUserUrl}?tab=profile`);
                $ = cheerio.load(linkedUserProfilePage);
                const networkUserUrl = $('.js-user-header a').last().attr('href');
                console.log(`Network user url: `, networkUserUrl);

                // Fetch network accounts to get the account of the site we want
                const networkAccountsPage = await module.exports.fetchUrl(`${networkUserUrl}?tab=accounts`);
                $ = cheerio.load(networkAccountsPage);
                let siteUserUrl = $('.account-site a').filter((i, el) => el.href.includes(siteUrl)).first().attr('href');
                console.log(`Site user url: `, siteUserUrl);

                // Finally we get the target site's user id
                if(siteUserUrl.length == 1) userId = Number(siteUserUrl.match(/\d+/, ''));
            }
            catch(e) {
                console.error(e);
            }
        }

        console.log(`Resolved site user id: `, userId);
        return userId;
    },

    // Example URL: https://www.timeanddate.com/worldclock/fixedtime.html?iso=20201231T2359
    toTadParamFormat: function(date)
    {
        if(typeof date === 'string' || typeof date === 'number') date = new Date(date); // from string or int
        if(typeof date !== 'object') date = new Date(); // invalid, default to now

        return date.toISOString().replace(/(-|:|\d\dZ)/gi, '').replace(/\..*$/, '').replace(/ /g, 'T');
    },

    dateToUtcTimestamp: function(date)
    {
        if(typeof date === 'string' || typeof date === 'number') date = new Date(date); // from string or int
        if(typeof date !== 'object') date = new Date(); // invalid, default to now

        return date.toISOString().replace('T', ' ').replace(/\.\d+/, '');
    },

    dateToRelativetime: function(date, soonText = 'soon')
    {
        if(typeof date === 'string' || typeof date === 'number') date = new Date(date); // from string or int
        if(typeof date !== 'object') date = new Date(); // invalid, default to now

        const pluralize = n => n !== 1 ? 's' : '';

        const diff = new Date(date) - Date.now();
        const daysTo = Math.floor(diff / (24 * 60 * 60 * 1000));
        const hoursTo = Math.floor(diff / (60 * 60 * 1000));
        const textLink = daysTo > 1 ? 'in ' + daysTo + ' day' + pluralize(daysTo) :
            hoursTo > 1 ? 'in ' + hoursTo + ' hour' + pluralize(hoursTo) :
            soonText;

        return textLink;
    },

    linkToRelativeTimestamp: function(date)
    {
        return `[${module.exports.dateToRelativetime(date)}](https://www.timeanddate.com/worldclock/fixedtime.html?iso=${module.exports.toTadParamFormat(date)})`
    },

    linkToUtcTimestamp: function(date)
    {
        return `[${module.exports.dateToUtcTimestamp(date)}](https://www.timeanddate.com/worldclock/fixedtime.html?iso=${module.exports.toTadParamFormat(date)})`
    }
}
