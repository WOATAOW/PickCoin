Page({
  data: {
    selectedMonth: '',
    selectedCategory: '全部',
    categories: ['全部', '餐饮外卖', '网购', '交通出行', '娱乐休闲', '学习教育', '其他支出', '生活费', '兼职', '红包', '其他收入'],
    monthExpense: '0.00',
    monthIncome: '0.00',
    txList: [],
    isLoading: true,
    groupedBills: [],
    isEmpty: false,
    showEditModal: false,
    editingBill: null,
    newAmount: '',
    isSubmitting: false
  },

  onLoad() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const currentMonth = `${year}-${month}`;
    
    this.setData({ selectedMonth: currentMonth });
    this.fetchBillList();
  },

  onShow() {
    this.fetchBillList();
  },

  onMonthChange(e) {
    const selectedDate = e.detail.value;
    const year = selectedDate.substring(0, 4);
    const month = selectedDate.substring(5, 7);
    const selectedMonth = `${year}-${month}`;
    
    this.setData({ selectedMonth: selectedMonth });
    this.fetchBillList();
  },

  onCategoryChange(e) {
    const index = parseInt(e.detail.value);
    const category = this.data.categories[index];
    this.setData({ selectedCategory: category });
    this.fetchBillList();
  },

  openEditBillModal(e) {
    const bill = e.currentTarget.dataset.bill;
    this.setData({
      showEditModal: true,
      editingBill: bill,
      newAmount: bill.amountText || String(bill.amount)
    });
  },

  closeEditModal() {
    this.setData({
      showEditModal: false,
      editingBill: null,
      newAmount: ''
    });
  },

  onNewAmountInput(e) {
    this.setData({
      newAmount: e.detail.value
    });
  },

  async submitEditBill() {
    const { editingBill, newAmount, isSubmitting } = this.data;
    
    if (isSubmitting) {
      return;
    }

    if (!newAmount) {
      wx.showToast({
        title: '请输入金额',
        icon: 'none'
      });
      return;
    }

    const newAmt = parseFloat(parseFloat(newAmount).toFixed(2));
    if (isNaN(newAmt) || newAmt <= 0) {
      wx.showToast({
        title: '请输入合法金额',
        icon: 'none'
      });
      return;
    }

    const oldAmount = parseFloat(editingBill.amount) || 0;
    if (Math.abs(oldAmount - newAmt) < 0.001) {
      this.closeEditModal();
      return;
    }

    let accountDelta = 0;
    if (editingBill.type === '支出' || editingBill.type === 'expense') {
      accountDelta = oldAmount - newAmt;
    } else {
      accountDelta = newAmt - oldAmount;
    }

    this.setData({ isSubmitting: true });
    wx.showLoading({ title: '保存中...', mask: true });

    try {
      const db = wx.cloud.database();
      const _ = db.command;

      await db.collection('pc_bill').doc(editingBill._id).update({
        data: {
          amount: newAmt
        }
      });

      if (editingBill.accountId) {
        await db.collection('pc_account').doc(editingBill.accountId).update({
          data: {
            balance: _.inc(accountDelta)
          }
        });
      }

      wx.hideLoading();
      wx.showToast({
        title: '修改成功',
        icon: 'success'
      });

      this.closeEditModal();
      this.fetchBillList();

    } catch (err) {
      console.error('修改账单失败', err);
      wx.hideLoading();
      wx.showToast({
        title: '修改失败',
        icon: 'error'
      });
    } finally {
      this.setData({ isSubmitting: false });
    }
  },

  async fetchBillList() {
    const app = getApp();
    const userInfo = app.globalData.userInfo;
    
    if (!userInfo || !userInfo._openid) {
      this.setData({ 
        isLoading: false, 
        isEmpty: true,
        txList: [],
        groupedBills: [],
        monthExpense: '0.00',
        monthIncome: '0.00'
      });
      return;
    }

    wx.showLoading({ title: '加载中...' });

    try {
      const db = wx.cloud.database();
      const { selectedMonth, selectedCategory } = this.data;
      
      let query = db.collection('pc_bill').where({
        _openid: userInfo._openid
      });

      if (selectedCategory !== '全部') {
        query = query.where({
          category: selectedCategory
        });
      }

      const result = await query.orderBy('createTime', 'desc').limit(100).get();
      
      let rawData = result.data || [];
      
      if (selectedMonth) {
        rawData = rawData.filter(item => {
          const createTime = item.createTime;
          if (!createTime) return false;
          const dateStr = typeof createTime === 'object' 
            ? `${createTime.getFullYear()}-${String(createTime.getMonth() + 1).padStart(2, '0')}`
            : createTime.substring(0, 7);
          return dateStr === selectedMonth;
        });
      }

      const groupedData = this.groupByDate(rawData);
      
      let monthExpense = 0;
      let monthIncome = 0;
      rawData.forEach(item => {
        const amount = parseFloat(item.amount) || 0;
        if (item.type === '支出' || item.type === 'expense') {
          monthExpense += amount;
        } else {
          monthIncome += amount;
        }
      });

      this.setData({
        txList: rawData,
        groupedBills: groupedData,
        isLoading: false,
        isEmpty: rawData.length === 0,
        monthExpense: monthExpense.toFixed(2),
        monthIncome: monthIncome.toFixed(2)
      });

      wx.hideLoading();
    } catch (err) {
      console.error("【获取账单列表失败】", err);
      wx.hideLoading();
      this.setData({ 
        isLoading: false, 
        isEmpty: true,
        txList: [],
        groupedBills: []
      });
    }
  },

  groupByDate(data) {
    const groups = {};
    
    data.forEach(item => {
      const createTime = item.createTime;
      let dateStr = '';
      
      if (typeof createTime === 'object' && createTime.getFullYear) {
        dateStr = `${createTime.getFullYear()}-${String(createTime.getMonth() + 1).padStart(2, '0')}-${String(createTime.getDate()).padStart(2, '0')}`;
      } else if (typeof createTime === 'string') {
        dateStr = createTime.substring(0, 10);
      } else {
        dateStr = '未知日期';
      }

      if (!groups[dateStr]) {
        groups[dateStr] = {
          date: dateStr,
          dayTotalExpense: 0,
          dayTotalIncome: 0,
          records: []
        };
      }

      const amount = parseFloat(item.amount) || 0;
      if (item.type === '支出' || item.type === 'expense') {
        groups[dateStr].dayTotalExpense += amount;
      } else {
        groups[dateStr].dayTotalIncome += amount;
      }

      const processedItem = {
        ...item,
        amount: parseFloat(item.amount) || 0
      };
      groups[dateStr].records.push(processedItem);
    });

    const result = Object.values(groups).map(group => ({
      ...group,
      dayTotalExpense: parseFloat(group.dayTotalExpense.toFixed(2)),
      dayTotalIncome: parseFloat(group.dayTotalIncome.toFixed(2)),
      records: group.records.map(record => {
        const createTime = record.createTime;
        let time = '--:--';
        if (typeof createTime === 'object' && createTime.getHours) {
          const hours = String(createTime.getHours()).padStart(2, '0');
          const minutes = String(createTime.getMinutes()).padStart(2, '0');
          time = `${hours}:${minutes}`;
        } else if (typeof createTime === 'string') {
          const timeStr = createTime.substring(11, 16);
          if (timeStr && timeStr.length >= 5) {
            time = timeStr;
          }
        }
        return {
          ...record,
          amount: parseFloat(record.amount) || 0,
          amountText: (parseFloat(record.amount) || 0).toFixed(2),
          time: time
        };
      })
    }));

    result.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    return result;
  }
});