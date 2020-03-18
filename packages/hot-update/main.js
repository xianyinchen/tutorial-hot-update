'use strict';

var Fs = require("fire-fs");
var Path = require("fire-path");
var GenV = require("./generator")

var first_version = "1.0.0";
var remote_address = "192.168.55.48:5501";
var orgin_assets = Path.join(__dirname, "../../orgin-assets/");
var remote_assets = Path.join(__dirname, "../../remote-assets/");

module.exports = {
    load: function () {
        // 当 package 被正确加载的时候执行
    },

    unload: function () {
        // 当 package 被正确卸载的时候执行
    },

    messages: {
        "editor:build-finished": function (event, target) {
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
                    "            var _storagePath = (jsb.fileUtils ? jsb.fileUtils.getWritablePath() : '/') + hotUpdateSearchPaths;\n" +
                    "            jsb.AssetsManager.checkFinish(_storagePath);\n" +
                    "            jsb.fileUtils.setSearchPaths(_storagePath);\n" +
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

            // 读取更新配置
            var profile = Editor.Profile.load("profile://project/hotupdate.json");
            var first_done = profile.data["first_done"];

            // 生成版本
            var newVersion = first_version;
            var oldVersion = profile.data["version"];
            if (oldVersion) {
                var numVersion = oldVersion.split(".");
                newVersion = (numVersion[0] || "1") + "." + (numVersion[1] || "0") + "." + (parseInt(numVersion[2] || "0") + 1);
            }

            // 由于 assets 引用了 project.manifest, 所以只有在第二次才能正常生成首包
            var numVersion = first_version.split(".");
            var first_check = (numVersion[0] || "1") + "." + (numVersion[1] || "0") + "." + (parseInt(numVersion[2] || "0") + 1);

            try {
                // 生成更新包
                GenV.Version([
                    "-f", first_done ? "" : first_check,
                    "-v", newVersion,
                    "-u", "http://" + remote_address + "/remote-assets/",
                    "-s", root,
                    "-d", remote_assets,
                    "-o", orgin_assets,
                ]);
            } catch (e) {
                Editor.log(e);
            }

            if (!first_done && first_check == newVersion) {
                // 标记首包生成完毕, 这一步不更新版本号！
                profile.data["first_done"] = true;
            }
            else {
                // 保存版本号
                profile.data["version"] = newVersion;
                profile.save();
                Editor.log("new version " + newVersion);
            }

            // 更新版本文件
            Editor.assetdb.refresh("db://assets//project.manifest");
        }
    }
};