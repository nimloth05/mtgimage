"use strict";

var base = require("xbase"),
	C = require("C"),
	fs = require("fs"),
	path = require("path"),
	fileUtil = require("xutil").file,
	tiptoe = require("tiptoe");

var JSON_PATH = "/mnt/compendium/DevLab/mtgjson/json";

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
	tiptoe(
		function loadJSON()
		{
			fs.readFile(path.join(JSON_PATH, setCode + ".json"), {encoding : "utf8"}, this);
		},
		function processCards(setJSON)
		{
			JSON.parse(setJSON).cards.serialForEach(function(card, subcb)
			{
				fileUtil.copy(path.join(__dirname, "..", "..", "web", "actual", "set", setCode.toLowerCase() + "after", card.imageName + ".jpg"),
							  path.join(__dirname, "..", "..", "web", "actual", "set", setCode.toLowerCase(), card.imageName + ".jpg"), subcb);
			}, this);
		},
		function finish(err)
		{
			return setImmediate(function() { cb(err); });
		}
	);
}
