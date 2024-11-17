
// teadrinker / Martin Eklund 2024
// https://github.com/teadrinker/idealist-hacker-mono-font
// Code License: GNU GPLv3
// Font License: SIL Open Font License, Version 1.1

// Some hacky code to generate a font from a svg glyph sheet using deno and opentype.js

import {Path, parse} from "https://esm.sh/opentype.js";
import {svg_path_flatten} from "./svg_path_flatten.js";

const logMetrics = false;
const logDebugGlyphs = false;
const onlyUpdateAsciiRange = true;
const removeNonAscii = false; // might brake export

const sourceRowText  = ["Ā !\"#$%&'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUÅ",
                        "VWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~ÅÅÅÅ❶❷❸❹❺❻❼ÅÅÅÅ",
                        "₀₁₂₃₄₅₆₇₈₉⁰¹²³⁴⁵⁶⁷⁸⁹❽❾❿①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳←↑→↓↔↕ÅÅÅÅÅÅÅÅ"];

const glyphGridWidth = 144;
const glyphGridHeight = 224;
const glyphDestCropX = 24;
const glyphDestCropY = 40;
const glyphDestCropW = 32;
const glyphDestCropH = 48;

const letterWidthFallbackFont = 614
const inBaseline = 8; // relative to the glyph y (glyphGridHeight - glyphDestCropH)
const inDescender = 0;
const inCapitalHeight = 168;
const inXHeight = 136;
const glyphScale = letterWidthFallbackFont / (glyphGridWidth - glyphDestCropW);


const flattenInstance = svg_path_flatten();
const toSvgPathArray = (str) => flattenInstance.parsePathString(str)
const pathArrayToAbsolute = (a) => flattenInstance.pathToAbsolute(a)
const fromSvgPathArray = (a) => flattenInstance.convertToString(a)


function saveSvg(filename: string, path: string, width: number, height: number) {
    const svgContent = `<?xml version="1.0" encoding="UTF-8"?>
        <svg xmlns="http://www.w3.org/2000/svg" width="500" height="500" viewBox="0 0 ${width} ${height}"> 
        <path d="${path}" fill="black" /> </svg>`;
    try {
        Deno.writeTextFileSync(filename, svgContent);
        console.log(`Wrote SVG to ${filename}`);
    } catch (error) {
        console.error(`Failed to write SVG to ${filename}:`, error);
    }
}

    
function writeDebugGlyphs(font, glyphs, glyphMap) {
    if(!logDebugGlyphs) return;
    // Find the glyph with the most commands
    const longestGlyph = glyphs.reduce((longest, current) => current.path.length > longest.path.length ? current : longest, glyphs[0]);
    if (longestGlyph) {
        saveSvg(`glyph_${longestGlyph.char}_debug.svg`, fromSvgPathArray(longestGlyph.path), glyphGridWidth, glyphGridHeight);
        console.log(`Longest glyph '${longestGlyph.char}' has ${longestGlyph.path.length} commands`);
    }
    // Write debug SVGs for specific glyphs
    const debugGlyphs = ['A', 'E', 'W', 'O', 'b', 'f', 'v', 'z', ':'];
    for (const char of debugGlyphs) {
        const path = glyphMap.get(char);
        if (path) {
            const filename = char === ':' ? 'glyph_colon_debug.svg' : `glyph_${char}_debug.svg`;
            saveSvg(filename, SVGPathArrayToPath(path).toPathData(), glyphGridWidth, glyphGridHeight);
            console.log(`Glyph '${char}' has ${path.length} commands`);
        }
    }
    const glyphString = font.charToGlyph('W').path.toPathData();    
    saveSvg('glyph_W_debug_real.svg', glyphString, glyphGridWidth, glyphGridHeight);
}


