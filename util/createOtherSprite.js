"use strict";
/*global setImmediate: true*/

var base = require("xbase"),
	C = require("C"),
	fileUtil = require("xutil").file,
	imageUtil = require("xutil").image,
	runUtil = require("xutil").run,
	fs = require("fs"),
	mkdirp = require("mkdirp"),
	path = require("path"),
	rimraf = require("rimraf"),
	tiptoe = require("tiptoe");

var runOptions = {silent:true};
var OTHER_SPRITE_PATH = path.join(__dirname, "..", "web", "otherSymbolsSprite.png");
var TEMP_PATH = fileUtil.generateTempFilePath();
var SYMBOL_OTHER_PATH = path.join(__dirname, "..", "web", "actual", "symbol", "other");
var SPRITE_BIN_PATH = "/mnt/compendium/bin/createSprite";

tiptoe(
	function removeExistingSprite()
	{
		if(fs.existsSync(OTHER_SPRITE_PATH))
			fs.unlink(OTHER_SPRITE_PATH, this);
		else
			this();
	},
	function mktargetDir()
	{
		mkdirp(TEMP_PATH, this);
		base.info(TEMP_PATH);
	},
	function copyImages()
	{
		var self=this;

		Object.keys(C.SYMBOL_OTHER).forEach(function(symbol)
		{
			fileUtil.copy(path.join(SYMBOL_OTHER_PATH, symbol, "32.png"), path.join(TEMP_PATH, symbol + ".png"), self.parallel());
		});
	},
	function createSprite()
	{
		runUtil.run(SPRITE_BIN_PATH, ["./", "--classPrefix", "div"], {cwd:TEMP_PATH}, this);
	},
	function copySprite()
	{
		fileUtil.copy(path.join(TEMP_PATH, "sprite.png"), OTHER_SPRITE_PATH, this);
	},
	function finish(err)
	{
		if(err)
		{
			base.error(err);
			process.exit(1);
		}

		base.info("Copy " + path.join(TEMP_PATH, "sprite.styl") + " into 'index.styl'");
		process.exit(0);
	}
);