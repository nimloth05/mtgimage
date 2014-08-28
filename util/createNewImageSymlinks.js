"use strict";

var base = require("xbase"),
	C = require("C"),
	util = require("util"),
	fs = require("fs"),
	glob = require("glob"),
	path = require("path"),
	rimraf = require("rimraf"),
	dustUtil = require("xutil").dust,
	printUtil = require("xutil").print,
	fileUtil = require("xutil").file,
	runUtil = require("xutil").run,
	moment = require("moment"),
	GET_SOURCES = require("./sources").GET_SOURCES,
	tiptoe = require("tiptoe");

var SET_PATH = "/mnt/compendium/DevLab/mtgimage/web/actual/set";
var JSON_PATH = "/mnt/compendium/DevLab/mtgjson/json";
var runOptions = {silent : true};

processSet(process.argv[2], function(err)
{
	if(err)
	{
		base.error(err);
		process.exit(1);
	}

	process.exit(0);
});

function processSet(setCode, cb)
{
	base.info("Creating new image symlinks for set for: %s", setCode);

	tiptoe(
		function loadJSON()
		{
			fs.readFile(path.join(JSON_PATH, setCode + ".json"), {encoding:"utf8"}, this);
		},
		function getConvertedCrops(setRaw)
		{
			var set = JSON.parse(setRaw);

			var link = null;
			var links = {};
			var suffixes = [".jpg", ".hq.jpg", ".crop.jpg", ".crop.hq.jpg"];

			set.cards.forEach(function(card)
			{
				if(card.layout==="split")
				{
					base.info("Found split card: %s", card.name);

					addLink(card.names.join(" ").toLowerCase(), card.imageName, links);
					card.names.forEach(function(name)
					{
						addLink(name.toLowerCase(), card.imageName, links);
					});
				}
				else if(card.layout==="flip")
				{
					base.info("Found flip card: %s", card.name);
					addLink(card.names.join(" ").toLowerCase().replaceAll("/", " ").strip(":\"?"), card.imageName, links);
				}
				else if(card.variations || (C.SETS_NOT_ON_GATHERER.concat(getMCISetCodes()).contains(setCode) && card.rarity==="Basic Land"))
				{
					base.info("Found card with variations or a basic land: %s", card.name);
					addLink(card.imageName.trim("0123456789"), card.imageName.trim("0123456789") + "1", links);
				}
			}.bind(this));

			Object.forEach(links, function(dest, src)
			{
				var prefix = path.join(SET_PATH, setCode.toLowerCase(), dest);
				suffixes.forEach(function(suffix)
				{
					fs.symlink(src + suffix, prefix + suffix, this.parallel());
				}.bind(this));
			}.bind(this));
			
			this.parallel()();
		},
		function finish(err)
		{
			setImmediate(function() { cb(err); });
		}
	);
}

function addLink(dest, src, links)
{
	if(!links.hasOwnProperty(dest))
		links[dest] = src;
}

function getMCISetCodes()
{
	return C.SETS.filter(function(SET) { return SET.isMCISet; }).map(function(SET) { return SET.code; });
}
