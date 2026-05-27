Page({
  data: {
    totalAssets: '0.00',
    totalLiabilities: '0.00',
    netAssets: '0.00',
    accountList: [],
    isLoading: true,
    showModal: false,
    modalAccountName: '',
    modalAccountBalance: '',
    isSubmitting: false,
    showEditModal: false,
    editingAccountId: '',
    editingAccountName: '',
    editAccountBalance: ''
  },

  onLoad: function () {
    this.fetchAccounts();
  },

  onShow: function () {
    this.fetchAccounts();
  },

  showAddAccountModal: function () {
    if (this.data.accountList.length >= 5) {
      wx.showModal({
        title: '额度已满',
        content: '普通用户最多只能添加5个账户哦',
        showCancel: false
      });
      return;
    }
    this.setData({
      showModal: true,
      modalAccountName: '',
      modalAccountBalance: ''
    });
  },

  closeModal: function () {
    this.setData({
      showModal: false,
      modalAccountName: '',
      modalAccountBalance: ''
    });
  },

  onModalNameInput: function (e) {
    this.setData({
      modalAccountName: e.detail.value
    });
  },

  onModalBalanceInput: function (e) {
    this.setData({
      modalAccountBalance: e.detail.value
    });
  },

  submitNewAccount: async function () {
    const { modalAccountName, modalAccountBalance, isSubmitting, accountList } = this.data;

    if (isSubmitting) {
      return;
    }

    if (accountList.length >= 5) {
      wx.showModal({
        title: '额度已满',
        content: '普通用户最多只能添加5个账户哦',
        showCancel: false
      });
      return;
    }

    const name = modalAccountName.trim();
    if (!name) {
      wx.showToast({
        title: '请输入账户名称',
        icon: 'none'
      });
      return;
    }

    let balance = 0;
    if (modalAccountBalance) {
      balance = parseFloat(parseFloat(modalAccountBalance).toFixed(2));
      if (isNaN(balance)) {
        wx.showToast({
          title: '请输入合法金额',
          icon: 'none'
        });
        return;
      }
    }

    const type = balance < 0 ? 'liability' : 'asset';

    this.setData({ isSubmitting: true });
    wx.showLoading({ title: '添加中...', mask: true });

    try {
      const app = getApp();
      const userId = app.globalData.userInfo?._openid || '';
      const db = wx.cloud.database();

      await db.collection('pc_account').add({
        data: {
          name: name,
          balance: balance,
          icon: balance < 0 ? '💳' : '📦',
          type: type,
          createTime: db.serverDate()
        }
      });

      wx.hideLoading();
      wx.showToast({
        title: '添加成功',
        icon: 'success'
      });

      this.setData({
        showModal: false,
        modalAccountName: '',
        modalAccountBalance: ''
      });

      this.fetchAccounts();

    } catch (err) {
      console.error('添加账户失败:', err);
      wx.hideLoading();
      wx.showToast({
        title: '添加失败',
        icon: 'error'
      });
    } finally {
      this.setData({ isSubmitting: false });
    }
  },

  onEditAccountBalance: function (e) {
    const { id, name, balance } = e.currentTarget.dataset;
    this.setData({
      showEditModal: true,
      editingAccountId: id,
      editingAccountName: name,
      editAccountBalance: balance
    });
  },

  onEditBalanceInput: function (e) {
    this.setData({
      editAccountBalance: e.detail.value
    });
  },

  closeEditModal: function () {
    this.setData({
      showEditModal: false,
      editingAccountId: '',
      editingAccountName: '',
      editAccountBalance: ''
    });
  },

  submitEditBalance: async function () {
    const { editingAccountId, editAccountBalance, isSubmitting } = this.data;

    if (isSubmitting) {
      return;
    }

    if (!editingAccountId) {
      wx.showToast({
        title: '参数错误',
        icon: 'none'
      });
      return;
    }

    let balance = 0;
    if (editAccountBalance) {
      balance = parseFloat(parseFloat(editAccountBalance).toFixed(2));
      if (isNaN(balance)) {
        wx.showToast({
          title: '请输入合法金额',
          icon: 'none'
        });
        return;
      }
    }

    this.setData({ isSubmitting: true });
    wx.showLoading({ title: '保存中...', mask: true });

    try {
      const db = wx.cloud.database();

      await db.collection('pc_account').doc(editingAccountId).update({
        data: {
          balance: balance,
          type: balance < 0 ? 'liability' : 'asset',
          icon: balance < 0 ? '💳' : '📦'
        }
      });

      wx.hideLoading();
      wx.showToast({
        title: '修改成功',
        icon: 'success'
      });

      this.closeEditModal();
      this.fetchAccounts();

    } catch (err) {
      console.error('修改余额失败:', err);
      wx.hideLoading();
      wx.showToast({
        title: '修改失败',
        icon: 'error'
      });
    } finally {
      this.setData({ isSubmitting: false });
    }
  },

  async fetchAccounts() {
    this.setData({ isLoading: true });
    wx.showNavigationBarLoading();

    const app = getApp();
    const userId = app.globalData.userInfo?.openid || app.globalData.userInfo?._openid || '';
    const db = wx.cloud.database();

    try {
      const res = await db.collection('pc_account')
        .where({ _openid: userId })
        .get();

      let accountList = [];
      const defaultAccounts = [
        { name: '微信零钱', balance: 0.00, icon: '💬', type: 'asset' },
        { name: '支付宝', balance: 0.00, icon: '💚', type: 'asset' },
        { name: '银行卡', balance: 0.00, icon: '🏦', type: 'asset' }
      ];

      if (res.data && res.data.length > 0) {
        const seenNames = new Set();
        accountList = res.data.filter(item => {
          if (seenNames.has(item.name)) {
            return false;
          }
          seenNames.add(item.name);
          return true;
        }).map(item => ({
          _id: item._id,
          id: item._id,
          name: item.name,
          balance: parseFloat(item.balance) || 0.00,
          icon: item.icon || '📦',
          type: item.type || 'asset'
        }));

        const existingNames = accountList.map(a => a.name);
        for (const account of defaultAccounts) {
          if (!existingNames.includes(account.name)) {
            await db.collection('pc_account').add({
              data: account
            });
          }
        }
      } else {
        accountList = defaultAccounts.map((acc, index) => ({
          _id: String(index + 1),
          id: String(index + 1),
          ...acc
        }));
        for (const account of defaultAccounts) {
          await db.collection('pc_account').add({
            data: account
          });
        }
      }

      let totalAssets = 0;
      let totalLiabilities = 0;

      accountList.forEach(item => {
        const balance = parseFloat(item.balance) || 0;
        if (balance >= 0) {
          totalAssets += balance;
        } else {
          totalLiabilities += Math.abs(balance);
        }
      });

      const netAssets = totalAssets - totalLiabilities;

      this.setData({
        accountList: accountList.map(item => ({
          ...item,
          balance: parseFloat(item.balance).toFixed(2)
        })),
        totalAssets: totalAssets.toFixed(2),
        totalLiabilities: totalLiabilities.toFixed(2),
        netAssets: netAssets.toFixed(2),
        isLoading: false
      });

    } catch (err) {
      console.error('获取账户数据失败:', err);
      const defaultAccounts = [
        { _id: '1', id: '1', name: '微信零钱', balance: '0.00', icon: '💬', type: 'asset' },
        { _id: '2', id: '2', name: '支付宝', balance: '0.00', icon: '💚', type: 'asset' },
        { _id: '3', id: '3', name: '银行卡', balance: '0.00', icon: '🏦', type: 'asset' }
      ];
      this.setData({
        accountList: defaultAccounts,
        totalAssets: '0.00',
        totalLiabilities: '0.00',
        netAssets: '0.00',
        isLoading: false
      });
    } finally {
      wx.hideNavigationBarLoading();
    }
  }
});