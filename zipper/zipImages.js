"use strict";
var base = require("xbase"),
	fs = require("fs"),
	C = require("./C.js"),
	httpUtil = require("xutil").http,
	fileUtil = require("xutil").file,
	path = require("path"),
	rimraf = require("rimraf"),
	runUtil = require("xutil").run,
	tiptoe = require("tiptoe");

var JSON_PATH = "/srv/mtgjson.com/json";
var ZIP_PATH = "/srv/mtgimage.com/zip";
var ZIP_WORK_PATH = path.join(__dirname, "zipwork");
base.info("Creating zips...");

tiptoe(
	function clearZipWorkDirectory()
	{
		base.info("Clearing and creating zip work directory...");
		rimraf(ZIP_WORK_PATH, this);
	},
	function createZipWorkDirectory()
	{
		fs.mkdir(ZIP_WORK_PATH, this);
	},
	function createSetDirectories()
	{
		C.SETS.serialForEach(function(SET, subcb) { fs.mkdir(path.join(ZIP_WORK_PATH, SET.code), subcb); }, this);
	},
	function loadJSON()
	{
		C.SETS.serialForEach(function(SET, subcb) { fs.readFile(path.join(JSON_PATH, SET.code + "-x.json"), {encoding : "utf8"}, subcb); }, this);
	},
	function downloadImages(setJSON)
	{
		C.SETS.serialForEach(function(SET, subcb, i)
		{
			base.info("Dowloading images for %s...", SET.code);
			JSON.parse(setJSON[i]).cards.serialForEach(function(card, cardcb)
			{
				httpUtil.download("http://mtgimage.com/set/" + SET.code + "/" + card.imageName + ".hq.jpg", path.join(ZIP_WORK_PATH, SET.code, card.imageName + ".hq.jpg"), cardcb);
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
	function zipAllSets()
	{
		base.info("Zipping all sets...");
		runUtil.run("zip", ["-r", "AllSets.zip"].concat(C.SETS.map(function(SET) { return SET.code; })), {cwd : ZIP_WORK_PATH, silent : true}, this);
	},
	function clearZipDirectory()
	{
		base.info("Clearing and creating zip directory...");
		rimraf(ZIP_PATH, this);
	},
	function createZipDirectory()
	{
		fs.mkdir(ZIP_PATH, this);
	},
	function moveSetZips()
	{
		C.SETS.serialForEach(function(SET, subcb)
		{
			base.info("Moving set zip %s...", SET.code);
			fileUtil.move(path.join(ZIP_WORK_PATH, SET.code + ".zip"), path.join(ZIP_PATH, SET.code + ".zip"), subcb);
		}, this);
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
		if(err)
		{
			base.error(err);
			process.exit(1);
		}

		process.exit(0);
	}
);
