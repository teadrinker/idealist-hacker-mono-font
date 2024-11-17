![Idealist Hacker Mono font sample](idealist-hacker-mono-sample.png)
![Idealist Hacker Mono font sample2](idealist-hacker-mono-sample2.png)

[**Try it out here!**](https://teadrinker.github.io/idealist-hacker-mono-font/) 

* This repo contains ready-to-use, TTF, OTF and WOFF font files. ([SIL Open Font License](https://scripts.sil.org/OFL))
* Also contains hacky code to generate font from a custom svg glyph sheet
* Code requires Deno, and uses opentype.js and [svg flattener from Timo](https://gist.githubusercontent.com/timo22345/9413158/raw/2205896461da9cf7ad1700b0db8257ff9a52d7fa/flatten.js)) 
* Each glyph is designed to fit snuggly into a box:

![Idealist Hacker Mono font box](idealist-hacker-mono-box.png)

Issues
 * Only ASCII characters (fallbacks to [JetBrains Mono](https://www.jetbrains.com/lp/mono/))
 * Converted from pixel font, so kind of looks bad in large sizes. I hope to look into that at some point, most of this point is purely geometric and would be nice if that wasn't lost in translation...
 * Some ligatures would also help some cases...