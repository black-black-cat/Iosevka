# Iosevka

Coders' typeface, built from code.

![](https://raw.githubusercontent.com/be5invis/Iosevka/master/images/weights.png)

## Installation

Quit your editor/program. Unzip and open the folder.

 * **Mac + Linux (with font-viewer)** : Select the .ttf files and double click → Follow the on-screen guide.
 * **Windows** : Right click the .ttf files → Install.
 * **Linux (manually)** : Copy the .ttf files to your fonts-directory → Run `sudo fc-cache`.
    - Arch Linux users can install the font from the AUR [here](https://aur.archlinux.org/packages/ttf-iosevka) using an AUR wrapper or by doing it manually.

### Detailed Instructions
 * [How to](http://www.howtogeek.com/192980/how-to-install-remove-and-manage-fonts-on-windows-mac-and-linux/) Install, Remove, and Manage Fonts on Windows, Mac, and Linux.
 * [Ubuntu Wiki](https://wiki.ubuntu.com/Fonts#Manually)

## Building

To build Iosevka you should:

1. Ensure that `node`, `FontForge` (≥ Aug. 2015 release), `ttfautohint`, `ttx` and `make` are runnable in your terminal.
2. Install necessary libs by `npm install`
3. `make`.

You will find ttfs in the `build/` directory.

## Build your own style

![Styles Preview](https://cloud.githubusercontent.com/assets/240091/10895370/cc80f088-81ee-11e5-919b-a6daefdbc3f0.png)

Iosevka comes with several visual styles, however they are inactive using the default build. To build these variants you should use style variables in the `make` procedure:

* `STYLE_COMMON` for both uprights and italics,
* `STYLE_UPRIGHT` for uprights only, and
* `STYLE_ITALICS` for itaics only.

You can add arbitary styles for these variables, for example, `make STYLE_UPRIGHT='v-l-zshaped v-i-zshaped'` to create a variant with Z-shaped letter `l` and `i` for uprights.

The current avaliable styles are:

* Styles for letter `l`:
	* `v-l-hooky` : Hooky `l`
	* `v-l-zshaped` : Z-shaped `l`
	* `v-l-serifed` : Serifed `l` (default for upright subfamilies)
	* `v-l-italic` : Italic `l` (default for italic subfamilies)
* Styles for letter `i`:
	* `v-i-hooky` : Hooky `i`
	* `v-i-zshaped` : Z-shaped `i`
	* `v-i-serifed` : Serifed `i` (default for upright subfamilies)
	* `v-l-italic` : Italic `i` (default for italic subfamilies)

## Release Notes
* **1.4.3**
 - Added the "oblique" variant.
 - Corrected the stroke width in italic variants. It will reduce the file size of italics and improve its outline quality.
* **1.4.2**
 - The shape of lowercase `y` is improved. Its slab version is redesigned.
 - Rebalanced italic `l` and `i`.
 - Enwiden `/t`.
* **1.4.1**
 - Fixed the incorrectly-shaped `/nine` in the thin variant.
 - Fixed the broken serif of `/yhooktop`.
* **1.4.0**
 - Added five new weights: *thin*, *extralight*, *light*, *medium* and *heavy*.
 - Shape optimizations for MANY letters, including `/s`, `/r`, `/a`, `/beta`, `/cyryeri` and their derived characters.
* **1.3.0**
 - Shape optimizations: `/f`, `/r`, `/a`, `/s`, `/epsilon`, `/cyrze` and their derived glyphs.
 - Narrowed slab-serif variants.
 - Added `/overlineTieAbove`, `/underlineTieBelow` and `/turnTieAbove`.
* **1.2.0**
 - Glyphs added: `/cyrGhayn`, `/cyrghayn`, `/cyrChevbar`, `/cyrchevbar`, `/turnoe`, `/voicedlaryngenalspirant`, `/oupperhalf`, `/olowerhalf` and their derived glyphs.
 - Shape optimization: `/eight`, `/propto`, `/J`, `/j`, `/epsilon`, `/cyrze`, `/taillessphi`, `/smcpPsi` and their derived glyphs.
 - Added the missing marks of `/longs`.
 - Introduced a new SVG-based outline exporting mechanism. Now I am finally free from the rounding nightmare.
* **1.1.2**
 - Improved the balancing of `/longs`, `/f` and `/eszet`.
 - The strokes of `/A`, `/V` and `/v` in Iosevka Slab is straightened.
* **1.1.1**
 - Added the missing serifs for `/cyrdzhe`.
 - Balanced `/pi` in bold weights.
 - Moved the descender lines of Cyrillic letters rightward a little in italics.
* **1.1.0**
 - Enwiden the boldfaces. This will improve the consistency between regular and bold weights.
 - The curves in `/xi` are optimized.
* **1.0.2**
 - Fixed the incorrect `/yhooktop`.
 - The digaphs defined in Unicode is now single-width.
 - Reorganized subfamilies: Now the default Iosevka does not contain full-width glyphs any more.
