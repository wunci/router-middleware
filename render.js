const fs = require("fs");

const render = function(file, data) {
  let str = fs.readFileSync(`./views/${file}.ejs`, "utf8");
  const escape = function(html) {
    return String(html)
      .replace(/&(?!\w+;)/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;"); // IE下不支持&apos;(单引号)转义
  };
  str = str
    .replace(/\n/g, "")
    .replace(/\s{2,}/g, "")
    .replace(/<%-([\S\s]+?)%>/g, function(match, val) {
      return `'+ ${val} +'`;
    })
    .replace(/<%=([\S\s]+?)%>/g, function(match, val) {
      return `'+ escape(${val}) +'`;
    })
    .replace(/<%([\S\s]+?)%>/g, function(match, val) {
      return `';\n${val}\ntpl +='`;
    });

  str = `let tpl = '${str}';return tpl;`;
  str = `with(option){${str};return tpl;}`;
  const complied = new Function("option", str);
  let result;
  try {
    result = complied(data);
  } catch (error) {
    console.log(error);
  }
  return result;
};
module.exports = render;
