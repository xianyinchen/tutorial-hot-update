'use strict';

var os = require('os');
var Fs = require("fire-fs");
var Path = require("fire-path");
var GenV = require("./generator")

var main_hook = function (src) {
    return `
var main_script = function () {
${src}
}

var hotUpdateSearchPaths = localStorage.getItem('HotUpdateSearchPaths');
if (hotUpdateSearchPaths) {
    //var paths = JSON.parse(hotUpdateSearchPaths);
    var paths = [((jsb.fileUtils ? jsb.fileUtils.getWritablePath() : '/') + 'blackjack-remote-asset')];
    jsb.fileUtils.setSearchPaths(paths);

    var fileList = [];
    var storagePath = paths[0] || '';
    var tempPath = storagePath + '_temp/';
    var baseOffset = tempPath.length;

    if (jsb.fileUtils.isDirectoryExist(tempPath) && !jsb.fileUtils.isFileExist(tempPath + 'project.manifest.temp')) {
        jsb.fileUtils.listFilesRecursively(tempPath, fileList);
        fileList.forEach(srcPath => {
            var relativePath = srcPath.substr(baseOffset);
            var dstPath = storagePath + relativePath;

            if (srcPath[srcPath.length] == '/') {
                cc.fileUtils.createDirectory(dstPath)
            }
            else {
                if (cc.fileUtils.isFileExist(dstPath)) {
                    cc.fileUtils.removeFile(dstPath)
                }
                cc.fileUtils.renameFile(srcPath, dstPath);
            }
        })
        cc.fileUtils.removeDirectory(tempPath);
    }
}

// require('src/main.js');
main_script();
`;
}

function getIPAdress() {
    var interfaces = os.networkInterfaces();
    for (var devName in interfaces) {
        var iface = interfaces[devName];
        for (var i = 0; i < iface.length; i++) {
            var alias = iface[i];
            if (alias.family === 'IPv4' && alias.address !== '127.0.0.1' && !alias.internal) {
                return alias.address;
            }
        }
    }
}

// 引入http模块
var http = require("http");
var fs = require("fs");

var remote_server = null;
function createServer(ip, port) {
    try {
        if (null != remote_server) {
            remote_server.close();
        }

        // 创建server，指定处理客户端请求的函数
        Editor.log("IP: " + ip + ":" + port);
        remote_server = http.createServer(
            function (request, response) {
                //判断HTTP方法，只处理GET 
                if (request.method != "GET") {
                    response.writeHead(403);
                    response.end();
                    return null;
                }

                //此处也可使用URL模块来分析URL(https://nodejs.org/api/url.html)
                var sep = request.url.indexOf('?');
                var filePath = sep < 0 ? request.url : request.url.slice(0, sep);

                //当文件存在时发送数据给客户端，否则404
                var fileStat = fs.stat(Path.join(__dirname, "../../",  "." + filePath),
                    function (err, stats) {
                        Editor.log("GET file: " + Path.join(__dirname, "../../",  "." + filePath));

                        if (err) {
                            response.writeHead(404);
                            response.end();
                            return null;
                        }
                        //TODO:Content-Type应该根据文件类型设置
                        response.writeHead(200, { "Content-Type": "text/plain", "Content-Length": stats.size });

                        //使用Stream
                        var stream = fs.createReadStream(Path.join(__dirname, "../../",  "." + filePath));

                        stream.on('data', function (chunk) {
                            response.write(chunk);
                        });

                        stream.on('end', function () {
                            response.end();
                        });

                        stream.on('error', function () {
                            response.end();
                        });
                    }
                );
            }
        ).listen(port);
    }
    catch (e) {
        Editor.log(e);
    }
}

var first_version = "1.0.0";
var remote_address = "192.168.55.79:5500";
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
            var remote_address = `${getIPAdress()}:7788`
            createServer(getIPAdress(), 7788);

            var root = Path.normalize(target.dest);
            var url = Path.join(root, "main.js");

            try {
                var srcStr = Fs.readFileSync(url, 'utf-8');
                Fs.writeFileSync(url, main_hook(srcStr));
            } catch (e) {
                Editor.log(e);
            }

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