// not really working, so we use pathArrayToAbsolute first, and then this converts the horizontal/vertical to L
function normalizeSvgPathArray(path: (string | number)[][]): (string | number)[][] {
    const result: (string | number)[][] = [];
    let x = 0, y = 0;
    for (const cmd of path) {
        const cmdType = cmd[0] as string;
        const isRelative = cmdType === cmdType.toLowerCase();
        let r: (string | number)[] = [cmdType.toUpperCase()];

        switch (cmdType.toUpperCase()) {
            case 'M':
            case 'L':
                r.push(isRelative ? x + (cmd[1] as number) : cmd[1], isRelative ? y + (cmd[2] as number) : cmd[2]);
                x = r[1] as number;
                y = r[2] as number;
                break;

            case 'H':
                r = ['L', isRelative ? x + (cmd[1] as number) : cmd[1], y];
                x = r[1] as number;
                break;

            case 'V':
                r = ['L', x, isRelative ? y + (cmd[1] as number) : cmd[1]];
                y = r[2] as number;
                break;

            case 'Q':
                r.push(
                    isRelative ? x + (cmd[1] as number) : cmd[1], isRelative ? y + (cmd[2] as number) : cmd[2],
                    isRelative ? x + (cmd[3] as number) : cmd[3], isRelative ? y + (cmd[4] as number) : cmd[4]
                );
                x = r[3] as number;
                y = r[4] as number;
                break;

            case 'C':
                r.push(
                    isRelative ? x + (cmd[1] as number) : cmd[1], isRelative ? y + (cmd[2] as number) : cmd[2],
                    isRelative ? x + (cmd[3] as number) : cmd[3], isRelative ? y + (cmd[4] as number) : cmd[4],
                    isRelative ? x + (cmd[5] as number) : cmd[5], isRelative ? y + (cmd[6] as number) : cmd[6]
                );
                x = r[5] as number;
                y = r[6] as number;
                break;

            case 'Z':
                break;

            default:
                console.warn(`Unsupported SVG path command: ${cmdType}`);
                continue;
        }

        result.push(r);
    }

    return result;
}

function SVGPathArrayToPath(svgPath) {
    const path = new Path();
    let x = 0, y = 0; 
    for (let i = 0; i < svgPath.length; i++) {
        const a = svgPath[i];
        const cmdType = a[0] as string;
        if(i == svgPath.length - 1 || svgPath[i + 1][0] == 'M') {
            continue;
        }
        switch (cmdType) {
            case 'M': x  = a[1]; y  = a[2]; path.moveTo(x, y); break; // Move to
            case 'm': x += a[1]; y += a[2]; path.moveTo(x, y); break; // Move to
            case 'L': x  = a[1]; y  = a[2]; path.lineTo(x, y); break; // Line to
            case 'l': x += a[1]; y += a[2]; path.lineTo(x, y); break; // Line to
            case 'H': x  = a[1];            path.lineTo(x, y); break; // Horizontal line to
            case 'h': x += a[1];            path.lineTo(x, y); break; // Horizontal line to
            case 'V':            y  = a[1]; path.lineTo(x, y); break; // Vertical line to
            case 'v':            y += a[1]; path.lineTo(x, y); break; // Vertical line to
            case 'C': path.curveTo         (    a[1],     a[2],     a[3],     a[4],     a[5],     a[6]); x  = a[5]; y  = a[6]; break; // Cubic Bezier Curve
            case 'c': path.curveTo         (x + a[1], y + a[2], x + a[3], y + a[4], x + a[5], y + a[6]); x += a[5]; y += a[6]; break; // Cubic Bezier Curve
            case 'Q': path.quadraticCurveTo(    a[1],     a[2],     a[3],     a[4]                    ); x  = a[3]; y  = a[4]; break; // Quadratic Bezier Curve
            case 'q': path.quadraticCurveTo(x + a[1], y + a[2], x + a[3], y + a[4]                    ); x += a[3]; y += a[4]; break; // Quadratic Bezier Curve
            case 'z': path.close(); break; // Close path
            case 'Z': path.close(); break; // Close path
  
            default: 
              console.warn(`Unsupported SVG path command: ${type}`); 
        }
    }
    return path;
}


// Function to convert Uint8Array to ArrayBuffer
function uint8ArrayToArrayBuffer(uint8Array) {
    return uint8Array.buffer.slice(
        uint8Array.byteOffset,
        uint8Array.byteOffset + uint8Array.byteLength
    );
}

function getSvgPathHack(svg) {

        // Find the index of ' d="'
    const startIndex = svg.indexOf(' d="');
    if (startIndex === -1) {
        console.error("Could not find ' d=\"' in the file");
        Deno.exit(1);
    }

    // Get everything after ' d="'
    const afterD = svg.slice(startIndex + 4);

    // Find the first '"' and get everything before it
    const endIndex = afterD.indexOf('"');
    if (endIndex === -1) {
        console.error("Could not find closing quote");
        Deno.exit(1);
    }

    return afterD.slice(0, endIndex);
}
function printFontMetrics(font) {
    if(!logMetrics) return;
    // Print current font metrics
    console.log("Current font metrics:");
    console.log({
        // OS/2 table metrics
        os2: {
            typoAscender: font.tables.os2.sTypoAscender,
            usWinAscent: font.tables.os2.usWinAscent,
            typoDescender: font.tables.os2.sTypoDescender,
            usWinDescent: font.tables.os2.usWinDescent,
            typoLineGap: font.tables.os2.sTypoLineGap,
            sCapHeight: font.tables.os2.sCapHeight,
            sxHeight: font.tables.os2.sxHeight
        },
        // General font metrics
        ascender: font.ascender,
        descender: font.descender,
        unitsPerEm: font.unitsPerEm,
        // hhea table metrics
        hhea: {
            ascender: font.tables.hhea.ascender,
            descender: font.tables.hhea.descender,
            lineGap: font.tables.hhea.lineGap
        }
    });
}
    
