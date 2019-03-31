const path = require('path');
const https = require('https');
const express = require('express');
let app;

module.exports = {

    shutdownServer: function(app) {
        if(app) app.close();
    },

    staticServer: function() 
    {
        app = express().set('port', process.env.PORT || 5000);
        
        const staticPath = path.join(__dirname, '../static');
        app.use('/', express.static(staticPath));
                
        app.listen(app.get('port'), () => {
            console.log(`INIT - Node app ${staticPath} is listening on port ${app.get('port')}.`);
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

    dateToTimestamp: function(date)
    {
        if(typeof date === 'number') date = new Date(date); // from int
        if(typeof date !== 'object') date = new Date(); // invalid, default to now

        return date.toISOString().replace('T', ' ').replace(/\.\d+/, '');
    }
}
