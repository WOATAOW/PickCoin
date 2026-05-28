Page({
  data: {
    activeTab: 'receivable',
    debtList: [],
    selectedDebt: null,
    showDetailModal: false,
    totalReceivable: '0.00',
    receivableCount: 0,
    accountList: [],
    receivableList: [],
    historyList: []
  },

  onShow() {
    this.loadDebts();
    this.loadAccounts();
  },

  async loadDebts() {
    const app = getApp();
    const userInfo = app.globalData.userInfo;
    
    if (!userInfo || !userInfo._openid) {
      this.setData({ debtList: [] });
      return;
    }

    try {
      const db = wx.cloud.database();
      const result = await db.collection('pc_debt')
        .where({ _openid: userInfo._openid, debtType: '应收' })
        .orderBy('createTime', 'desc')
        .get();

      const debts = result.data || [];
      
      const processedDebts = debts.map(item => ({
        ...item,
        amount: parseFloat(item.amount) || 0,
        amountText: (parseFloat(item.amount) || 0).toFixed(2),
        dateText: this.formatDate(item.createTime),
        createTimeText: this.formatDateTime(item.createTime),
        settleTimeText: item.settleTime ? this.formatDateTime(item.settleTime) : ''
      }));

      const receivableList = processedDebts.filter(d => d.status === 0);
      const historyList = processedDebts.filter(d => d.status === 1);

      const totalReceivable = receivableList.reduce((sum, d) => sum + d.amount, 0).toFixed(2);

      this.setData({
        totalReceivable,
        receivableCount: receivableList.length,
        receivableList,
        historyList
      });

      this.updateCurrentList();
    } catch (err) {
      console.error("【加载债务列表失败】", err);
    }
  },

  async loadAccounts() {
    const app = getApp();
    const userId = app.globalData.userInfo?.openid || app.globalData.userInfo?._openid || '';
    
    try {
      const db = wx.cloud.database();
      const res = await db.collection('pc_account')
        .where({ _openid: userId })
        .get();

      let accountList = [];
      if (res.data && res.data.length > 0) {
        accountList = res.data.map(item => ({
          _id: item._id,
          name: item.name,
          balance: parseFloat(item.balance) || 0.00
        }));
      } else {
        accountList = [
          { _id: '1', name: '微信零钱', balance: 0.00 },
          { _id: '2', name: '支付宝', balance: 0.00 },
          { _id: '3', name: '银行卡', balance: 0.00 }
        ];
      }

      this.setData({ accountList });
    } catch (err) {
      console.error("【加载账户列表失败】", err);
      this.setData({
        accountList: [
          { _id: '1', name: '微信零钱', balance: 0.00 },
          { _id: '2', name: '支付宝', balance: 0.00 },
          { _id: '3', name: '银行卡', balance: 0.00 }
        ]
      });
    }
  },

  formatDate(date) {
    if (!date) return '--';
    const d = typeof date === 'object' ? date : new Date(date);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  },

  formatDateTime(date) {
    if (!date) return '--';
    const d = typeof date === 'object' ? date : new Date(date);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  },

  switchTab(e) {
    const tab = e.currentTarget.dataset.tab;
    this.setData({ activeTab: tab });
    this.updateCurrentList();
  },

  updateCurrentList() {
    const { activeTab, receivableList, historyList } = this.data;
    const list = activeTab === 'receivable' ? receivableList : historyList;
    this.setData({ debtList: list });
  },

  openDetailModal(e) {
    const debt = e.currentTarget.dataset.debt;
    this.setData({
      selectedDebt: debt,
      showDetailModal: true
    });
  },

  closeDetailModal() {
    this.setData({ showDetailModal: false });
  },

  showAccountSelector() {
    const { accountList, selectedDebt } = this.data;
    
    if (!selectedDebt) return;

    const items = accountList.map(acc => ({
      text: `${acc.name} (¥${acc.balance.toFixed(2)})`,
      value: acc._id,
      account: acc
    }));

    wx.showActionSheet({
      itemList: items.map(i => i.text),
      itemColor: '#3B82F6',
      title: `请选择收款账户 (¥${selectedDebt.amount})`,
      success: (res) => {
        const selectedAccount = items[res.tapIndex].account;
        this.settleDebt(selectedAccount);
      },
      fail: () => {
        console.log('用户取消选择');
      }
    });
  },

  async settleDebt(selectedAccount) {
    const { selectedDebt } = this.data;
    if (!selectedDebt || !selectedAccount) return;

    wx.showLoading({ title: '处理中...', mask: true });

    try {
      const app = getApp();
      const userInfo = app.globalData.userInfo;
      const db = wx.cloud.database();
      const _ = db.command;

      const billAmount = parseFloat(selectedDebt.amount) || 0;

      await db.collection('pc_debt').doc(selectedDebt._id).update({
        data: {
          status: 1,
          settleTime: db.serverDate(),
          settleAccountId: selectedAccount._id,
          settleAccountName: selectedAccount.name
        }
      });

      await db.collection('pc_bill').add({
        data: {
          type: '收入',
          category: '其他收入',
          amount: billAmount,
          account: selectedAccount.name,
          accountId: selectedAccount._id,
          remark: `[应收结清] ${selectedDebt.targetPerson || 'AA待收款'}`,
          createTime: db.serverDate(),
          creator: {
            _openid: userInfo._openid || '',
            nickname: userInfo.nickname || '系统',
            isAI: false
          }
        }
      });

      await db.collection('pc_account').doc(selectedAccount._id).update({
        data: {
          balance: _.inc(billAmount)
        }
      });

      wx.hideLoading();
      wx.showToast({ title: '核销成功', icon: 'success' });
      
      this.closeDetailModal();
      this.loadDebts();
      this.loadAccounts();

    } catch (err) {
      console.error("【核销债务失败】", err);
      wx.hideLoading();
      wx.showToast({ title: '核销失败', icon: 'error' });
    }
  }
});
