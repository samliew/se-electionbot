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
                process.exit();
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

    dateToTimestamp: function(date)
    {
        if(typeof date === 'number') date = new Date(date); // from int
        if(typeof date !== 'object') date = new Date(); // invalid, default to now

        return date.toISOString().replace('T', ' ').replace(/\.\d+/, '');
    }
}
