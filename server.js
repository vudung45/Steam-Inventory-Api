/*
 Way2Heaven Cache Server
 */

var app = require('express')();
var request = require('request');
const fs = require('fs');

var serverBusy = false;

//Local proxies
var server = ["", "https://way2heaven-web-davidvu98.c9users.io/file.php?link=", "https://way2heaven-davidvu98.c9users.io/file.php?link=", "https://w2hchatbox-davidvu98.c9users.io/file.php?link="];

var time;


function setConfig() {
    for (var i = 0; i < server.length; i++) {
        fs.readFile("config.txt", (err, data) => {
            if (err) console.log(err);
    else {
            time = data.toString().split(",");
            for (var i = 0; i < server.length || function() {
                writeConfig();
                return false;
            }(); i++) {
                if (i > time.length - 1) {
                    time.push(0);
                }
                time[i] = parseInt(time[i]);
            }
        }
    });
    }
}

function writeConfig() {
    fs.writeFile("config.txt", time.join());

}

app.get('/reload/:steamid/:appid',function(req,res){
    var cacheDir = './cache/' + req.params['steamid'] + ' - ' + req.params['appid'] + '.txt';
    getData(req.params['steamid'], req.params['appid'], function(err, data) {
        if (!err) {
            var newCache = data;
            var savedCache = {
                time: new Date().getTime(),
                content: newCache
            };

            fs.writeFile(cacheDir, JSON.stringify(savedCache), (err) => {
                if (err) console.log(err);

            res.send("" + data);
        });
        } else {
            res.send("Server Busy!");
        }
    });
});

app.get('/:steamid/:appid', function(req, res) {
    var cacheDir = './cache/' + req.params['steamid'] + ' - ' + req.params['appid'] + '.txt';
    fs.exists(cacheDir, (exists) => {
        if (exists) {
            fs.readFile(cacheDir, (err, data) => {
                if (err) console.log(err);
            var obj = JSON.parse(data);
            if (new Date().getTime() - obj["time"] > 1200000 && !serverBusy) {å
                getData(req.params['steamid'], req.params['appid'], function(err, data) {
                    if (!err) {
                        var newCache = data;
                        var savedCache = {
                            time: new Date().getTime(),
                            content: newCache
                        };
                        fs.writeFile(cacheDir, JSON.stringify(savedCache), (err) => {
                            if (err) console.log(err);

                        res.send("" + data);
                    });
                    } else {
                        res.send("" + obj["content"]);
                    }
                });
            } else {
                res.send("" + obj["content"]);
            }
        });
        } else {
            if (!serverBusy) {
        getData(req.params['steamid'], req.params['appid'], function(err, data) {
            if (!err) {
                var newCache = data;
                var savedCache = {
                    time: new Date().getTime(),
                    content: newCache
                };

                fs.writeFile(cacheDir, JSON.stringify(savedCache), (err) => {
                    if (err) console.log(err);

                res.send("" + data);
            });
            } else {
                res.send("Server Busy!");
            }
        });
    } else {
        res.send("Server Busy!");
    }
}
});
});

//Get the least used proxy
//Avoid rate limit
function getMin(callback) {
    var thisMin = 0;
    var lastSaved = time[0];
    for (var i = 0; i < time.length || function() {
        callback(thisMin);
        return false;
    }(); i++) {
        if (time[i] <= lastSaved) {
            lastSaved = time[i];
            thisMin = i;
        }
    }
}

//Try using YAHOO YQL to parse first -> failed then use proxy
function getData(steamid, appid, callback) {
    yahooYQL(steamid, appid, function(err, data) {
        if (err || (err == null && data == null)) {
            localProxy(steamid, appid, function(err, data) {
                if (err) {
                    console.log(err)
                    callback(err, null);
                } else {
                    callback(null, data);
                }
            });
        } else {
            callback(null,data);
        }
    });
}



//Using C9 servers as proxies :D
function localProxy(steamid, appid, callback) {
    getMin(function(minIndex) {
        console.log(server[minIndex] + "http://steamcommunity.com/profiles/" + steamid + "/inventory/json/" + appid + "/2/?trading=1");
        var keepReq = true;
        request({
            url: server[minIndex] + "http://steamcommunity.com/profiles/" + steamid + "/inventory/json/" + appid + "/2/?trading=1",
            json: true
        }, function(error, response, body) {
            if (isJsonString(body)) {
                time[minIndex] = time[minIndex] + 1;
                writeConfig();
                callback(null, body);
                serverBusy = true;
                setTimeout(function() {
                    serverBusy = false
                }, 5000);
            } else {
                time[minIndex] = time[minIndex] + 3;
                writeConfig();
                callback("Server busy or invalid steamid / appid", null);
            }
        });
    });
}

function isJsonString(str) {
    try {
        JSON.parse(str);
    } catch (e) {
        return false;
    }
    return true;
}

function yahooYQL(steamid, appid, callback) {
    var steamLink = "http://steamcommunity.com/profiles/" + steamid + "/inventory/json/" + appid + "/2/?trading=1";
    request({
        url: "https://query.yahooapis.com/v1/public/yql?q=select * from json where url='" + steamLink + "'&format=json",
        json: true
    }, function(error, response, body) {
        if (error) {
            console.log(error);
            callback(error, null)
        } else {
            if (body.query.results != null) {
                console.log("Parsed Using Yahoo YQL: https://query.yahooapis.com/v1/public/yql?q=select * from json where url='" + steamLink + "'&format=json");
                var data = body.query.results.json;
                reSort(data,function(err,data){
                    if(!err){
                        callback(null, JSON.stringify(data));
                    } else {
                        callback(err,null);
                    }
                });
            } else {
                console.log("Yahoo YQL Failed! Trying localProxy");
                callback(null, null);
            }
        }
    });

}

//Workaround for YAHOO YQL
function reSort(data,callback){
    var i = 0;
    if(data.hasOwnProperty("rgInventory")){
        for(var thisItem in data.rgInventory){
            i++;
            data.rgInventory[data.rgInventory[thisItem].id] = data.rgInventory[thisItem];
            delete data.rgInventory[thisItem];
            if(i >= Object.keys(data.rgInventory).length){
                var c = 0;
                for(var thisItem in data.rgDescriptions){
                    c++;
                    data.rgDescriptions[data.rgDescriptions[thisItem].classid+"_"+data.rgDescriptions[thisItem].instanceid] = data.rgDescriptions[thisItem];
                    delete data.rgDescriptions[thisItem];
                    if(c >= Object.keys(data.rgDescriptions).length){
                        callback(null,data);
                    }
                }
            }
        }
    } else {
        callback("Something went wrong", null);
    }

}
app.listen(8080, function() {
    setConfig();
    console.log('W2Heaven Inventory Cache Server. Config Loaded!')
})
