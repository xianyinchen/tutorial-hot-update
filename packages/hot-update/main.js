'use strict';

var Fs = require("fire-fs");
var Path = require("fire-path");
var NewV = require("./generator")

module.exports = {
    load: function () {
        // 当 package 被正确加载的时候执行
    },

    unload: function () {
        // 当 package 被正确卸载的时候执行
    },

    messages: {
        'editor:build-finished': function (event, target) {
            var root = Path.normalize(target.dest);
            var url = Path.join(root, "main.js");
            Fs.readFile(url, "utf8", function (err, data) {
                if (err) {
                    throw err;
                }

                var newStr =
                    "(function () {\n" +
                    "    if (typeof window.jsb === 'object') {\n" +
                    "        var hotUpdateSearchPaths = localStorage.getItem('HotUpdateSearchPaths');\n" +
                    "        if (hotUpdateSearchPaths) {\n" +                                  
                    "            jsb.fileUtils.setSearchPaths([jsb.fileUtils ? jsb.fileUtils.getWritablePath() : '/']);\n" +                         
                    "            jsb.AssetsManager.checkFinish('blackjack-remote-asset')\n" +
                    "            jsb.fileUtils.setSearchPaths(JSON.parse(hotUpdateSearchPaths));\n" +                         
                    "        }\n" +
                    "    }\n" +
                    "})();\n";
                newStr += data;
                Fs.writeFile(url, newStr, function (error) {
                    if (err) {
                        throw err;
                    }
                    Editor.log("SearchPath updated in built main.js for hot update");
                });
            });

            // 写入配置
            var profile = Editor.Profile.load('profile://project/hotupdate.json');
            var newVer = parseInt(profile.data['version'] || "0") + 1;
            profile.data['version'] = newVer;
            profile.save();

            NewV([
                "-v", '1.0.' + newVer,
                "-u", "http://192.168.55.54:5501/remote-assets/",
                "-s", Path.join(__dirname, "../../build/jsb-link/"),
                "-d", Path.join(__dirname, "../../remote-assets/"),
                "-o", Path.join(__dirname, "../../orgin-assets/"),
            ]);

            Editor.log("New " + '1.0.' + newVer);
        }
    }
};