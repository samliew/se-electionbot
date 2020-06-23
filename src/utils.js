const path = require('path');
const https = require('https');
const express = require('express');

module.exports = {

    staticServer: function() 
    {
        const app = express().set('port', process.env.PORT || 5000);
        
        const staticPath = path.join(__dirname, '../static');
        app.use('/', express.static(staticPath));
                
        app.listen(app.get('port'), () => {
            console.log(`INIT - Node app ${staticPath} is listening on port ${app.get('port')}.`);
        });

        process.on('SIGINT', function() {
            app.close(function() {
                console.log('gracefully shutting down');
            });
        });

        return app;
    },

    keepAlive: function(url, mins = 20) 
    {
        // Fetch endpoint to prevent server from idling
        setInterval(function() {
            https.get(url).on('error', function(err) {
                console.error("ERROR - Keep-alive failed." + err.message);
            });
        }, mins * 60000);
    },

    toTadDateFormat: function(date)
    {
        if(typeof date === 'number') date = new Date(date); // from int
        if(typeof date !== 'object') date = new Date(); // invalid, default to now

        return date.toISOString().replace(/(-|:|\d\dZ)/gi, '').replace(/\d{2}\.\d+/, '').replace(/ /g, 'T');
    },

    dateToTimestamp: function(date)
    {
        if(typeof date === 'number') date = new Date(date); // from int
        if(typeof date !== 'object') date = new Date(); // invalid, default to now

        return date.toISOString().replace('T', ' ').replace(/\.\d+/, '');
    },

    toRelativetime: function(date, soonText = 'soon')
    {
        if(typeof date === 'number') date = new Date(date); // from int
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
        return `[${this.toRelativetime(date)}](https://www.timeanddate.com/worldclock/fixedtime.html?iso=${this.toTadDateFormat(date)}})`
    },

    linkToUtcTimestamp: function(date)
    {
        return `[${this.dateToTimestamp(date)}](https://www.timeanddate.com/worldclock/fixedtime.html?iso=${this.toTadDateFormat(date)}})`
    }
}
