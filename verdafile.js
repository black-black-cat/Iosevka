"use strict";

const build = require("verda").create();
const { task, file, oracle, computed, phony } = build.ruleTypes;
const { de, fu, sfu, ofu } = build.rules;
const { run, node, cd, cp, rm } = build.actions;
const { FileList } = build.predefinedFuncs;
module.exports = build;

///////////////////////////////////////////////////////////

const fs = require("fs");
const path = require("path");
const toml = require("toml");

const BUILD = "build";
const DIST = "dist";
const ARCHIVE_DIR = "release-archives";

const OTF2OTC = "otf2otc";
const PATEL_C = ["node", "./node_modules/patel/bin/patel-c"];
const TTCIZE = ["node", "./node_modules/otfcc-ttcize/bin/_startup"];
const GENERATE = ["node", "gen/generator"];
const GC = ["node", "gen/gc"];
const webfontFormats = [
	["woff2", "woff2"],
	["woff", "woff"],
	["ttf", "truetype"]
];

const BUILD_PLANS = path.relative(__dirname, path.resolve(__dirname, "./build-plans.toml"));
const PRIVATE_BUILD_PLANS = path.relative(
	__dirname,
	path.resolve(__dirname, "./private-build-plans.toml")
);

// Save journal to build/
build.setJournal(`${BUILD}/.verda-build-journal`);
// Enable self-tracking
build.setSelfTracking();

///////////////////////////////////////////////////////////
//////                   Oracles                     //////
///////////////////////////////////////////////////////////

const Version = oracle(`metadata:version`, async () => {
	const package_json = JSON.parse(fs.readFileSync(path.join(__dirname, "package.json")));
	return package_json.version;
});

async function tryParseToml(str) {
	try {
		return toml.parse(fs.readFileSync(str, "utf-8"));
	} catch (e) {
		throw new Error(
			`Failed to parse configuration file ${str}.\n` +
				`Please validate whether there's syntax error.\n` +
				`${e}`
		);
	}
}

const RawPlans = oracle(`metadata:raw-plans`, async target => {
	await target.need(sfu(BUILD_PLANS), ofu(PRIVATE_BUILD_PLANS));

	const bp = await tryParseToml(BUILD_PLANS);
	if (fs.existsSync(PRIVATE_BUILD_PLANS)) {
		const privateBP = await tryParseToml(PRIVATE_BUILD_PLANS);
		Object.assign(bp.buildPlans, privateBP.buildPlans);
	}
	for (const prefix in bp.buildPlans) {
		const plan = bp.buildPlans[prefix];
		plan.prefix = prefix;

		// Style groups
		if (!plan.pre) plan.pre = {};
		if (!plan.post) plan.post = {};

		if (!plan.pre.design) plan.pre.design = plan.design || [];
		if (!plan.pre.upright) plan.pre.upright = plan.upright || [];
		if (!plan.pre.oblique) plan.pre.oblique = plan.oblique || [];
		if (!plan.pre.italic) plan.pre.italic = plan.italic || [];

		if (!plan.post.design) plan.post.design = [];
		if (!plan.post.upright) plan.post.upright = [];
		if (!plan.post.oblique) plan.post.oblique = [];
		if (!plan.post.italic) plan.post.italic = [];
	}
	for (const prefix in bp.collectPlans) {
		bp.collectPlans[prefix].prefix = prefix;
	}
	return bp;
});

const BuildPlans = computed("metadata:build-plans", async target => {
	const [rp] = await target.need(RawPlans);
	return rp.buildPlans;
});
const ExportPlans = computed("metadata:export-plans", async target => {
	const [rp] = await target.need(RawPlans);
	return rp.exportPlans;
});
const RawCollectPlans = computed("metadata:raw-collect-plans", async target => {
	const [rp] = await target.need(RawPlans);
	return rp.collectPlans;
});
const Weights = computed("metadata:global-weights", async target => {
	const [rp] = await target.need(RawPlans);
	return rp.weights;
});
const Slants = computed("metadata:global-slants", async target => {
	const [rp] = await target.need(RawPlans);
	return rp.slants;
});
const Widths = computed("metadata:global-widths", async target => {
	const [rp] = await target.need(RawPlans);
	return rp.widths;
});
const CollectConfig = computed("metadata:collect-config", async target => {
	const [rp] = await target.need(RawPlans);
	return rp.collectConfig;
});

