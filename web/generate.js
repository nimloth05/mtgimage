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
	httpUtil = require("xutil").http,
	fileUtil = require("xutil").file,
	runUtil = require("xutil").run,
	moment = require("moment"),
	tiptoe = require("tiptoe");

var JSON_PATH = "/mnt/compendium/DevLab/mtgjson/json";

var dustData = 
{
	title : "Magic the Gathering card images",
	sets  : []
};

var ACTUAL_PATH = path.join(__dirname, "actual");
var CREATE_LINKS = process.argv.length>2 && process.argv[2].toLowerCase().startsWith("createlinks");
var CREATE_ZIPS = process.argv.length>2 && process.argv[2].toLowerCase().startsWith("createzips");

var ZIP_PATH = path.join(__dirname, "zip");
var CARD_PATH = path.join(ACTUAL_PATH, "card");
var SET_PATH = path.join(ACTUAL_PATH, "set");
var MULTIVERSEID_PATH = path.join(ACTUAL_PATH, "multiverseid");
var SETNAME_PATH = path.join(ACTUAL_PATH, "setname");

var EXTRA_CARD_SYMLINKS =
[
	"ugl/b.f.m. (big furry monster)",
	"unh/our market research shows that players like really long card names so we made this card to have the absolute longest card name ever elemental",
	"unh/richard garfield, ph.d.",
	"unh/s.n.o.t.",
	"ugl/b.f.m.",
	"unh/land aid '04",
	"unh/     ",
	"unh/        ",
	"ugl/goblin token card.jpg",
	"ugl/pegasus token card.jpg",
	"ugl/sheep token card.jpg",
	"ugl/soldier token card.jpg",
	"ugl/squirrel token card.jpg",
	"ugl/zombie token card.jpg",
	"nph/tresspassing souleater.crop.jpg",
	"nph/tresspassing souleater.crop.hq.jpg",
	"pcel/1996 world champion.jpg",
	"pcel/1996 world champion.hq.jpg",
	"pcel/1996 world champion.crop.jpg",
	"pcel/1996 world champion.crop.hq.jpg"
];

var EXTRA_SETNAME_SYMLINKS =
{
	"cmd" : "commander",
	"pd2" : "premium deck series fire & lightning",
	"md1" : "modern event deck",
	"cns" : ["magic the gathering-conspiracy", "conspiracy", "magic: the gathering-conspiracy"],
	"v14" : ["from the vault annihilation", "from the vault: annihilation"]
};

var EXTRA_MULTIVERSEID_SYMLINKS =
{
	"20579" : "inv/assaultbattery",
	"20573" : "inv/standdeliver",
	"20575" : "inv/spitemalice",
	"20577" : "inv/painsuffering",
	"20581" : "inv/waxwane",
	"27167" : "apc/orderchaos",
	"26276" : "apc/nightday",
	"27161" : "apc/lifedeath",
	"27165" : "apc/fireice",
	"27163" : "apc/illusionreality"
};

var VALID_SETS = C.SETS.filter(function(SET) { return !C.SETS_WITH_NO_IMAGES.contains(SET.code); });
var setSymbols = {};
var SYMBOL_PATH = path.join(__dirname, "actual", "symbol");
var SET_SYMBOL_PATH = path.join(SYMBOL_PATH, "set");

