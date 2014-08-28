"use strict";

var base = require("xbase"),
	C = require("C"),
	fs = require("fs"),
	path = require("path"),
	dustUtil = require("xutil").dust,
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
			var set = JSON.parse(setJSON);
			var dustData = {count : set.cards.length, images : []};
			set.cards.forEach(function(card)
			{
				dustData.images.push({codeBefore : setCode, codeAfter : setCode + "after", imageName : card.imageName});
			});

			dustUtil.render(__dirname, "compare", dustData, this);
		},
		function saveToDisk(html)
		{
			fs.writeFile(path.join(__dirname, "compare.html"), html, {encoding:"utf8"}, this);
		},
		function finish(err)
		{
			return setImmediate(function() { cb(err); });
		}
	);
}
