/*
Way2Heaven-Eztrade Inventory Cache Server
This is a small version of a working Steam Inventory Cache Server on EZTrade.gg
Features:
    - Parse float/stickers of items in csgo
    - Avoid steam inventory rate limits
*/
var app = require('express')();
var request = require('request');
var fs = require("fs-extra");
var lockFile = require("lockfile");
var bodyParser = require('body-parser')
var SteamUser = require("steam-user");
var botMaster = require("csgo-floats");
var pretty = require('express-prettify');
var master = new botMaster();
var bot1, bot2, bot3, bot4, bot5;
var swapQueue = [];
bot1 = new SteamUser();
bot2 = new SteamUser();
bot3 = new SteamUser();
bot4 = new SteamUser();
var itemCounter = {};
const keepCacheLimit = 86400000; // this is the time limit for each item in float Cache (delete item from cache when expires)
const timeLimit = 120000; //Rate limit to parse new inventory

//add inspect bot
addInspectBot(master, bot1, 'username', 'password');

//Cache Storage
var uStorage = {730: {}}; //normal user
var botStorage = {730: {}}; //bots inventory


//list of bots steamid 64
var invBotList = []; //to load item counter

master.on('error', response => {
    const {
        accountID,
        error
    } = response;
    console.log(`Account ${accountID} disconnected from Steam.`, error);
})



master.on('connectedToGC', accountID => {
    console.log(`Account ${accountID} connected to GC.`);
});

master.on('disconnectedFromGC', response => {
    const {
        accountID,
        error
    } = response;
    console.log(`Account ${accountID} disconnected from GC.`, error);
});

var serverBusy = false;
//Proxies to bypass rate limit
var proxies = ["0.0.0.0"]
var index = 0; //index of currently used proxy
console.log("Number of proxies:" + proxies.length);

var time;

//float cache
var floatCache = JSON.parse(fs.readFileSync("./floatcache.json"));

console.log("Float Cache loaded");
var inspectQueue = []
processQueue(); //process Float Parsing queue
processSwapQueue(); 

function saveCacheFloat() {
    var dataToSave = {};
    for (var item in floatCache) {
        if (floatCache[item] != null && floatCache[item].processed) {
            dataToSave[item] = floatCache[item];
        }
    }
    fs.writeFile("./floatcache.json", JSON.stringify(dataToSave));
}

function addInspectBot(master, bot, username, password) {
    bot.logOn({
        accountName: username,
        password: password
    })
    master.addBot(bot)
        .then(accountID => console.log(`Account ${accountID} added to bot master.`))
        .catch(error => console.log('Error adding bot to bot master.', error));
}


app.use(bodyParser.urlencoded({
    extended: true
}));

app.use(pretty({ query: 'pretty' }));
app.use(bodyParser.json());

app.use(function(req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
});

//app.use('/static', express.static('public'))
app.get("/log", function(req, res) {
    res.sendFile("./floatcache.json", {
        root: __dirname
    });
});

app.get("/updateCount",function(req,res) {
    getItemCounter(730,function(err,data){
        if(!err){
            itemCounter = data;
            res.json(itemCounter);
        } else {
            res.json({success:false, message : "Something went wrong! Please update bot inv first"});
        }
        
    });
});

app.get("/sortedCount", function(req,res){
    var array = []
    
    for(var key in itemCounter){
        array.push({
            name: key,
            count: itemCounter[key]
        })    
    }
    array = array.sort(function(a,b){
        return a.count > b.count? -1 : 1;
    });
    var output = "";
    for(var i in array){
        output += array[i].name +" : "+array[i].count+"</br>";
    }
    res.send(output);
});

app.get("/itemCounter",function(req,res) {
    res.json(itemCounter);
})

app.get("/clearbot", function(req, res) { //purge inventory bot
    botStorage[730] = {};
    res.json({success:true});
});