tiptoe(
	function reset()
	{
		if(!CREATE_LINKS)
			return this();

		base.info("Resetting...");
		rimraf(CARD_PATH, this.parallel());
		rimraf(SETNAME_PATH, this.parallel());
		rimraf(MULTIVERSEID_PATH, this.parallel());
		rimraf(path.join(SYMBOL_PATH, "all"), this.parallel());
	},
	function setup()
	{
		if(!CREATE_LINKS)
			return this();

		base.info("Setting up...");
		fs.mkdir(CARD_PATH, this.parallel());
		fs.mkdir(SETNAME_PATH, this.parallel());
		fs.mkdir(MULTIVERSEID_PATH, this.parallel());
		fs.mkdir(path.join(SYMBOL_PATH, "all"), this.parallel());
	},
	function createSymbolAllLinks()
	{
		if(!CREATE_LINKS)
			return this();

		base.info("Creating symbol all links...");

		Object.keys(C.SYMBOL_MANA).concat(Object.values(C.SYMBOL_MANA).flatten()).serialForEach(function(SYMBOL, subcb)
		{
			tiptoe(
				function createManaSymbolAllLinks()
				{
					fs.symlink(path.join("..", "mana", SYMBOL), path.join(SYMBOL_PATH, "all", SYMBOL), this.parallel());
					fs.symlink(path.join("..", "mana", SYMBOL + ".svg"), path.join(SYMBOL_PATH, "all", SYMBOL + ".svg"), this.parallel());
				},
				subcb
			);
		}.bind(this), this.parallel());

		Object.keys(C.SYMBOL_OTHER).concat(Object.values(C.SYMBOL_OTHER).flatten()).serialForEach(function(SYMBOL, subcb)
		{
			tiptoe(
				function createManaSymbolAllLinks()
				{
					fs.symlink(path.join("..", "other", SYMBOL), path.join(SYMBOL_PATH, "all", SYMBOL), this.parallel());
					fs.symlink(path.join("..", "other", SYMBOL + ".svg"), path.join(SYMBOL_PATH, "all", SYMBOL + ".svg"), this.parallel());
				},
				subcb
			);
		}.bind(this), this.parallel());

		VALID_SETS.serialForEach(function(SET, subcb)
		{
			fs.symlink(path.join("..", "set", SET.code.toLowerCase()), path.join(SYMBOL_PATH, "all", SET.code.toLowerCase()), subcb);
		}.bind(this), this.parallel());
	},
	function createSetAndSetNameLinks()
	{
		if(!CREATE_LINKS)
			return this();

		base.info("Creating set name links...");
		
		VALID_SETS.serialForEach(function(SET, subcb)
		{
			var setSrcPath = path.join("..", "set", SET.code.toLowerCase());
			var destPaths = [path.join(SETNAME_PATH, SET.name.strip(":\"'?").toLowerCase()), path.join(SETNAME_PATH, SET.name.strip("?").toLowerCase())];
			destPaths = destPaths.concat(destPaths.map(function(destPath) { return destPath.replaceAll(" core set", ""); }));
			destPaths.unique().serialForEach(function(destPath, destcb) { fs.symlink(setSrcPath, destPath, destcb); }, subcb);
		}.bind(this), this.parallel());
	},
	function createOldSetCodeLinks()
	{
		if(!CREATE_LINKS)
			return this();

		base.info("Creating oldCode links...");
		VALID_SETS.serialForEach(function(SET, subcb)
		{
			if(!SET.hasOwnProperty("oldCode"))
				return setImmediate(subcb);

			var oldCodePath = path.join(SET_PATH, SET.oldCode.toLowerCase());
			if(fs.existsSync(oldCodePath))
				return setImmediate(subcb);

			fs.symlink(SET.code.toLowerCase(), oldCodePath, subcb);
		}.bind(this), this);
	},
	function createGathererSetCodeLinks()
	{
		if(!CREATE_LINKS)
			return this();

		base.info("Creating gathererCode links...");
		VALID_SETS.serialForEach(function(SET, subcb)
		{
			if(!SET.hasOwnProperty("gathererCode"))
				return setImmediate(subcb);

			var gathererCodePath = path.join(SET_PATH, SET.gathererCode.toLowerCase());
			if(fs.existsSync(gathererCodePath))
				return setImmediate(subcb);

			fs.symlink(SET.code.toLowerCase(), gathererCodePath, subcb);
		}.bind(this), this);
	},
	function createExtraSetNameLinks()
	{
		if(!CREATE_LINKS)
			return this();

		base.info("Creating extra set name links...");

		Object.forEach(EXTRA_SETNAME_SYMLINKS, function(setCode, setNames)
		{
			Array.toArray(setNames).forEach(function(setName)
			{
				fs.symlink(path.join("..", "set", setCode), path.join(SETNAME_PATH, setName), this.parallel());
			}.bind(this));
		}.bind(this));
	},
	function getSetSymbols()
	{
		base.info("Checking for set symbols...");

		VALID_SETS.forEach(function(SET)
		{
			setSymbols[SET.code] = "";
			Object.keys(C.SYMBOL_RARITIES).forEach(function(RARITY_LETTER)
			{
				if(fs.existsSync(path.join(SET_SYMBOL_PATH, SET.code.toLowerCase(), RARITY_LETTER + ".svg")))
				{
					if(setSymbols[SET.code])
						setSymbols[SET.code] += " ";
					setSymbols[SET.code] += RARITY_LETTER;
				}
			});
			if(!setSymbols[SET.code])
				setSymbols[SET.code] = "";
		});

		this();
	},
	function createZipsStep()
	{
		if(!CREATE_ZIPS)
			return this();

		createZips(this);
	},
	function countImages()
	{
		base.info("Counting images...");

		VALID_SETS.forEach(function(SET)
		{
			glob(path.join(SET_PATH, SET.code.toLowerCase()) + "/*.jpg", this.parallel());
		}.bind(this));
	},
	function populateDustData()
	{
		var args=arguments;

		dustData.symbolSizes = C.SYMBOL_SIZES.join(", ");
		dustData.manaCodes = Object.keys(C.SYMBOL_MANA).map(function(MANA_SYMBOL) { if(Number.isNumber(MANA_SYMBOL[0])) { return {code : MANA_SYMBOL, className : C.SYMBOL_MANA[MANA_SYMBOL][0]}; } else { return {code : (MANA_SYMBOL.startsWith("p") ? MANA_SYMBOL.reverse() : MANA_SYMBOL), className : MANA_SYMBOL}; } });
		dustData.otherCodes = Object.keys(C.SYMBOL_OTHER).map(function(OTHER_SYMBOL) { if(Number.isNumber(OTHER_SYMBOL[0])) { return {code : OTHER_SYMBOL, className : C.SYMBOL_OTHER[OTHER_SYMBOL][0]}; } else { return {code : OTHER_SYMBOL, className : OTHER_SYMBOL}; } });

		fs.writeFileSync(path.join(__dirname, "SetSymbols.json"), JSON.stringify(Object.map(setSymbols, function(key, value) { return [key, value.split(" ").filterEmpty()]; })), {encoding:"utf8"});

		VALID_SETS.serialForEach(function(SET, subcb, i)
		{
			base.info("Getting width/heights for: %s", SET.name);
			var setData =
			{
				code        : SET.code,
				codeLink    : SET.code.toLowerCase(),
				name        : SET.name,
				nameLink    : SET.name.toLowerCase(),
				releaseDate : SET.releaseDate,
				setSymbols  : setSymbols[SET.code].split(" ")
			};
			if(C.SETS_LACKING_HQ_SVG_SYMBOL_ICONS.contains(SET.code))
				setData.lowQuality = true;
			if(SET.code==="CON")
				setData.isCON = true;
			dustData.sets.push(setData);
			getWidthHeights(args[i].filter(function(a) { return !a.endsWith(".crop.jpg") && !a.endsWith(".hq.jpg"); }), subcb);
		}, this);
	},
	function renderIndex(widthHeightCountMaps)
	{
		base.info("Rendering...");

		dustData.sets.forEach(function(dustDataSet, i)
		{
			dustDataSet.resolution = Object.keys(widthHeightCountMaps[i]).sort(function(a, b) { return (+(b.split("x")[0]))-(+(a.split("x")[0])); }).join("<br>");
			if(dustDataSet.code.length===3)
				dustDataSet.shortCode = true;
		});

		dustData.sets = dustData.sets.sort(function(a, b) { return moment(a.releaseDate, "YYYY-MM-DD").unix()-moment(b.releaseDate, "YYYY-MM-DD").unix(); });
		dustData.changeLog = JSON.parse(fs.readFileSync(path.join(__dirname, "changelog.json"), {encoding : "utf8"})).map(function(o) { o.when = moment(o.when, "YYYY-MM-DD").format("MMM D, YYYY"); return o; });
		dustData.lastUpdated = dustData.changeLog[0].when;
		dustData.version = dustData.changeLog[0].version;
		dustData.allSetsZipSize = printUtil.toSize(fs.statSync(path.join(__dirname, "zip", "AllSets.zip")).size, 1);
		dustUtil.render(__dirname, "index", dustData, { keepWhitespace : true }, this);
	},
	function saveIndex(html)
	{
		fs.writeFile(path.join(__dirname, "index.html"), html, {encoding:"utf8"}, this);
	},
	function createCardSymlinks()
	{
		if(!CREATE_LINKS)
			return this();

		dustData.sets.reverse().serialForEach(function(dustDataSet, subcb)
		{
			createSetCardSymlinks(dustDataSet.code, subcb);
		}, this);
	},
	function createExtraCardSymlinks()
	{
		if(!CREATE_LINKS)
			return this();

		Object.forEach(EXTRA_MULTIVERSEID_SYMLINKS, function(multiverseid, srcImagePath)
		{
			makeSymlink(path.join(SET_PATH, srcImagePath + ".jpg"), path.join(MULTIVERSEID_PATH, multiverseid + ".jpg"), this.parallel());
			makeSymlink(path.join(SET_PATH, srcImagePath + ".hq.jpg"), path.join(MULTIVERSEID_PATH, multiverseid + ".hq.jpg"), this.parallel());

			makeSymlink(path.join(SET_PATH, srcImagePath + ".crop.jpg"), path.join(MULTIVERSEID_PATH, multiverseid + ".crop.jpg"), this.parallel());
			makeSymlink(path.join(SET_PATH, srcImagePath + ".crop.hq.jpg"), path.join(MULTIVERSEID_PATH, multiverseid + ".crop.hq.jpg"), this.parallel());
		}.bind(this));

		EXTRA_CARD_SYMLINKS.serialForEach(function(srcSymlinkPath, subcb)
		{
			if(srcSymlinkPath.endsWith(".jpg"))
			{
				fs.symlink(path.relative(CARD_PATH, path.join(SET_PATH, srcSymlinkPath)), path.join(CARD_PATH, path.basename(srcSymlinkPath)), subcb);
			}
			else
			{
				fs.symlink(path.relative(CARD_PATH, path.join(SET_PATH, srcSymlinkPath + ".jpg")), path.join(CARD_PATH, path.basename(srcSymlinkPath + ".jpg")), subcb);
				fs.symlink(path.relative(CARD_PATH, path.join(SET_PATH, srcSymlinkPath + ".hq.jpg")), path.join(CARD_PATH, path.basename(srcSymlinkPath + ".hq.jpg")), subcb);

				fs.symlink(path.relative(CARD_PATH, path.join(SET_PATH, srcSymlinkPath + ".crop.jpg")), path.join(CARD_PATH, path.basename(srcSymlinkPath + ".crop.jpg")), subcb);
				fs.symlink(path.relative(CARD_PATH, path.join(SET_PATH, srcSymlinkPath + ".crop.hq.jpg")), path.join(CARD_PATH, path.basename(srcSymlinkPath + ".crop.hq.jpg")), subcb);
			}
		}, this.parallel());

		fs.symlink(path.relative(CARD_PATH, path.join(__dirname, "actual", "cardback.jpg")), path.join(CARD_PATH, path.basename("cardback.jpg")), this.parallel());
		fs.symlink(path.relative(CARD_PATH, path.join(__dirname, "actual", "cardback.hq.jpg")), path.join(CARD_PATH, path.basename("cardback.hq.jpg")), this.parallel());
	},
	function finish(err)
	{
		if(err)
		{
			base.error(err);
			process.exit(1);
		}

		process.exit(0);
	}
);

