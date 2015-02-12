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

var MTGIMAGE_PATH = "/mnt/compendium/DevLab/mtgimage/web";
//var MTGIMAGE_PATH = "/srv/mtgimage.com";

var ZIP_PATH = path.join(MTGIMAGE_PATH, "zip");
var SYMBOL_PATH = path.join(MTGIMAGE_PATH, "actual", "symbol");
var ZIP_WORK_PATH = path.join(__dirname, "zipwork");

var SYMBOLS_TO_SYMLINK = 
{
	other : Object.keys(C.SYMBOL_OTHER),
	mana : Object.keys(C.SYMBOL_MANA),
	set : [],
};

C.SETS.forEach(function(SET) { SYMBOLS_TO_SYMLINK["set/" + SET.code.toLowerCase()] = Object.keys(C.SYMBOL_RARITIES); });

base.info("Creating zip...");

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
	function createMainDirectories()
	{
		var self=this;
		Object.keys(SYMBOLS_TO_SYMLINK).serialForEach(function(topName, subcb)
		{
			fs.mkdir(path.join(ZIP_WORK_PATH, topName), subcb);
		}, this);
	},
	function createSymlinks()
	{
		base.info("Creating symlinks...");

		var self=this;
		Object.forEach(SYMBOLS_TO_SYMLINK, function(topName, subNames)
		{
			symlinkSymbols(topName, subNames, self.parallel());
		});
	},
	function createZips()
	{
		base.info("Zipping...");

		runUtil.run("zip", ["-r", "other.zip", "other"], {cwd : ZIP_WORK_PATH, silent : true}, this.parallel());
		runUtil.run("zip", ["-r", "mana.zip", "mana"], {cwd : ZIP_WORK_PATH, silent : true}, this.parallel());
		runUtil.run("zip", ["-r", "set.zip", "set"], {cwd : ZIP_WORK_PATH, silent : true}, this.parallel());
	},
	function moveZips()
	{
		base.info("Moving zips...");
		fileUtil.move(path.join(ZIP_WORK_PATH, "other.zip"), path.join(ZIP_PATH, "symbol_other.zip"), this.parallel());
		fileUtil.move(path.join(ZIP_WORK_PATH, "mana.zip"), path.join(ZIP_PATH, "symbol_mana.zip"), this.parallel());
		fileUtil.move(path.join(ZIP_WORK_PATH, "set.zip"), path.join(ZIP_PATH, "symbol_set.zip"), this.parallel());
	},
	function createWindowsCon()
	{
		base.info("Creating windows set with _CON...");
		fs.rename(path.join(ZIP_WORK_PATH, "set", "con"), path.join(ZIP_WORK_PATH, "set", "_con"), this);
	},
	function zipWindowsCon()
	{
		base.info("Zipping windows set with _CON...");
		runUtil.run("zip", ["-r", "setWindows.zip", "set"], {cwd : ZIP_WORK_PATH, silent : true}, this);
	},
	function moveWindowsCon()
	{
		base.info("Moving Windows _CON.zip...");
		fileUtil.move(path.join(ZIP_WORK_PATH, "setWindows.zip"), path.join(ZIP_PATH, "symbol_setWindows.zip"), this);
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

function symlinkSymbols(topName, subNames, cb)
{
	var srcPath = path.join(SYMBOL_PATH, topName);
	var destPath = path.join(ZIP_WORK_PATH, topName);

	tiptoe(
		function createSVGLinks()
		{
			subNames.serialForEach(function(subName, subcb)
			{
				var src = path.join(srcPath, subName + ".svg");
				var dest = path.join(destPath, subName + ".svg");
				if(fs.existsSync(src))
					fs.symlink(src, dest, subcb);
				else
					return setImmediate(subcb);
			}, this);
		},
		function createImageDirectories()
		{
			subNames.serialForEach(function(subName, subcb)
			{
				var src = path.join(srcPath, subName);
				var dest = path.join(destPath, subName);
				if(fs.existsSync(src))
					fs.mkdir(dest, subcb);
				else
					return setImmediate(subcb);
			}, this);
		},
		function symLinkImages()
		{
			subNames.serialForEach(function(subName, subcb)
			{
				C.SYMBOL_SIZES.serialForEach(function(SYMBOL_SIZE, symbolCB)
				{
					var src = path.join(srcPath, subName, SYMBOL_SIZE + ".png");
					var dest = path.join(destPath, subName, SYMBOL_SIZE + ".png");
					if(fs.existsSync(src))
						fs.symlink(src, dest, symbolCB);
					else
						return setImmediate(symbolCB);
				}, subcb);
			}, this);
		},
		cb
	);
}