function getItemCounter(appid,callback){
    var botCacheDir = "./cache/bots";
    var itemCounter = {}
    var i = 0;
    for(var index in invBotList){
        if(botStorage[730][invBotList[index]]){
            var botInv = botStorage[730][invBotList[index]].eztrade;
            for(var key in botInv){
                itemCounter[botInv[key].market_hash_name] = 
                                itemCounter[botInv[key].market_hash_name] == null ? 1 : itemCounter[botInv[key].market_hash_name] + 1;
            }
        }
        
        i+=1;
        if(i >= invBotList.length){
            callback(null,itemCounter);
        }   
        // })
    }
}

//Constantly checks for new Swap Item Request then process it
function processSwapQueue() {
    if (swapQueue.length > 0) {
        var next = swapQueue[0];
        swapQueue.splice(0, 1);
        var {
            appid,
            bot,
            user,
            receivedItems,
            sentItems
        } = next;
        console.log(bot, user);

        console.log(sentItems);
        console.log(receivedItems);
    
        var botItems = botStorage[appid][bot];
        var userItems = uStorage[appid][user].content;
        
        //If bot has sent some items to user
        if (sentItems) {
            sentItems.forEach(item => {
                //Bot item becomes user item (new assetID);
                if (botItems.eztrade[item.oldAsset] != null) {
                    var chosenItem = botItems.eztrade[item.oldAsset];
                    itemCounter[chosenItem.market_hash_name]-=1;
                    //print thu botItems ra
                    delete botItems.eztrade[item.oldAsset];
                    console.log(item);
                    chosenItem.assetid = item.newAsset;
                    userItems.eztrade[item.newAsset] = chosenItem;
                }
                if (floatCache[item.oldAsset] != null) {
                    var temp = floatCache[item.oldAsset];
                    floatCache[item.newAsset] = temp
                    delete floatCache[item.oldAsset];
                }
            })
        }
        //If user has sent some items to bot
        if (receivedItems) {
            receivedItems.forEach(item => {
                //User item becomes Bot item (new assetID);
                if (userItems.eztrade[item.oldAsset] != null) {
                    var chosenItem = userItems.eztrade[item.oldAsset];
                    delete userItems.eztrade[item.oldAsset];
                    console.log(item);
                    chosenItem.assetid = item.newAsset;
                    botItems.eztrade[item.newAsset] = chosenItem;
                    itemCounter[chosenItem.market_hash_name] = 
                                itemCounter[chosenItem.market_hash_name] == null ? 1 : itemCounter[chosenItem.market_hash_name] + 1;
                }
                if (floatCache[item.oldAsset] != null) {
                    var temp = floatCache[item.oldAsset];
                    floatCache[item.newAsset] = temp
                    delete floatCache[item.oldAsset];
                    console.log("Swapped floatCache");
                }
            })
        }
        setTimeout(processSwapQueue,10);
    } else {
        setTimeout(processSwapQueue,10);
    }
}
app.post('/reload', function(req, res) {
    var {
        appid,
        bot,
        user,
        receivedItems,
        sentItems
    } = req.body;
    console.log("Received new swapping request! Added to queue");
    swapQueue.push({
        appid,
        bot,
        user,
        receivedItems,
        sentItems
    });
    res.send("Done");
});



function getFloatStickers(steamid, data, callback) {
    var eztradeData = data.eztrade;
    var i = 0;
    if (Object.keys(eztradeData).length > 0) {
        var to_con_cat = []
        for (var assetid in eztradeData) {
            if (floatCache[assetid] != null) {
                eztradeData[assetid].float = floatCache[assetid].float;
                eztradeData[assetid].stickers = floatCache[assetid].stickers;
                floatCache[assetid].time = new Date().getTime(); //lastest reload -- uses this for cleanCache
            } else {
                var type = eztradeData[assetid].type;
                if ((!type.toLowerCase().includes('key') && !type.toLowerCase().includes('graffiti') &&
                        !type.toLowerCase().includes('sticker') && !type.toLowerCase().includes('container'))) {
                    var d = eztradeData[assetid].inspectlink.split("D")[1];
                    if (d != null) {
                        floatCache[assetid] = {
                            time: new Date().getTime(),
                            float: "loading...",
                            stickers: [],
                            processed: false
                        }
                        to_con_cat.push([steamid, assetid, d, eztradeData[assetid].images]);
                    }
                }
            }
        }
        if(to_con_cat.length > 0){
            if(invBotList.indexOf(steamid) != -1) //if bot then priotize            
                inspectQueue = to_con_cat.concat(inspectQueue);
            else //add the end of the queue
                inspectQueue =  inspectQueue.concat(to_con_cat);
        }
    }
    callback(data);
}