function makeSuffix(w, wd, s, fallback) {
	return (
		(wd === "normal" ? "" : wd) + (w === "regular" ? "" : w) + (s === "upright" ? "" : s) ||
		fallback
	);
}

function getSuffixSet(weights, slants, widths) {
	const mapping = {};
	for (const w in weights) {
		for (const s in slants) {
			for (const wd in widths) {
				const suffix = makeSuffix(w, wd, s, "regular");
				mapping[suffix] = {
					hives: [`w-${weights[w].shape}`, `s-${s}`, `wd-${widths[wd].shape}`],
					weight: w,
					cssWeight: weights[w].css || w,
					menuWeight: weights[w].menu || weights[w].css || w,
					width: wd,
					cssStretch: widths[wd].css || wd,
					menuWidth: widths[wd].menu || widths[wd].css || wd,
					slant: s,
					cssStyle: slants[s] || s,
					menuStyle: slants[s] || s
				};
			}
		}
	}
	return mapping;
}

const Suffixes = computed(`metadata:suffixes`, async target => {
	const [weights, slants, widths] = await target.need(Weights, Slants, Widths);
	return getSuffixSet(weights, slants, widths);
});

const FontBuildingParameters = computed(`metadata:font-building-parameters`, async target => {
	const [buildPlans, defaultWeights, defaultSlants, defaultWidths] = await target.need(
		BuildPlans,
		Weights,
		Slants,
		Widths
	);
	const fontInfos = {};
	const bp = {};
	for (const p in buildPlans) {
		const { pre, post, prefix, family, weights, slants, widths, hintParams } = buildPlans[p];
		const targets = [];
		const suffixMapping = getSuffixSet(
			weights || defaultWeights,
			slants || defaultSlants,
			widths || defaultWidths
		);
		for (const suffix in suffixMapping) {
			if (weights && !weights[suffixMapping[suffix].weight]) continue;
			if (slants && !slants[suffixMapping[suffix].slant]) continue;
			const fileName = [prefix, suffix].join("-");
			const preHives = [...pre.design, ...pre[suffixMapping[suffix].slant]];
			const postHives = [...post.design, ...post[suffixMapping[suffix].slant]];
			fontInfos[fileName] = {
				name: fileName,
				family,
				hives: ["iosevka", ...preHives, ...suffixMapping[suffix].hives, ...postHives],
				menuWeight: suffixMapping[suffix].menuWeight,
				menuWidth: suffixMapping[suffix].menuWidth,
				menuStyle: suffixMapping[suffix].menuStyle,
				cssWeight: suffixMapping[suffix].cssWeight,
				cssStretch: suffixMapping[suffix].cssStretch,
				cssStyle: suffixMapping[suffix].cssStyle,
				hintParams: hintParams || []
			};
			targets.push(fileName);
		}
		bp[prefix] = {
			family,
			prefix,
			targets
		};
	}
	return { fontInfos, buildPlans: bp };
});

