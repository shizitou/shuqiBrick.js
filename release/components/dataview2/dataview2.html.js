define('dataview2.html',function (require, exports, module) {				require("datahead2.html");require("datalist.html");				module.exports = require('$component')('dataview2.html',{					tpl: "<div class=\"cp-datalist\">\n\t<%= $require(\"datahead2.html\") %>\n\t<div class=\"cp-dl-desc\"><%- desc %></div>\n\t<%= $require(\"datalist.html\") %>\n</div>",					css: ".cp-datalist{\n\tmargin:0 10px 10px;\n\tcolor:black;\n\ttext-align:left;\n\tbackground:#00B3FF;\n}\n.cp-dl-desc{\n\tline-height:16px;\n\tfont-size:12px;\n\tmargin:5px 0 5px 0;\n\ttext-indent:2em;\n\tmargin-bottom:2px;\n\tborder-bottom:1px solid #f1f1f1;\n}"				});			})