function setAscender(font, ascender) {
    font.ascender = ascender;
    font.tables.os2.sTypoAscender = ascender;
    font.tables.os2.usWinAscent = ascender;
    font.tables.hhea.ascender = ascender;
}

function setDescender(font, descender) {
    font.descender = descender;
    font.tables.os2.sTypoDescender = descender;
    font.tables.os2.usWinDescent = Math.abs(descender);
    font.tables.hhea.descender = descender;
}

function setLineGap(font, lineGap) {
    font.tables.os2.sTypoLineGap = lineGap;
    font.tables.hhea.lineGap = lineGap;
}

function setUnitsPerEm(font, unitsPerEm) {
    font.unitsPerEm = unitsPerEm;
}

function setCapitalHeight(font, height) {
    font.tables.os2.sCapHeight = height;
}

function setXHeight(font, height) {
    font.tables.os2.sxHeight = height;
}

async function loadFont(fontPath: string) {
    const fontData = await Deno.readFile(fontPath);
    const fontArrayBuffer = uint8ArrayToArrayBuffer(fontData);
    return parse(fontArrayBuffer);
}




try {



    const svg = await Deno.readTextFile("Idealist Hacker Mono Sheet.svg");


    const srcGlyphsPathsString = getSvgPathHack(svg);
    let allGlyphs = toSvgPathArray(srcGlyphsPathsString)
    allGlyphs = pathArrayToAbsolute(allGlyphs)   // fix relative coords
    allGlyphs = normalizeSvgPathArray(allGlyphs) // fix horiz/vert


    // split the allGlyphs, a svg path array ( [['M',2,2 ...], ['L',3,3 ...] ]), allGlyphs are already flattened, so no deltacoords
    // split it by the sourceRowText (interpreted as 2 dim array of glyphs characters), each grid item is by size (glyphWidth,glyphHeight)
    // bin the output (svg path arrays split by the grid) in glyphs

    const glyphMap = new Map<string, (string | number)[][]>();
    let currentCmd: (string | number)[] = [];
    let currentX = 0;
    let currentY = 0;
    let minY = 99999;
    let maxY = -99999;


    for (let i = 0; i < allGlyphs.length; i++) {
        const commandWithArgs = allGlyphs[i];
        const command = commandWithArgs[0] as string;
        
        currentCmd = [command];
        
        if (typeof command === 'string') {
            for (let p = 1; p < commandWithArgs.length; p += 2) {
                const x = commandWithArgs[p] as number;
                const y = commandWithArgs[p + 1] as number;
                
                let outX = x % glyphGridWidth;
                let outY = y % glyphGridHeight;

                outY = glyphGridHeight - outY; // flip y
                outX -= glyphDestCropX;
                outY -= glyphDestCropY;
                outY -= inBaseline; 
                
                outX *= glyphScale;
                outY *= glyphScale;
                
                outX = Math.round(outX); // if we don't round, we get some artifacts in the font (due to delta drift probably)
                outY = Math.round(outY);

                maxY = Math.max(maxY, outY);
                minY = Math.min(minY, outY);
                
                currentCmd.push(outX, outY);
                
                if (p === 1) {
                    currentX = x;
                    currentY = y;
                }
            }
        } else {
            // Handle non-string command case
            console.warn(`Unexpected non-string command: ${command}`);
            continue;
        }
        const row = Math.floor(currentY / glyphGridHeight);
        const col = Math.floor(currentX / glyphGridWidth);
        
        //console.log(row +' '+ col + ' '+ currentX +' '+ currentY + ' ' + typeof command + ' '+ command);
        
        if (row >= 0 && row < sourceRowText.length && col >= 0 && col < sourceRowText[row].length) {
            const char = sourceRowText[row][col];
            if (!glyphMap.has(char)) {
                glyphMap.set(char, [currentCmd]);
            } else {
                const existingPaths = glyphMap.get(char);
                existingPaths?.push(currentCmd);
            }
        }
        
        if (command === 'Z' || command === 'z') {
            currentCmd = [];
        }
    }


    const glyphs = sourceRowText.flatMap(row => 
        Array.from(row).map(char => ({
            char,
            path: glyphMap.get(char) || []
        }))
    );

    const font = await loadFont("JetBrains Mono ExtraBold.ttf");




    writeDebugGlyphs(font, glyphs, glyphMap);
    printFontMetrics(font);
    //console.log("Current font metadata:\n" + JSON.stringify(font.names, null, 2));



    for (const [char, path] of glyphMap.entries()) {
        try {
            // Skip non-ASCII characters if onlyUpdateAsciiRange is true
            if (onlyUpdateAsciiRange && char.charCodeAt(0) > 127) {
                continue;
            }

            const glyph = font.charToGlyph(char);
            if (glyph) {
                glyph.path = SVGPathArrayToPath(path);
                //glyph.path = parseSVGPath(fromSvgPathArray(path));
                //console.log(`Updated glyph for character '${char}'`);
            }
        } catch (err) {
            console.warn(`Failed to update glyph for character '${char}':`, err);
        }
    }
    if(removeNonAscii) {
        const glyphsToRemove = [];
        // font.glyphs.glyphs is an object where keys are glyph indices
        for (const index in font.glyphs.glyphs) {
            const glyph = font.glyphs.glyphs[index];
            // Keep basic ASCII range (32-126) and notdef glyph (0)
            if (glyph.unicode && (glyph.unicode > 127 || glyph.unicode < 32)) {
                glyph.path = new Path();  // Empty path instead of null
            }
        }
    }   

    //console.log("maxY: "+ maxY);
    //console.log("minY: "+ minY);
    setUnitsPerEm(font, (glyphGridHeight - glyphDestCropH) * glyphScale); // "max size", controls view size in font forge, and line height in the browser

    //setCapitalHeight(font, 1300); 
    //setAscender(font, 1300); // actually ascenders in font files are more about layouting than actual ascenders

    setCapitalHeight(font, (inCapitalHeight - inBaseline) * glyphScale); 
    setXHeight(font, (inXHeight - inBaseline) * glyphScale); 
    setAscender(font, (inCapitalHeight - inBaseline) * glyphScale); // actually ascenders in font files are more about layouting than actual ascenders
    setDescender(font, (inDescender - inBaseline) * glyphScale); 

    // JetBrains Mono ExtraBold v2.304 Metrics
    // setAscender(font, 1044)
    // setDescender(font, -307); 
    // setLineGap(font, 0);
    // setUnitsPerEm(font, 1024);

    // Update font metadata
    font.names = {
        copyright: { en: "Copyright © 2024 teadrinker /Martin Eklund (fallback font: JetBrains Mono ExtraBold v2.304, https://github.com/JetBrains/JetBrainsMono)" },
        fontFamily: { en: "Idealist Hacker Mono" },
        fontSubfamily: { en: "ExtraBold" },
        uniqueID: { en: "1.0;teadrinker;idealist-hacker-mono-font" },
        fullName: { en: "Idealist Hacker Mono ExtraBold" },
        version: { en: "Version 0.9" },
        postScriptName: { en: "IdealistHackerMono-ExtraBold" },
        trademark: { en: "JetBrains Mono is a trademark of JetBrains s.r.o." },
        manufacturer: { en: "Font Generator" },
        designer: { en: "teadrinker / Martin Eklund" },
        description: { en: "Procedurally generated font" },
        manufacturerURL: { en: "https://github.com/teadrinker/idealist-hacker-mono-font" },
        designerURL: { en: "https://github.com/teadrinker/idealist-hacker-mono-font" },
        license: { en: "This Font Software is licensed under the SIL Open Font License, Version 1.1. This license is available with a FAQ at: https://scripts.sil.org/OFL" },
        licenseURL: { en: "https://scripts.sil.org/OFL" },
        preferredFamily: { en: "Idealist Hacker Mono" },
        preferredSubfamily: { en: "ExtraBold" },
        compatibleFullName: { en: "Idealist Hacker Mono ExtraBold" },
        sampleText: { en: "Sphinx of black quartz, judge my vow" },
    };

    const newFontArrayBuffer = new Uint8Array(font.toArrayBuffer());
    const newFontPath = font.names.fontFamily.en;
    Deno.writeFileSync(newFontPath + ".ttf" , newFontArrayBuffer);
    Deno.writeFileSync(newFontPath + ".otf" , newFontArrayBuffer);
    Deno.writeFileSync(newFontPath + ".woff", newFontArrayBuffer);
    console.log(`saved as ${newFontPath}`);

    if(logMetrics) {
        const newFont = await loadFont(newFontPath + ".ttf");
        printFontMetrics(newFont);
    }

    // debug glyph of output font
    //    const newFont = await loadFont(newFontPath + ".ttf");
    //    const glyphStringO = newFont.charToGlyph('O').path.toPathData();    
    //    saveSvg('glyph_O_debug_out.svg', glyphStringO, glyphGridWidth, glyphGridHeight);


} catch (err) {
    console.error("Error processing the font:", err);
}
