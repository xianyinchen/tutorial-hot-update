var fs = require('fs');
var path = require('path');
var crypto = require('crypto');

function newVersion(argv) {
    var manifest = {
        packageUrl: 'http://localhost/tutorial-hot-update/remote-assets/',
        remoteManifestUrl: 'http://localhost/tutorial-hot-update/remote-assets/project.manifest',
        remoteVersionUrl: 'http://localhost/tutorial-hot-update/remote-assets/version.manifest',
        version: '1.0.0',
        assets: {},
        searchPaths: []
    };

    var orgin = './orgin-assets/';
    var dest = './remote-assets/';
    var src = './jsb/';

    // Parse arguments
    var i = 0;
    while (i < argv.length) {
        var arg = argv[i];
        switch (arg) {
            case '--url':
            case '-u':
                var url = argv[i + 1];
                manifest.packageUrl = url;
                manifest.remoteManifestUrl = url + 'project.manifest';
                manifest.remoteVersionUrl = url + 'version.manifest';
                i += 2;
                break;
            case '--version':
            case '-v':
                manifest.version = argv[i + 1];
                i += 2;
                break;
            case '--src':
            case '-s':
                src = argv[i + 1];
                i += 2;
                break;
            case '--dest':
            case '-d':
                dest = argv[i + 1];
                i += 2;
                break;
            case '-o':
                orgin = argv[i + 1];
                i += 2;
                break;
            default:
                i++;
                break;
        }
    }

    //递归创建目录 同步方法  
    function mkdirsSync(dirname) {
        if (fs.existsSync(dirname)) {
            return true;
        } else {
            if (mkdirsSync(path.dirname(dirname))) {
                fs.mkdirSync(dirname);
                return true;
            }
        }
    }

    function readDir(dir, obj) {
        if (!fs.existsSync(dir))
            return;

        var stat = fs.statSync(dir);
        if (!stat.isDirectory()) {
            return;
        }
        var subpaths = fs.readdirSync(dir), subpath, size, md5, compressed, relative;
        for (var i = 0; i < subpaths.length; ++i) {
            if (subpaths[i][0] === '.') {
                continue;
            }
            subpath = path.join(dir, subpaths[i]);
            stat = fs.statSync(subpath);
            if (stat.isDirectory()) {
                readDir(subpath, obj);
            }
            else if (stat.isFile()) {
                // Size in Bytes
                size = stat['size'];
                md5 = crypto.createHash('md5').update(fs.readFileSync(subpath)).digest('hex');
                compressed = path.extname(subpath).toLowerCase() === '.zip';

                relative = path.relative(src, subpath);
                relative = relative.replace(/\\/g, '/');
                relative = encodeURI(relative);
                obj[relative] = {
                    'size': size,
                    'md5': md5
                };
                if (compressed) {
                    obj[relative].compressed = true;
                }

                var dest_file = path.join(dest/*, manifest.version*/, subpath.replace(src, ''));
                mkdirsSync(dest_file.replace(path.basename(dest_file), ''));
                fs.writeFileSync(dest_file, fs.readFileSync(subpath));
            }
        }
    }

    var mkdirSync = function (path) {
        try {
            fs.mkdirSync(path);
        } catch (e) {
            if (e.code != 'EEXIST') throw e;
        }
    }

    // Iterate res and src folder
    readDir(path.join(src, 'src'), manifest.assets);
    readDir(path.join(src, 'res'), manifest.assets);

    var destManifest = path.join(dest/*, manifest.version*/, 'project.manifest');
    var destVersion = path.join(dest/*, manifest.version*/, 'version.manifest');

    mkdirSync(dest);

    fs.writeFile(destManifest, JSON.stringify(manifest), (err) => {
        if (err) throw err;
        Editor.log('Manifest successfully generated');
    });

    delete manifest.assets;
    delete manifest.searchPaths;
    fs.writeFile(destVersion, JSON.stringify(manifest), (err) => {
        if (err) throw err;
        Editor.log('Version successfully generated');
    });

    function deleteFolderRecursive(path) {
        if (fs.existsSync(path)) {
            fs.readdirSync(path).forEach(function (file) {
                var curPath = path + "/" + file;
                if (fs.statSync(curPath).isDirectory()) { // recurse
                    deleteFolderRecursive(curPath);
                } else { // delete file
                    fs.unlinkSync(curPath);
                }
            });
            fs.rmdirSync(path);
        }
    };

    const copyDir = function (src, dst) {
        if (!fs.existsSync(src)) return;
        var paths = fs.readdirSync(src);

        if (!fs.existsSync(dst)) fs.mkdirSync(dst);
        paths.forEach(function (path) {
            const _src = src + '/' + path
            const _dst = dst + '/' + path
            let readable; let writable
            var st = fs.statSync(_src);
            if (st.isFile()) {
                readable = fs.createReadStream(_src)
                writable = fs.createWriteStream(_dst)
                readable.pipe(writable)
            }
            else if (st.isDirectory()) {
                if (!fs.existsSync(dst))
                    fs.mkdirSync(dst);
                copyDir(_src, _dst);
            }
        })
    }

    if (!fs.existsSync(path.join(orgin, 'src'))) {
        mkdirSync(orgin);
        copyDir(path.join(src, 'src'), path.join(orgin, 'src'));
        copyDir(path.join(src, 'res'), path.join(orgin, 'res'));
    }
    else {
        deleteFolderRecursive(path.join(src, 'src'));
        copyDir(path.join(orgin, 'src'), path.join(src, 'src'));

        deleteFolderRecursive(path.join(src, 'res'));
        copyDir(path.join(orgin, 'res'), path.join(src, 'res'));
    }

}

module.exports = newVersion;
