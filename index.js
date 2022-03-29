const express = require("express");
const cors = require('cors');
const https = require('https');
const http = require('http');
const fs = require('fs');
const uuid = require("uuid");
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(cors());

const periodMilliseconds = Number(process.env.PERIOD_SECONDS || 5) * 1000;
const gameServers = {};
const healthTimes = {};

app.get('/', (req, res) => {
    const result = [];
    for (const key in gameServers) {
        if (Object.hasOwnProperty.call(gameServers, key)) {
            result.push(gameServers[key]);
        }
    }
    res.status(200).send({
        success: true,
        gameServers: result,
    });
});

app.get('/totalPlayer', (req, res) => {
    let totalPlayer = 0;
    for (const key in gameServers) {
        if (Object.hasOwnProperty.call(gameServers, key)) {
            totalPlayer += gameServers[key].currentPlayer;
        }
    }
    res.status(200).send({
        success: true,
        totalPlayer,
    });
});

app.post('/connect', (req, res) => {
    const value = req.body;
    if (!value)
    {
        res.status(400).send({
            success: false,
            error: "No Data",
        });
    }
    else
    {
        // NOTE: Not sure there is a form validation library or not.
        const gameServer = {
            id: uuid.v4(),
            address: value.address,
            port: value.port,
            title: value.title,
            description: value.description,
            map: value.map,
            currentPlayer: value.currentPlayer,
            maxPlayer: value.maxPlayer,
        };
        gameServers[gameServer.id] = gameServer;
        const time = Date.now();
        healthTimes[gameServer.id] = time;
        console.log('Server id ' + gameServer.id + ' connected at ' + time);
        res.status(200).send({
            success: true,
            gameServer,
        });
    }
});

app.post('/health', (req, res) => {
    const value = req.body;
    if (!value)
    {
        res.status(400).send({
            success: false,
            error: "No Data",
        });
    }
    else
    {
        const id = value.id;
        if (id !== undefined && id in healthTimes)
        {
            const time = Date.now();
            healthTimes[id] = time;
            console.log('Server id ' + id + ' health update at ' + time);
            res.status(200).send({
                success: true,
            });
        }
        else
        {
            res.status(404).send({
                success: false,
                error: "Cannot find the server",
            });
        }
    }
});

app.put('/update', (req, res) => {
    const value = req.body;
    if (!value)
    {
        res.status(400).send({
            success: false,
            error: "No Data",
        });
    }
    else
    {
        const id = value.id;
        if (id !== undefined && id in gameServers)
        {
            const gameServer = {
                id: value.id,
                address: value.address,
                port: value.port,
                title: value.title,
                description: value.description,
                map: value.map,
                currentPlayer: value.currentPlayer,
                maxPlayer: value.maxPlayer,
            };
            gameServers[id] = gameServer;
            res.status(200).send({
                success: true,
                gameServer,
            });
        }
        else
        {
            res.status(404).send({
                success: false,
                error: "Cannot find the server",
            });
        }
    }
});

app.post('/shutdown', (req, res) => {
    const value = req.body;
    if (!value)
    {
        res.status(400).send({
            success: false,
            error: "No Data",
        });
    }
    else
    {
        const id = value.id;
        if (id !== undefined && id in gameServers)
        {
            delete gameServers[id];
            delete healthTimes[id];
            console.log('Server id ' + id + ' shutdown');
            res.status(200).send({
                success: true,
            });
        }
        else
        {
            res.status(404).send({
                success: false,
                error: "Cannot find the server",
            });
        }
    }
});


const HealthHandle = () =>
{
    try
    {
        const keys = Object.keys(gameServers);
        for (let i = 0; i < keys.length; ++i) {
            const id = keys[i];
            const timeDiff = Date.now() - healthTimes[id];
            if (timeDiff >= periodMilliseconds)
            {
                // Kick unhealthy (timed out) game servers
                delete gameServers[id];
                delete healthTimes[id];
                console.log('Server id ' + id + ' timed out.');
            }
        }
    }
    catch (error)
    {
        console.error('Error occurring while handling health checking: ' + error);
    }
};
setInterval(HealthHandle, 1000);

const port = Number(process.env.SERVER_PORT || 8000);
const useHttps = Number(process.env.USE_HTTPS || 0) > 0;
const keyFilePath = process.env.HTTPS_KEY_FILE_PATH;
const certFilePath = process.env.HTTPS_CERT_FILE_PATH;
const httpsPort = Number(process.env.HTTPS_SERVER_PORT || 8080);

const httpServer = http.createServer(app);
httpServer.listen(port, () => {
    console.log(`Simple Server Listing is listening on port ${port}`);
});

if (useHttps) {
    const httpsServer = https.createServer({
        key: fs.readFileSync(keyFilePath),
        cert: fs.readFileSync(certFilePath),
    }, app);
    httpsServer.listen(httpsPort, () => {
        console.log(`Simple Server Listing is listening on port ${httpsPort}`);
    });
}