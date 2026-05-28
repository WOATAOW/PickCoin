Page({
  data: {
    userInfo: {
      _openid: '',
      nickname: '',
      avatarUrl: ''
    },
    stats: {
      days: 0,
      debt: '0.00'
    },
    isSaving: false,
    isLogging: false,
    tempAvatarPath: ''
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 4 });
    }
    this.loadUserData();
  },

  loadUserData() {
    const app = getApp();
    const globalUser = app.globalData.userInfo;
    
    if (globalUser && globalUser._openid) {
      this.setData({
        userInfo: {
          _openid: globalUser._openid || '',
          nickname: globalUser.nickname || '',
          avatarUrl: globalUser.avatarUrl || ''
        }
      });
      
      this.calculateTotalDays(globalUser);
      this.fetchDebtTotal();
    } else {
      this.setData({
        userInfo: {
          _openid: '',
          nickname: '',
          avatarUrl: ''
        },
        stats: {
          days: 0,
          debt: '0.00'
        }
      });
    }
  },

  calculateTotalDays(globalUser) {
    if (!globalUser || !globalUser.createTime) {
      this.setData({
        'stats.days': 1
      });
      return;
    }

    try {
      let startDate;
      
      if (globalUser.createTime instanceof Date) {
        startDate = globalUser.createTime;
      } else {
        startDate = new Date(globalUser.createTime);
      }
      
      const nowDate = new Date();
      
      const timeDiff = nowDate.getTime() - startDate.getTime();
      let days = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));
      
      if (days < 1) {
        days = 1;
      }
      
      this.setData({
        'stats.days': days
      });
    } catch (error) {
      console.error("计算记账总天数失败：", error);
      this.setData({
        'stats.days': 1
      });
    }
  },
  
  async fetchDebtTotal() {
    const app = getApp();
    const userInfo = app.globalData.userInfo;
    
    if (!userInfo || !userInfo._openid) {
      this.setData({ 'stats.debt': '0.00' });
      return;
    }

    try {
      const db = wx.cloud.database();
      const result = await db.collection('pc_debt')
        .where({ 
          _openid: userInfo._openid,
          status: 0,
          debtType: '应收'
        })
        .get();

      const debts = result.data || [];
      const totalDebt = debts.reduce((sum, item) => {
        return sum + (parseFloat(item.amount) || 0);
      }, 0);

      this.setData({
        'stats.debt': totalDebt.toFixed(2)
      });
    } catch (err) {
      console.error("【获取待收债务失败】", err);
      this.setData({ 'stats.debt': '0.00' });
    }
  },

  async onChooseAvatar(e) {
    const { avatarUrl } = e.detail;
    console.log("【头像选择】临时路径:", avatarUrl);
    
    this.setData({ tempAvatarPath: avatarUrl });
    wx.showLoading({ title: '上传头像中...' });
    
    try {
      const uploadPromise = new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('上传超时'));
        }, 15000);
        
        wx.cloud.uploadFile({
          cloudPath: `avatars/${Date.now()}-${Math.random().toString(36).substr(2, 9)}.png`,
          filePath: avatarUrl,
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
      
      const uploadResult = await uploadPromise;
      console.log("【头像上传】云存储路径:", uploadResult.fileID);
      
      this.setData({
        'userInfo.avatarUrl': uploadResult.fileID
      });
      
      wx.hideLoading();
      wx.showToast({ title: '头像上传成功', icon: 'success' });
    } catch (err) {
      wx.hideLoading();
      console.error("【头像上传失败】", err);
      wx.showToast({ title: '头像上传失败', icon: 'error' });
    }
  },

  onInputNickname(e) {
    const nickname = e.detail.value;
    this.setData({
      'userInfo.nickname': nickname
    });
  },

  async handleSave() {
    const { userInfo } = this.data;
    
    if (!userInfo.nickname || userInfo.nickname.trim() === '') {
      wx.showToast({ title: '请输入昵称', icon: 'none' });
      return;
    }

    this.setData({ isSaving: true });
    wx.showLoading({ title: '保存中...', mask: true });
    
    try {
      const db = wx.cloud.database();
      const app = getApp();
      
      const updatePromise = new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('数据库操作超时'));
        }, 15000);
        
        db.collection('pc_user').where({
          _openid: userInfo._openid
        }).update({
          data: {
            nickname: userInfo.nickname,
            avatarUrl: userInfo.avatarUrl,
            updateTime: db.serverDate()
          },
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
      
      await updatePromise;
      
      app.globalData.userInfo = {
        ...app.globalData.userInfo,
        nickname: userInfo.nickname,
        avatarUrl: userInfo.avatarUrl
      };
      
      try {
        wx.setStorageSync('userInfo', app.globalData.userInfo);
      } catch (e) {
        console.log("【保存用户缓存失败】", e);
      }
      
      wx.hideLoading();
      this.setData({ isSaving: false });
      wx.showToast({ title: '信息更新成功', icon: 'success' });
      console.log("【用户信息更新成功】", userInfo);
    } catch (err) {
      wx.hideLoading();
      this.setData({ isSaving: false });
      console.error("【用户信息更新失败】", err);
      wx.showToast({ title: '更新失败', icon: 'error' });
    }
  },

  async onManualLogin() {
    this.setData({ isLogging: true });
    wx.showLoading({ title: '登录中...', mask: true });
    
    try {
      const promise = new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('登录超时，请检查网络'));
        }, 15000);
        
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
        const app = getApp();
        
        app.globalData.userInfo = user;
        
        try {
          wx.setStorageSync('userInfo', user);
        } catch (e) {
          console.log("【保存登录缓存失败】", e);
        }
        
        this.setData({
          userInfo: {
            _openid: user._openid || '',
            nickname: user.nickname || '',
            avatarUrl: user.avatarUrl || ''
          },
          isLogging: false
        });
        
        this.calculateTotalDays(user);
        
        wx.hideLoading();
        wx.showToast({ title: '登录成功', icon: 'success' });
        console.log("【手动登录成功】", user);
      } else {
        wx.hideLoading();
        this.setData({ isLogging: false });
        console.error("【手动登录失败】", res.result);
        wx.showToast({ title: '登录失败', icon: 'error' });
      }
    } catch (err) {
      wx.hideLoading();
      this.setData({ isLogging: false });
      console.error("【手动登录异常】", err);
      wx.showToast({ title: '登录超时，请重试', icon: 'none' });
    }
  },

  handleMenuClick(e) {
    const item = e.currentTarget.dataset.item;
    
    if (item === '账单导出') {
      this.exportMyBills();
      return;
    }
    
    if (item === '关于拾圆') {
      wx.navigateTo({
        url: '/pages/about/index'
      });
      return;
    }
    
    if (item === '人情债管理') {
      wx.navigateTo({
        url: '/pages/debt/index'
      });
      return;
    }
    
    wx.showToast({
      title: '功能开发中，敬请期待',
      icon: 'none'
    });
  },
  
  exportMyBills: function() {
    wx.showLoading({ title: '正在生成账单...', mask: true });

    wx.cloud.callFunction({
      name: 'exportBills',
      data: {}
    }).then(res => {
      if (res.result && res.result.success) {
        const fileID = res.result.fileID;
        
        wx.showLoading({ title: '正在下载文件...' });
        
        wx.cloud.downloadFile({
          fileID: fileID,
          success: downloadRes => {
            wx.hideLoading();
            const filePath = downloadRes.tempFilePath;
            
            wx.openDocument({
              filePath: filePath,
              showMenu: true,
              success: function () {
                console.log('打开文档成功');
              },
              fail: function (err) {
                wx.showToast({ title: '打开失败', icon: 'none' });
              }
            });
          },
          fail: err => {
            wx.hideLoading();
            wx.showToast({ title: '下载失败', icon: 'none' });
          }
        });
      } else {
        wx.hideLoading();
        wx.showToast({ title: '生成失败', icon: 'none' });
      }
    }).catch(err => {
      wx.hideLoading();
      wx.showToast({ title: '网络异常', icon: 'none' });
    });
  },

  onLogout() {
    wx.showModal({
      title: '确认退出',
      content: '确定要退出登录吗？',
      confirmColor: '#EF4444',
      success: (res) => {
        if (res.confirm) {
          const app = getApp();
          
          app.globalData.userInfo = null;
          
          try {
            wx.removeStorageSync('userInfo');
          } catch (e) {
            console.log("【退出登录】清除缓存失败:", e);
          }
          
          this.setData({
            userInfo: {
              _openid: '',
              nickname: '',
              avatarUrl: ''
            },
            stats: {
              days: 0,
              debt: '0.00'
            }
          });
          
          wx.showToast({
            title: '已退出',
            icon: 'success'
          });
          
          console.log("【退出登录】成功");
        }
      }
    });
  }
});