var fs = require('fs');
var path = require('path');
var crypto = require('crypto');

function rmdirSync(path) {
    if (fs.existsSync(path)) {
        fs.readdirSync(path).forEach(function (file) {
            var curPath = path + "/" + file;
            if (fs.statSync(curPath).isDirectory()) { // recurse
                rmdirSync(curPath);
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

var mkdirSync = function (path) {
    try {
        fs.mkdirSync(path);
    } catch (e) {
        if (e.code != 'EEXIST') throw e;
    }
}

function Version(argv) {
    var manifest = {
        packageUrl: 'http://localhost/tutorial-hot-update/remote-assets/',
        remoteManifestUrl: 'http://localhost/tutorial-hot-update/remote-assets/project.manifest',
        remoteVersionUrl: 'http://localhost/tutorial-hot-update/remote-assets/version.manifest',
        version: '1.0.0',
        assets: {},
        searchPaths: []
    };

    var first_version = '1.0.0';
    var orgin = './orgin-assets/';
    var dest = './remote-assets/';
    var src = './jsb-link/';

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
            case '-f':
                first_version = argv[i + 1];
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

    // 添加MD5记录
    function addRecord(src, subpath, obj) {
        // Size in Bytes
        stat = fs.statSync(subpath);
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
                addRecord(src, subpath, obj);
            }
        }
    }

    // new folder
    rmdirSync(dest);
    mkdirSync(dest);

    // Iterate res and src folder
    readDir(path.join(src, 'src'), manifest.assets);
    readDir(path.join(src, 'assets'), manifest.assets);

    // main.js
    addRecord(src, path.join(src, 'main.js'), manifest.assets);    

    var destManifest = path.join(dest/*, manifest.version*/, 'project.manifest');
    var destVersion = path.join(dest/*, manifest.version*/, 'version.manifest');

    fs.writeFileSync(destManifest, JSON.stringify(manifest))

    delete manifest.assets;
    delete manifest.searchPaths;
    fs.writeFileSync(destVersion, JSON.stringify(manifest));

    // 生成首包
    if (first_version.length > 0) {
        if (first_version == manifest.version) {
            // 清除版本数据
            rmdirSync(orgin);

            // 生成首包
            mkdirSync(orgin);
            copyDir(path.join(dest, 'src'), path.join(orgin, 'src'));
            copyDir(path.join(dest, 'assets'), path.join(orgin, 'assets'));
            fs.copyFileSync(path.join(dest, 'main.js'), path.join(orgin, 'main.js'));            

            rmdirSync(dest);
            Editor && Editor.Dialog.messageBox(null, { type: "info", message: "new first package done!" });
        }
        else {
            // 生成首包之前同步 project.manifest            
            fs.copyFileSync(destManifest, path.join(__dirname, "../../assets/project.manifest"));
        }
    }
    else if (fs.existsSync(path.join(orgin, 'src'))) {
        rmdirSync(path.join(src, 'src'));
        rmdirSync(path.join(src, 'assets'));
        copyDir(path.join(orgin, 'src'), path.join(src, 'src'));
        copyDir(path.join(orgin, 'assets'), path.join(src, 'assets'));
        fs.copyFileSync(path.join(orgin, 'main.js'), path.join(src, 'main.js'));        
        Editor && Editor.warn("replace build res/src with first package resource.")
    }
}

module.exports = {
    Version
}