function createSetCardSymlinks(setCode, cb)
{
	base.info("Creating card symlinks for: %s", setCode);

	var SETDATA = VALID_SETS.filter(function(SET) { return SET.code.toLowerCase()===setCode.toLowerCase(); })[0];

	tiptoe(
		function loadJSON()
		{
			fs.readFile(path.join(JSON_PATH, setCode + ".json"), {encoding : "utf8"}, this);
		},
		function processCards(err, setJSON)
		{
			if(err)
			{
				setImmediate(function() { cb(err); });
				return;
			}

			var set = JSON.parse(setJSON);
			set.cards.serialForEach(function(card, subcb)
			{
				tiptoe(
					function makeSymlinks()
					{
						makeSymlink(path.join(SET_PATH, setCode.toLowerCase(), card.imageName) + ".jpg", path.join(CARD_PATH, card.imageName.trim("0123456789 .") + ".jpg"), this.parallel());
						makeSymlink(path.join(SET_PATH, setCode.toLowerCase(), card.imageName) + ".hq.jpg", path.join(CARD_PATH, card.imageName.trim("0123456789 .") + ".hq.jpg"), this.parallel());

						makeSymlink(path.join(SET_PATH, setCode.toLowerCase(), card.imageName) + ".crop.jpg", path.join(CARD_PATH, card.imageName.trim("0123456789 .") + ".crop.jpg"), this.parallel());
						makeSymlink(path.join(SET_PATH, setCode.toLowerCase(), card.imageName) + ".crop.hq.jpg", path.join(CARD_PATH, card.imageName.trim("0123456789 .") + ".crop.hq.jpg"), this.parallel());

						if(card.multiverseid)
						{
							makeSymlink(path.join(SET_PATH, setCode.toLowerCase(), card.imageName) + ".jpg", path.join(MULTIVERSEID_PATH, card.multiverseid + ".jpg"), this.parallel());
							makeSymlink(path.join(SET_PATH, setCode.toLowerCase(), card.imageName) + ".hq.jpg", path.join(MULTIVERSEID_PATH, card.multiverseid + ".hq.jpg"), this.parallel());

							makeSymlink(path.join(SET_PATH, setCode.toLowerCase(), card.imageName) + ".crop.jpg", path.join(MULTIVERSEID_PATH, card.multiverseid + ".crop.jpg"), this.parallel());
							makeSymlink(path.join(SET_PATH, setCode.toLowerCase(), card.imageName) + ".crop.hq.jpg", path.join(MULTIVERSEID_PATH, card.multiverseid + ".crop.hq.jpg"), this.parallel());
						}

						if(card.layout==="split")
						{
							makeSymlink(path.join(SET_PATH, setCode.toLowerCase(), card.imageName) + ".jpg", path.join(CARD_PATH, card.name.toLowerCase().strip(":\"?").replaceAll("/", " ").trim("0123456789 .") + ".jpg"), this.parallel());
							makeSymlink(path.join(SET_PATH, setCode.toLowerCase(), card.imageName) + ".hq.jpg", path.join(CARD_PATH, card.name.toLowerCase().strip(":\"?").replaceAll("/", " ").trim("0123456789 .") + ".hq.jpg"), this.parallel());

							makeSymlink(path.join(SET_PATH, setCode.toLowerCase(), card.name.toLowerCase().strip(":\"?").replaceAll("/", " ").trim("0123456789 .")) + ".crop.jpg", path.join(CARD_PATH, card.name.toLowerCase().strip(":\"?").replaceAll("/", " ").trim("0123456789 .") + ".crop.jpg"), this.parallel());
							makeSymlink(path.join(SET_PATH, setCode.toLowerCase(), card.name.toLowerCase().strip(":\"?").replaceAll("/", " ").trim("0123456789 .")) + ".crop.hq.jpg", path.join(CARD_PATH, card.name.toLowerCase().strip(":\"?").replaceAll("/", " ").trim("0123456789 .") + ".crop.hq.jpg"), this.parallel());

							if(card.names[0]===card.name)
							{
								makeSymlink(path.join(SET_PATH, setCode.toLowerCase(), card.imageName) + ".jpg", path.join(CARD_PATH, card.names.map(function(name) { return name.toLowerCase().strip(":\"?").replaceAll("/", " ").trim("0123456789 ."); }).join(" ") + ".jpg"), this.parallel());
								makeSymlink(path.join(SET_PATH, setCode.toLowerCase(), card.imageName) + ".hq.jpg", path.join(CARD_PATH, card.names.map(function(name) { return name.toLowerCase().strip(":\"?").replaceAll("/", " ").trim("0123456789 ."); }).join(" ") + ".hq.jpg"), this.parallel());

								makeSymlink(path.join(SET_PATH, setCode.toLowerCase(), card.imageName) + ".crop.jpg", path.join(CARD_PATH, card.names.map(function(name) { return name.toLowerCase().strip(":\"?").replaceAll("/", " ").trim("0123456789 ."); }).join(" ") + ".crop.jpg"), this.parallel());
								makeSymlink(path.join(SET_PATH, setCode.toLowerCase(), card.imageName) + ".crop.hq.jpg", path.join(CARD_PATH, card.names.map(function(name) { return name.toLowerCase().strip(":\"?").replaceAll("/", " ").trim("0123456789 ."); }).join(" ") + ".crop.hq.jpg"), this.parallel());

								if(card.names.length>2)
								{
									makeSymlink(path.join(SET_PATH, setCode.toLowerCase(), card.imageName) + ".jpg", path.join(CARD_PATH, card.names.map(function(name) { return name.toLowerCase().strip(":\"?").replaceAll("/", " ").trim("0123456789 ."); }).join("") + ".jpg"), this.parallel());
									makeSymlink(path.join(SET_PATH, setCode.toLowerCase(), card.imageName) + ".hq.jpg", path.join(CARD_PATH, card.names.map(function(name) { return name.toLowerCase().strip(":\"?").replaceAll("/", " ").trim("0123456789 ."); }).join("") + ".hq.jpg"), this.parallel());
									
									makeSymlink(path.join(SET_PATH, setCode.toLowerCase(), card.imageName) + ".crop.jpg", path.join(CARD_PATH, card.names.map(function(name) { return name.toLowerCase().strip(":\"?").replaceAll("/", " ").trim("0123456789 ."); }).join("") + ".crop.jpg"), this.parallel());
									makeSymlink(path.join(SET_PATH, setCode.toLowerCase(), card.imageName) + ".crop.hq.jpg", path.join(CARD_PATH, card.names.map(function(name) { return name.toLowerCase().strip(":\"?").replaceAll("/", " ").trim("0123456789 ."); }).join("") + ".crop.hq.jpg"), this.parallel());
								}
							}
						}

						if(card.name.endsWith("?"))
						{
							makeSymlink(path.join(SET_PATH, setCode.toLowerCase(), card.imageName) + ".jpg", path.join(CARD_PATH, card.name.trim("0123456789 .?").toLowerCase()), this.parallel());
						}
					},
					function finish(err) { setImmediate(function() { subcb(err); }); }
				);
			}, cb);
		}
	);
}

