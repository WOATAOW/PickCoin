App({
  globalData: {
    cloudbase: null,
    userInfo: null
  },
  
  onLaunch() {
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力');
    } else {
      wx.cloud.init({
        env: "cloud1-d5gx634yq13de2e48",
        traceUser: true
      });
      
      this.globalData.cloudbase = wx.cloud;
    }
    
    this.silentLogin();
  },
  
  async silentLogin() {
    try {
      console.log("【App】开始静默登录...");
      
      const promise = new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('云函数调用超时'));
        }, 10000);
        
        wx.cloud.callFunction({
          name: 'login',
          success: (res) => {
            clearTimeout(timeout);
            resolve(res);
          },
          fail: (err) => {
            clearTimeout(timeout);
            reject(err);
          }
        });
      });
      
      const res = await promise;
      
      if (res.result && res.result.success) {
        const user = res.result.user;
        this.globalData.userInfo = user;
        console.log("【前端拿到通行证】", user);
      } else {
        console.error("【App】静默登录失败:", res.result);
      }
    } catch (err) {
      console.error("【App】静默登录发生异常:", err);
      console.log("【App】将尝试使用本地存储恢复用户信息...");
      try {
        const storedUser = wx.getStorageSync('userInfo');
        if (storedUser) {
          this.globalData.userInfo = storedUser;
          console.log("【App】已从本地存储恢复用户:", storedUser);
        }
      } catch (e) {
        console.log("【App】本地存储无用户数据");
      }
    }
  }
});