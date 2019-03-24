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

    keepAlive: function(scriptHostname) 
    {
        
        setInterval(function() {
            https.get(scriptHostname).on('error', function(err) {
                console.error(">> keep-alive error! " + err.message);
            });
        }, 20 * 60000); // every 20 minutes
    }
}