app.get('/:steamid/:appid', function(req, res) {
    var cacheDir = './cache/' + req.params['steamid'] + ' - ' + req.params['appid'] + '.txt';
    var appid = req.params['appid'];
    var steamid = req.params['steamid']
    if(uStorage[appid] != null){
        if (uStorage[appid][steamid] != null && !uStorage[appid][steamid].isLoading && (new Date().getTime() - uStorage[appid][steamid]["time"] < timeLimit)) {
            var jsondata = uStorage[appid][steamid];
            getFloatStickers(req.params['steamid'], jsondata["content"], function(data) {
                res.json(data);
            });
        } else {
            if(uStorage[appid][steamid] == null || !uStorage[appid][steamid].isLoading){
                uStorage[appid][steamid] = {isLoading: true}; //make sure that no loading request is accepted when this hasnt callback yet
                getData(req.params['steamid'], req.params['appid'], function(err, data) {
                    
                    if (!err) {
                        w2heavenApi("user", req.params['steamid'], data, function(err, returnData) {
                            if (!err) {
                                var savedCache = {
                                    isLoading: false,
                                    time: new Date().getTime(),
                                    content: returnData
                                };
                                uStorage[appid][steamid] =  savedCache; //update local cache
                                getFloatStickers(req.params['steamid'], returnData, function(data) {
                                    res.json(data);
                                });
                            } else {
                                uStorage[appid][steamid].isLoading = false;
                                res.json({});
                            }
                        });
                    } else {
                       console.log(err);
                       uStorage[appid][steamid].isLoading = false;
                       res.json({});
                    }
                });
            } else {
                res.json({});
            }
        }
    }
});

app.get('/bot/:steamid/:appid', function(req, res) {
    var cacheDir = req.query.sub ? './sub/bots/' + req.params['steamid'] + ' - ' + req.params['appid'] + '.txt' : './cache/bots/' + req.params['steamid'] + ' - ' + req.params['appid'] + '.txt';
    var appid = req.params['appid'];
    var steamid = req.params['steamid']
    
    if(botStorage[appid] != null){
        if(botStorage[appid][steamid] != null){
            getFloatStickers(req.params['steamid'], botStorage[appid][steamid], function(data) {
                res.json(data);
            });
        } else {
            getData(req.params['steamid'], req.params['appid'], function(err, data) {
                if (!err) {
                    w2heavenApi("bot", req.params['steamid'], data, function(err, returnData) {
                        if (!err) {
                            botStorage[appid][steamid] = returnData;
                            getFloatStickers(req.params['steamid'], returnData, function(data) {
                                res.json(data);
                            });
                        } else {
                            res.json({});
                        }
                    });
                }
            });
        }
    }

});



//Try using YAHOO YQL to parse first -> failed then use proxy
function getData(steamid, appid, callback) {
    yahooYQL(steamid, appid, function(err, data) {
        if (err || (err == null && data == null)) {
            localProxy(steamid, appid, function(err, data) {
                if (err) {
                    console.log(err)
                    callback(err, null);
                } else {
                    console.log("Parsed Sucessfully using localProxy. User:" + steamid);
                    callback(null, data);
                }
            });
        } else {
            callback(null, data);

        }
    });
}