async function getCollectPlans(target, rawCollectPlans, suffixMapping, config, fnFileName) {
	const composition = {},
		groups = {};
	for (const gid in rawCollectPlans) {
		const groupFileList = new Set();
		const collect = rawCollectPlans[gid];
		if (!collect || !collect.from || !collect.from.length) continue;

		for (const prefix of collect.from) {
			const [gri] = await target.need(GroupInfo(prefix));
			const ttfFileNameSet = new Set(gri.targets);
			for (const suffix in suffixMapping) {
				const gr = suffixMapping[suffix];
				const ttcFileName = fnFileName(
					config,
					collect.prefix,
					gr.weight,
					gr.width,
					gr.slant
				);
				const ttfTargetName = `${prefix}-${suffix}`;

				if (!ttfFileNameSet.has(ttfTargetName)) continue;
				if (!composition[ttcFileName]) composition[ttcFileName] = [];
				composition[ttcFileName].push({ dir: prefix, file: ttfTargetName });
				groupFileList.add(ttcFileName);
			}
		}
		groups[gid] = [...groupFileList];
	}
	return { composition, groups };
}
function fnStandardTtc(collectConfig, prefix, w, wd, s) {
	const ttcSuffix = makeSuffix(
		collectConfig.distinguishWeights ? w : "regular",
		collectConfig.distinguishWidths ? wd : "normal",
		collectConfig.distinguishSlant ? s : "upright",
		"regular"
	);
	return `${prefix}-${ttcSuffix}`;
}

const CollectPlans = computed(`metadata:collect-plans`, async target => {
	const [rawCollectPlans, suffixMapping, collectConfig] = await target.need(
		RawCollectPlans,
		Suffixes,
		CollectConfig
	);
	return await getCollectPlans(
		target,
		rawCollectPlans,
		suffixMapping,
		collectConfig,
		fnStandardTtc
	);
});

const HivesOf = computed.group("metadata:hives-of", async (target, gid) => {
	const [{ fontInfos }] = await target.need(FontBuildingParameters);
	const hvs = fontInfos[gid];
	if (!hvs) throw new Error(`Build plan for ${gid} not found.`);
	return hvs;
});

const GroupInfo = computed.group("metadata:group-info", async (target, gid) => {
	const [{ buildPlans }] = await target.need(FontBuildingParameters);
	return buildPlans[gid];
});

const GroupFontsOf = computed.group("metadata:group-fonts-of", async (target, gid) => {
	const [plan] = await target.need(GroupInfo(gid));
	return plan.targets;
});

const CollectionPartsOf = computed.group("metadata:collection-parts-of", async (target, id) => {
	const [{ composition }] = await target.need(CollectPlans);
	return composition[id];
});

///////////////////////////////////////////////////////////
//////                Font Building                  //////
///////////////////////////////////////////////////////////

const BuildTTF = file.make(
	(gr, fn) => `${BUILD}/${gr}/${fn}.ttf`,
	async (target, output, _gr, fn) => {
		const [{ hives, family, menuWeight, menuStyle, menuWidth }, version] = await target.need(
			HivesOf(fn),
			Version
		);
		const otd = output.dir + "/" + output.name + ".otd";
		const ttfTmp = output.dir + "/" + output.name + ".tmp.ttf";
		const otdTmp = output.dir + "/" + output.name + ".tmp.otd";
		const charmap = output.dir + "/" + output.name + ".charmap";
		await target.need(Scripts, fu`parameters.toml`, de`${output.dir}`);
		await run(
			GENERATE,
			["-o", otdTmp],
			["--charmap", charmap],
			["--family", family],
			["--ver", version],
			["--menu-weight", menuWeight],
			["--menu-slant", menuStyle],
			["--menu-width", menuWidth],
			hives
		);
		await run("otfccbuild", otdTmp, "-o", ttfTmp, "-O3", "--keep-average-char-width");
		await run(GC, ["-i", ttfTmp], ["-o", otd]);
		await run("otfccbuild", otd, "-o", output.full, "-O3", "--keep-average-char-width", "-q");
		await rm(otdTmp);
		await rm(ttfTmp);
		await rm(otd);
	}
);
const BuildCM = file.make(
	(gr, f) => `${BUILD}/${gr}/${f}.charmap`,
	async (target, output, gr, f) => {
		await target.need(BuildTTF(gr, f));
	}
);

///////////////////////////////////////////////////////////
//////              Font Distribution                //////
///////////////////////////////////////////////////////////