function makeSymlink(symlinkSrcPath, symlinkDestPath, cb)
{
	tiptoe(
		function getTargetAndCurrentDimensions()
		{
			getWidthHeight(symlinkSrcPath, this.parallel());

			if(fs.existsSync(symlinkDestPath))
				getWidthHeight(symlinkDestPath, this.parallel());
			else
				this.parallel()();
		},
		function makeSymlinkIfNeeded()
		{
			if(arguments[1] && arguments[0][0]>arguments[1][0])
				fs.unlinkSync(symlinkDestPath);

			if(!arguments[1] || arguments[0][0]>arguments[1][0])
				fs.symlink(path.relative(CARD_PATH, symlinkSrcPath), symlinkDestPath, this);
			else
				this();
		},
		function finish(err)
		{
			if(err)
				base.error("Unable to create symlink from src [%s] to dest [%s]", symlinkSrcPath, symlinkDestPath);
			setImmediate(function() { cb(err); });
		}
	);
}

function getWidthHeights(files, cb)
{
	tiptoe(
		function go()
		{
			files.serialForEach(function(file, subcb)
			{
				getWidthHeight(file, subcb);
			}, this);
		},
		function finish(err, widthHeights)
		{
			var widthHeightCounts = {};
			widthHeights = widthHeights.map(function(widthHeight) { return widthHeight[0] + "x" + widthHeight[1]; });
			widthHeights.unique().forEach(function(widthHeight) { widthHeightCounts[widthHeight] = widthHeights.count(widthHeight); });
			setImmediate(function() { cb(err, widthHeightCounts); });
		}
	);
}

