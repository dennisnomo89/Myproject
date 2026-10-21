// Writes the presentation's own colour scheme into a .pptx made by pptxgenjs.
// pptxgenjs always saves Office's default colours in ppt/theme/theme1.xml, so the
// scheme colours used on the slides (accent1, text2, ...) only take on the GVMA
// palette after this rewrites that file.
const fs = require('fs');
const JSZip = require('jszip');

const SLOTS = ['dk1', 'lt1', 'dk2', 'lt2', 'accent1', 'accent2', 'accent3', 'accent4', 'accent5', 'accent6', 'hlink', 'folHlink'];
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

async function applyTheme(file, theme) {
  for (const slot of SLOTS) {
    if (!/^[0-9A-Fa-f]{6}$/.test(theme.colors[slot] || '')) throw new Error(`theme colour ${slot} must be six hex digits`);
  }
  const zip = await JSZip.loadAsync(fs.readFileSync(file));
  const part = 'ppt/theme/theme1.xml';
  let xml = await zip.file(part).async('string');

  for (const slot of SLOTS) {
    const re = new RegExp(`<a:${slot}>[\\s\\S]*?</a:${slot}>`);
    xml = xml.replace(re, `<a:${slot}><a:srgbClr val="${theme.colors[slot].toUpperCase()}"/></a:${slot}>`);
  }
  xml = xml.replace(/(<a:theme\b[^>]*\bname=")[^"]*"/, `$1${esc(theme.name)}"`);
  xml = xml.replace(/(<a:clrScheme\b[^>]*\bname=")[^"]*"/, `$1${esc(theme.name)}"`);

  zip.file(part, xml);
  fs.writeFileSync(file, await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }));
}

module.exports = { applyTheme };