//Convert to an easy-to-access data
function w2heavenApi(owner, steamid, data, callback) {
    var stringData = '{"steam": {}, "w2heaven": {}, "eztrade": {}}';
    var returnData = JSON.parse(stringData);
    var i = 0;
    var count = 0;
    var calls = [];
    if (!data || !data.rgInventory) callback(null, returnData);
    else {
        if (Object.keys(data.rgInventory).length > 0) {
            for (var item in data.rgInventory) {
                var classid = data.rgInventory[item].classid;
                var instanceid = data.rgInventory[item].instanceid;
                var assetid = data.rgInventory[item].id;
                var market_hash_name = data.rgDescriptions[classid + "_" + instanceid].market_hash_name;
                var icon_url = data.rgDescriptions[classid + "_" + instanceid].icon_url;
                var type = data.rgDescriptions[classid + "_" + instanceid].type;
                var inspectlink = "";
                var exterior = '';
                var images = [];
                if (market_hash_name.indexOf('Battle-Scarred') !== -1) exterior = "Battle-Scarred";
                else if (market_hash_name.indexOf('Well-Worn') !== -1) exterior = "Well-Worn";
                else if (market_hash_name.indexOf('Field-Tested') !== -1) exterior = "Field-Tested";
                else if (market_hash_name.indexOf('Minimal Wear') !== -1) exterior = "Minimal Wear";
                else if (market_hash_name.indexOf('Factory New') !== -1) exterior = "Factory New";

                var nameTag = "";
                if (data.rgDescriptions[classid + "_" + instanceid].fraudwarnings) {
                    nameTag = data.rgDescriptions[classid + "_" + instanceid].fraudwarnings;
                }

                if (data.rgDescriptions[classid + "_" + instanceid].hasOwnProperty("actions") &&
                    (!type.toLowerCase().includes('key') && !type.toLowerCase().includes('graffiti') && !type.toLowerCase().includes('sticker'))) {
                    var data_to_look = data.rgDescriptions[classid + "_" + instanceid].actions;
                    if (data_to_look instanceof Array) {
                        data_to_look = data.rgDescriptions[classid + "_" + instanceid].actions[0];
                    }
                    inspectlink = data_to_look.link.replace("%owner_steamid%", "" + steamid).replace("%assetid%", assetid);

                    //If the item has stickers, the last element in descriptions array will always contain sticker images 
                    try {
                        var descriptions = data.rgDescriptions[classid + "_" + instanceid].descriptions;
                        var possibleData = descriptions[descriptions.length - 1].value; //stickers data
                        images = possibleData.match(/src=".*?"/g).map(img => img.substring(5, img.length - 1)) //remove the 'src' and the double quote from the string;
                    } catch (e) {}

                }

                var thisItem = {
                    "assetid": assetid,
                    "classid": classid,
                    "instanceid": instanceid,
                    "market_hash_name": market_hash_name,
                    "nameTag": nameTag,
                    "exterior": exterior,
                    "type": type,
                    "icon_url": icon_url,
                    "inspectlink": inspectlink,
                    "float": 0.0,
                    "stickers": [],
                    "images": images
                };
                returnData.eztrade["" + assetid] = thisItem;
                i++;

                if (i >= Object.keys(data.rgInventory).length) {
                    callback(null, returnData);
                }
            }
        } else {
            callback(null, returnData);
        }
    }
}

app.get("/cleanCache",function(req,res){
    var i = 0;
    var count = 0;
    for (var item in floatCache) {
        if (new Date().getTime() - floatCache[item].time >= keepCacheLimit) { //2days
            floatCache[item] = null;
            delete floatCache[item];
            count+=1;
        }
    }   
    console.log(i);
    res.send("Number of items deleted: "+count);
});