// Per group file
const DistUnhintedTTF = file.make(
	(gr, fn) => `${DIST}/${gr}/ttf-unhinted/${fn}.ttf`,
	async (target, path, gr, f) => {
		const [from] = await target.need(BuildTTF(gr, f), de`${path.dir}`);
		await cp(from.full, path.full);
	}
);
const DistHintedTTF = file.make(
	(gr, fn) => `${DIST}/${gr}/ttf/${fn}.ttf`,
	async (target, path, gr, f) => {
		const [{ hintParams }] = await target.need(HivesOf(f));
		const [from] = await target.need(BuildTTF(gr, f), de`${path.dir}`);
		await run("ttfautohint", hintParams, from.full, path.full);
	}
);
const DistWoff = file.make(
	(gr, fn) => `${DIST}/${gr}/woff/${fn}.woff`,
	async (target, path, group, f) => {
		const [from] = await target.need(DistHintedTTF(group, f), de`${path.dir}`);
		await node(`utility/ttf-to-woff.js`, from.full, path.full);
	}
);
const DistWoff2 = file.make(
	(gr, fn) => `${DIST}/${gr}/woff2/${fn}.woff2`,
	async (target, path, group, f) => {
		const [from] = await target.need(DistHintedTTF(group, f), de`${path.dir}`);
		await node(`utility/ttf-to-woff2.js`, from.full, path.full);
	}
);

// TTC
const DistTTC = file.make(
	(gr, f) => `${DIST}/collections/${gr}/${f}.ttc`,
	async (target, out, gr, f) => {
		const [parts] = await target.need(CollectionPartsOf(f));
		await buildTtcForFile(target, parts, out, false);
	}
);
const SuperTTC = file.make(
	f => `${DIST}/super-ttc/${f}.ttc`,
	async (target, out, f) => {
		await target.need(de(out.dir));
		const [inputs] = await target.need(CollectionFontsOf(f));
		await run(
			OTF2OTC,
			["-o", out.full],
			inputs.map(f => f.full)
		);
	}
);
async function buildTtcForFile(target, parts, out, xMode) {
	await target.need(de`${out.dir}`);
	const [ttfs] = await target.need(parts.map(part => DistHintedTTF(part.dir, part.file)));
	await run(
		TTCIZE,
		ttfs.map(p => p.full),
		["-o", out.full],
		[xMode ? "-x" : "-h", "--common-width=500"]
	);
}

// Group-level
const GroupTTFs = task.group("ttf", async (target, gid) => {
	const [ts] = await target.need(GroupFontsOf(gid));
	await target.need(ts.map(tn => DistHintedTTF(gid, tn)));
});
const GroupUnhintedTTFs = task.group("ttf-unhinted", async (target, gid) => {
	const [ts] = await target.need(GroupFontsOf(gid));
	await target.need(ts.map(tn => DistUnhintedTTF(gid, tn)));
});
const GroupWoffs = task.group("woff", async (target, gid) => {
	const [ts] = await target.need(GroupFontsOf(gid));
	await target.need(ts.map(tn => DistWoff(gid, tn)));
});
const GroupWoff2s = task.group("woff2", async (target, gid) => {
	const [ts] = await target.need(GroupFontsOf(gid));
	await target.need(ts.map(tn => DistWoff2(gid, tn)));
});
const GroupFonts = task.group("fonts", async (target, gid) => {
	await target.need(GroupTTFs(gid), GroupUnhintedTTFs(gid), GroupWoffs(gid), GroupWoff2s(gid));
});

// Charmap (for specimen)
const DistCharMaps = file.make(
	(gid, suffix) => `${DIST}/${gid}/${suffix}.charmap`,
	async (target, { full, dir }, gid, suffix) => {
		const [src] = await target.need(BuildCM(gid, suffix), de`${dir}`);
		await cp(src.full, full);
	}
);

// Webfont CSS
const DistWebFontCSS = file.make(
	gid => `${DIST}/${gid}/webfont.css`,
	async (target, { dir }, gid) => {
		// Note: this target does NOT depend on the font files.
		const [gr, ts] = await target.need(GroupInfo(gid), GroupFontsOf(gid), de(dir));
		const hs = await target.need(...ts.map(HivesOf));
		await node(
			"utility/make-webfont-css.js",
			`${DIST}/${gid}/webfont.css`,
			gr.family,
			hs,
			webfontFormats
		);
	}
);

