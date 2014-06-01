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
	imageUtil = require("xutil").image,
	moment = require("moment"),
	GET_SOURCES = require("./sources").GET_SOURCES,
	tiptoe = require("tiptoe");

var SVG_PATH = path.join(__dirname, "..", "web", "actual", "symbol", "set");

base.info("<html><head><title>svg links</title></head><body>");
C.SETS.serialForEach(processSet,
	function finish(err)
	{
		base.info("</body></html>");
		
		if(err)
		{
			base.error(err);
			process.exit(1);
		}

		process.exit(0);
	}
);

function processSet(SET, cb)
{
	tiptoe(
		function step1()
		{
			Object.keys(C.SYMBOL_RARITIES).forEach(function(RARITY)
			{
				if(fs.existsSync(path.join(SVG_PATH, SET.code.toLowerCase(), RARITY + ".svg")))
					base.info("<a href='http://dev.mtgimage.com/symbol/set/%s/%s.svg'>%s %s</a><br>", SET.code.toLowerCase(), RARITY, SET.code.toLowerCase(), RARITY);
			});

			this();
		},
		function returnResult()
		{
			setImmediate(cb);
		}
	);
}