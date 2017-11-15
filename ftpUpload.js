require('./dateExtends.js')

const execSync = require('child_process').execSync
const fs = require('fs')
const path = require('path')
const ftp = require('ftp')
// 命令行上传图标
const ora = require('ora')
// 命令行字体样式
const chalk = require('chalk')
// 命令行问答交互
const inquirer = require('inquirer')
const cfg = require('./ftpConfig.js')

const f = new ftp()
// 当前项目路径
// 注意，process.cwd()与__dirname的区别。
// 前者进程发起时的位置，后者是脚本的位置，两者可能是不一致的。
// 比如，node ./code/program.js，对于process.cwd()来说，返回的是当前目录（.）；对于__dirname来说，返回是脚本所在目录，即./code/program.js。
const proPath = process.cwd();
// 环境变量
const env = process.env.NODE_ENV

// 获取上一次上传的时间
const lastUploadTime = fs.readFileSync(`${__dirname}/ftpUploadTime${env}.txt`, 'utf-8')
// 记录上传的时间
const currentUploadTime = new Date().Format('yyyy-MM-dd hh:mm:ss')
// 当前项目的文件夹名称
const proFolder = proPath.split('\\')[proPath.split('\\').length - 1];

// 上传到服务器上的文件夹名称
const uploadDirName = `${env}.${cfg.server}`
// 文件夹数组
const folderList = [];
// 文件数组
const fileList = [];
// 命令行提示
const questions = [{
  type: 'confirm',
  name: 'type',
  message: '请确认上传的文件：'
}]

// 打印文件列表
getUploadFilesList()
// 命令行确认上传
inquirer.prompt(questions).then(answers => {
  if (answers.type) {
    ftpUploadFn()
  } else {
    console.log('取消了ftp上传操作');
  }
})


/**
 * -----------------------------------------------
 * 获取待上传的文件列表
 * -----------------------------------------------
 */
function getUploadFilesList() {
  execSync(`svn diff -r {"${lastUploadTime}"} --summarize ${cfg.svnUrl}${proFolder} > ${__dirname}\\changedFiles.txt`)
  // 获取文件列表
  const changeList = fs.readFileSync(`${__dirname}/changedFiles.txt`, 'utf-8').split('\r\n')
  // 文件列表为空，退出命令行
  if (!changeList) {
    console.log('没有文件更新!');
    process.exit(0)
  }
  // 获取文件路径
  changeList.forEach(item => {
    if (item) {
      //  * 排除删除记录（以‘D’开头）
      if (!/^D\s+/.test(item)) {
        // 替换路径
        item = item.replace(new RegExp(`^(M|A)\\s+(${cfg.svnUrl}${proFolder}\/)`), '');
        let isWatch = new RegExp(`^(${cfg.uploadDir.join("|")})`).test(item);
        if (isWatch && !/(.map)$/.test(item)) {
          // 判断是文件还是文件夹
          let stats = fs.lstatSync(decodeURI(`${proPath}/${item}`));
          if (stats.isDirectory()) {
            folderList.push(item)
          } else {
            fileList.push(item);
          }
        }
      }
    }
  })
  // 不是上传目标文件夹文件，退出命令行
  if (!fileList.length) {
    console.log('没有文件更新!');
    process.exit(0)
  }
  // 打印文件个数和列表
  console.log('文件夹个数：' + chalk.green.bold(folderList.length));
  console.log('文件个数：' + chalk.green.bold(fileList.length));
  folderList.forEach(folder => console.log(folder))
  fileList.forEach(file => console.log(file))
}

/**
 * -----------------------------------------------
 * 链接ftp，创建文件夹
 * -----------------------------------------------
 */
function ftpUploadFn() {
  // 链接FTP服务器
  f.connect(cfg.ftp)

  // 连接成功
  f.on('ready', () => {
    console.log('FTP链接成功，开始上传');

    // 如果有文件夹，先创建文件夹
    if (folderList.length > 0) {
      for (let i = folderList.length - 1; i >= 0; i--) {
        f.mkdir(`${uploadDirName}/${folderList[i]}`, true, err => {
          if (err) throw err;
          // 上传进度条
          const spinner = ora('Loading unicorns').start();
          spinner.text = folderList[i]
          spinner.succeed()
          // 文件夹创建完成后开始上传文件
          i === 0 && uploadFiles()
        })
      }
    } else {
      // 没有文件夹， 直接上传文件
      uploadFiles()
    }
  })

  // 连接失败
  f.on('error', err => {
    console.log(`FTP连接失败，请检查网络和配置`)
    process.exit(0)
  })
}

/**
 * -----------------------------------------------
 * 上传文件
 * -----------------------------------------------
 */
function uploadFiles() {
  if (fileList.length === 0) process.exit(0)
  // 文件上传
  for (let j = 0, jlen = fileList.length; j < jlen; j++) {
    const spinner = ora('Loading unicorns').start();
    spinner.text = fileList[j]
    f.put(`${proPath}/${fileList[j]}`, `${uploadDirName}/${fileList[j]}`, (err) => {
      if (err) throw err;
      if (!/(.map)$/.test(fileList[j])) {
        spinner.succeed()
        // 文件上传完成
        if (j === jlen - 1) {
          // 记录上传时间
          fs.writeFileSync(`${__dirname}/ftpUploadTime${env}.txt`, currentUploadTime)
          // 删除列表文件
          fs.unlinkSync(`${__dirname}/changedFiles.txt`);
          // 将记录的上传时间文件提交到SVN服务器上
          execSync(`svn commit "${__dirname}/ftpUploadTime${env}.txt" -m "update -> ${env}.dgd.vc"`)
          // 关闭ftp链接
          f.end();
          // 退出命令行
          process.exit(0);
        }
      }

    })
  }

}