function processInspectQueue() {
    if (inspectQueue.length > 0) {
        var ITP = inspectQueue[0]; //ITP == itemToProcess
        inspectQueue.splice(0, 1); //pop
        var assetid = ITP[1];
        var images = ITP[3];
        if (floatCache[assetid] == null || !floatCache[assetid].processed) {
            processQueue(ITP[0], assetid, ITP[2], function(err, data) {
                if (!err) {
                    floatCache[assetid] = {
                        "time" : new Date().getTime(),
                        "float": data.paintwear,
                        "stickers": [],
                        "processed": true
                    };
                    if (data.stickers != undefined && images != null && data.stickers.length > 0) {
                        var items = images.map((img, ind) => {
                            return {
                                image: img,
                                wear: data.stickers[ind].wear
                            }
                        })
                        floatCache[assetid].stickers = items; //update global val
                        //console.log(floatCache[assetid].stickers);
                        //console.log("Item " + assetid + " has stickers");
                    }
                    console.log("Get stickers/float for item: " + assetid + " successfully. Left: " + inspectQueue.length);
                    if (inspectQueue.length % 100 == 0) { //get all floats then save cache
                        console.log("Saving cache...");
                        saveCacheFloat();
                    }
                } else {
                    console.log(err);
                    console.log("Get float for item " + assetid + " FAILED.. To be added into queue later!");
                    floatCache[assetid] = null;
                    delete floatCache[assetid]; //to be added in to queue later
                }
                setTimeout(processInspectQueue, 1);
            })
        } else {
            setTimeout(processInspectQueue, 1)
        }
    } else {
        setTimeout(processInspectQueue, 1)
    }
}

processInspectQueue();

function processQueue(s, a, d, callback) {
    master.inspect(`steam://rungame/730/76561202255233023/+csgo_econ_action_preview%20S${s}A${a}D${d}`).then(item => {
        callback(null, item);
    }).catch(error => {
        callback(error, null);
    })
}

//Using C9 servers as proxies :D
function localProxy(steamid, appid, callback) {
    console.log("Try parsing using proxy: " + proxies[index % proxies.length]);
    index += 1;
    request({
        url: "http://steamcommunity.com/profiles/" + steamid + "/inventory/json/" + appid + "/2/?trading=1",
        proxy: "http://" + proxies[(index - 1) % proxies.length],
        timeout: 5000
    }, function(error, response, body) {
        if (isJsonString(body)) {
            //fs.writeFile("./config.txt",body);
            var data = JSON.parse(body);
            callback(null, data);
        } else {
            callback("Failed parsing inventory with localProxy", null);
        }
    });
}

function isJsonString(str) {
    try {
        return JSON.parse(str) != null;
    } catch (e) {
        return false;
    }
}

function yahooYQL(steamid, appid, callback) {
    var steamLink = "http://steamcommunity.com/profiles/" + steamid + "/inventory/json/" + appid + "/2/?trading=1";
    request({
        url: "https://query.yahooapis.com/v1/public/yql?q=select * from json where url='" + steamLink + "'&format=json",
        json: true,
        timeout: 5000
    }, function(error, response, body) {
        if (error) {
            console.log(error);
            callback(error, null)
        } else {
            if (body != null && body.query != null && body.query.results != null) {

                console.log("Parsed Using Yahoo YQL for user: " + steamid);
                var data = body.query.results.json;
                reSort(data, function(err, data) {
                    if (!err) {
                        callback(null, data);
                    } else {
                        callback(err, null);
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
//Yahoo YQL return this very weird data structure, this is a work around for it
function reSort(data, callback) {
    var i = 0;
    if (data && data.hasOwnProperty("rgInventory")) {
        for (var thisItem in data.rgInventory) {
            i++;
            data.rgInventory[data.rgInventory[thisItem].id] = data.rgInventory[thisItem];
            delete data.rgInventory[thisItem];
            if (i >= Object.keys(data.rgInventory).length) {
                var c = 0;
                for (var thisItem in data.rgDescriptions) {
                    c++;
                    data.rgDescriptions[data.rgDescriptions[thisItem].classid + "_" + data.rgDescriptions[thisItem].instanceid] = data.rgDescriptions[thisItem];
                    delete data.rgDescriptions[thisItem];
                    if (c >= Object.keys(data.rgDescriptions).length) {
                        callback(null, data);
                    }
                }
            }
        }
    } else {
        console.log("something went wrong");
        callback("Something went wrong", null);
    }

}

app.listen(8080, function() {
    console.log('Inventory Cache Server. Config Loaded!')
})