const GroupContents = task.group("contents", async (target, gid) => {
	const [gr] = await target.need(GroupInfo(gid));
	await target.need(
		GroupFonts(gid),
		DistWebFontCSS(gid),
		DistCharMaps(gid, `${gr.prefix}-regular`)
	);
	return gid;
});

// Archive
const ArchiveFile = file.make(
	(gid, version) => `${ARCHIVE_DIR}/${gid}-${version}.zip`,
	async (target, { dir, full }, gid, version) => {
		// Note: this target does NOT depend on the font files.
		const [exportPlans] = await target.need(ExportPlans, de`${dir}`);
		await target.need(GroupContents(exportPlans[gid]));
		await cd(`${DIST}/${exportPlans[gid]}`).run(
			["7z", "a"],
			["-tzip", "-r", "-mx=9"],
			`../../${full}`,
			`./`
		);
	}
);
const GroupArchives = task.group(`archive`, async (target, gid) => {
	const [version] = await target.need(Version);
	await target.need(ArchiveFile(gid, version));
});

// Collection-level
const CollectionFontsOf = task.group("collection-fonts", async (target, cid) => {
	const [{ groups }] = await target.need(CollectPlans);
	const [files] = await target.need(groups[cid].map(file => DistTTC(cid, file)));
	return files;
});
const TTCArchiveFile = file.make(
	(cid, version) => `${ARCHIVE_DIR}/ttc-${cid}-${version}.zip`,
	async (target, { dir, full }, cid) => {
		// Note: this target does NOT depend on the font files.
		await target.need(de`${dir}`);
		await target.need(CollectionFontsOf(cid));
		await rm(full);
		await cd(`${DIST}/collections/${cid}`).run(
			["7z", "a"],
			["-tzip", "-r", "-mx=9"],
			`../../../${full}`,
			`./`
		);
	}
);
const CollectionArchive = task.group(`collection-archive`, async (target, cid) => {
	const [version] = await target.need(Version);
	await target.need(TTCArchiveFile(cid, version));
});

///////////////////////////////////////////////////////////
//////                  Root Tasks                   //////
///////////////////////////////////////////////////////////

const Pages = task(`pages`, async target => {
	const [sans, slab] = await target.need(GroupContents`iosevka`, GroupContents`iosevka-slab`);
	await cp(`${DIST}/${sans}`, `pages/${sans}`);
	await cp(`${DIST}/${slab}`, `pages/${slab}`);
});

const SampleImagesPre = task(`sample-images:pre`, async target => {
	const [sans, slab] = await target.need(
		GroupContents`iosevka`,
		GroupContents`iosevka-slab`,
		de`images`
	);
	await cp(`${DIST}/${sans}`, `snapshot/${sans}`);
	await cp(`${DIST}/${slab}`, `snapshot/${slab}`);
});
const SnapShotCSS = file(`snapshot/index.css`, async target => {
	await target.need(fu`snapshot/index.styl`);
	await run(`npm`, `run`, `stylus`, `snapshot/index.styl`, `-c`);
});
const TakeSampleImages = task(`sample-images:take`, async target => {
	await target.need(SampleImagesPre, SnapShotCSS);
	await cd(`snapshot`).run("npx", "electron", "get-snap.js", ["--dir", "../images"]);
});
const ScreenShot = file.glob(`images/*.png`, async (target, { full }) => {
	await target.need(TakeSampleImages);
	await run("optipng", full);
});

const SampleImages = task(`sample-images`, async target => {
	await target.need(TakeSampleImages);
	await target.need(
		ScreenShot`images/charvars.png`,
		ScreenShot`images/download-options.png`,
		ScreenShot`images/family.png`,
		ScreenShot`images/languages.png`,
		ScreenShot`images/ligations.png`,
		ScreenShot`images/matrix.png`,
		ScreenShot`images/preview-all.png`,
		ScreenShot`images/stylesets.png`,
		ScreenShot`images/variants.png`,
		ScreenShot`images/weights.png`
	);
});

