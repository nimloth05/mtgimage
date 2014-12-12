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
var IMAGE_PATH = "/srv/mtgimage.com/actual/set";
var ZIP_WORK_PATH = path.join(__dirname, "zipwork");
base.info("Creating zips...");

tiptoe(
	function zipFull()
	{
		performZipping(false, false, this);
	},
	function zipFullHQ()
	{
		performZipping(false, true, this);
	},
	function zipCrop()
	{
		performZipping(true, false, this);
	},
	function zipCropHQ()
	{
		performZipping(true, true, this);
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

function performZipping(crop, hq, cb)
{
	var suffix = (crop ? ".crop" : "") + (hq ? ".hq" : "");

	base.info("Zipping images with suffix: %s", suffix);

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
		function copyImages(setJSON)
		{
			C.SETS.serialForEach(function(SET, subcb, i)
			{
				base.info("Symlinking images for %s...", SET.code);
				JSON.parse(setJSON[i]).cards.serialForEach(function(card, cardcb)
				{
					var srcImage = path.join(IMAGE_PATH, SET.code.toLowerCase(), card.imageName + suffix + ".jpg");
					if(!fs.existsSync(srcImage))
						base.error("Image does not exist: %s", srcImage);

					var destImage = path.join(ZIP_WORK_PATH, SET.code, card.imageName + suffix + ".jpg");

					if(fs.existsSync(destImage))
						return setImmediate(cardcb);

					fs.symlink(srcImage, destImage, cardcb);
				}, subcb);
			}, this);
		},
		function zipSets()
		{
			C.SETS.serialForEach(function(SET, subcb, i)
			{
				base.info("Zipping images for %s...", SET.code);
				runUtil.run("zip", ["-r", SET.code + suffix + ".zip", SET.code], {cwd : ZIP_WORK_PATH, silent : true}, subcb);
			}, this);
		},
		function zipAllSets()
		{
			base.info("Zipping all sets...");
			runUtil.run("zip", ["-r", "AllSets" + suffix + ".zip"].concat(C.SETS.map(function(SET) { return SET.code; })), {cwd : ZIP_WORK_PATH, silent : true}, this);
		},
		function moveSetZips()
		{
			C.SETS.serialForEach(function(SET, subcb)
			{
				base.info("Moving set zip %s...", SET.code);
				fileUtil.move(path.join(ZIP_WORK_PATH, SET.code + suffix + ".zip"), path.join(ZIP_PATH, SET.code + suffix + ".zip"), subcb);
			}, this);
		},
		function moveAllSetsZip()
		{
			base.info("Moving AllSets.zip...");
			fileUtil.move(path.join(ZIP_WORK_PATH, "AllSets" + suffix + ".zip"), path.join(ZIP_PATH, "AllSets" + suffix + ".zip"), this);
		},
		function createWindowsCon()
		{
			base.info("Creating windows _CON...");
			fs.rename(path.join(ZIP_WORK_PATH, "CON"), path.join(ZIP_WORK_PATH, "_CON"), this);
		},
		function zipWindowsCon()
		{
			base.info("Zipping Windows _CON...");
			runUtil.run("zip", ["-r", "_CON" + suffix + ".zip", "_CON"], {cwd : ZIP_WORK_PATH, silent : true}, this);
		},
		function moveWindowsCon()
		{
			base.info("Moving Windows _CON.zip...");
			fileUtil.move(path.join(ZIP_WORK_PATH, "_CON" + suffix + ".zip"), path.join(ZIP_PATH, "_CON" + suffix + ".zip"), this);
		},
		function zipWindowsAllSets()
		{
			base.info("Zipping windows all sets...");
			runUtil.run("zip", ["-r", "AllSetsWindows" + suffix + ".zip"].concat(C.SETS.map(function(SET) { return (SET.code==="CON" ? "_CON" : SET.code); })), {cwd : ZIP_WORK_PATH, silent : true}, this);
		},
		function moveAllSetsZip()
		{
			base.info("Moving AllSetsWindows.zip...");
			fileUtil.move(path.join(ZIP_WORK_PATH, "AllSetsWindows" + suffix + ".zip"), path.join(ZIP_PATH, "AllSetsWindows" + suffix + ".zip"), this);
		},
		function deleteZipWorkDirectory()
		{
			base.info("Deleting zip work path...");
			rimraf(ZIP_WORK_PATH, this);
		},
		function returnResults(err)
		{
			cb(err);
		}
	);
}