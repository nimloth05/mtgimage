"use strict";
/*global setImmediate: true*/

var base = require("xbase"),
	C = require("C"),
	request = require("request"),
	fs = require("fs"),
	url = require("url"),
	moment = require("moment"),
	runUtil = require("xutil").run,
	unicodeUtil = require("xutil").unicode,
	path = require("path"),
	querystring = require("querystring"),
	httpUtil = require("xutil").http,
	tiptoe = require("tiptoe");

var JSON_PATH = "/mnt/compendium/DevLab/mtgjson/json";
var IMAGES_PATH = "/mnt/compendium/DevLab/mtgimage/web/actual/set";

if(process.argv.length<3)
{
	base.error("Usage: node downloadMythicSpoilerImages.js <set code>");
	process.exit(1);
}

var targetSet = C.SETS.mutateOnce(function(SET) { if(SET.name.toLowerCase()===process.argv[2].toLowerCase() || SET.code.toLowerCase()===process.argv[2].toLowerCase()) { return SET; } });
if(!targetSet)
{
	base.error("Set %s not found!", process.argv[2]);
	process.exit(1);
}

var SET_IMAGE_PATH = path.join(IMAGES_PATH, targetSet.code.toLowerCase());

if(fs.existsSync(SET_IMAGE_PATH))
{
	base.error("Download path [%s] already exists.", SET_IMAGE_PATH);
	process.exit(1);
}

fs.mkdirSync(SET_IMAGE_PATH);

tiptoe(
	function loadJSON()
	{
		fs.readFile(path.join(JSON_PATH, targetSet.code.toUpperCase() + ".json"), {encoding:"utf8"}, this);
	},
	function rip(jsonRaw)
	{
		JSON.parse(jsonRaw).cards.serialForEach(downloadCard, this);
	},
	function finish(err)
	{
		if(err)
		{
			base.error(err);
			process.exit(1);
		}

		process.exit(0);
});

function downloadCard(card, cb)
{
	var targetFilename = path.join(SET_IMAGE_PATH, card.imageName + ".jpg");
	
	tiptoe(
		function downloadImage()
		{
			var spoilerCardName = card.name.replaceAll("Æ", "ae").toLowerCase().replace(/[^A-Za-z0-9]/g, "");
			var numSuffix = card.imageName.replace(/^.*([0-9])$/g, "$1");
			if(C.SET_SPOILER_IMAGE_DIFF_SRC_NUMBER.hasOwnProperty(targetSet.code.toUpperCase()) && C.SET_SPOILER_IMAGE_DIFF_SRC_NUMBER[targetSet.code.toUpperCase()].hasOwnProperty(card.name))
				spoilerCardName += C.SET_SPOILER_IMAGE_DIFF_SRC_NUMBER[targetSet.code.toUpperCase()][card.name];
			else if(numSuffix && numSuffix.length===1 && +numSuffix>=1 && +numSuffix<=9)
				spoilerCardName += +numSuffix===1 ? "" : (+numSuffix)-1;

			base.info("Downloading: %s (%s)", card.name, spoilerCardName);
			httpUtil.download("http://mythicspoiler.com/" + targetSet.code.toLowerCase() + "/cards/" + spoilerCardName + ".jpg", targetFilename, this);
		},
		function handleError(err)
		{
			if(!err && fs.statSync(targetFilename).size<1000)
				err = "Download may have failed, size to small.";

			if(err)
			{
				base.error("Failed to download card: %s", card.name);
				base.error(err);
			}

			return setImmediate(cb);
		}
	);
}