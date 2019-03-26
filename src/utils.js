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
            console.log(`Node app ${staticPath} is listening on port ${app.get('port')}.`);
        });
    },

    keepAlive: function(url, mins = 20) 
    {
        // Fetch endpoint to prevent server from idling
        setInterval(function() {
            https.get(url).on('error', function(err) {
                console.error(">> keep-alive error! " + err.message);
            });
        }, mins * 60000); // every 20 minutes
    },

    dateToTimestamp: function(date)
    {
        if(typeof date === 'number') date = new Date(date); // from int
        if(typeof date !== 'object') date = new Date(); // invalid, default to now

        return date.toISOString().replace('T', ' ').replace(/\.\d+/, '');
    }
}
