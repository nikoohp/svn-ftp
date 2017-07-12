## 配置
`ftpConfig.js`
```
{
  ftp: {
    host: '127.0.0.1',  // ftp服务器ip地址
    port: 21,           // ftp服务器端口
    user: 'username',   // ftp服务器用户名
    password: 'password'// ftp服务器密码
  },
  server: 'yourserveraddress',// 服务器上传目录
  svnUrl: 'https://127.0.0.1/svn/code/',// SVN地址
  uploadDir: ['statics']  // 需要上传服务器的本地目录
}
```