const AllArchives = task(`all:archives`, async target => {
	const [exportPlans, collectPlans] = await target.need(ExportPlans, CollectPlans);
	await target.need(
		Object.keys(exportPlans).map(GroupArchives),
		Object.keys(collectPlans.groups).map(CollectionArchive)
	);
});

const AllTtfArchives = task(`all:ttf`, async target => {
	const [exportPlans] = await target.need(ExportPlans);
	await target.need(Object.keys(exportPlans).map(GroupArchives));
});

const AllTtcArchives = task(`all:ttc`, async target => {
	const [collectPlans] = await target.need(CollectPlans);
	await target.need(Object.keys(collectPlans.groups).map(CollectionArchive));
});

const SpecificSuperTtc = task.group(`super-ttc`, async (target, gr) => {
	await target.need(SuperTTC(gr));
});
const AllSuperTtc = task(`all:super-ttc`, async target => {
	const [collectPlans] = await target.need(CollectPlans);
	await target.need(Object.keys(collectPlans.groups).map(gr => SuperTTC(gr)));
});

const ChangeFileList = oracle.make(
	() => `release:change-file-list`,
	target => FileList({ under: "changes", pattern: "*.md" })(target)
);
const ReleaseNotes = task(`release:release-note`, async target => {
	const [version] = await target.need(Version);
	const [changeFiles] = await target.need(ChangeFileList());
	await target.need(changeFiles.map(fu));
	await run("node", "utility/generate-release-note", version);
});

phony(`clean`, async () => {
	await rm(`build`);
	await rm(`dist`);
	await rm(`release-archives`);
	build.deleteJournal(); // Disable journal
});
phony(`release`, async target => {
	await target.need(AllArchives, AllSuperTtc);
	await target.need(SampleImages, Pages);
	await target.need(ReleaseNotes);
});

///////////////////////////////////////////////////////////
//////               Script Building                 //////
///////////////////////////////////////////////////////////

const MARCOS = [fu`meta/macros.ptl`];
const ScriptsUnder = oracle.make(
	(ext, dir) => `${ext}-scripts-under::${dir}`,
	(target, ext, dir) => FileList({ under: dir, pattern: `**/*.${ext}` })(target)
);
const ScriptFiles = computed.group("script-files", async (target, ext) => {
	const [gen, meta, glyphs, support] = await target.need(
		ScriptsUnder(ext, `gen`),
		ScriptsUnder(ext, `meta`),
		ScriptsUnder(ext, `glyphs`),
		ScriptsUnder(ext, `support`)
	);
	return [...gen, ...meta, ...glyphs, ...support];
});
const JavaScriptFromPtl = computed("scripts-js-from-ptl", async target => {
	const [ptl] = await target.need(ScriptFiles("ptl"));
	return ptl.map(x => x.replace(/\.ptl$/g, ".js"));
});

const ScriptJS = file.glob(`{gen|glyphs|support|meta}/**/*.js`, async (target, path) => {
	const [jsFromPtl] = await target.need(JavaScriptFromPtl);
	if (jsFromPtl.indexOf(path.full) >= 0) {
		const ptl = path.full.replace(/\.js$/g, ".ptl");
		if (/^glyphs\//.test(path.full)) {
			await target.need(MARCOS);
		}
		await target.need(fu`${ptl}`);
		await run(PATEL_C, "--strict", ptl, "-o", path.full);
	} else {
		await target.need(fu`${path.full}`);
	}
});
const Scripts = task("scripts", async target => {
	await target.need(sfu`parameters.toml`, sfu`variants.toml`, sfu`empty-font.toml`);
	const [jsFromPtl] = await target.need(JavaScriptFromPtl);
	await target.need(jsFromPtl);
	const [js] = await target.need(ScriptFiles("js"));
	await target.need(js.map(ScriptJS));
});
