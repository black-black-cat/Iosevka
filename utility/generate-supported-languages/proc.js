const cldr = require("cldr");
const fs = require("fs-extra");
const path = require("path");

module.exports = async function(charMapPath) {
	const charMap = await fs.readJson(charMapPath);

	const supportLocaleSet = new Set();
	const codePointSet = new Set();
	for (const ch of charMap) for (const unicode of ch[1]) codePointSet.add(unicode);

	for (const locale of cldr.localeIds) {
		const exemplar = cldr.extractCharacters(locale).exemplar;
		if (!exemplar) continue;
		const basicChars = [...(exemplar.default || [])];
		const fullChars = [
			...basicChars,
			...(exemplar.auxiliary || []),
			...(exemplar.index || []),
			...(exemplar.numbers || []),
			...(exemplar.punctuation || [])
		].join("");

		let fullSupport = true;
		let basicSupport = true;
		for (const ch of basicChars) {
			if (!codePointSet.has(ch.codePointAt(0))) basicSupport = false;
		}
		for (const ch of fullChars) {
			if (!codePointSet.has(ch.codePointAt(0))) fullSupport = false;
		}

		if (basicSupport) {
			supportLocaleSet.add(locale);
		}
	}
	for (const loc of supportLocaleSet) {
		const seg = loc.split("_");
		if (seg.length < 2) continue;
		for (let m = 1; m < seg.length; m++) {
			const upperLoc = seg.slice(0, m).join("_");
			if (upperLoc && supportLocaleSet.has(upperLoc)) {
				supportLocaleSet.delete(loc);
			}
		}
	}
	const supportLangSet = new Set();
	for (const loc of supportLocaleSet) {
		const seg = loc.split("_");
		let displayName = null;
		for (let m = 1; m <= seg.length; m++) {
			const upperLoc = seg.slice(0, m).join("_");
			const subDisplayName = cldr.extractLanguageDisplayNames("en")[upperLoc];
			if (subDisplayName)
				displayName = subDisplayName + (upperLoc === loc ? "" : "\u00A0(" + loc + ")");
		}
		if (displayName) supportLangSet.add(displayName);
	}

	const unicodeCoverage = new Map();
	for (const [gn, codes, cl] of charMap) for (const u of codes) unicodeCoverage.set(u, cl);

	return {
		stats: {
			glyphCount: charMap.length,
			codePointCount: unicodeCoverage.size
		},
		unicodeCoverage: Array.from(unicodeCoverage).sort((a, b) => a[0] - b[0]),
		languages: Array.from(supportLangSet).sort()
	};
};
