Way2Heaven-Eztrade Inventory Cache Server

This is a small version of a working Steam Inventory Cache Server on EZTrade.gg

##Features:
    - Parse float/stickers of items in csgo
    - Avoid steam inventory rate limits
    - Somewhat a framework for those who plan to create similar application (Swaping items to minimize # of steam API requests, Float parsing queue, etc.)


Dependencies:
``var app = require('express')();

var request = require('request');

var fs = require("fs-extra");

var lockFile = require("lockfile");

var bodyParser = require('body-parser');

var SteamUser = require("steam-user");

var botMaster = require("csgo-floats");

var pretty = require('express-prettify');``

@Author: David Vu
