/**
 * 扩展日期对象
 * 添加时间格式化方法
 */
Date.prototype.Format = function (fmt) {
  let o = {
    'M+': this.getMonth() + 1, // 月份
    "d+": this.getDate(), //日 
    "h+": this.getHours(), //小时 
    "m+": this.getMinutes(), //分 
    "s+": this.getSeconds() //秒 
  }
  // y出现一次或多次
  if (/(y+)/.test(fmt)) {
    fmt = fmt.replace(RegExp.$1, (this.getFullYear() + "").substr(4 - RegExp.$1.length));
  }
  for (var k in o) {
    if (new RegExp("(" + k + ")").test(fmt)) {
      fmt = fmt.replace(RegExp.$1, (RegExp.$1.length == 1) ? (o[k]) : (("00" + o[k]).substr(("" + o[k]).length)));
    }
  }
  return fmt;
}



const exec = require('child_process').exec;
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const ftp = require('ftp');
// 导入配置文件
const cfg = require('./ftpConfig.js');
// ftp
const f = new ftp();
// 当前项目路径
// 注意，process.cwd()与__dirname的区别。
// 前者进程发起时的位置，后者是脚本的位置，两者可能是不一致的。
// 比如，node ./code/program.js，对于process.cwd()来说，返回的是当前目录（.）；对于__dirname来说，返回是脚本所在目录，即./code/program.js。
const proPath = process.cwd();

// 上次上传时间
const lastTime = fs.readFileSync(`${__dirname}/ftpUploadTime${process.env.NODE_ENV.trim()}.txt`, 'utf-8');
// 本次时间
let thisTime = 0;
// 当前项目的文件夹名称
const proFolder = proPath.split('\\')[proPath.split('\\').length - 1];

cfg.server = `${process.env.NODE_ENV.trim()}.${cfg.server}`


// 命令行提示
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});
rl.setPrompt('执行该命令前请确保提交了更改并获取了最新的版本 (y/n) : ');
rl.prompt();
rl.on('line', (line) => {
  let input = line.trim();
  if (input === 'y' || input === 'Y' || input === '') {
    ftpUpload();
  } else {
    console.log('取消了ftp上传操作');
    process.exit(0);
  }
});
rl.on('close', function () {
  console.log('bye bye');
  process.exit(0);
});

/**
 * ftp事件操作
 */
function ftpUpload() {
  console.log('开始执行ftp上传操作');
  let folderList = [];
  let fileList = [];
  // 获取更新列表
  exec(`svn diff -r {"${lastTime}"} --summarize ${cfg.svnUrl}${proFolder} > ${__dirname}\\changedFiles.txt`, (err, stdout, stderr) => {
    if (err) throw err;
    // 获取成功后保存当前时间
    thisTime = new Date().Format('yyyy-MM-dd hh:mm:ss');
    // 读取文件列表
    let files = fs.readFileSync(`${__dirname}/changedFiles.txt`, 'utf-8').split('\r\n');
    files.forEach(item => {
      if (item !== '') {
        // 提交记录筛选
        // 排除删除提交（以‘D’开头）
        if (!/^D\s+/.test(item)) {
          // 替换路径
          item = item.replace(new RegExp(`^(M|A)\\s+(${cfg.svnUrl}${proFolder}\/)`), '');
          var isWatch = new RegExp(`^(${cfg.uploadDir.join("|")})`).test(item);
          if (isWatch) {
            // 判断是文件还是文件夹
            var stats = fs.lstatSync(decodeURI(`${proPath}/${item}`));
            if (stats.isDirectory()) {
              folderList.push(item)
            } else {
              fileList.push(item);
            }
          }
        }
      }
    })
    // 参考：https://github.com/mscdex/node-ftp
    if (fileList.length > 0) {
      f.on('ready', () => {
        console.log(`文件个数：${fileList.length}
文件夹个数：${folderList.length}
        `);
        if (folderList.length > 0) {
          // 创建目录
          for (let i = 0, len = folderList.length; i < len; i++) {
            f.mkdir(`${cfg.server}/${folderList[i]}`, true, function (err) {
              if (err) throw err;
              console.log(`创建完成  ${folderList[i]}`);
              if (i === len - 1) {
                uploadFiles()
              }
            })
          }
        } else {
          uploadFiles()
        }

      })
      f.on('error', function (err) {
        console.log('FTP连接失败!!');
        process.exit(0);
      })
      // 连接
      f.connect(cfg.ftp);
    } else {
      console.log('没有文件更新!请先提交更新并获取最新版本！');
      process.exit(0);
    }
  })

  function uploadFiles() {
    // 文件上传
    for (let j = 0, jlen = fileList.length; j < jlen; j++) {
      f.put(`${proPath}/${fileList[j]}`, `${cfg.server}/${fileList[j]}`, (err) => {
        if (err) throw err;
        console.log(`上传完成  ${fileList[j]}`);
        if (j === jlen - 1) {
          // 记录时间
          fs.writeFile(`${__dirname}/ftpUploadTime${process.env.NODE_ENV.trim()}.txt`, thisTime, 'utf-8', function (err) {
            if (err) throw err;
            console.log('\n上传时间记录完成');
            // 删除列表文件
            fs.unlinkSync(`${__dirname}/changedFiles.txt`);
            // 记录完成后将文件提交到SVN服务器上
            exec(`svn commit "${__dirname}/ftpUploadTime${process.env.NODE_ENV.trim()}.txt" -m "更新${process.env.NODE_ENV.trim()}.zczj.com上传时间"`, (err, stdout, stderr) => {
              if (err) throw err;
              process.exit(0);
            });
          })
          f.end();
        }
      })
    }
  }

}