function getWidthHeight(file, cb)
{
	tiptoe(
		function getSize()
		{
			runUtil.run("identify", ["-quiet", file], {silent : true}, this);
		},
		function processSizes(err, result)
		{
			if(err)
				return cb(err);

			var matches = result.trim().match(/[^ ]+ [^ ]+ ([0-9]+)x([0-9]+) .*/);
			if(!matches || matches.length!==3)
			{
				base.error("Error reading width/height of file [%s] with result: %s", file, result);
				return setImmediate(function() { cb(null, [0, 0]); });
			}

			setImmediate(function() { cb(null, [+matches[1], +matches[2]]); });
		}
	);
}

function createZips(cb)
{
	var ZIP_WORK_PATH = path.join(__dirname, "zipwork");
	base.info("Creating zips...");

	tiptoe(
		function prepareZipDirectories()
		{
			base.info("Preparing zip directories...");
			rimraf(ZIP_WORK_PATH, this.parallel());
			rimraf(ZIP_PATH, this.parallel());
		},
		function createWorkDirectory()
		{
			fs.mkdir(ZIP_WORK_PATH, this.parallel());
			fs.mkdir(ZIP_PATH, this.parallel());
		},
		function createSetDirectories()
		{
			C.SETS.serialForEach(function(SET, subcb) { fs.mkdir(path.join(ZIP_WORK_PATH, SET.code), subcb); }, this);
		},
		function loadJSON()
		{
			C.SETS.serialForEach(function(SET, subcb) { fs.readFile(path.join(JSON_PATH, SET.code + ".json"), {encoding : "utf8"}, subcb); }, this);
		},
		function downloadImages(setJSON)
		{
			C.SETS.serialForEach(function(SET, subcb, i)
			{
				base.info("Dowloading images for %s...", SET.code);
				JSON.parse(setJSON[i]).cards.serialForEach(function(card, cardcb)
				{
					httpUtil.download("http://dev.mtgimage.com/set/" + SET.code + "/" + card.imageName + ".hq.jpg", path.join(ZIP_WORK_PATH, SET.code, card.imageName + ".hq.jpg"), cardcb);
				}, subcb);
			}, this);
		},
		function zipSets()
		{
			C.SETS.serialForEach(function(SET, subcb, i)
			{
				base.info("Zipping images for %s...", SET.code);
				runUtil.run("zip", ["-r", SET.code + ".zip", SET.code], {cwd : ZIP_WORK_PATH, silent : true}, subcb);
			}, this);
		},
		function moveSetZips()
		{
			C.SETS.serialForEach(function(SET, subcb)
			{
				base.info("Moving set zip %s...", SET.code);
				fileUtil.move(path.join(ZIP_WORK_PATH, SET.code + ".zip"), path.join(ZIP_PATH, SET.code + ".zip"), subcb);
			}, this);
		},
		function zipAllSets()
		{
			base.info("Zipping all sets...");
			runUtil.run("zip", ["-r", "AllSets.zip"].concat(C.SETS.map(function(SET) { return SET.code; })), {cwd : ZIP_WORK_PATH, silent : true}, this);
		},
		function moveAllSetsZip()
		{
			base.info("Moving AllSets.zip...");
			fileUtil.move(path.join(ZIP_WORK_PATH, "AllSets.zip"), path.join(ZIP_PATH, "AllSets.zip"), this);
		},
		function createWindowsCon()
		{
			base.info("Creating windows _CON...");
			fs.rename(path.join(ZIP_WORK_PATH, "CON"), path.join(ZIP_WORK_PATH, "_CON"), this);
		},
		function zipWindowsCon()
		{
			base.info("Zipping Windows _CON...");
			runUtil.run("zip", ["-r", "_CON.zip", "_CON"], {cwd : ZIP_WORK_PATH, silent : true}, this);
		},
		function moveWindowsCon()
		{
			base.info("Moving Windows _CON.zip...");
			fileUtil.move(path.join(ZIP_WORK_PATH, "_CON.zip"), path.join(ZIP_PATH, "_CON.zip"), this);
		},
		function zipWindowsAllSets()
		{
			base.info("Zipping windows all sets...");
			runUtil.run("zip", ["-r", "AllSetsWindows.zip"].concat(C.SETS.map(function(SET) { return (SET.code==="CON" ? "_CON" : SET.code); })), {cwd : ZIP_WORK_PATH, silent : true}, this);
		},
		function moveAllSetsZip()
		{
			base.info("Moving AllSetsWindows.zip...");
			fileUtil.move(path.join(ZIP_WORK_PATH, "AllSetsWindows.zip"), path.join(ZIP_PATH, "AllSetsWindows.zip"), this);
		},
		function deleteZipWorkDirectory()
		{
			base.info("Deleting zip work path...");
			rimraf(ZIP_WORK_PATH, this);
		},
		function finish(err)
		{
			return setImmediate(function() { cb(err); });
		}
	);
}