"use strict";
/*global setImmediate: true*/

var base = require("xbase"),
	C = require("C"),
	fs = require("fs"),
	url = require("url"),
	runUtil = require("xutil").run,
	httpUtil = require("xutil").http,
	imageUtil = require("xutil").image,
	rimraf = require("rimraf"),
	fileUtil = require("xutil").file,
	path = require("path"),
	querystring = require("querystring"),
	tiptoe = require("tiptoe");

var JSON_PATH = "/mnt/compendium/DevLab/mtgjson/json";
var SET_IMAGES_PATH = "/mnt/compendium/DevLab/mtgimage/web/actual/symbol/set";
var RUN_OPTIONS = {silent:true};

function usage()
{
	base.error("Usage: node %s <set code or name>", process.argv[1]);
	process.exit(1);
}

if(process.argv.length<3)
	usage();

var targetSet = C.SETS.mutateOnce(function(SET) { if(SET.name.toLowerCase()===process.argv[2].toLowerCase() || SET.code.toLowerCase()===process.argv[2].toLowerCase()) { return SET; } });
if(!targetSet)
{
	base.error("Set %s not found!", process.argv[2]);
	process.exit(1);
}

tiptoe(
	function rip()
	{
		downloadSetIcons(targetSet.code, this);
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

function downloadSetIcons(setCode, cb)
{
	var tmpDir =fileUtil.generateTempFilePath();
	fs.mkdirSync(tmpDir);

	base.info("Saving to: %s", tmpDir);

	var validRaritySymbols = [];

	tiptoe(
		function loadJSON()
		{
			base.info("Loading JSON...");
			fs.readFile(path.join(JSON_PATH, setCode + ".json"), {encoding : "utf8"}, this);
		},
		function downloadIcons(setJSON)
		{
			base.info("Downloading icons...");
			var rarities = JSON.parse(setJSON).cards.map(function(card) { return card.rarity ? card.rarity.toLowerCase() : ""; }).unique().filterEmpty();
			Object.forEach(C.SYMBOL_RARITIES, function(raritySymbol, rarityNames)
			{
				var raritySourceImage = path.join(tmpDir, raritySymbol + ".png");

				rarityNames.forEach(function(rarityName)
				{
					if(!rarities.contains(rarityName))
						return;

					validRaritySymbols.push(raritySymbol);

					var setImageURL = url.format(
					{
						protocol : "http",
						host     : "gatherer.wizards.com",
						pathname : "/Handlers/Image.ashx",
						query    :
						{
							type   : "symbol",
							size   : "large",
							set    : setCode.toUpperCase(),
							rarity : (raritySymbol==="s" && C.SETS_WITH_BONUS_RARITIES.contains(setCode.toUpperCase())) ? "B" : raritySymbol.toUpperCase()
						}
					});
					base.info(setImageURL);
					httpUtil.download(setImageURL, raritySourceImage, this.parallel());
				}.bind(this));
			}.bind(this));

			this.parallel()();
		},
		function getFileSizes()
		{
			validRaritySymbols.serialForEach(function(raritySymbol, subcb)
			{
				imageUtil.getWidthHeight(path.join(tmpDir, raritySymbol + ".png"), subcb);
			}, this.parallel());
		},
		function generateSVGFiles(sizes)
		{
			base.info("Generating SVG files...");
			validRaritySymbols.forEach(function(raritySymbol, i)
			{
				var size = sizes[i];
				var svgData = "<svg width=\"" + size[0] + "\" height=\"" + size[1] + "\" xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\">";
				svgData += "<image width=\"" + size[0] + "\" height=\"" + size[1] + "\" xlink:href=\"data:image/png;base64,";
				svgData += new Buffer(fs.readFileSync(path.join(tmpDir, raritySymbol + ".png")), "binary").toString("base64");
				svgData += "\"/></svg>";

				fs.writeFile(path.join(tmpDir, raritySymbol + ".svg"), svgData, this.parallel());
			}.bind(this));
		},
		function generatingIcons()
		{
			base.info("Generting icons from SVG files...");
			validRaritySymbols.serialForEach(function(raritySymbol, subcb)
			{
				base.info("Generating %s symbols...", raritySymbol);
				runUtil.run("node", [path.join(__dirname, "import_set_symbol.js"), setCode, raritySymbol, path.join(tmpDir, raritySymbol + ".svg")], RUN_OPTIONS, subcb);
			}, this);
		},
		function cleanup()
		{
			rimraf(tmpDir, this);
		},
		function finish(err)
		{
			base.info("\n!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!\nMAKE SURE TO UPDATE mtgimage.com.conf AND ALSO C.SETS_LACKING_HQ_SVG_SYMBOL_ICONS\n!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!\n");
			return setImmediate(function() { cb(err); });
		}
	);
}
