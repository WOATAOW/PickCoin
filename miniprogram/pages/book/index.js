Page({
  data: {
    type: 'expense',
    amount: '',
    category: '',
    categoryName: '',
    categoryIndex: 0,
    expenseCategories: ['餐饮外卖', '网购', '交通出行', '娱乐休闲', '学习教育', '其他支出'],
    expenseCategoryIds: ['food', 'shopping', 'transport', 'entertainment', 'study', 'other'],
    incomeCategories: ['生活费', '兼职', '红包', '其他收入'],
    incomeCategoryIds: ['allowance', 'parttime', 'redpacket', 'other'],
    accountList: [],
    selectedAccount: null,
    accountIndex: 0,
    accountName: '',
    isAA: false,
    peopleCount: 2,
    remark: '',
    selectedDate: '',
    displayDate: '今天',
    showKeyboard: false,
    isSubmitting: false
  },

  onLoad: function () {
    this.fetchAccounts();
  },

  onShow: function () {
    this.fetchAccounts();
  },

  async fetchAccounts() {
    const app = getApp();
    const userId = app.globalData.userInfo?.openid || app.globalData.userInfo?._openid || '';
    const db = wx.cloud.database();

    try {
      const res = await db.collection('pc_account')
        .where({ _openid: userId })
        .get();

      let accountList = [];
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
          name: item.name,
          balance: parseFloat(item.balance) || 0.00,
          icon: item.icon || '📦',
          type: item.type || 'asset'
        }));
      } else {
        const defaultAccounts = [
          { _id: '1', name: '微信零钱', balance: '0.00', icon: '💬', type: 'asset' },
          { _id: '2', name: '支付宝', balance: '0.00', icon: '💚', type: 'asset' },
          { _id: '3', name: '银行卡', balance: '0.00', icon: '🏦', type: 'asset' }
        ];
        accountList = defaultAccounts;
      }

      this.setData({
        accountList,
        selectedAccount: accountList[0] || null,
        accountIndex: 0,
        accountName: accountList[0]?.name || ''
      });

    } catch (err) {
      console.error('获取账户数据失败:', err);
      const defaultAccounts = [
        { _id: '1', name: '微信零钱', balance: '0.00', icon: '💬', type: 'asset' },
        { _id: '2', name: '支付宝', balance: '0.00', icon: '💚', type: 'asset' },
        { _id: '3', name: '银行卡', balance: '0.00', icon: '🏦', type: 'asset' }
      ];
      this.setData({
        accountList: defaultAccounts,
        selectedAccount: defaultAccounts[0],
        accountIndex: 0,
        accountName: defaultAccounts[0].name
      });
    }
  },

  onAccountChange(e) {
    const index = parseInt(e.detail.value);
    this.setData({
      accountIndex: index,
      selectedAccount: this.data.accountList[index],
      accountName: this.data.accountList[index].name
    });
  },

  openKeyboard() {
    this.setData({ showKeyboard: true });
  },

  closeKeyboard() {
    this.setData({ showKeyboard: false });
  },

  onTypeChange(e) {
    const type = e.currentTarget.dataset.type;
    const isExpense = type === 'expense';

    this.setData({
      type,
      categoryIndex: 0,
      category: isExpense ? this.data.expenseCategoryIds[0] : this.data.incomeCategoryIds[0],
      categoryName: isExpense ? this.data.expenseCategories[0] : this.data.incomeCategories[0]
    });
  },

  onCategoryChange(e) {
    const index = parseInt(e.detail.value);
    const isExpense = this.data.type === 'expense';

    this.setData({
      categoryIndex: index,
      category: isExpense ? this.data.expenseCategoryIds[index] : this.data.incomeCategoryIds[index],
      categoryName: isExpense ? this.data.expenseCategories[index] : this.data.incomeCategories[index]
    });
  },

  toggleAA() {
    this.setData({ isAA: !this.data.isAA });
  },

  increasePeople() {
    if (this.data.peopleCount < 20) {
      this.setData({ peopleCount: this.data.peopleCount + 1 });
    }
  },

  decreasePeople() {
    if (this.data.peopleCount > 2) {
      this.setData({ peopleCount: this.data.peopleCount - 1 });
    }
  },

  onDateChange(e) {
    const chooseDate = e.detail.value;
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${(today.getMonth() + 1).toString().padStart(2, '0')}-${today.getDate().toString().padStart(2, '0')}`;

    let showText = chooseDate;
    if (chooseDate === todayStr) {
      showText = '今天';
    } else {
      showText = chooseDate.substring(5);
    }

    this.setData({
      selectedDate: chooseDate,
      displayDate: showText
    });
  },

  onRemarkInput(e) {
    this.setData({ remark: e.detail.value });
  },

  onKeyPress(e) {
    const key = e.currentTarget.dataset.key;
    let amount = this.data.amount;

    if (key === '.') {
      if (!amount.includes('.')) {
        amount += key;
      }
    } else if (key === '00') {
      if (amount === '') {
        amount = '0';
      }
      amount += '00';
    } else {
      if (amount === '0') {
        amount = key;
      } else {
        amount += key;
      }
    }

    const parts = amount.split('.');
    if (parts.length === 2 && parts[1].length > 2) {
      amount = parts[0] + '.' + parts[1].slice(0, 2);
    }

    this.setData({ amount });
  },

  onKeyDelete() {
    let amount = this.data.amount;
    amount = amount.slice(0, -1);
    this.setData({ amount });
  },

  async onSubmit() {
    if (this.data.isSubmitting) {
      return;
    }

    const { amount, categoryName, selectedAccount } = this.data;

    if (!amount || amount === '.' || parseFloat(amount) <= 0) {
      wx.showToast({
        title: '请输入有效金额',
        icon: 'none'
      });
      return;
    }

    if (!categoryName) {
      wx.showToast({
        title: '请选择分类',
        icon: 'none'
      });
      return;
    }

    if (!selectedAccount) {
      wx.showToast({
        title: '请选择账户',
        icon: 'none'
      });
      return;
    }

    this.setData({ isSubmitting: true });
    wx.showLoading({ title: '记账中...', mask: true });

    try {
      const app = getApp();
      const userInfo = app.globalData.userInfo || {};
      const db = wx.cloud.database();
      const _ = db.command;

      const cleanAmount = parseFloat(parseFloat(amount).toFixed(2));
      const isExpense = this.data.type === 'expense';
      
      const isLiability = selectedAccount.type === 'liability' || selectedAccount.isLiability;
      let balanceChange;
      if (isLiability) {
        balanceChange = isExpense ? cleanAmount : -cleanAmount;
      } else {
        balanceChange = isExpense ? -cleanAmount : cleanAmount;
      }

      const billData = {
        type: isExpense ? '支出' : '收入',
        category: categoryName,
        categoryId: this.data.category,
        amount: cleanAmount,
        account: selectedAccount.name,
        accountId: selectedAccount._id,
        remark: this.data.remark,
        isAA: this.data.isAA,
        peopleCount: this.data.isAA ? this.data.peopleCount : 1,
        createTime: db.serverDate(),
        creator: {
          _openid: userInfo._openid || '',
          nickname: userInfo.nickname || '匿名用户',
          avatarUrl: userInfo.avatarUrl || ''
        }
      };

      if (this.data.selectedDate) {
        billData.date = this.data.selectedDate;
      }

      await db.collection('pc_bill').add({
        data: billData
      });

      await db.collection('pc_account').doc(selectedAccount._id).update({
        data: {
          balance: _.inc(balanceChange)
        }
      });

      wx.hideLoading();
      wx.showToast({
        title: '记账成功',
        icon: 'success'
      });

      this.resetForm();

      setTimeout(() => {
        wx.switchTab({
          url: '/pages/index/index'
        });
      }, 1500);

    } catch (err) {
      console.error("【记账失败】", err);
      wx.hideLoading();
      wx.showToast({
        title: '记账失败',
        icon: 'error'
      });
    } finally {
      this.setData({ isSubmitting: false });
    }
  },

  resetForm() {
    this.setData({
      amount: '',
      categoryIndex: 0,
      category: this.data.expenseCategoryIds[0],
      categoryName: this.data.expenseCategories[0],
      accountIndex: 0,
      selectedAccount: this.data.accountList[0] || null,
      accountName: this.data.accountList[0]?.name || '',
      isAA: false,
      peopleCount: 2,
      remark: '',
      selectedDate: '',
      displayDate: '今天',
      showKeyboard: false
    });
  }
});