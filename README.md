Way2Heaven-Eztrade Inventory Cache Server written in NodeJS

This is a small version of a working Steam Inventory Cache Server on my website EZTrade.gg
(Sorry for the messy code, I haven't had the time to create a nice public version of this code)


## Features:
    - Parse float/stickers of items in csgo
    - Avoid steam inventory rate limits
    - Implemeted YAHOO YQL as a work around to avoid Steam API Rate Limit
    - Return an easy-to-process steam inventory data structure
    - Somewhat a framework for those who plan to create similar application 
    (Swapping items to minimize # of steam API requests, Float parsing queue, etc.)


## Dependencies:
    var app = require('express')();

    var request = require('request');

    var fs = require("fs-extra");
    
    //Prettify stuff
    var bodyParser = require('body-parser');
    
    var pretty = require('express-prettify');
    
    //Used for parsing csgo's items' floats (Require steam login)
    var SteamUser = require("steam-user");

    var botMaster = require("csgo-floats");
    
 

@Author: David Vu
