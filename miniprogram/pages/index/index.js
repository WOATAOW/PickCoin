Page({
  data: {
    monthExpense: '0.00',
    monthIncome: '0.00',
    totalBalance: '0.00',
    recentTxs: [],
    isLoading: true
  },

  onLoad: function (options) {
    this.fetchDashboardData();
  },

  onShow: function () {
    this.fetchDashboardData();
  },

  async fetchDashboardData() {
    this.setData({ isLoading: true });
    wx.showNavigationBarLoading();

    const app = getApp();
    const userId = app.globalData.userInfo?.openid || app.globalData.userInfo?._openid || '';
    
    if (!userId) {
      console.log('用户未登录，使用默认数据');
      this.setData({
        monthExpense: '0.00',
        monthIncome: '0.00',
        totalBalance: '0.00',
        recentTxs: [],
        isLoading: false
      });
      wx.hideNavigationBarLoading();
      return;
    }

    const db = wx.cloud.database();
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    try {
      const res = await db.collection('pc_bill')
        .where({ _openid: userId })
        .orderBy('createTime', 'desc')
        .limit(100)
        .get();

      let monthExpense = 0;
      let monthIncome = 0;
      let totalExpense = 0;
      let totalIncome = 0;
      const recentTxs = [];

      if (res.data && res.data.length > 0) {
        res.data.forEach(item => {
          const amount = parseFloat(item.amount) || 0;
          const isExpense = item.type === '支出' || item.type === 'expense';
          const createTime = this.parseDate(item.createTime);

          if (isExpense) {
            totalExpense += amount;
          } else {
            totalIncome += amount;
          }

          if (createTime >= startOfMonth && createTime <= endOfMonth) {
            if (isExpense) {
              monthExpense += amount;
            } else {
              monthIncome += amount;
            }
          }

          if (recentTxs.length < 5) {
            recentTxs.push({
              txId: item._id,
              category: item.category || item.type,
              account: item.account || '其他',
              type: isExpense ? 'expense' : 'income',
              amount: amount.toFixed(2),
              date: this.formatDate(createTime)
            });
          }
        });
      }

      this.setData({
        monthExpense: monthExpense.toFixed(2),
        monthIncome: monthIncome.toFixed(2),
        totalBalance: (totalIncome - totalExpense).toFixed(2),
        recentTxs: recentTxs,
        isLoading: false
      });

    } catch (err) {
      console.error('拉取数据失败:', err);
      this.setData({
        monthExpense: '0.00',
        monthIncome: '0.00',
        totalBalance: '0.00',
        recentTxs: [],
        isLoading: false
      });
    } finally {
      wx.hideNavigationBarLoading();
    }
  },

  parseDate(date) {
    if (typeof date === 'object' && date.getFullYear) {
      return date;
    } else if (typeof date === 'string') {
      return new Date(date);
    }
    return new Date();
  },

  formatDate(date) {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const itemDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const timeStr = `${hours}:${minutes}`;

    if (itemDate.getTime() === today.getTime()) {
      return `今天 ${timeStr}`;
    } else if (itemDate.getTime() === yesterday.getTime()) {
      return `昨天 ${timeStr}`;
    } else {
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${month}-${day} ${timeStr}`;
    }
  },

  goToQuickBook: function () {
    wx.switchTab({
      url: '/pages/book/index'
    });
  },

  goToAiAgent: function () {
    wx.switchTab({
      url: '/pages/ai/index'
    });
  },

  goToAllTxs: function () {
    wx.switchTab({
      url: '/pages/history/index'
    });
  },

  goToAccounts: function () {
    wx.navigateTo({
      url: '/pages/accounts/index'
    });
  }
});